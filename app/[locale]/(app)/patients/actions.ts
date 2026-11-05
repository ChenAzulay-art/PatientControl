"use server";

import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/dal/context";
import {
  createPatient,
  findPatientsByNationalId,
  listPatients,
  type PatientListItem,
  setPatientArchived,
  updatePatient,
} from "@/lib/dal/patients";
import { requireClinic } from "@/lib/dal/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import {
  patientFormValues,
  patientInputSchema,
  type PatientFieldError,
  type PatientFormValues,
} from "@/lib/validation/patient";

export type PatientFormState = {
  errors?: Partial<Record<keyof PatientFormValues, PatientFieldError>>;
  duplicates?: { id: string; fullName: string }[];
  values?: PatientFormValues;
};

function localeFrom(formData: FormData) {
  const value = formData.get("locale");
  return isLocale(value) ? value : defaultLocale;
}

/** Creates a patient, or updates one when the form has a `patientId`. */
export async function savePatient(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const locale = localeFrom(formData);
  const ctx = await requireClinic(locale);

  const rawId = formData.get("patientId");
  const patientId = isUuid(rawId) ? rawId : null;
  const values = patientFormValues(formData);
  const parsed = patientInputSchema.safeParse(values);

  if (!parsed.success) {
    const errors: PatientFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof PatientFormValues;
      errors[field] ??= issue.message as PatientFieldError;
    }
    return { errors, values };
  }

  // Warn before saving a second card with the same ID number.
  if (parsed.data.nationalId && formData.get("confirmDuplicate") !== "on") {
    const duplicates = await findPatientsByNationalId(
      ctx,
      parsed.data.nationalId,
      patientId ?? undefined,
    );
    if (duplicates.length > 0) return { duplicates, values };
  }

  let id: string;
  if (patientId) {
    const updated = await updatePatient(ctx, patientId, parsed.data);
    if (!updated) notFound();
    id = patientId;
  } else {
    id = await createPatient(ctx, parsed.data);
  }
  redirect(`/${locale}/patients/${id}`);
}

/**
 * Searches without putting the search text in the URL, where names and phone
 * numbers would end up in browser history and server logs.
 */
export async function searchPatients(input: {
  locale: string;
  query: string;
  archived: boolean;
}): Promise<PatientListItem[]> {
  const locale = isLocale(input.locale) ? input.locale : defaultLocale;
  const ctx = await requireClinic(locale);
  return listPatients(ctx, {
    query: String(input.query ?? "").slice(0, 100),
    archived: input.archived === true,
  });
}

export async function setArchived(formData: FormData) {
  const locale = localeFrom(formData);
  const ctx = await requireClinic(locale);
  const patientId = String(formData.get("patientId") ?? "");
  const archived = formData.get("archived") === "true";

  const ok = await setPatientArchived(ctx, patientId, archived);
  if (!ok) notFound();
  redirect(`/${locale}/patients/${patientId}`);
}
