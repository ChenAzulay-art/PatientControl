import "server-only";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  availabilityRules,
  clinicSettings,
  patients,
  patientTreatmentTypes,
  sessionNotes,
  sessionNoteVersions,
  treatmentTypes,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { decrypt } from "@/lib/crypto";
import { type ClinicContext, isUuid } from "./context";

export const EXPORT_FORMAT = "patient-control-export";
export const EXPORT_VERSION = 1;

export type ExportScope = { kind: "clinic" } | { kind: "patient"; id: string };

export type ExportedSummary = {
  status: "draft" | "final";
  text: string;
  finalizedAt: string | null;
  updatedAt: string;
  /** Every saved version of a final summary, oldest first. */
  versions: { savedAt: string; text: string }[];
};

export type ExportedAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  source: string;
  treatment: string | null;
  createdAt: string;
  summary: ExportedSummary | null;
};

export type ExportedPatient = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  nationalId: string | null;
  medicalBackground: string | null;
  importantNotes: string | null;
  preferredLocale: string;
  reminderConsent: boolean;
  treatmentTypes: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  appointments: ExportedAppointment[];
};

export type ClinicExport = {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  scope: ExportScope["kind"];
  clinic: { name: string; slug: string; timezone: string };
  /** Clinic-wide exports only. */
  settings?: {
    treatmentTypes: {
      name: string;
      durationMinutes: number;
      priceAgorot: number | null;
      active: boolean;
      bookableOnline: boolean;
    }[];
    workingHours: { weekday: number; start: string; end: string }[];
    booking: Record<string, unknown> | null;
  };
  patients: ExportedPatient[];
};

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function group<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const list = map.get(key(row)) ?? [];
    list.push(row);
    map.set(key(row), list);
  }
  return map;
}

/**
 * Everything the clinic holds, or everything about one patient, decrypted,
 * as plain JSON: for the practitioner's own records, for moving to another
 * system, or to answer a patient's request to see their information.
 * Returns null when the patient isn't in this clinic. Recorded in the audit log.
 */
