import { describe, expect, it } from "vitest";
import {
  appointmentInputSchema,
  availabilityExceptionSchema,
  treatmentTypeSchema,
  workingHoursSchema,
} from "@/lib/validation/scheduling";
import {
  addDays,
  isIsoDate,
  isTime,
  todayIn,
  utcToZoned,
  zonedDayRange,
  zonedToUtc,
} from "./time";

const IL = "Asia/Jerusalem";
const hours = (range: { start: Date; end: Date }) =>
  (range.end.getTime() - range.start.getTime()) / 3_600_000;

describe("clinic time zone conversions (Israel)", () => {
  it("uses UTC+2 in winter and UTC+3 in summer", () => {
    expect(zonedToUtc("2026-01-15", "10:00", IL).toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    expect(zonedToUtc("2026-07-15", "10:00", IL).toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  it("round-trips wall-clock times", () => {
    const instant = zonedToUtc("2026-11-08", "16:45", IL);
    expect(utcToZoned(instant, IL)).toEqual({
      date: "2026-11-08",
      time: "16:45",
      weekday: 0, // Sunday
    });
  });

  it("has a 23-hour day when clocks go forward and a 25-hour day when they go back", () => {
    // Find this year's change days instead of hard-coding them.
    let short: string | null = null;
    let long: string | null = null;
    for (
      let date = "2026-01-01";
      date < "2027-01-01";
      date = addDays(date, 1)
    ) {
      const length = hours(zonedDayRange(date, IL));
      if (length === 23) short = date;
      if (length === 25) long = date;
    }
    expect(short).toMatch(/^2026-03-/);
    expect(long).toMatch(/^2026-10-/);
  });

  it("moves a skipped wall-clock time forward instead of failing", () => {
    let changeDay = "2026-03-01";
    while (hours(zonedDayRange(changeDay, IL)) !== 23) {
      changeDay = addDays(changeDay, 1);
    }
    // 02:30 doesn't exist on that night in Israel.
    const instant = zonedToUtc(changeDay, "02:30", IL);
    expect(utcToZoned(instant, IL).time).toBe("03:30");
  });

  it("knows today's date in the clinic even when UTC is still yesterday", () => {
    // 23:30 UTC on 7 Nov is 01:30 on 8 Nov in Israel.
    expect(todayIn(IL, new Date("2026-11-07T23:30:00Z"))).toBe("2026-11-08");
  });

  it("validates dates and times", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isTime("09:05")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("9:05")).toBe(false);
  });
});

describe("treatment type input", () => {
  it("parses price in shekels to agorot", () => {
    const parse = (price: string) =>
      treatmentTypeSchema.parse({
        name: "Reflexology",
        durationMinutes: "45",
        priceAgorot: price,
        color: "teal",
      }).priceAgorot;
    expect(parse("250")).toBe(25000);
    expect(parse("250.5")).toBe(25050);
    expect(parse("250,50")).toBe(25050);
    expect(parse("")).toBeNull();
  });

  it.each([
    [{ durationMinutes: "3" }, "durationInvalid"],
    [{ durationMinutes: "500" }, "durationInvalid"],
    [{ priceAgorot: "-5" }, "priceInvalid"],
    [{ priceAgorot: "12.345" }, "priceInvalid"],
    [{ color: "pink" }, "colorInvalid"],
  ])("rejects %o", (override, message) => {
    const result = treatmentTypeSchema.safeParse({
      name: "Reflexology",
      durationMinutes: "45",
      priceAgorot: "",
      color: "teal",
      ...override,
    });
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("appointment input", () => {
  const valid = {
    patientId: "0b8e3f2a-1c4d-4e5f-8a9b-0c1d2e3f4a5b",
    treatmentTypeId: "",
    date: "2026-11-10",
    time: "10:30",
    durationMinutes: "45",
  };

  it("accepts a valid booking without a treatment type", () => {
    expect(appointmentInputSchema.parse(valid)).toMatchObject({
      treatmentTypeId: null,
      durationMinutes: 45,
    });
  });

  it.each([
    [{ patientId: "" }, "patientRequired"],
    [{ date: "2026-13-01" }, "dateInvalid"],
    [{ time: "25:00" }, "timeInvalid"],
    [{ durationMinutes: "0" }, "durationInvalid"],
  ])("rejects %o", (override, message) => {
    expect(
      appointmentInputSchema.safeParse({ ...valid, ...override }).error
        ?.issues[0]?.message,
    ).toBe(message);
  });
});

describe("working hours", () => {
  const week = (sunday: { start: string; end: string }[]) => [
    sunday,
    [],
    [],
    [],
    [],
    [],
    [],
  ];

  it("accepts split days", () => {
    expect(
      workingHoursSchema.safeParse(
        week([
          { start: "08:00", end: "12:00" },
          { start: "16:00", end: "20:00" },
        ]),
      ).success,
    ).toBe(true);
  });

  it("rejects overlapping and backwards ranges", () => {
    expect(
      workingHoursSchema.safeParse(
        week([
          { start: "08:00", end: "12:00" },
          { start: "11:00", end: "14:00" },
        ]),
      ).success,
    ).toBe(false);
    expect(
      workingHoursSchema.safeParse(week([{ start: "12:00", end: "08:00" }]))
        .success,
    ).toBe(false);
  });

  it("needs all seven days", () => {
    expect(workingHoursSchema.safeParse([[]]).success).toBe(false);
  });

  it("turns a closed day into an exception without times", () => {
    expect(
      availabilityExceptionSchema.parse({
        date: "2026-12-25",
        closed: true,
        start: "",
        end: "",
      }),
    ).toEqual({ date: "2026-12-25", start: null, end: null });
    expect(
      availabilityExceptionSchema.safeParse({
        date: "2026-12-25",
        closed: false,
        start: "13:00",
        end: "09:00",
      }).success,
    ).toBe(false);
  });
});
