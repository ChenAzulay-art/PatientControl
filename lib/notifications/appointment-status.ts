import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  type AppointmentStatus,
  organization,
  patients,
  treatmentTypes,
} from "@/db/schema";
import type { ClinicContext } from "@/lib/dal/context";
import { rotateCancelToken } from "@/lib/dal/public-booking";
import { sendBookingEmail } from "@/lib/email/booking";
import { isLocale } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";

/**
 * Tells a patient who booked online that the practitioner confirmed or
 * cancelled their appointment. Appointments the practitioner booked
 * themselves get no email here (reminders come in a later stage). Email
 * failures are logged without details and never undo the status change.
 */
export async function notifyOnlineBookingStatus(
  ctx: ClinicContext,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<void> {
  if (status !== "confirmed" && status !== "cancelled") return;
  try {
    const [row] = await db
      .select({
        source: appointments.source,
        startsAt: appointments.startsAt,
        patientName: patients.fullName,
        email: patients.email,
        locale: patients.preferredLocale,
        treatmentName: treatmentTypes.name,
        clinicSlug: organization.slug,
      })
      .from(appointments)
      .innerJoin(
        patients,
        and(
          eq(patients.id, appointments.patientId),
          eq(patients.clinicId, appointments.clinicId),
        ),
      )
      .innerJoin(organization, eq(organization.id, appointments.clinicId))
      .leftJoin(
        treatmentTypes,
        and(
          eq(treatmentTypes.id, appointments.treatmentTypeId),
          eq(treatmentTypes.clinicId, appointments.clinicId),
        ),
      )
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.clinicId, ctx.clinic.id),
        ),
      )
      .limit(1);
    if (!row || row.source !== "online" || !row.email) return;
    if (status === "cancelled" && row.startsAt <= new Date()) return;

    const locale = isLocale(row.locale) ? row.locale : "he";
    const origin = await siteUrl();
    const common = {
      to: row.email,
      locale,
      patientName: row.patientName,
      clinicName: ctx.clinic.name,
      treatmentName: row.treatmentName ?? "",
      startsAt: row.startsAt.toISOString(),
      timezone: ctx.clinic.timezone,
    };
    if (status === "confirmed") {
      const token = await rotateCancelToken(ctx.clinic.id, appointmentId);
      await sendBookingEmail({
        ...common,
        kind: "confirmed",
        cancelUrl: `${origin}/${locale}/book/cancel?token=${token}`,
      });
    } else {
      await sendBookingEmail({
        ...common,
        kind: "cancelled",
        bookUrl: `${origin}/${locale}/book/${row.clinicSlug}`,
      });
    }
  } catch {
    console.error("[booking] status email failed");
  }
}
