// @vitest-environment node
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import type { AppointmentInput } from "@/lib/validation/scheduling";
import { makeClinic } from "@/test/db";
import type { ClinicContext } from "./context";

vi.mock("@/db", async () => ({
  db: await (await import("@/test/db")).createTestDb(),
}));

const { db } = await import("@/db");
const {
  createAppointment,
  getAppointment,
  listAppointments,
  listPatientAppointments,
  moveAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
} = await import("./appointments");
const {
  addAvailabilityException,
  getWorkingHours,
  hoursForDate,
  listAvailabilityExceptions,
  removeAvailabilityException,
  setWorkingHours,
} = await import("./availability");
const { createPatient } = await import("./patients");
const { createTreatmentType } = await import("./treatment-types");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

let clinicA: ClinicContext;
let clinicB: ClinicContext;
let patientA: string;
let patientB: string;

async function addPatient(ctx: ClinicContext, fullName: string) {
  return createPatient(ctx, {
    fullName,
    phone: "+972501234567",
    email: null,
    dateOfBirth: null,
    nationalId: null,
    medicalBackground: null,
    importantNotes: null,
    treatmentTypeIds: [],
    preferredLocale: "he",
    reminderConsent: false,
  });
}

function booking(
  patientId: string,
  date: string,
  time: string,
  durationMinutes = 60,
): AppointmentInput {
  return { patientId, treatmentTypeId: null, date, time, durationMinutes };
}

beforeAll(async () => {
  clinicA = await makeClinic(db, "sched-a");
  clinicB = await makeClinic(db, "sched-b");
  patientA = await addPatient(clinicA, "Noa A");
  patientB = await addPatient(clinicB, "Omer B");
});

