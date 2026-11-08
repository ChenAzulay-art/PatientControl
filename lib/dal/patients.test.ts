// @vitest-environment node
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import type { PatientInput } from "@/lib/validation/patient";
import { makeClinic as makeTestClinic } from "@/test/db";
import type { ClinicContext } from "./context";

// Run the real data access code against an in-memory Postgres.
vi.mock("@/db", async () => ({
  db: await (await import("@/test/db")).createTestDb(),
}));

const { db } = await import("@/db");
const {
  createPatient,
  findPatientsByNationalId,
  getPatient,
  listPatients,
  setPatientArchived,
  updatePatient,
} = await import("./patients");
const { createTreatmentType, listTreatmentTypes, setTreatmentTypeActive } =
  await import("./treatment-types");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const makeClinic = (suffix: string) => makeTestClinic(db, suffix);

function input(overrides: Partial<PatientInput> = {}): PatientInput {
  return {
    fullName: "Dana Cohen",
    phone: "+972501234567",
    email: "dana@example.test",
    dateOfBirth: "1985-03-14",
    nationalId: "123456782",
    medicalBackground: "Knee surgery in 2019",
    importantNotes: "Allergic to lavender oil",
    treatmentTypeIds: [],
    preferredLocale: "he",
    reminderConsent: true,
    ...overrides,
  };
}

let clinicA: ClinicContext;
let clinicB: ClinicContext;

beforeAll(async () => {
  clinicA = await makeClinic("a");
  clinicB = await makeClinic("b");
});

describe("patients", () => {
  it("creates a patient and reads it back decrypted", async () => {
    const id = await createPatient(clinicA, input());
    const patient = await getPatient(clinicA, id);
    expect(patient).toMatchObject({
      fullName: "Dana Cohen",
      nationalId: "123456782",
      medicalBackground: "Knee surgery in 2019",
      importantNotes: "Allergic to lavender oil",
    });
  });

  it("stores sensitive fields encrypted", async () => {
    const id = await createPatient(clinicA, input({ fullName: "Encrypted" }));
    const [row] = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, id));
    const stored = JSON.stringify(row);
    expect(stored).not.toContain("123456782");
    expect(stored).not.toContain("Knee surgery");
    expect(stored).not.toContain("lavender");
    expect(row.nationalIdEncrypted).toMatch(/^v1:/);
  });

  it("never shows one clinic's patient to another clinic", async () => {
    const id = await createPatient(clinicA, input({ fullName: "Private A" }));

    expect(await getPatient(clinicB, id)).toBeNull();
    expect(
      (await listPatients(clinicB)).some((p) => p.fullName === "Private A"),
    ).toBe(false);
    expect((await listPatients(clinicB, { query: "Private" })).length).toBe(0);
  });

  it("never lets another clinic change or archive a patient", async () => {
    const id = await createPatient(clinicA, input({ fullName: "Locked A" }));

    expect(
      await updatePatient(clinicB, id, input({ fullName: "Hijacked" })),
    ).toBe(false);
    expect(await setPatientArchived(clinicB, id, true)).toBe(false);

    const patient = await getPatient(clinicA, id);
    expect(patient?.fullName).toBe("Locked A");
    expect(patient?.archivedAt).toBeNull();
  });

  it("finds duplicate ID numbers only within the same clinic", async () => {
    const first = await createPatient(
      clinicA,
      input({ fullName: "Duplicate One", nationalId: "000000018" }),
    );
    expect(await findPatientsByNationalId(clinicA, "000000018")).toEqual([
      { id: first, fullName: "Duplicate One" },
    ]);
    expect(await findPatientsByNationalId(clinicA, "000000018", first)).toEqual(
      [],
    );
    expect(await findPatientsByNationalId(clinicB, "000000018")).toEqual([]);
  });

  it("searches by name, phone and email", async () => {
    await createPatient(
      clinicB,
      input({
        fullName: "יוסי לוי",
        phone: "+972549876543",
        email: "yossi@example.test",
      }),
    );
    const names = async (query: string) =>
      (await listPatients(clinicB, { query })).map((p) => p.fullName);

    expect(await names("יוסי")).toEqual(["יוסי לוי"]);
    expect(await names("054-987")).toEqual(["יוסי לוי"]);
    expect(await names("YOSSI@")).toEqual(["יוסי לוי"]);
    expect(await names("%")).toEqual([]);
  });

  it("archives and restores", async () => {
    const id = await createPatient(
      clinicA,
      input({ fullName: "Archived Ari" }),
    );
    await setPatientArchived(clinicA, id, true);

    expect((await listPatients(clinicA)).some((p) => p.id === id)).toBe(false);
    expect(
      (await listPatients(clinicA, { archived: true })).some(
        (p) => p.id === id,
      ),
    ).toBe(true);

    await setPatientArchived(clinicA, id, false);
    expect((await listPatients(clinicA)).some((p) => p.id === id)).toBe(true);
  });

  it("records views and changes in the audit log", async () => {
    const id = await createPatient(clinicA, input({ fullName: "Audited" }));
    await getPatient(clinicA, id);
    const entries = await db
      .select({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, id));
    expect(entries.map((e) => e.action)).toEqual([
      "patient.created",
      "patient.viewed",
    ]);
  });

  it("rejects ids that aren't UUIDs without querying", async () => {
    expect(await getPatient(clinicA, "1 or 1=1")).toBeNull();
    expect(await setPatientArchived(clinicA, "../x", true)).toBe(false);
  });
});

describe("treatment types", () => {
  it("links only the clinic's own treatment types", async () => {
    const own = await createTreatmentType(clinicA, "Reflexology");
    const foreign = await createTreatmentType(clinicB, "Physiotherapy");
    if (!own.ok || !foreign.ok) throw new Error("setup failed");

    const id = await createPatient(
      clinicA,
      input({
        fullName: "Linked",
        treatmentTypeIds: [own.id, foreign.id],
      }),
    );
    const patient = await getPatient(clinicA, id);
    expect(patient?.treatmentTypes).toEqual([
      { id: own.id, name: "Reflexology" },
    ]);
  });

  it("rejects a duplicate name in the same clinic, ignoring case", async () => {
    expect((await createTreatmentType(clinicA, "Massage")).ok).toBe(true);
    expect(await createTreatmentType(clinicA, "massage")).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect((await createTreatmentType(clinicB, "Massage")).ok).toBe(true);
  });

  it("hides a type without removing it from patients", async () => {
    const type = await createTreatmentType(clinicA, "Cupping");
    if (!type.ok) throw new Error("setup failed");
    const id = await createPatient(
      clinicA,
      input({ fullName: "Cupping fan", treatmentTypeIds: [type.id] }),
    );

    expect(await setTreatmentTypeActive(clinicB, type.id, false)).toBe(false);
    expect(await setTreatmentTypeActive(clinicA, type.id, false)).toBe(true);

    const active = await listTreatmentTypes(clinicA);
    expect(active.some((t) => t.id === type.id)).toBe(false);
    expect((await getPatient(clinicA, id))?.treatmentTypes).toEqual([
      { id: type.id, name: "Cupping" },
    ]);
  });

  it("the database itself refuses a cross-clinic link", async () => {
    const foreign = await createTreatmentType(clinicB, "Shiatsu");
    if (!foreign.ok) throw new Error("setup failed");
    const id = await createPatient(clinicA, input({ fullName: "Guarded" }));

    await expect(
      db.insert(schema.patientTreatmentTypes).values({
        clinicId: clinicA.clinic.id,
        patientId: id,
        treatmentTypeId: foreign.id,
      }),
    ).rejects.toThrow();
  });
});
