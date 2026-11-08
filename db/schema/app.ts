import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Per-clinic settings. A clinic is a Better Auth organization; its slug is the booking address. */
export const clinicSettings = pgTable("clinic_settings", {
  clinicId: text("clinic_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Asia/Jerusalem"),
  defaultLocale: text("default_locale").notNull().default("he"),
  /** The public booking page at /book/<slug> is open. */
  bookingEnabled: boolean("booking_enabled").notNull().default(false),
  /** Online bookings are confirmed at once; otherwise they wait for approval. */
  bookingAutoConfirm: boolean("booking_auto_confirm").notNull().default(true),
  /** How long before a slot it can still be booked online. */
  bookingMinNoticeMinutes: integer("booking_min_notice_minutes")
    .notNull()
    .default(720),
  /** How many days ahead patients can book. */
  bookingWindowDays: integer("booking_window_days").notNull().default(30),
  /** Offered start times are this many minutes apart. */
  bookingSlotIntervalMinutes: integer("booking_slot_interval_minutes")
    .notNull()
    .default(30),
  /** Email reminders go to patients who agreed to them. */
  remindersEnabled: boolean("reminders_enabled").notNull().default(true),
  /** How long before an appointment the reminder is sent. */
  reminderLeadMinutes: integer("reminder_lead_minutes").notNull().default(1440),
  ...timestamps,
});

/**
 * Fixed-window counters for the public booking page (per IP address and per
 * phone number). Keys are keyed hashes, so no phone numbers or addresses
 * are stored.
 */
export const publicRateLimits = pgTable("public_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

/** Who did what and when. Identifiers only: never patient details. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_clinic_created_idx").on(t.clinicId, t.createdAt),
    index("audit_log_actor_created_idx").on(t.actorId, t.createdAt),
  ],
);
