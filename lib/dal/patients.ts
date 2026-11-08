import "server-only";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { patients, patientTreatmentTypes, treatmentTypes } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { decrypt, encrypt, lookupHash } from "@/lib/crypto";
import type { Locale } from "@/lib/i18n/config";
import { isLocale } from "@/lib/i18n/config";
import type { PatientInput } from "@/lib/validation/patient";
import { phoneSearchDigits } from "@/lib/validation/phone";
import { type ClinicContext, isUuid } from "./context";
import { ownTreatmentTypeIds } from "./treatment-types";

export type PatientListItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  treatmentTypes: string[];
  archived: boolean;
};

export type PatientDetail = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  nationalId: string | null;
  medicalBackground: string | null;
  importantNotes: string | null;
  preferredLocale: Locale;
  reminderConsent: boolean;
  treatmentTypes: { id: string; name: string }[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const LIST_LIMIT = 200;

/** Escapes LIKE wildcards so a search for "50%" means the characters, not a pattern. */
function likeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function treatmentTypeNames(
  clinicId: string,
  patientIds: string[],
): Promise<Map<string, { id: string; name: string }[]>> {
  const byPatient = new Map<string, { id: string; name: string }[]>();
  if (patientIds.length === 0) return byPatient;
  const rows = await db
    .select({
      patientId: patientTreatmentTypes.patientId,
      id: treatmentTypes.id,
      name: treatmentTypes.name,
    })
    .from(patientTreatmentTypes)
    .innerJoin(
      treatmentTypes,
      eq(treatmentTypes.id, patientTreatmentTypes.treatmentTypeId),
    )
    .where(
      and(
        eq(patientTreatmentTypes.clinicId, clinicId),
        inArray(patientTreatmentTypes.patientId, patientIds),
      ),
    )
    .orderBy(asc(treatmentTypes.sortOrder), asc(treatmentTypes.name));
  for (const row of rows) {
    const list = byPatient.get(row.patientId) ?? [];
    list.push({ id: row.id, name: row.name });
    byPatient.set(row.patientId, list);
  }
  return byPatient;
}

/** Patients of this clinic, optionally filtered by name, phone or email. */
export async function listPatients(
  ctx: ClinicContext,
  { query = "", archived = false }: { query?: string; archived?: boolean } = {},
): Promise<PatientListItem[]> {
  const conditions: SQL[] = [
    eq(patients.clinicId, ctx.clinic.id),
    archived ? isNotNull(patients.archivedAt) : isNull(patients.archivedAt),
  ];

  const term = query.trim().slice(0, 100);
  if (term) {
    const matches: SQL[] = [
      ilike(patients.fullName, likeContains(term)),
      ilike(patients.email, likeContains(term)),
    ];
    const digits = phoneSearchDigits(term);
    if (digits) matches.push(ilike(patients.phone, likeContains(digits)));
    conditions.push(or(...matches)!);
  }

  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      phone: patients.phone,
      email: patients.email,
      archivedAt: patients.archivedAt,
    })
    .from(patients)
    .where(and(...conditions))
    .orderBy(asc(patients.fullName))
    .limit(LIST_LIMIT);

  const types = await treatmentTypeNames(
    ctx.clinic.id,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    treatmentTypes: (types.get(row.id) ?? []).map((type) => type.name),
    archived: row.archivedAt !== null,
  }));
}

