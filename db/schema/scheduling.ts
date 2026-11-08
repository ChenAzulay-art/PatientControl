import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { patients, treatmentTypes } from "./patients";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Regular weekly working hours, in the clinic's time zone. A day can have
 * more than one range (e.g. morning and evening).
 */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday. */
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    ...timestamps,
  },
  (t) => [
    index("availability_rules_clinic_idx").on(t.clinicId, t.weekday),
    check(
      "availability_rules_weekday_check",
      sql`${t.weekday} between 0 and 6`,
    ),
    check("availability_rules_time_check", sql`${t.endTime} > ${t.startTime}`),
  ],
);

/** A date that differs from the weekly hours: closed, or open at other times. */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    /** Both null = closed all day. */
    startTime: time("start_time"),
    endTime: time("end_time"),
    ...timestamps,
  },
  (t) => [
    index("availability_exceptions_clinic_date_idx").on(t.clinicId, t.date),
    check(
      "availability_exceptions_time_check",
      sql`(${t.startTime} is null and ${t.endTime} is null) or (${t.startTime} is not null and ${t.endTime} is not null and ${t.endTime} > ${t.startTime})`,
    ),
  ],
);

export const appointmentStatuses = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

/**
 * An appointment. A database exclusion constraint (added in the migration's
 * SQL, see drizzle/0002_scheduling.sql) stops two non-cancelled appointments
 * in the same clinic from overlapping.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").notNull(),
    treatmentTypeId: uuid("treatment_type_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: appointmentStatuses })
      .notNull()
      .default("scheduled"),
    /** "staff" when the practitioner booked it; "online" from the booking page. */
    source: text("source", { enum: ["staff", "online"] })
      .notNull()
      .default("staff"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    // Lets session summaries require the same clinic as their appointment.
    unique("appointments_clinic_id_id_key").on(t.clinicId, t.id),
    index("appointments_clinic_starts_idx").on(t.clinicId, t.startsAt),
    index("appointments_patient_idx").on(t.clinicId, t.patientId, t.startsAt),
    // Both the patient and the treatment type must belong to the same clinic.
    foreignKey({
      name: "appointments_patient_fk",
      columns: [t.clinicId, t.patientId],
      foreignColumns: [patients.clinicId, patients.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "appointments_treatment_type_fk",
      columns: [t.clinicId, t.treatmentTypeId],
      foreignColumns: [treatmentTypes.clinicId, treatmentTypes.id],
    }),
    check("appointments_time_check", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "appointments_status_check",
      sql`${t.status} in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')`,
    ),
    check("appointments_source_check", sql`${t.source} in ('staff', 'online')`),
  ],
);
