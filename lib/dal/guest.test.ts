// @vitest-environment node
import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { isValidIsraeliId } from "@/lib/validation/israeli-id";
import { makeClinic } from "@/test/db";

vi.mock("@/db", async () => ({
  db: await (await import("@/test/db")).createTestDb(),
}));

const sendEmail = vi.fn(async () => ({}));
vi.mock("@/lib/email/index", () => ({ sendEmail }));

const { db } = await import("@/db");
const { cleanupGuests, createGuestClinic, deleteGuestData } =
  await import("./guest");
const { GUEST_LIMITS, GuestLimitError } = await import("./guest-limits");
const { createPatient } = await import("./patients");
const { exportClinicData } = await import("./export");
const { sendBookingEmail } = await import("@/lib/email/booking");
const { demoNationalId } = await import("@/lib/guest/demo-data");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

/** Tuesday 1 Dec 2026, 08:00 in Israel. */
const NOW = new Date("2026-12-01T06:00:00Z");

let guestNumber = 0;
async function newGuest(createdAt = NOW) {
  const id = `guest-${++guestNumber}`;
  await db.insert(schema.user).values({
    id,
    name: "Guest",
    email: `${id}@guest.invalid`,
    isAnonymous: true,
    createdAt,
    updatedAt: createdAt,
  });
  return id;
}

async function rows(
  table:
    | typeof schema.patients
    | typeof schema.appointments
    | typeof schema.sessionNotes
    | typeof schema.sessionNoteVersions,
  clinicId: string,
) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(table)
    .where(eq(table.clinicId, clinicId));
  return n;
}

describe("createGuestClinic", () => {
  let guestId: string;
  let ctx: Awaited<ReturnType<typeof createGuestClinic>>;

  beforeAll(async () => {
    guestId = await newGuest();
    ctx = await createGuestClinic(guestId, "he", NOW);
  });

  it("creates a demo clinic owned by the guest", async () => {
    expect(ctx.clinic).toMatchObject({ isDemo: true, role: "owner" });
    expect(ctx.clinic.slug).toMatch(/^demo-[0-9a-f]{8}$/);
    const [settings] = await db
      .select()
      .from(schema.clinicSettings)
      .where(eq(schema.clinicSettings.clinicId, ctx.clinic.id));
    expect(settings).toMatchObject({ isDemo: true, defaultLocale: "he" });
  });

  it("fills it with patients, appointments, summaries and a pending request", async () => {
    expect(await rows(schema.patients, ctx.clinic.id)).toBe(6);
    expect(await rows(schema.appointments, ctx.clinic.id)).toBe(10);
    expect(await rows(schema.sessionNotes, ctx.clinic.id)).toBe(3);
    // One summary was saved twice, so it has two versions.
    expect(await rows(schema.sessionNoteVersions, ctx.clinic.id)).toBe(4);

    const pending = await db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.clinicId, ctx.clinic.id),
          eq(schema.appointments.source, "online"),
          eq(schema.appointments.status, "scheduled"),
        ),
      );
    expect(pending).toHaveLength(1);

    const data = await exportClinicData(ctx, { kind: "clinic" });
    const noa = data!.patients.find((p) => p.fullName === "נועה לוי")!;
    expect(noa.importantNotes).toContain("לבנדר");
    expect(isValidIsraeliId(noa.nationalId!)).toBe(true);
  });

  it("keeps each guest's clinic separate", async () => {
    const other = await createGuestClinic(await newGuest(), "en", NOW);
    expect(other.clinic.id).not.toBe(ctx.clinic.id);
    const data = await exportClinicData(other, { kind: "clinic" });
    expect(data!.patients.map((p) => p.fullName)).toContain("Noa Levi");
    expect(JSON.stringify(data)).not.toContain("נועה");
  });
});

