// @vitest-environment node
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { makeClinic } from "@/test/db";
import type { ClinicContext } from "./context";

vi.mock("@/db", async () => ({
  db: await (await import("@/test/db")).createTestDb(),
}));

const { db } = await import("@/db");
const { createPatient } = await import("./patients");
const { createAppointment } = await import("./appointments");
const { saveFinalSessionNote } = await import("./session-notes");
const { exportClinicData } = await import("./export");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

let mine: ClinicContext;
let other: ClinicContext;
let noa: string;
let dan: string;

async function patient(ctx: ClinicContext, fullName: string, phone: string) {
  return createPatient(ctx, {
    fullName,
    phone,
    email: null,
    dateOfBirth: "1990-05-01",
    nationalId: "000000018",
    medicalBackground: `${fullName} background`,
    importantNotes: null,
    treatmentTypeIds: [],
    preferredLocale: "he",
    reminderConsent: true,
  });
}

async function session(ctx: ClinicContext, patientId: string, time: string) {
  const result = await createAppointment(ctx, {
    patientId,
    treatmentTypeId: null,
    date: "2026-10-01",
    time,
    durationMinutes: 45,
  });
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

beforeAll(async () => {
  mine = await makeClinic(db, "export-mine");
  other = await makeClinic(db, "export-other");
  await db.insert(schema.clinicSettings).values({ clinicId: mine.clinic.id });
  noa = await patient(mine, "Noa", "+972501110001");
  dan = await patient(mine, "Dan", "+972501110002");
  await patient(other, "Someone else", "+972501110003");

  const first = await session(mine, noa, "09:00");
  await saveFinalSessionNote(mine, first, "First version");
  await saveFinalSessionNote(mine, first, "Corrected version");
  await session(mine, dan, "11:00");
});

describe("exportClinicData", () => {
  it("exports the whole clinic, decrypted, and nothing from other clinics", async () => {
    const data = await exportClinicData(mine, { kind: "clinic" });
    expect(data).toMatchObject({
      format: "patient-control-export",
      version: 1,
      scope: "clinic",
      clinic: { slug: "clinic-export-mine" },
      settings: { booking: { remindersEnabled: true } },
    });
    expect(data!.patients.map((p) => p.fullName)).toEqual(["Dan", "Noa"]);

    const exportedNoa = data!.patients.find((p) => p.id === noa)!;
    expect(exportedNoa).toMatchObject({
      nationalId: "000000018",
      medicalBackground: "Noa background",
      dateOfBirth: "1990-05-01",
    });
    expect(exportedNoa.appointments).toHaveLength(1);
    expect(exportedNoa.appointments[0].summary).toMatchObject({
      status: "final",
      text: "Corrected version",
    });
    expect(
      exportedNoa.appointments[0].summary!.versions.map((v) => v.text),
    ).toEqual(["First version", "Corrected version"]);

    expect(JSON.stringify(data)).not.toContain("Someone else");
    // No ciphertext leaks into the file.
    expect(JSON.stringify(data)).not.toContain("v1:");
  });

  it("exports one patient", async () => {
    const data = await exportClinicData(mine, { kind: "patient", id: dan });
    expect(data!.scope).toBe("patient");
    expect(data!.settings).toBeUndefined();
    expect(data!.patients.map((p) => p.fullName)).toEqual(["Dan"]);
    expect(data!.patients[0].appointments[0].summary).toBeNull();
  });

  it("refuses another clinic's patient", async () => {
    expect(
      await exportClinicData(other, { kind: "patient", id: noa }),
    ).toBeNull();
    expect(
      await exportClinicData(mine, { kind: "patient", id: "not-a-uuid" }),
    ).toBeNull();
  });

  it("records each export in the audit log", async () => {
    const entries = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.clinicId, mine.clinic.id),
          eq(schema.auditLog.action, "patient.exported"),
        ),
      );
    expect(entries).toEqual([
      expect.objectContaining({ entity: "patient", entityId: dan }),
    ]);
  });
});