export async function exportClinicData(
  ctx: ClinicContext,
  scope: ExportScope,
  now: Date = new Date(),
): Promise<ClinicExport | null> {
  const clinicId = ctx.clinic.id;
  if (scope.kind === "patient" && !isUuid(scope.id)) return null;
  const only = <T extends SQL>(clinicCondition: T, patientCondition: SQL) =>
    scope.kind === "patient"
      ? and(clinicCondition, patientCondition)
      : clinicCondition;
  const patientId = scope.kind === "patient" ? scope.id : "";

  const patientRows = await db
    .select()
    .from(patients)
    .where(only(eq(patients.clinicId, clinicId), eq(patients.id, patientId)))
    .orderBy(asc(patients.fullName), asc(patients.createdAt));
  if (scope.kind === "patient" && patientRows.length === 0) return null;

  const [types, links, appointmentRows, noteRows, versionRows] =
    await Promise.all([
      db
        .select()
        .from(treatmentTypes)
        .where(eq(treatmentTypes.clinicId, clinicId))
        .orderBy(asc(treatmentTypes.sortOrder), asc(treatmentTypes.name)),
      db
        .select()
        .from(patientTreatmentTypes)
        .where(
          only(
            eq(patientTreatmentTypes.clinicId, clinicId),
            eq(patientTreatmentTypes.patientId, patientId),
          ),
        ),
      db
        .select()
        .from(appointments)
        .where(
          only(
            eq(appointments.clinicId, clinicId),
            eq(appointments.patientId, patientId),
          ),
        )
        .orderBy(asc(appointments.startsAt)),
      db
        .select()
        .from(sessionNotes)
        .where(
          only(
            eq(sessionNotes.clinicId, clinicId),
            eq(sessionNotes.patientId, patientId),
          ),
        ),
      db
        .select({
          noteId: sessionNoteVersions.noteId,
          bodyEncrypted: sessionNoteVersions.bodyEncrypted,
          savedAt: sessionNoteVersions.savedAt,
        })
        .from(sessionNoteVersions)
        .innerJoin(
          sessionNotes,
          and(
            eq(sessionNotes.id, sessionNoteVersions.noteId),
            eq(sessionNotes.clinicId, sessionNoteVersions.clinicId),
          ),
        )
        .where(
          only(
            eq(sessionNoteVersions.clinicId, clinicId),
            eq(sessionNotes.patientId, patientId),
          ),
        )
        .orderBy(asc(sessionNoteVersions.savedAt)),
    ]);

  const typeName = new Map(types.map((type) => [type.id, type.name]));
  const typesByPatient = group(links, (link) => link.patientId);
  const appointmentsByPatient = group(appointmentRows, (a) => a.patientId);
  const noteByAppointment = new Map(
    noteRows.map((note) => [note.appointmentId, note]),
  );
  const versionsByNote = group(versionRows, (version) => version.noteId);

  const summaryFor = (appointmentId: string): ExportedSummary | null => {
    const note = noteByAppointment.get(appointmentId);
    if (!note) return null;
    return {
      status: note.status,
      text: decrypt(note.bodyEncrypted) ?? "",
      finalizedAt: iso(note.finalizedAt),
      updatedAt: note.updatedAt.toISOString(),
      versions: (versionsByNote.get(note.id) ?? []).map((version) => ({
        savedAt: version.savedAt.toISOString(),
        text: decrypt(version.bodyEncrypted) ?? "",
      })),
    };
  };

  const exported: ClinicExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    scope: scope.kind,
    clinic: {
      name: ctx.clinic.name,
      slug: ctx.clinic.slug,
      timezone: ctx.clinic.timezone,
    },
    patients: patientRows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      dateOfBirth: row.dateOfBirth,
      nationalId: decrypt(row.nationalIdEncrypted),
      medicalBackground: decrypt(row.medicalBackgroundEncrypted),
      importantNotes: decrypt(row.importantNotesEncrypted),
      preferredLocale: row.preferredLocale,
      reminderConsent: row.reminderConsent,
      treatmentTypes: (typesByPatient.get(row.id) ?? [])
        .map((link) => typeName.get(link.treatmentTypeId))
        .filter((name): name is string => Boolean(name)),
      archivedAt: iso(row.archivedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      appointments: (appointmentsByPatient.get(row.id) ?? []).map((a) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        status: a.status,
        source: a.source,
        treatment: a.treatmentTypeId
          ? (typeName.get(a.treatmentTypeId) ?? null)
          : null,
        createdAt: a.createdAt.toISOString(),
        summary: summaryFor(a.id),
      })),
    })),
  };

  if (scope.kind === "clinic") {
    const [hours, [booking]] = await Promise.all([
      db
        .select()
        .from(availabilityRules)
        .where(eq(availabilityRules.clinicId, clinicId))
        .orderBy(
          asc(availabilityRules.weekday),
          asc(availabilityRules.startTime),
        ),
      db
        .select()
        .from(clinicSettings)
        .where(eq(clinicSettings.clinicId, clinicId)),
    ]);
    exported.settings = {
      treatmentTypes: types.map((type) => ({
        name: type.name,
        durationMinutes: type.durationMinutes,
        priceAgorot: type.priceAgorot,
        active: type.active,
        bookableOnline: type.bookableOnline,
      })),
      workingHours: hours.map((rule) => ({
        weekday: rule.weekday,
        start: rule.startTime.slice(0, 5),
        end: rule.endTime.slice(0, 5),
      })),
      booking: booking
        ? {
            enabled: booking.bookingEnabled,
            autoConfirm: booking.bookingAutoConfirm,
            minNoticeMinutes: booking.bookingMinNoticeMinutes,
            windowDays: booking.bookingWindowDays,
            slotIntervalMinutes: booking.bookingSlotIntervalMinutes,
            remindersEnabled: booking.remindersEnabled,
            reminderLeadMinutes: booking.reminderLeadMinutes,
          }
        : null,
    };
  }

  await recordAudit({
    actorId: ctx.user.id,
    clinicId,
    action: scope.kind === "clinic" ? "clinic.exported" : "patient.exported",
    entity: scope.kind === "clinic" ? "clinic" : "patient",
    entityId: scope.kind === "clinic" ? clinicId : scope.id,
  });
  return exported;
}
