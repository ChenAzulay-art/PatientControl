"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { accountDeletionBlocker, deleteClinicAccount } from "@/lib/dal/account";
import {
  addAvailabilityException,
  removeAvailabilityException,
  setWorkingHours,
} from "@/lib/dal/availability";
import { updateBookingSettings } from "@/lib/dal/booking-settings";
import { updateReminderSettings } from "@/lib/dal/reminders";
import { confirmPassword } from "@/lib/dal/reauth";
import { requireClinic } from "@/lib/dal/session";
import { sendEmail } from "@/lib/email";
import {
  createTreatmentType,
  setTreatmentTypeActive,
  updateTreatmentType,
} from "@/lib/dal/treatment-types";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getDictionaryFor } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { bookingSettingsSchema } from "@/lib/validation/booking";
import { reminderSettingsSchema } from "@/lib/validation/reminders";
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
    bookableOnline: formData.get("bookableOnline") === "on",
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

/* ---------- Online booking ---------- */

export type BookingSettingsState = { error?: "invalid"; savedAt?: number };

export async function saveBookingSettings(
  _prev: BookingSettingsState,
  formData: FormData,
): Promise<BookingSettingsState> {
  const ctx = await requireClinic(localeFrom(formData.get("locale")));
  const parsed = bookingSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    autoConfirm: formData.get("autoConfirm") === "on",
    minNoticeMinutes: formData.get("minNoticeMinutes"),
    windowDays: formData.get("windowDays"),
    intervalMinutes: formData.get("intervalMinutes"),
  });
  if (!parsed.success) return { error: "invalid" };
  await updateBookingSettings(ctx, parsed.data);
  return { savedAt: Date.now() };
}

/* ---------- Reminders ---------- */

export type ReminderSettingsState = { error?: "invalid"; savedAt?: number };

export async function saveReminderSettings(
  _prev: ReminderSettingsState,
  formData: FormData,
): Promise<ReminderSettingsState> {
  const ctx = await requireClinic(localeFrom(formData.get("locale")));
  const parsed = reminderSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    leadMinutes: formData.get("leadMinutes"),
  });
  if (!parsed.success) return { error: "invalid" };
  await updateReminderSettings(ctx, parsed.data);
  return { savedAt: Date.now() };
}

/* ---------- Deleting the account ---------- */

export type DeleteAccountState = {
  error?: "confirm" | "wrongPassword" | "tooMany" | "notOwner" | "otherMembers";
};

/**
 * Deletes the clinic, all its records and the practitioner's account, after
 * the clinic's address is typed and the password entered again. Then signs
 * out and sends a confirmation email.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const locale = localeFrom(formData.get("locale"));
  const ctx = await requireClinic(locale);
  if (String(formData.get("confirm") ?? "").trim() !== ctx.clinic.slug) {
    return { error: "confirm" };
  }
  const check = await confirmPassword(
    ctx,
    String(formData.get("password") ?? ""),
  );
  if (check !== "ok") {
    return { error: check === "tooMany" ? "tooMany" : "wrongPassword" };
  }
  const blocker = await accountDeletionBlocker(ctx);
  if (blocker) return { error: blocker };

  // Sign out first, while the session still exists, so the cookies are cleared.
  const requestHeaders = await headers();
  await auth.api.signOut({ headers: requestHeaders });
  const result = await deleteClinicAccount(ctx);
  if (!result.ok) return { error: result.error };

  const t = await getDictionaryFor(locale);
  await sendEmail({
    to: ctx.user.email,
    subject: format(t.deleteAccount.email.subject, { clinic: ctx.clinic.name }),
    text: format(t.deleteAccount.email.body, {
      name: ctx.user.name,
      clinic: ctx.clinic.name,
    }),
  }).catch(() => {
    // The account is gone either way; a missing confirmation email isn't worth an error page.
  });
  redirect(`/${locale}/account-deleted`);
}
