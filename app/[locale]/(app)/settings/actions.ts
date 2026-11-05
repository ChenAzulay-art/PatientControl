"use server";

import { redirect } from "next/navigation";
import { requireClinic } from "@/lib/dal/session";
import {
  createTreatmentType,
  setTreatmentTypeActive,
} from "@/lib/dal/treatment-types";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { treatmentTypeNameSchema } from "@/lib/validation/patient";

export type AddTreatmentTypeState = {
  error?: "nameInvalid" | "duplicate";
  value?: string;
  /** Changes after each successful add, so the form can reset. */
  savedAt?: number;
};

function localeFrom(formData: FormData) {
  const value = formData.get("locale");
  return isLocale(value) ? value : defaultLocale;
}

export async function addTreatmentType(
  _prev: AddTreatmentTypeState,
  formData: FormData,
): Promise<AddTreatmentTypeState> {
  const ctx = await requireClinic(localeFrom(formData));
  const value = String(formData.get("name") ?? "");
  const parsed = treatmentTypeNameSchema.safeParse(value);
  if (!parsed.success) return { error: "nameInvalid", value };

  const result = await createTreatmentType(ctx, parsed.data);
  if (!result.ok) return { error: "duplicate", value };
  return { savedAt: Date.now() };
}

export async function toggleTreatmentType(formData: FormData) {
  const locale = localeFrom(formData);
  const ctx = await requireClinic(locale);
  await setTreatmentTypeActive(
    ctx,
    String(formData.get("id") ?? ""),
    formData.get("active") === "true",
  );
  redirect(`/${locale}/settings#treatment-types`);
}