/** One patient card, decrypted. Every view is recorded in the audit log. */
export async function getPatient(
  ctx: ClinicContext,
  id: string,
): Promise<PatientDetail | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)))
    .limit(1);
  if (!row) return null;

  const types = await treatmentTypeNames(ctx.clinic.id, [row.id]);
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "patient.viewed",
    entity: "patient",
    entityId: row.id,
  });

  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    dateOfBirth: row.dateOfBirth,
    nationalId: decrypt(row.nationalIdEncrypted),
    medicalBackground: decrypt(row.medicalBackgroundEncrypted),
    importantNotes: decrypt(row.importantNotesEncrypted),
    preferredLocale: isLocale(row.preferredLocale) ? row.preferredLocale : "he",
    reminderConsent: row.reminderConsent,
    treatmentTypes: types.get(row.id) ?? [],
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Other patients in this clinic with the same ID number (for a duplicate warning). */
export async function findPatientsByNationalId(
  ctx: ClinicContext,
  nationalId: string,
  excludePatientId?: string,
): Promise<{ id: string; fullName: string }[]> {
  const conditions = [
    eq(patients.clinicId, ctx.clinic.id),
    eq(patients.nationalIdHash, lookupHash(ctx.clinic.id, nationalId)),
  ];
  if (excludePatientId && isUuid(excludePatientId)) {
    conditions.push(ne(patients.id, excludePatientId));
  }
  return db
    .select({ id: patients.id, fullName: patients.fullName })
    .from(patients)
    .where(and(...conditions))
    .limit(5);
}

function storedFields(ctx: ClinicContext, input: PatientInput) {
  return {
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    dateOfBirth: input.dateOfBirth,
    nationalIdEncrypted: encrypt(input.nationalId),
    nationalIdHash: input.nationalId
      ? lookupHash(ctx.clinic.id, input.nationalId)
      : null,
    medicalBackgroundEncrypted: encrypt(input.medicalBackground),
    importantNotesEncrypted: encrypt(input.importantNotes),
    preferredLocale: input.preferredLocale,
    reminderConsent: input.reminderConsent,
  };
}

export async function createPatient(
  ctx: ClinicContext,
  input: PatientInput,
): Promise<string> {
  const typeIds = await ownTreatmentTypeIds(ctx, input.treatmentTypeIds);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(patients)
      .values({
        clinicId: ctx.clinic.id,
        createdBy: ctx.user.id,
        ...storedFields(ctx, input),
      })
      .returning({ id: patients.id });
    if (typeIds.length > 0) {
      await tx.insert(patientTreatmentTypes).values(
        typeIds.map((treatmentTypeId) => ({
          clinicId: ctx.clinic.id,
          patientId: row.id,
          treatmentTypeId,
        })),
      );
    }
    return row.id;
  });
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "patient.created",
    entity: "patient",
    entityId: id,
  });
  return id;
}

/** Returns false if the patient doesn't exist in this clinic. */
export async function updatePatient(
  ctx: ClinicContext,
  id: string,
  input: PatientInput,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const typeIds = await ownTreatmentTypeIds(ctx, input.treatmentTypeIds);
  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(patients)
      .set(storedFields(ctx, input))
      .where(and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)))
      .returning({ id: patients.id });
    if (rows.length === 0) return false;

    await tx
      .delete(patientTreatmentTypes)
      .where(
        and(
          eq(patientTreatmentTypes.clinicId, ctx.clinic.id),
          eq(patientTreatmentTypes.patientId, id),
        ),
      );
    if (typeIds.length > 0) {
      await tx.insert(patientTreatmentTypes).values(
        typeIds.map((treatmentTypeId) => ({
          clinicId: ctx.clinic.id,
          patientId: id,
          treatmentTypeId,
        })),
      );
    }
    return true;
  });
  if (updated) {
    await recordAudit({
      actorId: ctx.user.id,
      clinicId: ctx.clinic.id,
      action: "patient.updated",
      entity: "patient",
      entityId: id,
    });
  }
  return updated;
}

/**
 * Archiving hides a patient from the list without deleting their record:
 * treatment records must be kept, and archiving can be undone.
 */
export async function setPatientArchived(
  ctx: ClinicContext,
  id: string,
  archived: boolean,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await db
    .update(patients)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)))
    .returning({ id: patients.id });
  if (rows.length === 0) return false;
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: archived ? "patient.archived" : "patient.restored",
    entity: "patient",
    entityId: id,
  });
  return true;
}

/** Just the name, for pre-filling a patient in the booking dialog. */
export async function getPatientName(
  ctx: ClinicContext,
  id: string,
): Promise<{ id: string; fullName: string } | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ id: patients.id, fullName: patients.fullName })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.clinicId, ctx.clinic.id)))
    .limit(1);
  return row ?? null;
}
