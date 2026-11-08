"use server";

import { redirect } from "next/navigation";
import { appointmentStatuses, type AppointmentStatus } from "@/db/schema";
import {
  type AppointmentError,
  type AppointmentView,
  createAppointment,
  listAppointments,
  moveAppointment,
  rescheduleAppointment,
  setAppointmentStatus,
} from "@/lib/dal/appointments";
import { isUuid } from "@/lib/dal/context";
import { requireClinic } from "@/lib/dal/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import {
  appointmentInputSchema,
  appointmentMoveSchema,
} from "@/lib/validation/scheduling";

function localeFrom(value: unknown) {
  return isLocale(value) ? value : defaultLocale;
}

/** Appointments for the calendar's visible range. */
export async function fetchAppointments(input: {
  locale: string;
  from: string;
  to: string;
  includeCancelled?: boolean;
}): Promise<AppointmentView[]> {
  const ctx = await requireClinic(localeFrom(input.locale));
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  return listAppointments(ctx, {
    from,
    to,
    includeCancelled: input.includeCancelled === true,
  });
}

type FieldError =
  "patientRequired" | "dateInvalid" | "timeInvalid" | "durationInvalid";

export type AppointmentFormState = {
  fieldErrors?: Partial<
    Record<"patientId" | "date" | "time" | "durationMinutes", FieldError>
  >;
  error?: AppointmentError | "generic";
  savedAt?: number;
};

/** Books a new appointment, or reschedules one when the form has `appointmentId`. */
export async function saveAppointment(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const ctx = await requireClinic(localeFrom(formData.get("locale")));
  const parsed = appointmentInputSchema.safeParse({
    patientId: String(formData.get("patientId") ?? ""),
    treatmentTypeId: String(formData.get("treatmentTypeId") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: AppointmentFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof NonNullable<
        AppointmentFormState["fieldErrors"]
      >;
      if (field === "patientId") fieldErrors.patientId = "patientRequired";
      else if (field in { date: 1, time: 1, durationMinutes: 1 }) {
        fieldErrors[field] ??= issue.message as FieldError;
      }
    }
    return { fieldErrors };
  }

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const result = isUuid(appointmentId)
    ? await rescheduleAppointment(ctx, appointmentId, parsed.data)
    : await createAppointment(ctx, parsed.data);
  if (!result.ok) return { error: result.error };
  return { savedAt: Date.now() };
}

/** Saves a drag or resize on the calendar. */
export async function moveAppointmentAction(input: {
  locale: string;
  appointmentId: string;
  startsAt: string;
  endsAt: string;
}): Promise<{ ok: true } | { ok: false; error: AppointmentError | "generic" }> {
  const ctx = await requireClinic(localeFrom(input.locale));
  const parsed = appointmentMoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  return moveAppointment(
    ctx,
    parsed.data.appointmentId,
    new Date(parsed.data.startsAt),
    new Date(parsed.data.endsAt),
  );
}

export async function setStatusAction(input: {
  locale: string;
  appointmentId: string;
  status: string;
}): Promise<{ ok: true } | { ok: false; error: AppointmentError | "generic" }> {
  const ctx = await requireClinic(localeFrom(input.locale));
  if (!appointmentStatuses.includes(input.status as AppointmentStatus)) {
    return { ok: false, error: "generic" };
  }
  return setAppointmentStatus(
    ctx,
    input.appointmentId,
    input.status as AppointmentStatus,
  );
}

/** Status change from a plain form (dashboard, patient card); returns to `returnTo`. */
export async function setStatusFromForm(formData: FormData) {
  const locale = localeFrom(formData.get("locale"));
  const ctx = await requireClinic(locale);
  const status = String(formData.get("status") ?? "");
  if (appointmentStatuses.includes(status as AppointmentStatus)) {
    await setAppointmentStatus(
      ctx,
      String(formData.get("appointmentId") ?? ""),
      status as AppointmentStatus,
    );
  }
  const returnTo = String(formData.get("returnTo") ?? "");
  // Only same-site paths in this locale.
  redirect(
    returnTo.startsWith(`/${locale}/`) && !returnTo.startsWith("//")
      ? returnTo
      : `/${locale}/dashboard`,
  );
}