describe("booking", () => {
  it("stores the clinic's wall-clock time as the right instant", async () => {
    const result = await createAppointment(
      clinicA,
      booking(patientA, "2026-07-01", "10:00", 45),
    );
    if (!result.ok) throw new Error(result.error);
    const appointment = await getAppointment(clinicA, result.id);
    // Israel is UTC+3 in July.
    expect(appointment?.startsAt).toBe("2026-07-01T07:00:00.000Z");
    expect(appointment?.endsAt).toBe("2026-07-01T07:45:00.000Z");
    expect(appointment?.status).toBe("scheduled");
  });

  it("refuses an overlapping appointment but allows back-to-back ones", async () => {
    expect(
      (
        await createAppointment(
          clinicA,
          booking(patientA, "2026-08-03", "09:00"),
        )
      ).ok,
    ).toBe(true);
    expect(
      await createAppointment(
        clinicA,
        booking(patientA, "2026-08-03", "09:30"),
      ),
    ).toEqual({ ok: false, error: "overlap" });
    expect(
      (
        await createAppointment(
          clinicA,
          booking(patientA, "2026-08-03", "10:00"),
        )
      ).ok,
    ).toBe(true);
  });

  it("lets two clinics book the same time", async () => {
    expect(
      (
        await createAppointment(
          clinicA,
          booking(patientA, "2026-08-04", "09:00"),
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await createAppointment(
          clinicB,
          booking(patientB, "2026-08-04", "09:00"),
        )
      ).ok,
    ).toBe(true);
  });

  it("frees the time when an appointment is cancelled, and won't restore over a new one", async () => {
    const first = await createAppointment(
      clinicA,
      booking(patientA, "2026-08-05", "11:00"),
    );
    if (!first.ok) throw new Error(first.error);
    await setAppointmentStatus(clinicA, first.id, "cancelled");

    const second = await createAppointment(
      clinicA,
      booking(patientA, "2026-08-05", "11:00"),
    );
    expect(second.ok).toBe(true);
    expect(await setAppointmentStatus(clinicA, first.id, "scheduled")).toEqual({
      ok: false,
      error: "overlap",
    });
  });

  it("moves and reschedules, refusing overlaps", async () => {
    const a = await createAppointment(
      clinicA,
      booking(patientA, "2026-08-06", "09:00"),
    );
    const b = await createAppointment(
      clinicA,
      booking(patientA, "2026-08-06", "12:00"),
    );
    if (!a.ok || !b.ok) throw new Error("setup failed");

    const bView = await getAppointment(clinicA, b.id);
    expect(
      await moveAppointment(
        clinicA,
        a.id,
        new Date(bView!.startsAt),
        new Date(bView!.endsAt),
      ),
    ).toEqual({ ok: false, error: "overlap" });

    expect(
      await rescheduleAppointment(
        clinicA,
        a.id,
        booking(patientA, "2026-08-06", "14:00", 30),
      ),
    ).toEqual({ ok: true });
    const moved = await getAppointment(clinicA, a.id);
    expect(moved?.startsAt).toBe("2026-08-06T11:00:00.000Z");
    expect(moved?.endsAt).toBe("2026-08-06T11:30:00.000Z");
  });

  it("drops a treatment type from another clinic", async () => {
    const foreign = await createTreatmentType(clinicB, "Foreign massage");
    if (!foreign.ok) throw new Error("setup failed");
    const result = await createAppointment(clinicA, {
      ...booking(patientA, "2026-08-07", "09:00"),
      treatmentTypeId: foreign.id,
    });
    if (!result.ok) throw new Error(result.error);
    expect(
      (await getAppointment(clinicA, result.id))?.treatmentTypeId,
    ).toBeNull();
  });
});

describe("clinic isolation", () => {
  it("can't book another clinic's patient", async () => {
    expect(
      await createAppointment(
        clinicA,
        booking(patientB, "2026-09-01", "09:00"),
      ),
    ).toEqual({ ok: false, error: "patientNotFound" });
  });

  it("can't see, move or cancel another clinic's appointment", async () => {
    const theirs = await createAppointment(
      clinicB,
      booking(patientB, "2026-09-02", "09:00"),
    );
    if (!theirs.ok) throw new Error("setup failed");

    expect(await getAppointment(clinicA, theirs.id)).toBeNull();
    const listed = await listAppointments(clinicA, {
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-03T00:00:00Z"),
    });
    expect(listed.some((a) => a.id === theirs.id)).toBe(false);
    expect(
      await moveAppointment(
        clinicA,
        theirs.id,
        new Date("2026-09-02T10:00:00Z"),
        new Date("2026-09-02T11:00:00Z"),
      ),
    ).toEqual({ ok: false, error: "notFound" });
    expect(await setAppointmentStatus(clinicA, theirs.id, "cancelled")).toEqual(
      { ok: false, error: "notFound" },
    );
    expect((await getAppointment(clinicB, theirs.id))?.status).toBe(
      "scheduled",
    );
  });
});

describe("listing", () => {
  it("lists a range, hiding cancelled ones unless asked", async () => {
    const kept = await createAppointment(
      clinicA,
      booking(patientA, "2026-10-12", "09:00"),
    );
    const dropped = await createAppointment(
      clinicA,
      booking(patientA, "2026-10-12", "11:00"),
    );
    if (!kept.ok || !dropped.ok) throw new Error("setup failed");
    await setAppointmentStatus(clinicA, dropped.id, "cancelled");

    const range = {
      from: new Date("2026-10-12T00:00:00Z"),
      to: new Date("2026-10-13T00:00:00Z"),
    };
    expect((await listAppointments(clinicA, range)).map((a) => a.id)).toEqual([
      kept.id,
    ]);
    expect(
      (await listAppointments(clinicA, { ...range, includeCancelled: true }))
        .length,
    ).toBe(2);
  });

  it("refuses very long ranges", async () => {
    expect(
      await listAppointments(clinicA, {
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2026-12-31T00:00:00Z"),
      }),
    ).toEqual([]);
  });

  it("splits a patient's appointments into upcoming and past", async () => {
    const patient = await addPatient(clinicA, "Timeline");
    await createAppointment(clinicA, booking(patient, "2026-02-01", "09:00"));
    await createAppointment(clinicA, booking(patient, "2026-12-01", "09:00"));
    const { upcoming, past } = await listPatientAppointments(
      clinicA,
      patient,
      new Date("2026-06-01T00:00:00Z"),
    );
    expect(upcoming.map((a) => a.startsAt.slice(0, 10))).toEqual([
      "2026-12-01",
    ]);
    expect(past.map((a) => a.startsAt.slice(0, 10))).toEqual(["2026-02-01"]);
  });

  it("records bookings and changes in the audit log", async () => {
    const result = await createAppointment(
      clinicA,
      booking(patientA, "2026-10-20", "09:00"),
    );
    if (!result.ok) throw new Error("setup failed");
    await setAppointmentStatus(clinicA, result.id, "completed");
    const entries = await db
      .select({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, result.id));
    expect(entries.map((e) => e.action)).toEqual([
      "appointment.created",
      "appointment.completed",
    ]);
  });
});

describe("working hours and exceptions", () => {
  it("saves weekly hours per clinic", async () => {
    await setWorkingHours(clinicA, [
      [
        { start: "09:00", end: "13:00" },
        { start: "16:00", end: "19:00" },
      ],
      [{ start: "09:00", end: "17:00" }],
      [],
      [],
      [],
      [],
      [],
    ]);
    const hours = await getWorkingHours(clinicA);
    expect(hours[0]).toEqual([
      { start: "09:00", end: "13:00" },
      { start: "16:00", end: "19:00" },
    ]);
    expect(hours[2]).toEqual([]);
    expect((await getWorkingHours(clinicB)).flat()).toEqual([]);
  });

  it("uses an exception instead of the weekly hours on that date", async () => {
    await addAvailabilityException(clinicA, {
      date: "2026-12-06",
      start: null,
      end: null,
    });
    await addAvailabilityException(clinicA, {
      date: "2026-12-07",
      start: "10:00",
      end: "12:00",
    });
    const weekly = await getWorkingHours(clinicA);
    const exceptions = await listAvailabilityExceptions(clinicA, {
      from: "2026-12-01",
    });
    expect(hoursForDate(weekly, exceptions, "2026-12-06", 0)).toEqual([]);
    expect(hoursForDate(weekly, exceptions, "2026-12-07", 1)).toEqual([
      { start: "10:00", end: "12:00" },
    ]);
    expect(hoursForDate(weekly, exceptions, "2026-12-13", 0)).toEqual(
      weekly[0],
    );

    // Another clinic can't remove it.
    const id = exceptions[0].id;
    expect(await removeAvailabilityException(clinicB, id)).toBe(false);
    expect(await removeAvailabilityException(clinicA, id)).toBe(true);
  });
});
