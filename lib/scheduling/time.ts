import { DateTime } from "luxon";

/**
 * Appointments are stored as absolute instants (timestamptz). People enter
 * and read them as wall-clock times in the clinic's time zone, so every
 * conversion goes through these helpers, which follow daylight-saving
 * changes. A wall-clock time that doesn't exist (the hour skipped when
 * clocks go forward) moves forward to the next valid time.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE.test(value) &&
    DateTime.fromISO(value, { zone: "UTC" }).isValid
  );
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}

/** Clinic wall-clock date + time → instant. */
export function zonedToUtc(date: string, time: string, zone: string): Date {
  const local = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!local.isValid) throw new Error(`Invalid date/time: ${date} ${time}`);
  return local.toUTC().toJSDate();
}

/** Instant → clinic wall-clock parts. Weekday is 0 = Sunday … 6 = Saturday. */
export function utcToZoned(
  instant: Date,
  zone: string,
): { date: string; time: string; weekday: number } {
  const local = DateTime.fromJSDate(instant, { zone });
  return {
    date: local.toISODate()!,
    time: local.toFormat("HH:mm"),
    weekday: local.weekday % 7,
  };
}

/** The instants where a clinic day starts and the next one starts. */
export function zonedDayRange(
  date: string,
  zone: string,
): { start: Date; end: Date } {
  const start = DateTime.fromISO(date, { zone }).startOf("day");
  return {
    start: start.toJSDate(),
    end: start.plus({ days: 1 }).toJSDate(),
  };
}

/** Today's date in the clinic's time zone. */
export function todayIn(zone: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone }).toISODate()!;
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: "UTC" }).plus({ days }).toISODate()!;
}

/** "HH:mm[:ss]" → minutes after midnight. */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "HH:mm:ss" from the database → "HH:mm" for forms and display. */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * The current time, for Server Components deciding e.g. whether a session
 * has ended. They render once per request, so reading the clock is fine.
 */
export function requestTime(): number {
  return Date.now();
}
