"use server";

import { redirect } from "next/navigation";
import {
  addAvailabilityException,
  removeAvailabilityException,
  setWorkingHours,
} from "@/lib/dal/availability";
import { requireClinic } from "@/lib/dal/session";
import {
  createTreatmentType,
  setTreatmentTypeActive,
  updateTreatmentType,
} from "@/lib/dal/treatment-types";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import {
  availabilityExceptionSchema,
  treatmentTypeSchema,
  workingHoursSchema,
} from "@/lib/validation/scheduling";

function localeFrom(value: unknown) {
  return isLocale(value) ? value : defaultLocale;
}

/* ---------- Treatment types ---------- */

export type TreatmentTypeFormState = {
  error?:
    | "nameInvalid"
    | "durationInvalid"
    | "priceInvalid"
    | "colorInvalid"
    | "duplicate"
    | "notFound";
  /** Changes after each successful save, so the form can reset or close. */
  savedAt?: number;
};

/** Creates a treatment type, or updates one when the form has an `id`. */
export async function saveTreatmentType(
  _prev: TreatmentTypeFormState,
  formData: FormData,
): Promise<TreatmentTypeFormState> {
  const ctx = await requireClinic(localeFrom(formData.get("locale")));
  const parsed = treatmentTypeSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
    priceAgorot: String(formData.get("price") ?? ""),
    color: String(formData.get("color") ?? ""),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message as TreatmentTypeFormState["error"],
    };
  }

  const id = String(formData.get("id") ?? "");
  const result = id
    ? await updateTreatmentType(ctx, id, parsed.data)
    : await createTreatmentType(ctx, parsed.data);
  if (!result.ok) return { error: result.error };
  return { savedAt: Date.now() };
}

export async function toggleTreatmentType(formData: FormData) {
  const locale = localeFrom(formData.get("locale"));
  const ctx = await requireClinic(locale);
  await setTreatmentTypeActive(
    ctx,
    String(formData.get("id") ?? ""),
    formData.get("active") === "true",
  );
  redirect(`/${locale}/settings#treatment-types`);
}

/* ---------- Working hours ---------- */

export type WorkingHoursState = {
  error?: "rangeInvalid" | "rangesOverlap" | "generic";
  savedAt?: number;
};

export async function saveWorkingHours(
  _prev: WorkingHoursState,
  formData: FormData,
): Promise<WorkingHoursState> {
  const ctx = await requireClinic(localeFrom(formData.get("locale")));
  let hours: unknown;
  try {
    hours = JSON.parse(String(formData.get("hours") ?? "null"));
  } catch {
    return { error: "generic" };
  }
  const parsed = workingHoursSchema.safeParse(hours);
  if (!parsed.success) {
    const message = parsed.error.issues.find(
      (issue) =>
        issue.message === "rangesOverlap" || issue.message === "rangeInvalid",
    )?.message;
    return {
      error: (message as WorkingHoursState["error"]) ?? "rangeInvalid",
    };
  }
  await setWorkingHours(ctx, parsed.data);
  return { savedAt: Date.now() };
}

/* ---------- Days off and special hours ---------- */

export type ExceptionFormState = {
  error?: "dateInvalid" | "rangeInvalid";
  savedAt?: number;
};

export async function addException(
  _prev: ExceptionFormState,
  formData: FormData,
): Promise<ExceptionFormState> {
  const ctx = await requireClinic(localeFrom(formData.get("locale")));
  const parsed = availabilityExceptionSchema.safeParse({
    date: String(formData.get("date") ?? ""),
    closed: formData.get("closed") === "on",
    start: String(formData.get("start") ?? ""),
    end: String(formData.get("end") ?? ""),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message === "dateInvalid"
          ? "dateInvalid"
          : "rangeInvalid",
    };
  }
  await addAvailabilityException(ctx, parsed.data);
  return { savedAt: Date.now() };
}

export async function removeException(formData: FormData) {
  const locale = localeFrom(formData.get("locale"));
  const ctx = await requireClinic(locale);
  await removeAvailabilityException(ctx, String(formData.get("id") ?? ""));
  redirect(`/${locale}/settings#exceptions`);
}
