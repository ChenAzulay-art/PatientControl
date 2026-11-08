// @vitest-environment node
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { makeClinic } from "@/test/db";
import type { ClinicContext } from "./context";

vi.mock("@/db", async () => ({
  db: await (await import("@/test/db")).createTestDb(),
}));

const { db } = await import("@/db");
const { createPatient, getPatient } = await import("./patients");
const { createTreatmentType, setTreatmentTypeActive } =
  await import("./treatment-types");
const { setWorkingHours } = await import("./availability");
const { updateBookingSettings } = await import("./booking-settings");
const { getAppointment, listPendingOnlineRequests } =
  await import("./appointments");
const {
  bookOnline,
  cancelByToken,
  getAppointmentByCancelToken,
  getAvailableSlots,
  getBookingClinic,
  rotateCancelToken,
} = await import("./public-booking");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

/** Tuesday 1 Dec 2026, 07:00 in Israel. */
const NOW = new Date("2026-12-01T05:00:00Z");
let counter = 0;

/** A clinic with booking open, 09:00–12:00 every day and one 60-minute bookable type. */
async function openClinic(
  suffix: string,
  { autoConfirm = true } = {},
): Promise<{ ctx: ClinicContext; typeId: string }> {
  const ctx = await makeClinic(db, suffix);
  await db.insert(schema.clinicSettings).values({ clinicId: ctx.clinic.id });
  await setWorkingHours(
    ctx,
    Array.from({ length: 7 }, () => [{ start: "09:00", end: "12:00" }]),
  );
  const type = await createTreatmentType(ctx, {
    name: "Reflexology",
    durationMinutes: 60,
    priceAgorot: 25000,
    color: "teal",
    bookableOnline: true,
  });
  if (!type.ok) throw new Error("setup failed");
  await updateBookingSettings(ctx, {
    enabled: true,
    autoConfirm,
    minNoticeMinutes: 0,
    windowDays: 7,
    intervalMinutes: 60,
  });
  return { ctx, typeId: type.id };
}

function details(
  overrides: Partial<{ phone: string; fullName: string; email: string }> = {},
) {
  counter += 1;
  return {
    fullName: "Noa Online",
    phone: `+97250000${String(counter).padStart(4, "0")}`,
    email: `noa${counter}@example.test`,
    reminderConsent: true,
    locale: "he" as const,
    ...overrides,
  };
}

const key = () => `client-${++counter}`;

describe("booking page", () => {
  it("is hidden until online booking is turned on", async () => {
    const ctx = await makeClinic(db, "closed");
    await db.insert(schema.clinicSettings).values({ clinicId: ctx.clinic.id });
    expect(await getBookingClinic("clinic-closed")).toBeNull();
  });

  it("shows only active, bookable treatment types", async () => {
    const { ctx } = await openClinic("types");
    await createTreatmentType(ctx, "Staff only");
    const hidden = await createTreatmentType(ctx, {
      name: "Hidden",
      durationMinutes: 30,
      priceAgorot: null,
      color: "blue",
      bookableOnline: true,
    });
    if (!hidden.ok) throw new Error("setup failed");
    await setTreatmentTypeActive(ctx, hidden.id, false);

    const clinic = await getBookingClinic("clinic-types");
    expect(clinic?.treatmentTypes.map((t) => t.name)).toEqual(["Reflexology"]);
    // Nothing about patients or appointments is part of the public data.
    expect(Object.keys(clinic!).sort()).toEqual(
      [
        "autoConfirm",
        "id",
        "intervalMinutes",
        "minNoticeMinutes",
        "name",
        "slug",
        "timezone",
        "treatmentTypes",
        "windowDays",
      ].sort(),
    );
  });
});

