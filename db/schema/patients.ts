import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
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

/**
 * Kinds of treatment a clinic offers (reflexology, physiotherapy, ...).
 * The scheduling stage adds duration, price and online booking.
 */
export const treatmentTypes = pgTable(
  "treatment_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    // Lets the link table require that both sides belong to the same clinic.
    unique("treatment_types_clinic_id_id_key").on(t.clinicId, t.id),
    uniqueIndex("treatment_types_clinic_name_uidx").on(
      t.clinicId,
      sql`lower(${t.name})`,
    ),
  ],
);

/**
 * A patient card. Name, phone and email stay searchable; the ID number,
 * medical background and important notes are encrypted in the app
 * (lib/crypto.ts) before they reach the database.
 */
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    /** E.164, e.g. +972501234567. */
    phone: text("phone").notNull(),
    email: text("email"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    nationalIdEncrypted: text("national_id_encrypted"),
    /** Keyed hash of the ID number, for duplicate checks without decrypting. */
    nationalIdHash: text("national_id_hash"),
    medicalBackgroundEncrypted: text("medical_background_encrypted"),
    importantNotesEncrypted: text("important_notes_encrypted"),
    preferredLocale: text("preferred_locale").notNull().default("he"),
    reminderConsent: boolean("reminder_consent").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    unique("patients_clinic_id_id_key").on(t.clinicId, t.id),
    index("patients_clinic_name_idx").on(t.clinicId, t.fullName),
    index("patients_clinic_national_id_idx").on(t.clinicId, t.nationalIdHash),
  ],
);

/** Which treatment types a patient receives. Both must be in the patient's clinic. */
export const patientTreatmentTypes = pgTable(
  "patient_treatment_types",
  {
    clinicId: text("clinic_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    treatmentTypeId: uuid("treatment_type_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.patientId, t.treatmentTypeId] }),
    foreignKey({
      name: "patient_treatment_types_patient_fk",
      columns: [t.clinicId, t.patientId],
      foreignColumns: [patients.clinicId, patients.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "patient_treatment_types_treatment_type_fk",
      columns: [t.clinicId, t.treatmentTypeId],
      foreignColumns: [treatmentTypes.clinicId, treatmentTypes.id],
    }).onDelete("cascade"),
  ],
);
