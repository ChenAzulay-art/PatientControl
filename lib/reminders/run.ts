import "server-only";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  clinicSettings,
  notifications,
  organization,
  patients,
  treatmentTypes,
} from "@/db/schema";
import { rotateCancelToken } from "@/lib/dal/public-booking";
import { sendReminderEmail } from "@/lib/email/reminder";
import { isLocale } from "@/lib/i18n/config";
import { REMINDER_LEAD_OPTIONS } from "@/lib/validation/reminders";

/** A reminder is tried at most this many times. */
export const MAX_ATTEMPTS = 3;
/** Minutes to wait before the second and third attempts. */
export const RETRY_DELAYS_MINUTES = [15, 60] as const;
/** A send that hasn't finished after this long is treated as failed. */
const STALE_SENDING_MINUTES = 10;
const BATCH_SIZE = 50;
const MAX_BATCHES = 10;
const MAX_LEAD_MINUTES = Math.max(...REMINDER_LEAD_OPTIONS);

export type ReminderRunResult = {
  sent: number;
  retrying: number;
  failed: number;
};

type Options = {
  /** The site's public origin, for cancel links. */
  origin: string;
  now?: Date;
  /** Replaced in tests. */
  send?: typeof sendReminderEmail;
};

const minutesFrom = (now: Date, minutes: number) =>
  new Date(now.getTime() + minutes * 60_000);

/**
 * The rules for when an appointment gets a reminder. Used on a query that
 * joins appointments with their clinic settings and patient.
 */
function dueNow(now: Date) {
  const at = sql`${now.toISOString()}::timestamptz`;
  const lead = sql`make_interval(mins => ${clinicSettings.reminderLeadMinutes})`;
  return and(
    eq(clinicSettings.remindersEnabled, true),
    inArray(appointments.status, ["scheduled", "confirmed"]),
    // Online requests still waiting for the practitioner's approval.
    sql`not (${appointments.source} = 'online' and ${appointments.status} = 'scheduled')`,
    sql`${appointments.startsAt} > ${at}`,
    // Bounds the search so it can use the starts_at index.
    sql`${appointments.startsAt} <= ${at} + make_interval(mins => ${MAX_LEAD_MINUTES})`,
    sql`${appointments.startsAt} <= ${at} + ${lead}`,
    // Booked after its reminder time: the patient has only just arranged it.
    sql`${appointments.createdAt} <= ${appointments.startsAt} - ${lead}`,
    eq(patients.reminderConsent, true),
    isNotNull(patients.email),
  );
}

const patientJoin = and(
  eq(patients.id, appointments.patientId),
  eq(patients.clinicId, appointments.clinicId),
);

/**
 * Sends the reminder emails that are due, and retries ones that failed.
 * Runs every 15 minutes from the scheduled job (app/api/cron/reminders).
 *
 * Every reminder is claimed by inserting its row in `notifications`
 * before sending, so two overlapping runs can't send the same one twice.
 * A failed send is tried again after 15 minutes and then after an hour;
 * after three failures it's marked failed. Nothing about the patient is
 * logged.
 */