describe("booking", () => {
  it("books a free slot for a new patient and confirms it", async () => {
    const { ctx, typeId } = await openClinic("book");
    const clinic = (await getBookingClinic("clinic-book"))!;
    const slot = (await getAvailableSlots(clinic, typeId, NOW))[0].slots[0];

    const result = await bookOnline(
      clinic,
      { treatmentTypeId: typeId, startsAt: slot.startsAt, ...details() },
      { now: NOW, clientKey: key() },
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.status).toBe("confirmed");

    const appointment = await getAppointment(ctx, result.appointmentId);
    expect(appointment).toMatchObject({
      startsAt: slot.startsAt,
      status: "confirmed",
      source: "online",
      patientName: "Noa Online",
    });

    // The slot is gone for the next patient.
    const after = (await getAvailableSlots(clinic, typeId, NOW))
      .flatMap((day) => day.slots)
      .map((s) => s.startsAt);
    expect(after).not.toContain(slot.startsAt);
  });

  it("waits for approval when auto-confirm is off", async () => {
    const { ctx, typeId } = await openClinic("approve", { autoConfirm: false });
    const clinic = (await getBookingClinic("clinic-approve"))!;
    const slot = (await getAvailableSlots(clinic, typeId, NOW))[0].slots[0];
    const result = await bookOnline(
      clinic,
      { treatmentTypeId: typeId, startsAt: slot.startsAt, ...details() },
      { now: NOW, clientKey: key() },
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.status).toBe("scheduled");
    expect(
      (await listPendingOnlineRequests(ctx, NOW)).map((a) => a.id),
    ).toEqual([result.appointmentId]);
  });

  it("matches a returning patient by phone without changing their card", async () => {
    const { ctx, typeId } = await openClinic("returning");
    const patientId = await createPatient(ctx, {
      fullName: "Dana Original",
      phone: "+972521112233",
      email: null,
      dateOfBirth: null,
      nationalId: null,
      medicalBackground: null,
      importantNotes: "Allergic to lavender",
      treatmentTypeIds: [],
      preferredLocale: "en",
      reminderConsent: false,
    });
    const clinic = (await getBookingClinic("clinic-returning"))!;
    const slot = (await getAvailableSlots(clinic, typeId, NOW))[0].slots[0];
    const result = await bookOnline(
      clinic,
      {
        treatmentTypeId: typeId,
        startsAt: slot.startsAt,
        ...details({
          fullName: "Someone Else",
          phone: "+972521112233",
          email: "dana@example.test",
        }),
      },
      { now: NOW, clientKey: key() },
    );
    if (!result.ok) throw new Error(result.error);

    expect((await getAppointment(ctx, result.appointmentId))?.patientId).toBe(
      patientId,
    );
    const card = await getPatient(ctx, patientId);
    expect(card).toMatchObject({
      fullName: "Dana Original",
      email: "dana@example.test",
      importantNotes: "Allergic to lavender",
      preferredLocale: "en",
    });
  });

  it("refuses a time that isn't offered, and a type that isn't bookable", async () => {
    const { ctx, typeId } = await openClinic("refuse");
    const clinic = (await getBookingClinic("clinic-refuse"))!;
    expect(
      await bookOnline(
        clinic,
        {
          treatmentTypeId: typeId,
          // 03:00 is outside working hours.
          startsAt: "2026-12-02T01:00:00.000Z",
          ...details(),
        },
        { now: NOW, clientKey: key() },
      ),
    ).toEqual({ ok: false, error: "slotUnavailable" });

    const staffOnly = await createTreatmentType(ctx, "Staff only");
    if (!staffOnly.ok) throw new Error("setup failed");
    const slot = (await getAvailableSlots(clinic, typeId, NOW))[0].slots[0];
    expect(
      await bookOnline(
        clinic,
        {
          treatmentTypeId: staffOnly.id,
          startsAt: slot.startsAt,
          ...details(),
        },
        { now: NOW, clientKey: key() },
      ),
    ).toEqual({ ok: false, error: "notFound" });
  });

  it("gives the slot to only one of two patients booking it at once", async () => {
    const { typeId } = await openClinic("race");
    const clinic = (await getBookingClinic("clinic-race"))!;
    const slot = (await getAvailableSlots(clinic, typeId, NOW))[0].slots[0];
    const [a, b] = await Promise.all([
      bookOnline(
        clinic,
        { treatmentTypeId: typeId, startsAt: slot.startsAt, ...details() },
        { now: NOW, clientKey: key() },
      ),
      bookOnline(
        clinic,
        { treatmentTypeId: typeId, startsAt: slot.startsAt, ...details() },
        { now: NOW, clientKey: key() },
      ),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toEqual({
      ok: false,
      error: "slotUnavailable",
    });
  });

  it("limits bookings per phone number", async () => {
    const { typeId } = await openClinic("limits");
    const clinic = (await getBookingClinic("clinic-limits"))!;
    const free = (await getAvailableSlots(clinic, typeId, NOW)).flatMap(
      (day) => day.slots,
    );
    const phone = "+972549998877";
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await bookOnline(
          clinic,
          {
            treatmentTypeId: typeId,
            startsAt: free[i].startsAt,
            ...details({ phone }),
          },
          { now: NOW, clientKey: key() },
        ),
      );
    }
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3]).toEqual({ ok: false, error: "rateLimited" });
  });
});

