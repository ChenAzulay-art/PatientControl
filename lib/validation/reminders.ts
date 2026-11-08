import { z } from "zod";

/** How long before an appointment the reminder goes out (minutes). */
export const REMINDER_LEAD_OPTIONS = [120, 360, 720, 1440, 2880] as const;
export const DEFAULT_REMINDER_LEAD_MINUTES = 1440;

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  leadMinutes: z.coerce
    .number()
    .refine((value) =>
      (REMINDER_LEAD_OPTIONS as readonly number[]).includes(value),
    ),
});

export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;
