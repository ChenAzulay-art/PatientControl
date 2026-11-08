import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { appointments } from "./scheduling";

export const notificationStatuses = [
  /** Being sent right now (claimed by a run). */
  "sending",
  "sent",
  /** The last attempt failed; another is due at next_attempt_at. */
  "retry",
  /** Every attempt failed. */
  "failed",
] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

/**
 * A log of messages sent to patients about an appointment, one row per
 * appointment time: if the appointment moves, the new time gets its own
 * reminder. Holds no message text or contact details, only identifiers,
 * the outcome and a short error code.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").notNull(),
    kind: text("kind", { enum: ["reminder"] })
      .notNull()
      .default("reminder"),
    channel: text("channel", { enum: ["email"] })
      .notNull()
      .default("email"),
    /** The appointment time this message is about. */
    appointmentStartsAt: timestamp("appointment_starts_at", {
      withTimezone: true,
    }).notNull(),
    status: text("status", { enum: notificationStatuses }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    /** A short code such as "send_failed"; never the provider's message. */
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Claiming this row is what stops a reminder from going out twice.
    uniqueIndex("notifications_appointment_kind_time_uidx").on(
      t.appointmentId,
      t.kind,
      t.appointmentStartsAt,
    ),
    index("notifications_status_next_idx").on(t.status, t.nextAttemptAt),
    index("notifications_clinic_created_idx").on(t.clinicId, t.createdAt),
    foreignKey({
      name: "notifications_appointment_fk",
      columns: [t.clinicId, t.appointmentId],
      foreignColumns: [appointments.clinicId, appointments.id],
    }).onDelete("cascade"),
    check(
      "notifications_status_check",
      sql`${t.status} in ('sending', 'sent', 'retry', 'failed')`,
    ),
  ],
);
