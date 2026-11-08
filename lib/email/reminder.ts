import "server-only";
import type { Locale } from "@/lib/i18n/config";
import { getDictionaryFor } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { emailDateTime } from "./booking";
import { sendEmail } from "./index";

/**
 * A reminder of an upcoming appointment, in the patient's language. Like
 * the booking emails it names only the clinic, treatment and time.
 * Online bookings get a cancel link; others ask the patient to tell the
 * clinic.
 */
export async function sendReminderEmail({
  to,
  locale,
  patientName,
  clinicName,
  treatmentName,
  startsAt,
  timezone,
  cancelUrl,
}: {
  to: string;
  locale: Locale;
  patientName: string;
  clinicName: string;
  treatmentName: string | null;
  startsAt: string;
  timezone: string;
  cancelUrl: string | null;
}): Promise<{ id?: string }> {
  const t = (await getDictionaryFor(locale)).emails.reminder;
  const values = {
    name: patientName,
    clinic: clinicName,
    treatment: treatmentName ?? "",
    when: emailDateTime(startsAt, timezone, locale),
    cancelUrl: cancelUrl ?? "",
  };
  const body = format(treatmentName ? t.body : t.bodyNoTreatment, values);
  const footer = format(cancelUrl ? t.cancel : t.contact, values);
  return sendEmail({
    to,
    subject: format(t.subject, values),
    text: body + footer,
  });
}
