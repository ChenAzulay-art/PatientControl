import "server-only";
import { DateTime } from "luxon";
import type { Locale } from "@/lib/i18n/config";
import { getDictionaryFor } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { sendEmail } from "./index";

export type BookingEmailKind = "requested" | "confirmed" | "cancelled";

/**
 * Emails to a patient about an online booking. They name the clinic,
 * treatment and time, and nothing from the patient's records.
 */
export async function sendBookingEmail({
  kind,
  to,
  locale,
  patientName,
  clinicName,
  treatmentName,
  startsAt,
  timezone,
  cancelUrl = "",
  bookUrl = "",
}: {
  kind: BookingEmailKind;
  to: string;
  locale: Locale;
  patientName: string;
  clinicName: string;
  treatmentName: string;
  startsAt: string;
  timezone: string;
  cancelUrl?: string;
  bookUrl?: string;
}): Promise<void> {
  const t = await getDictionaryFor(locale);
  const when = DateTime.fromISO(startsAt, { zone: timezone })
    .setLocale(locale === "he" ? "he-IL" : "en-IL")
    .toFormat(
      locale === "he"
        ? "cccc, d 'ב'MMMM yyyy, HH:mm"
        : "cccc, d MMMM yyyy, HH:mm",
    );
  const values = {
    name: patientName,
    clinic: clinicName,
    treatment: treatmentName,
    when,
    cancelUrl,
    bookUrl,
  };
  const template = t.emails.booking[kind];
  await sendEmail({
    to,
    subject: format(template.subject, values),
    text: format(template.body, values),
  });
}
