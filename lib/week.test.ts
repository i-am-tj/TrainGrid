import { describe, expect, it } from "vitest";
import {
  addWeeks,
  datesOfWeek,
  formatDayHeading,
  getISOWeekId,
  hourFromTime,
  isValidTime,
  isValidWeekId,
  isoDayFromDate,
  mondayOfWeek,
} from "./week";

function localDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

describe("ISO weeks", () => {
  it("keeps Monday–Sunday and local calendar dates", () => {
    const dates = datesOfWeek("2026-W36");
    expect(dates).toHaveLength(7);
    expect(dates.map((d) => isoDayFromDate(d))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(dates.map((d) => formatDayHeading(d).weekday)).toEqual([
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN",
    ]);
    expect(dates[0]!.getDate()).toBe(31);
    expect(dates[0]!.getMonth()).toBe(7);
    expect(dates[6]!.getDate()).toBe(6);
    expect(dates[6]!.getMonth()).toBe(8);
  });

  it("crosses month boundaries without UTC shift", () => {
    const dates = datesOfWeek(getISOWeekId(localDate(2026, 9, 1)));
    expect(isoDayFromDate(dates[0]!)).toBe(1);
    expect(dates.some((d) => d.getMonth() === 7)).toBe(true);
    expect(dates.some((d) => d.getMonth() === 8)).toBe(true);
  });

  it("places 1 Jan 2021 in 2020-W53", () => {
    expect(getISOWeekId(localDate(2021, 1, 1))).toBe("2020-W53");
  });

  it("places 29 Dec 2025 in 2026-W01", () => {
    expect(getISOWeekId(localDate(2025, 12, 29))).toBe("2026-W01");
  });

  it("handles leap day 29 Feb 2024 as a local calendar date", () => {
    const weekId = getISOWeekId(localDate(2024, 2, 29));
    const dates = datesOfWeek(weekId);
    expect(dates.some((d) => d.getFullYear() === 2024 && d.getMonth() === 1 && d.getDate() === 29)).toBe(true);
  });

  it("round-trips mondayOfWeek through getISOWeekId", () => {
    for (const id of ["2020-W53", "2021-W01", "2024-W09", "2026-W01", "2026-W36"]) {
      expect(getISOWeekId(mondayOfWeek(id))).toBe(id);
    }
  });

  it("navigates previous and next week without corrupting Monday start", () => {
    let id = "2026-W01";
    for (let i = 0; i < 60; i++) id = addWeeks(id, 1);
    for (let i = 0; i < 60; i++) id = addWeeks(id, -1);
    expect(id).toBe("2026-W01");
    expect(isoDayFromDate(mondayOfWeek(id))).toBe(1);
  });

  it("rejects invalid week ids", () => {
    expect(isValidWeekId("2026-W36")).toBe(true);
    expect(isValidWeekId("not-a-week")).toBe(false);
    expect(isValidWeekId("2026-36")).toBe(false);
  });
});

describe("times", () => {
  it("accepts 30-minute clock times only", () => {
    expect(isValidTime("07:00")).toBe(true);
    expect(isValidTime("07:30")).toBe(true);
    expect(isValidTime("22:00")).toBe(true);
    expect(isValidTime("07:15")).toBe(false);
    expect(isValidTime("25:00")).toBe(false);
  });

  it("maps half-hour starts into the containing hour", () => {
    expect(hourFromTime("06:00")).toBe(6);
    expect(hourFromTime("07:30")).toBe(7);
    expect(hourFromTime("12:00")).toBe(12);
    expect(hourFromTime("18:00")).toBe(18);
    expect(hourFromTime("22:00")).toBe(22);
  });
});
