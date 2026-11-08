import { z } from "zod";
import { treatmentColorNames } from "@/lib/scheduling/colors";
import { isIsoDate, isTime, minutesOfDay } from "@/lib/scheduling/time";

export const DURATION_MIN = 5;
export const DURATION_MAX = 480;

const duration = z.coerce
  .number()
  .int({ message: "durationInvalid" })
  .min(DURATION_MIN, { message: "durationInvalid" })
  .max(DURATION_MAX, { message: "durationInvalid" });

/** "250" or "250.50" shekels → 25000 / 25050 agorot; empty → null. */
const priceAgorot = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    if (!/^\d{1,6}([.,]\d{1,2})?$/.test(value)) {
      ctx.addIssue({ code: "custom", message: "priceInvalid" });
      return z.NEVER;
    }
    return Math.round(Number(value.replace(",", ".")) * 100);
  });

export const treatmentTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "nameInvalid" })
    .max(60, { message: "nameInvalid" }),
  durationMinutes: duration,
  priceAgorot,
  color: z.enum(treatmentColorNames, { message: "colorInvalid" }),
});
export type TreatmentTypeInput = z.infer<typeof treatmentTypeSchema>;

export const appointmentInputSchema = z.object({
  patientId: z.uuid({ message: "patientRequired" }),
  treatmentTypeId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  date: z.string().refine(isIsoDate, { message: "dateInvalid" }),
  time: z.string().refine(isTime, { message: "timeInvalid" }),
  durationMinutes: duration,
});
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

/** A dragged or resized appointment: new absolute start and end. */
export const appointmentMoveSchema = z
  .object({
    appointmentId: z.uuid(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    ({ startsAt, endsAt }) => {
      const minutes = (Date.parse(endsAt) - Date.parse(startsAt)) / 60_000;
      return minutes >= DURATION_MIN && minutes <= DURATION_MAX;
    },
    { message: "durationInvalid" },
  );

const timeRange = z
  .object({
    start: z.string().refine(isTime),
    end: z.string().refine(isTime),
  })
  .refine(({ start, end }) => minutesOfDay(end) > minutesOfDay(start), {
    message: "rangeInvalid",
  });

/** Weekly hours: for each weekday (0 = Sunday), zero or more ranges that don't overlap. */
export const workingHoursSchema = z
  .array(z.array(timeRange).max(4))
  .length(7)
  .refine(
    (days) =>
      days.every((ranges) => {
        const sorted = [...ranges].sort(
          (a, b) => minutesOfDay(a.start) - minutesOfDay(b.start),
        );
        return sorted.every(
          (range, i) =>
            i === 0 ||
            minutesOfDay(range.start) >= minutesOfDay(sorted[i - 1].end),
        );
      }),
    { message: "rangesOverlap" },
  );
export type WorkingHours = z.infer<typeof workingHoursSchema>;

export const availabilityExceptionSchema = z
  .object({
    date: z.string().refine(isIsoDate, { message: "dateInvalid" }),
    closed: z.boolean(),
    start: z.string(),
    end: z.string(),
  })
  .transform((value, ctx) => {
    if (value.closed) return { date: value.date, start: null, end: null };
    if (
      !isTime(value.start) ||
      !isTime(value.end) ||
      minutesOfDay(value.end) <= minutesOfDay(value.start)
    ) {
      ctx.addIssue({ code: "custom", message: "rangeInvalid" });
      return z.NEVER;
    }
    return { date: value.date, start: value.start, end: value.end };
  });
