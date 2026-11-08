// @vitest-environment node
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { makeClinic } from "@/test/db";
import type { ClinicContext } from "@/lib/dal/context";

vi.mock("@/db", async () => ({
  db: await (await import("@/test/db")).createTestDb(),
}));

const { db } = await import("@/db");
const { createPatient } = await import("@/lib/dal/patients");
const { createAppointment, setAppointmentStatus, moveAppointment } =
  await import("@/lib/dal/appointments");
const { updateReminderSettings, listRecentReminders } =
  await import("@/lib/dal/reminders");
const { getAppointmentByCancelToken } =
  await import("@/lib/dal/public-booking");
const { runReminders } = await import("./run");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const ORIGIN = "https://clinic.example.test";
/** Tuesday 1 Dec 2026, 07:00 in Israel. */
const NOW = new Date("2026-12-01T05:00:00Z");
const minutesLater = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);

let send: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  send = vi.fn(async () => ({ id: "msg-1" }));
  // Each run looks at every clinic, so start every test without appointments.
  await db.delete(schema.appointments);
});

const run = (now = NOW) =>
  runReminders({ origin: ORIGIN, now, send: send as never });

async function clinic(suffix: string): Promise<ClinicContext> {
  const ctx = await makeClinic(db, suffix);
  await db.insert(schema.clinicSettings).values({ clinicId: ctx.clinic.id });
  return ctx;
}

let phone = 0;
async function patient(
  ctx: ClinicContext,
  {
    consent = true,
    email = `p${++phone}@example.test` as string | null,
    locale = "he",
  } = {},
) {
  return createPatient(ctx, {
    fullName: `Patient ${phone}`,
    phone: `+97252${String(++phone).padStart(7, "0")}`,
    email,
    dateOfBirth: null,
    nationalId: null,
    medicalBackground: "Private history",
    importantNotes: null,
    treatmentTypeIds: [],
    preferredLocale: locale as "he" | "en",
    reminderConsent: consent,
  });
}

/** An appointment on 2 Dec 2026 at `time` (Israel), booked well in advance. */
async function book(ctx: ClinicContext, patientId: string, time: string) {
  const result = await createAppointment(ctx, {
    patientId,
    treatmentTypeId: null,
    date: "2026-12-02",
    time,
    durationMinutes: 45,
  });
  if (!result.ok) throw new Error(result.error);
  await db
    .update(schema.appointments)
    .set({ createdAt: new Date("2026-11-01T00:00:00Z") })
    .where(eq(schema.appointments.id, result.id));
  return result.id;
}

async function notificationsFor(appointmentId: string) {
  return db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.appointmentId, appointmentId));
}

