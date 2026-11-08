"use server";

import { redirect } from "next/navigation";
import {
  type AppointmentError,
  createAppointment,
} from "@/lib/dal/appointments";
import { requireClinic } from "@/lib/dal/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { appointmentInputSchema } from "@/lib/validation/scheduling";

export type PastSessionState = {
  fieldErrors?: Partial<
    Record<
      "date" | "time" | "durationMinutes",
      "dateInvalid" | "timeInvalid" | "durationInvalid"
    >
  >;
  error?: AppointmentError | "generic";
};

/**
 * Records a session that already happened but was never booked, then opens
 * its summary page.
 */
export async function recordPastSession(
  _prev: PastSessionState,
  formData: FormData,
): Promise<PastSessionState> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const ctx = await requireClinic(locale);

  const parsed = appointmentInputSchema.safeParse({
    patientId: String(formData.get("patientId") ?? ""),
    treatmentTypeId: String(formData.get("treatmentTypeId") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: PastSessionState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "date") fieldErrors.date = "dateInvalid";
      if (field === "time") fieldErrors.time = "timeInvalid";
      if (field === "durationMinutes")
        fieldErrors.durationMinutes = "durationInvalid";
      if (field === "patientId") return { error: "patientNotFound" };
    }
    return { fieldErrors };
  }

  const result = await createAppointment(ctx, parsed.data, {
    pastSession: true,
  });
  if (!result.ok) return { error: result.error };
  redirect(
    `/${locale}/patients/${parsed.data.patientId}/sessions/${result.id}`,
  );
}
