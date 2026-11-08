import { z } from "zod";

/** The choices offered in Settings; anything else is rejected. */
export const MIN_NOTICE_OPTIONS = [0, 60, 120, 240, 720, 1440, 2880] as const;
export const WINDOW_DAYS_OPTIONS = [7, 14, 30, 60, 90] as const;
export const INTERVAL_OPTIONS = [15, 30, 60] as const;

const oneOf = (options: readonly number[]) =>
  z.coerce.number().refine((value) => options.includes(value));

export const bookingSettingsSchema = z.object({
  enabled: z.boolean(),
  autoConfirm: z.boolean(),
  minNoticeMinutes: oneOf(MIN_NOTICE_OPTIONS),
  windowDays: oneOf(WINDOW_DAYS_OPTIONS),
  intervalMinutes: oneOf(INTERVAL_OPTIONS),
});

export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>;