export async function runReminders({
  origin,
  now = new Date(),
  send = sendReminderEmail,
}: Options): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { sent: 0, retrying: 0, failed: 0 };
  const tally = (outcome: keyof ReminderRunResult | null) => {
    if (outcome) result[outcome] += 1;
  };

  // Sends that never finished (e.g. the function was stopped) and are out of attempts.
  const stale = new Date(now.getTime() - STALE_SENDING_MINUTES * 60_000);
  await db
    .update(notifications)
    .set({ status: "failed", errorCode: "timeout", nextAttemptAt: null })
    .where(
      and(
        eq(notifications.status, "sending"),
        lt(notifications.lastAttemptAt, stale),
        gte(notifications.attempts, MAX_ATTEMPTS),
      ),
    );

  // 1. Retries that are due, and unfinished sends with attempts left.
  const retries = await db
    .select({
      id: notifications.id,
      status: notifications.status,
      attempts: notifications.attempts,
    })
    .from(notifications)
    .where(
      or(
        and(
          eq(notifications.status, "retry"),
          lte(notifications.nextAttemptAt, now),
        ),
        and(
          eq(notifications.status, "sending"),
          lt(notifications.lastAttemptAt, stale),
        ),
      ),
    )
    .orderBy(asc(notifications.nextAttemptAt))
    .limit(BATCH_SIZE * MAX_BATCHES);

  for (const retry of retries) {
    const [claimed] = await db
      .update(notifications)
      .set({
        status: "sending",
        attempts: retry.attempts + 1,
        lastAttemptAt: now,
        nextAttemptAt: null,
      })
      .where(
        and(
          eq(notifications.id, retry.id),
          eq(notifications.status, retry.status),
          eq(notifications.attempts, retry.attempts),
        ),
      )
      .returning();
    if (claimed) tally(await deliver(claimed, { origin, now, send }));
  }

  // 2. New reminders, oldest appointment first.
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const due = await db
      .select({
        appointmentId: appointments.id,
        clinicId: appointments.clinicId,
        startsAt: appointments.startsAt,
      })
      .from(appointments)
      .innerJoin(
        clinicSettings,
        eq(clinicSettings.clinicId, appointments.clinicId),
      )
      .innerJoin(patients, patientJoin)
      .where(
        and(
          dueNow(now),
          notExists(
            db
              .select({ id: notifications.id })
              .from(notifications)
              .where(
                and(
                  eq(notifications.appointmentId, appointments.id),
                  eq(notifications.kind, "reminder"),
                  eq(notifications.appointmentStartsAt, appointments.startsAt),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(appointments.startsAt))
      .limit(BATCH_SIZE);

    for (const appointment of due) {
      const [claimed] = await db
        .insert(notifications)
        .values({
          clinicId: appointment.clinicId,
          appointmentId: appointment.appointmentId,
          kind: "reminder",
          appointmentStartsAt: appointment.startsAt,
          status: "sending",
          attempts: 1,
          lastAttemptAt: now,
        })
        .onConflictDoNothing()
        .returning();
      if (claimed) tally(await deliver(claimed, { origin, now, send }));
    }
    if (due.length < BATCH_SIZE) break;
  }

  return result;
}

type ClaimedNotification = typeof notifications.$inferSelect;

/** Sends one claimed reminder and records the outcome. */
async function deliver(
  notification: ClaimedNotification,
  { origin, now, send }: Required<Options>,
): Promise<keyof ReminderRunResult | null> {
  const [details] = await db
    .select({
      source: appointments.source,
      startsAt: appointments.startsAt,
      patientName: patients.fullName,
      email: patients.email,
      locale: patients.preferredLocale,
      clinicName: organization.name,
      timezone: clinicSettings.timezone,
      treatmentName: treatmentTypes.name,
    })
    .from(appointments)
    .innerJoin(
      clinicSettings,
      eq(clinicSettings.clinicId, appointments.clinicId),
    )
    .innerJoin(patients, patientJoin)
    .innerJoin(organization, eq(organization.id, appointments.clinicId))
    .leftJoin(
      treatmentTypes,
      and(
        eq(treatmentTypes.id, appointments.treatmentTypeId),
        eq(treatmentTypes.clinicId, appointments.clinicId),
      ),
    )
    .where(
      and(
        eq(appointments.id, notification.appointmentId),
        eq(appointments.clinicId, notification.clinicId),
        eq(appointments.startsAt, notification.appointmentStartsAt),
        dueNow(now),
      ),
    )
    .limit(1);

  const finish = (values: Partial<ClaimedNotification>) =>
    db
      .update(notifications)
      .set(values)
      .where(eq(notifications.id, notification.id));

  // Cancelled, moved or no longer wanted since the last attempt.
  if (!details?.email) {
    await finish({ status: "failed", errorCode: "not_due" });
    return null;
  }

  try {
    const locale = isLocale(details.locale) ? details.locale : "he";
    const cancelUrl =
      details.source === "online"
        ? `${origin}/${locale}/book/cancel?token=${await rotateCancelToken(
            notification.clinicId,
            notification.appointmentId,
          )}`
        : null;
    const { id } = await send({
      to: details.email,
      locale,
      patientName: details.patientName,
      clinicName: details.clinicName,
      treatmentName: details.treatmentName,
      startsAt: details.startsAt.toISOString(),
      timezone: details.timezone,
      cancelUrl,
    });
    await finish({
      status: "sent",
      sentAt: now,
      providerMessageId: id ?? null,
      errorCode: null,
    });
    return "sent";
  } catch {
    console.error(
      `[reminders] send failed (notification ${notification.id}, attempt ${notification.attempts})`,
    );
    const delay = RETRY_DELAYS_MINUTES[notification.attempts - 1];
    if (notification.attempts >= MAX_ATTEMPTS || delay === undefined) {
      await finish({ status: "failed", errorCode: "send_failed" });
      return "failed";
    }
    await finish({
      status: "retry",
      errorCode: "send_failed",
      nextAttemptAt: minutesFrom(now, delay),
    });
    return "retrying";
  }
}