describe("guest limits", () => {
  it("stops a guest clinic at the patient limit", async () => {
    const ctx = await createGuestClinic(await newGuest(), "en", NOW);
    const existing = await rows(schema.patients, ctx.clinic.id);
    await db.insert(schema.patients).values(
      Array.from({ length: GUEST_LIMITS.patients - existing }, (_, i) => ({
        clinicId: ctx.clinic.id,
        fullName: `Filler ${i}`,
        phone: "+972500000000",
      })),
    );
    const input = {
      fullName: "One too many",
      phone: "+972500000999",
      email: null,
      dateOfBirth: null,
      nationalId: null,
      medicalBackground: null,
      importantNotes: null,
      treatmentTypeIds: [],
      preferredLocale: "en" as const,
      reminderConsent: false,
    };
    await expect(createPatient(ctx, input)).rejects.toBeInstanceOf(
      GuestLimitError,
    );
  });

  it("doesn't limit real clinics", async () => {
    const real = await makeClinic(db, "limits-real");
    await expect(
      createPatient(real, {
        fullName: "Real patient",
        phone: "+972500000998",
        email: null,
        dateOfBirth: null,
        nationalId: null,
        medicalBackground: null,
        importantNotes: null,
        treatmentTypeIds: [],
        preferredLocale: "he",
        reminderConsent: false,
      }),
    ).resolves.toBeTypeOf("string");
  });
});

describe("deleteGuestData", () => {
  it("deletes the guest, their clinic and their audit entries", async () => {
    const guestId = await newGuest();
    const ctx = await createGuestClinic(guestId, "he", NOW);

    expect(await deleteGuestData(guestId)).toBe(true);

    expect(await rows(schema.patients, ctx.clinic.id)).toBe(0);
    expect(await rows(schema.appointments, ctx.clinic.id)).toBe(0);
    expect(
      await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, ctx.clinic.id)),
    ).toEqual([]);
    expect(
      await db.select().from(schema.user).where(eq(schema.user.id, guestId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.actorId, guestId)),
    ).toEqual([]);
  });

  it("never deletes a real practitioner", async () => {
    const real = await makeClinic(db, "delete-real");
    expect(await deleteGuestData(real.user.id)).toBe(false);
    expect(
      await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, real.clinic.id)),
    ).toHaveLength(1);
  });
});

describe("cleanupGuests", () => {
  it("deletes only guests older than 3 hours, and leaves real clinics", async () => {
    const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
    const oldId = await newGuest(hoursAgo(4));
    const old = await createGuestClinic(oldId, "en", hoursAgo(4));
    const freshId = await newGuest(hoursAgo(1));
    const fresh = await createGuestClinic(freshId, "en", hoursAgo(1));
    const real = await makeClinic(db, "cleanup-real");

    const result = await cleanupGuests(NOW);
    expect(result.guests).toBeGreaterThanOrEqual(1);

    const remaining = async (id: string) =>
      (
        await db
          .select()
          .from(schema.organization)
          .where(eq(schema.organization.id, id))
      ).length;
    expect(await remaining(old.clinic.id)).toBe(0);
    expect(await remaining(fresh.clinic.id)).toBe(1);
    expect(await remaining(real.clinic.id)).toBe(1);
  });

  it("removes a demo clinic whose guest is already gone", async () => {
    const id = await newGuest(new Date(NOW.getTime() - 5 * 3_600_000));
    const ctx = await createGuestClinic(
      id,
      "en",
      new Date(NOW.getTime() - 5 * 3_600_000),
    );
    // The guest row disappears on its own (e.g. a failed sign-in).
    await db.delete(schema.user).where(eq(schema.user.id, id));

    await cleanupGuests(NOW);
    expect(
      await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, ctx.clinic.id)),
    ).toEqual([]);
  });
});

describe("emails from guest clinics", () => {
  it("are never sent", async () => {
    const ctx = await createGuestClinic(await newGuest(), "en", NOW);
    const real = await makeClinic(db, "email-real");
    await db.insert(schema.clinicSettings).values({ clinicId: real.clinic.id });
    const message = {
      kind: "confirmed" as const,
      to: "someone@example.test",
      locale: "en" as const,
      patientName: "Noa",
      clinicName: "Clinic",
      treatmentName: "Reflexology",
      startsAt: "2026-12-02T08:00:00.000Z",
      timezone: "Asia/Jerusalem",
    };

    await sendBookingEmail({ ...message, clinicId: ctx.clinic.id });
    expect(sendEmail).not.toHaveBeenCalled();

    await sendBookingEmail({ ...message, clinicId: real.clinic.id });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("demoNationalId", () => {
  it("makes valid, distinct ID numbers", () => {
    const ids = Array.from({ length: 6 }, (_, i) => demoNationalId(i));
    expect(new Set(ids).size).toBe(6);
    expect(ids.every(isValidIsraeliId)).toBe(true);
  });
});