describe("runReminders", () => {
  it("emails patients who agreed, 24 hours ahead, once", async () => {
    const ctx = await clinic("due");
    const yes = await patient(ctx, { locale: "en" });
    const noConsent = await patient(ctx, { consent: false });
    const noEmail = await patient(ctx, { email: null });
    // 06:00 tomorrow is 23 hours away; 09:00 is 26 hours away.
    const due = await book(ctx, yes, "06:00");
    await book(ctx, noConsent, "07:00");
    await book(ctx, noEmail, "08:00");
    const later = await book(ctx, yes, "09:00");

    expect(await run()).toEqual({ sent: 1, retrying: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "p1@example.test",
      locale: "en",
      clinicName: "Clinic due",
      treatmentName: null,
      startsAt: "2026-12-02T04:00:00.000Z",
      timezone: "Asia/Jerusalem",
      cancelUrl: null,
    });
    // Nothing from the patient's records goes into the email.
    expect(JSON.stringify(send.mock.calls[0][0])).not.toContain("Private");

    const [log] = await notificationsFor(due);
    expect(log).toMatchObject({
      status: "sent",
      attempts: 1,
      providerMessageId: "msg-1",
    });

    // The next run doesn't send it again.
    expect(await run(minutesLater(15))).toEqual({
      sent: 0,
      retrying: 0,
      failed: 0,
    });
    // 09:00 comes due three hours later.
    expect(await run(minutesLater(180))).toMatchObject({ sent: 1 });
    expect(await notificationsFor(later)).toHaveLength(1);
  });

  it("skips cancelled and past appointments, unapproved online requests, and late bookings", async () => {
    const ctx = await clinic("skips");
    const id = await patient(ctx);
    const cancelled = await book(ctx, id, "06:00");
    await setAppointmentStatus(ctx, cancelled, "cancelled");
    const pending = await book(ctx, id, "07:00");
    await db
      .update(schema.appointments)
      .set({ source: "online", status: "scheduled" })
      .where(eq(schema.appointments.id, pending));
    // Booked an hour ago for tomorrow morning: inside the 24 hours already.
    const late = await book(ctx, id, "08:00");
    await db
      .update(schema.appointments)
      .set({ createdAt: minutesLater(-60) })
      .where(eq(schema.appointments.id, late));

    expect(await run()).toMatchObject({ sent: 0 });
    // After the appointments have passed, still nothing.
    expect(await run(minutesLater(60 * 30))).toMatchObject({ sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("follows the clinic's settings", async () => {
    const ctx = await clinic("settings");
    const id = await patient(ctx);
    await book(ctx, id, "06:00");
    await updateReminderSettings(ctx, { enabled: false, leadMinutes: 1440 });
    expect(await run()).toMatchObject({ sent: 0 });

    // Two hours before: nothing at 07:00 the day before, sent at 04:00 on the day.
    await updateReminderSettings(ctx, { enabled: true, leadMinutes: 120 });
    expect(await run()).toMatchObject({ sent: 0 });
    expect(await run(minutesLater(21 * 60))).toMatchObject({ sent: 1 });
  });

  it("includes a working cancel link for online bookings", async () => {
    const ctx = await clinic("online");
    const id = await patient(ctx);
    const appointment = await book(ctx, id, "06:00");
    await db
      .update(schema.appointments)
      .set({ source: "online", status: "confirmed" })
      .where(eq(schema.appointments.id, appointment));

    await run();
    const url = new URL(send.mock.calls[0][0].cancelUrl);
    expect(url.origin + url.pathname).toBe(`${ORIGIN}/he/book/cancel`);
    expect(
      await getAppointmentByCancelToken(url.searchParams.get("token")!, NOW),
    ).toMatchObject({ canCancel: true });
  });

  it("reminds again when an appointment moves to a new time", async () => {
    const ctx = await clinic("moved");
    const id = await patient(ctx);
    const appointment = await book(ctx, id, "06:00");
    await run();
    await moveAppointment(
      ctx,
      appointment,
      new Date("2026-12-02T05:00:00Z"),
      new Date("2026-12-02T05:45:00Z"),
    );
    expect(await run(minutesLater(15))).toMatchObject({ sent: 1 });
    expect(await notificationsFor(appointment)).toHaveLength(2);
  });

  it("retries a failed send after 15 minutes and an hour, then gives up", async () => {
    const ctx = await clinic("retry");
    const id = await patient(ctx);
    const appointment = await book(ctx, id, "06:00");
    send.mockRejectedValue(new Error("provider down"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await run()).toEqual({ sent: 0, retrying: 1, failed: 0 });
    let [log] = await notificationsFor(appointment);
    expect(log).toMatchObject({
      status: "retry",
      attempts: 1,
      errorCode: "send_failed",
      nextAttemptAt: minutesLater(15),
    });

    // Not before the retry time.
    expect(await run(minutesLater(10))).toMatchObject({ retrying: 0 });
    expect(await run(minutesLater(15))).toMatchObject({ retrying: 1 });
    [log] = await notificationsFor(appointment);
    expect(log).toMatchObject({ attempts: 2, nextAttemptAt: minutesLater(75) });

    expect(await run(minutesLater(75))).toEqual({
      sent: 0,
      retrying: 0,
      failed: 1,
    });
    [log] = await notificationsFor(appointment);
    expect(log).toMatchObject({ status: "failed", attempts: 3 });
    expect(send).toHaveBeenCalledTimes(3);

    // The error log names the attempt, never the patient.
    expect(String(errors.mock.calls[0][0])).not.toContain("@");
    errors.mockRestore();
  });

  it("sends on a retry once the provider is back", async () => {
    const ctx = await clinic("recover");
    const id = await patient(ctx);
    const appointment = await book(ctx, id, "06:00");
    send.mockRejectedValueOnce(new Error("provider down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    await run();
    expect(await run(minutesLater(15))).toMatchObject({ sent: 1 });
    const [log] = await notificationsFor(appointment);
    expect(log).toMatchObject({ status: "sent", attempts: 2, errorCode: null });
  });

  it("stops retrying when the appointment is cancelled", async () => {
    const ctx = await clinic("stop");
    const id = await patient(ctx);
    const appointment = await book(ctx, id, "06:00");
    send.mockRejectedValueOnce(new Error("provider down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    await run();
    await setAppointmentStatus(ctx, appointment, "cancelled");

    expect(await run(minutesLater(15))).toMatchObject({ sent: 0 });
    const [log] = await notificationsFor(appointment);
    expect(log).toMatchObject({ status: "failed", errorCode: "not_due" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("picks up a send that never finished", async () => {
    const ctx = await clinic("stale");
    const id = await patient(ctx);
    const appointment = await book(ctx, id, "06:00");
    await db.insert(schema.notifications).values({
      clinicId: ctx.clinic.id,
      appointmentId: appointment,
      appointmentStartsAt: new Date("2026-12-02T04:00:00Z"),
      status: "sending",
      attempts: 1,
      lastAttemptAt: minutesLater(-30),
    });
    expect(await run()).toMatchObject({ sent: 1 });
    const [log] = await notificationsFor(appointment);
    expect(log).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("sends each reminder once when two runs overlap", async () => {
    const ctx = await clinic("overlap");
    const id = await patient(ctx);
    await book(ctx, id, "06:00");
    await book(ctx, id, "07:00");
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.sent + b.sent).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("reminder log", () => {
  it("lists only the clinic's own reminders", async () => {
    const mine = await clinic("log-mine");
    const other = await clinic("log-other");
    await book(mine, await patient(mine), "06:00");
    await book(other, await patient(other), "07:00");
    await run();

    const log = await listRecentReminders(mine);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      status: "sent",
      appointmentStartsAt: "2026-12-02T04:00:00.000Z",
    });
  });
});