describe("cancel link", () => {
  it("shows when and what, and cancels once", async () => {
    const { ctx, typeId } = await openClinic("cancel-link");
    const clinic = (await getBookingClinic("clinic-cancel-link"))!;
    const slot = (await getAvailableSlots(clinic, typeId, NOW))[0].slots[0];
    const booked = await bookOnline(
      clinic,
      { treatmentTypeId: typeId, startsAt: slot.startsAt, ...details() },
      { now: NOW, clientKey: key() },
    );
    if (!booked.ok) throw new Error(booked.error);

    const view = await getAppointmentByCancelToken(booked.cancelToken, NOW);
    expect(view).toMatchObject({
      clinicName: "Clinic cancel-link",
      treatmentName: "Reflexology",
      startsAt: slot.startsAt,
      canCancel: true,
    });
    // No patient details through the link.
    expect(JSON.stringify(view)).not.toContain("Noa");

    expect(await cancelByToken(booked.cancelToken, NOW)).toEqual({ ok: true });
    expect((await getAppointment(ctx, booked.appointmentId))?.status).toBe(
      "cancelled",
    );
    expect(await cancelByToken(booked.cancelToken, NOW)).toEqual({
      ok: false,
      error: "notCancellable",
    });
  });

  it("rejects unknown tokens and stores only a hash", async () => {
    expect(await getAppointmentByCancelToken("x".repeat(32))).toBeNull();
    expect(await cancelByToken("not a token")).toEqual({
      ok: false,
      error: "notFound",
    });

    const { ctx, typeId } = await openClinic("hash");
    const clinic = (await getBookingClinic("clinic-hash"))!;
    const slot = (await getAvailableSlots(clinic, typeId, NOW))[0].slots[0];
    const booked = await bookOnline(
      clinic,
      { treatmentTypeId: typeId, startsAt: slot.startsAt, ...details() },
      { now: NOW, clientKey: key() },
    );
    if (!booked.ok) throw new Error(booked.error);
    const [row] = await db
      .select({ hash: schema.appointments.cancelTokenHash })
      .from(schema.appointments)
      .where(eq(schema.appointments.id, booked.appointmentId));
    expect(row.hash).not.toBe(booked.cancelToken);

    // A new link (sent when the practitioner confirms) replaces the old one.
    const fresh = await rotateCancelToken(ctx.clinic.id, booked.appointmentId);
    expect(
      await getAppointmentByCancelToken(booked.cancelToken, NOW),
    ).toBeNull();
    expect(await getAppointmentByCancelToken(fresh, NOW)).not.toBeNull();
  });
});
