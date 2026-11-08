import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { patients } from "./patients";
import { appointments } from "./scheduling";

export const sessionNoteStatuses = ["draft", "final"] as const;
export type SessionNoteStatus = (typeof sessionNoteStatuses)[number];

/**
 * The treatment summary for one appointment. The text is encrypted in the
 * app (lib/crypto.ts). A draft is saved automatically while typing; saving
 * it makes it final, and from then on every change is kept in
 * session_note_versions.
 */
export const sessionNotes = pgTable(
  "session_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    bodyEncrypted: text("body_encrypted").notNull(),
    status: text("status", { enum: sessionNoteStatuses })
      .notNull()
      .default("draft"),
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // One summary per appointment.
    unique("session_notes_appointment_key").on(t.appointmentId),
    unique("session_notes_clinic_id_id_key").on(t.clinicId, t.id),
    index("session_notes_patient_idx").on(t.clinicId, t.patientId),
    foreignKey({
      name: "session_notes_appointment_fk",
      columns: [t.clinicId, t.appointmentId],
      foreignColumns: [appointments.clinicId, appointments.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "session_notes_patient_fk",
      columns: [t.clinicId, t.patientId],
      foreignColumns: [patients.clinicId, patients.id],
    }).onDelete("cascade"),
    check("session_notes_status_check", sql`${t.status} in ('draft', 'final')`),
    check(
      "session_notes_finalized_check",
      sql`(${t.status} = 'final') = (${t.finalizedAt} is not null)`,
    ),
  ],
);

/** Every saved version of a final summary, oldest first. Never updated or deleted by the app. */
export const sessionNoteVersions = pgTable(
  "session_note_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: text("clinic_id").notNull(),
    noteId: uuid("note_id").notNull(),
    bodyEncrypted: text("body_encrypted").notNull(),
    savedBy: text("saved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("session_note_versions_note_idx").on(t.noteId, t.savedAt),
    foreignKey({
      name: "session_note_versions_note_fk",
      columns: [t.clinicId, t.noteId],
      foreignColumns: [sessionNotes.clinicId, sessionNotes.id],
    }).onDelete("cascade"),
  ],
);
