import { describe, expect, it } from "vitest";
import { availableSlots, hoursForDate, type WeeklyHours } from "./slots";
import { addDays, zonedDayRange, zonedToUtc } from "./time";

const IL = "Asia/Jerusalem";

/** 09:00–12:00 every day. */
const everyDay: WeeklyHours = Array.from({ length: 7 }, () => [
  { start: "09:00", end: "12:00" },
]);

function slots(overrides: Partial<Parameters<typeof availableSlots>[0]> = {}) {
  return availableSlots({
    timezone: IL,
    weekly: everyDay,
    exceptions: [],
    busy: [],
    // Tuesday 1 Dec 2026, 07:00 in Israel (UTC+2).
    now: new Date("2026-12-01T05:00:00Z"),
    minNoticeMinutes: 0,
    windowDays: 1,
    intervalMinutes: 30,
    durationMinutes: 60,
    ...overrides,
  });
}

const times = (days: ReturnType<typeof slots>) =>
  days.flatMap((day) => day.slots.map((slot) => `${day.date} ${slot.time}`));

describe("availableSlots", () => {
  it("offers start times where the whole appointment fits", () => {
    expect(times(slots())).toEqual([
      "2026-12-01 09:00",
      "2026-12-01 09:30",
      "2026-12-01 10:00",
      "2026-12-01 10:30",
      "2026-12-01 11:00",
    ]);
  });

  it("returns instants in UTC for the clinic's wall-clock times", () => {
    expect(slots()[0].slots[0].startsAt).toBe("2026-12-01T07:00:00.000Z");
  });

  it("follows the slot spacing and treatment length", () => {
    expect(times(slots({ intervalMinutes: 60, durationMinutes: 90 }))).toEqual([
      "2026-12-01 09:00",
      "2026-12-01 10:00",
    ]);
  });

  it("leaves out times that overlap a booked appointment", () => {
    const busy = [
      {
        start: zonedToUtc("2026-12-01", "10:00", IL),
        end: zonedToUtc("2026-12-01", "10:45", IL),
      },
    ];
    expect(times(slots({ busy }))).toEqual([
      "2026-12-01 09:00",
      "2026-12-01 11:00",
    ]);
  });

  it("respects the minimum notice", () => {
    // Now is 07:00; with 3 hours' notice the first slot is 10:00.
    expect(times(slots({ minNoticeMinutes: 180 }))).toEqual([
      "2026-12-01 10:00",
      "2026-12-01 10:30",
      "2026-12-01 11:00",
    ]);
  });

  it("uses days off and special hours instead of the weekly hours", () => {
    const result = slots({
      windowDays: 2,
      exceptions: [
        { id: "a", date: "2026-12-01", range: null },
        {
          id: "b",
          date: "2026-12-02",
          range: { start: "16:00", end: "17:00" },
        },
      ],
    });
    expect(times(result)).toEqual(["2026-12-02 16:00"]);
  });

  it("covers the booking window and skips closed weekdays", () => {
    const sundayOnly: WeeklyHours = [
      [{ start: "09:00", end: "10:00" }],
      [],
      [],
      [],
      [],
      [],
      [],
    ];
    const result = slots({ weekly: sundayOnly, windowDays: 14 });
    expect(result.map((day) => day.date)).toEqual(["2026-12-06", "2026-12-13"]);
  });

  it("splits days with several ranges", () => {
    const split: WeeklyHours = Array.from({ length: 7 }, () => [
      { start: "08:00", end: "09:00" },
      { start: "17:00", end: "18:00" },
    ]);
    expect(times(slots({ weekly: split }))).toEqual([
      "2026-12-01 08:00",
      "2026-12-01 17:00",
    ]);
  });

  it("skips the hour that doesn't exist when clocks go forward", () => {
    let changeDay = "2026-03-01";
    while (
      zonedDayRange(changeDay, IL).end.getTime() -
        zonedDayRange(changeDay, IL).start.getTime() !==
      23 * 3_600_000
    ) {
      changeDay = addDays(changeDay, 1);
    }
    const night: WeeklyHours = Array.from({ length: 7 }, () => [
      { start: "01:00", end: "05:00" },
    ]);
    const result = availableSlots({
      timezone: IL,
      weekly: night,
      exceptions: [],
      busy: [],
      now: zonedDayRange(changeDay, IL).start,
      minNoticeMinutes: 0,
      windowDays: 1,
      intervalMinutes: 60,
      durationMinutes: 30,
    });
    // 02:00 doesn't exist that night in Israel.
    expect(result[0].slots.map((slot) => slot.time)).toEqual([
      "01:00",
      "03:00",
      "04:00",
    ]);
  });
});

describe("hoursForDate", () => {
  it("falls back to the weekly hours when there's no exception", () => {
    expect(hoursForDate(everyDay, [], "2026-12-01", 2)).toEqual(everyDay[2]);
  });
});
