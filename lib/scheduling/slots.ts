import { minutesOfDay, todayIn, addDays, utcToZoned, zonedToUtc } from "./time";

export type TimeRange = { start: string; end: string };

/** Weekly hours: index 0 = Sunday … 6 = Saturday. */
export type WeeklyHours = TimeRange[][];

export type AvailabilityException = {
  id: string;
  date: string;
  /** null = closed all day */
  range: TimeRange | null;
};

/**
 * The open hours for one date: the exceptions for that date if there are
 * any (a closed one contributes nothing), otherwise the weekly ranges.
 */
export function hoursForDate(
  weekly: WeeklyHours,
  exceptions: AvailabilityException[],
  date: string,
  weekday: number,
): TimeRange[] {
  const dayExceptions = exceptions.filter((e) => e.date === date);
  if (dayExceptions.length > 0) {
    return dayExceptions
      .flatMap((e) => (e.range ? [e.range] : []))
      .sort((a, b) => minutesOfDay(a.start) - minutesOfDay(b.start));
  }
  return weekly[weekday] ?? [];
}

export type Slot = { time: string; startsAt: string };
export type DaySlots = { date: string; slots: Slot[] };

const pad = (n: number) => String(n).padStart(2, "0");
const toTime = (minutes: number) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * Start times a patient can book online.
 *
 * A slot is offered when the whole appointment fits inside an open range,
 * it starts at least `minNoticeMinutes` from `now`, and it doesn't overlap
 * any busy time. Days run from today (in the clinic's time zone) for
 * `windowDays`. Times are wall-clock times in `timezone`; a time skipped by
 * a daylight-saving change is left out.
 */
export function availableSlots({
  timezone,
  weekly,
  exceptions,
  busy,
  now,
  minNoticeMinutes,
  windowDays,
  intervalMinutes,
  durationMinutes,
}: {
  timezone: string;
  weekly: WeeklyHours;
  exceptions: AvailabilityException[];
  busy: { start: Date; end: Date }[];
  now: Date;
  minNoticeMinutes: number;
  windowDays: number;
  intervalMinutes: number;
  durationMinutes: number;
}): DaySlots[] {
  const earliest = now.getTime() + minNoticeMinutes * 60_000;
  const step = Math.max(5, intervalMinutes);
  const length = durationMinutes * 60_000;
  const today = todayIn(timezone, now);
  const days: DaySlots[] = [];

  for (let offset = 0; offset < windowDays; offset++) {
    const date = addDays(today, offset);
    const weekday = utcToZoned(
      zonedToUtc(date, "12:00", timezone),
      timezone,
    ).weekday;
    const slots: Slot[] = [];

    for (const range of hoursForDate(weekly, exceptions, date, weekday)) {
      const end = minutesOfDay(range.end);
      for (
        let start = minutesOfDay(range.start);
        start + durationMinutes <= end;
        start += step
      ) {
        const time = toTime(start);
        const startsAt = zonedToUtc(date, time, timezone);
        // Skipped by a daylight-saving change: the instant lands on another wall-clock time.
        if (utcToZoned(startsAt, timezone).time !== time) continue;
        const from = startsAt.getTime();
        if (from < earliest) continue;
        const to = from + length;
        const clash = busy.some(
          (b) => from < b.end.getTime() && to > b.start.getTime(),
        );
        if (!clash) slots.push({ time, startsAt: startsAt.toISOString() });
      }
    }
    if (slots.length > 0) days.push({ date, slots });
  }
  return days;
}
