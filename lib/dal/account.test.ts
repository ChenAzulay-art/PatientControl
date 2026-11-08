// @vitest-environment node
import { randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
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
const { deleteClinicAccount } = await import("./account");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

async function clinicWithRecords(suffix: string): Promise<ClinicContext> {
  const ctx = await makeClinic(db, suffix);
  const now = new Date();
  await db.insert(schema.member).values({
    id: `member-${suffix}`,
    organizationId: ctx.clinic.id,
    userId: ctx.user.id,
    role: "owner",
    createdAt: now,
  });
  await db.insert(schema.session).values({
    id: `session-${suffix}`,
    token: `token-${suffix}`,
    userId: ctx.user.id,
    expiresAt: new Date(now.getTime() + 3_600_000),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.clinicSettings).values({ clinicId: ctx.clinic.id });
  const patientId = await createPatient(ctx, {
    fullName: `Patient ${suffix}`,
    phone: "+972501234567",
    email: null,
    dateOfBirth: null,
    nationalId: null,
    medicalBackground: "History",
    importantNotes: null,
    treatmentTypeIds: [],
    preferredLocale: "he",
    reminderConsent: false,
  });
  const appointment = await createAppointment(ctx, {
    patientId,
    treatmentTypeId: null,
    date: "2026-10-01",
    time: "09:00",
    durationMinutes: 45,
  });
  if (!appointment.ok) throw new Error(appointment.error);
  await saveFinalSessionNote(ctx, appointment.id, "Summary");
  return ctx;
}

async function rows(
  table:
    | typeof schema.patients
    | typeof schema.appointments
    | typeof schema.sessionNotes
    | typeof schema.sessionNoteVersions
    | typeof schema.clinicSettings,
  clinicId: string,
) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(table)
    .where(eq(table.clinicId, clinicId));
  return n;
}

describe("deleteClinicAccount", () => {
  it("deletes the clinic, its records and the user, and leaves other clinics alone", async () => {
    const gone = await clinicWithRecords("delete-me");
    const kept = await clinicWithRecords("keep-me");

    expect(await deleteClinicAccount(gone)).toEqual({ ok: true });

    for (const table of [
      schema.patients,
      schema.appointments,
      schema.sessionNotes,
      schema.sessionNoteVersions,
      schema.clinicSettings,
    ]) {
      expect(await rows(table, gone.clinic.id)).toBe(0);
      expect(await rows(table, kept.clinic.id)).toBe(1);
    }
    expect(
      await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, gone.user.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, gone.user.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, kept.clinic.id)),
    ).toHaveLength(1);

    // The audit log keeps a trace by id only.
    const [entry] = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "account.deleted"));
    expect(entry).toMatchObject({
      entity: "clinic",
      entityId: gone.clinic.id,
      clinicId: null,
      actorId: null,
    });
  });

  it("only lets the owner of a one-person clinic delete it", async () => {
    const ctx = await clinicWithRecords("shared");
    expect(
      await deleteClinicAccount({
        ...ctx,
        clinic: { ...ctx.clinic, role: "member" },
      }),
    ).toEqual({ ok: false, error: "notOwner" });

    await db.insert(schema.user).values({
      id: "user-colleague",
      name: "Colleague",
      email: "colleague@example.test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.member).values({
      id: "member-colleague",
      organizationId: ctx.clinic.id,
      userId: "user-colleague",
      role: "member",
      createdAt: new Date(),
    });
    expect(await deleteClinicAccount(ctx)).toEqual({
      ok: false,
      error: "otherMembers",
    });
    expect(await rows(schema.patients, ctx.clinic.id)).toBe(1);
  });
});
