import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  clinicSettings,
  type NotificationStatus,
  notifications,
  patients,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  DEFAULT_REMINDER_LEAD_MINUTES,
  type ReminderSettingsInput,
} from "@/lib/validation/reminders";
import type { ClinicContext } from "./context";

export async function getReminderSettings(
  ctx: ClinicContext,
): Promise<ReminderSettingsInput> {
  const [row] = await db
    .select({
      enabled: clinicSettings.remindersEnabled,
      leadMinutes: clinicSettings.reminderLeadMinutes,
    })
    .from(clinicSettings)
    .where(eq(clinicSettings.clinicId, ctx.clinic.id))
    .limit(1);
  return {
    enabled: row?.enabled ?? true,
    leadMinutes: row?.leadMinutes ?? DEFAULT_REMINDER_LEAD_MINUTES,
  };
}

export async function updateReminderSettings(
  ctx: ClinicContext,
  input: ReminderSettingsInput,
): Promise<void> {
  const values = {
    remindersEnabled: input.enabled,
    reminderLeadMinutes: input.leadMinutes,
  };
  await db
    .insert(clinicSettings)
    .values({ clinicId: ctx.clinic.id, ...values })
    .onConflictDoUpdate({ target: clinicSettings.clinicId, set: values });
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "reminder_settings.updated",
    entity: "clinic",
    entityId: ctx.clinic.id,
  });
}

export type ReminderLogEntry = {
  id: string;
  status: NotificationStatus;
  attempts: number;
  errorCode: string | null;
  appointmentStartsAt: string;
  sentAt: string | null;
  createdAt: string;
  patientId: string;
  patientName: string;
};

/** The clinic's latest reminders, newest first. */
export async function listRecentReminders(
  ctx: ClinicContext,
  { limit = 20 }: { limit?: number } = {},
): Promise<ReminderLogEntry[]> {
  const rows = await db
    .select({
      id: notifications.id,
      status: notifications.status,
      attempts: notifications.attempts,
      errorCode: notifications.errorCode,
      appointmentStartsAt: notifications.appointmentStartsAt,
      sentAt: notifications.sentAt,
      createdAt: notifications.createdAt,
      patientId: patients.id,
      patientName: patients.fullName,
    })
    .from(notifications)
    .innerJoin(
      appointments,
      and(
        eq(appointments.id, notifications.appointmentId),
        eq(appointments.clinicId, notifications.clinicId),
      ),
    )
    .innerJoin(
      patients,
      and(
        eq(patients.id, appointments.patientId),
        eq(patients.clinicId, appointments.clinicId),
      ),
    )
    .where(eq(notifications.clinicId, ctx.clinic.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    appointmentStartsAt: row.appointmentStartsAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
