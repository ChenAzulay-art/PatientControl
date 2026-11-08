import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, clinicSettings, treatmentTypes } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { BookingSettingsInput } from "@/lib/validation/booking";
import type { ClinicContext } from "./context";

export type BookingSettings = BookingSettingsInput & {
  /** Warnings shown in Settings when booking can't offer anything yet. */
  hasBookableTypes: boolean;
  hasWorkingHours: boolean;
};

export async function getBookingSettings(
  ctx: ClinicContext,
): Promise<BookingSettings> {
  const [[settings], [bookable], [hours]] = await Promise.all([
    db
      .select({
        enabled: clinicSettings.bookingEnabled,
        autoConfirm: clinicSettings.bookingAutoConfirm,
        minNoticeMinutes: clinicSettings.bookingMinNoticeMinutes,
        windowDays: clinicSettings.bookingWindowDays,
        intervalMinutes: clinicSettings.bookingSlotIntervalMinutes,
      })
      .from(clinicSettings)
      .where(eq(clinicSettings.clinicId, ctx.clinic.id))
      .limit(1),
    db
      .select({ id: treatmentTypes.id })
      .from(treatmentTypes)
      .where(
        and(
          eq(treatmentTypes.clinicId, ctx.clinic.id),
          eq(treatmentTypes.active, true),
          eq(treatmentTypes.bookableOnline, true),
        ),
      )
      .limit(1),
    db
      .select({ id: availabilityRules.id })
      .from(availabilityRules)
      .where(eq(availabilityRules.clinicId, ctx.clinic.id))
      .limit(1),
  ]);
  return {
    enabled: settings?.enabled ?? false,
    autoConfirm: settings?.autoConfirm ?? true,
    minNoticeMinutes: settings?.minNoticeMinutes ?? 720,
    windowDays: settings?.windowDays ?? 30,
    intervalMinutes: settings?.intervalMinutes ?? 30,
    hasBookableTypes: Boolean(bookable),
    hasWorkingHours: Boolean(hours),
  };
}

export async function updateBookingSettings(
  ctx: ClinicContext,
  input: BookingSettingsInput,
): Promise<void> {
  const values = {
    bookingEnabled: input.enabled,
    bookingAutoConfirm: input.autoConfirm,
    bookingMinNoticeMinutes: input.minNoticeMinutes,
    bookingWindowDays: input.windowDays,
    bookingSlotIntervalMinutes: input.intervalMinutes,
  };
  await db
    .insert(clinicSettings)
    .values({ clinicId: ctx.clinic.id, ...values })
    .onConflictDoUpdate({ target: clinicSettings.clinicId, set: values });
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "booking_settings.updated",
    entity: "clinic",
    entityId: ctx.clinic.id,
  });
}
