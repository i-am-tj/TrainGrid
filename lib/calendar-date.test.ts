import { describe, expect, it } from "vitest";
import {
  addDays,
  dateOfWeekDay,
  isIsoDate,
  isRealWeekId,
  mondayOfIsoWeek,
  weekDateRange,
  weekDayOfDate,
  weeksBetween,
} from "./calendar-date";
import type { IsoDay } from "./domain";

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-11-16")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
    expect(isIsoDate("16/11/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("ISO weeks", () => {
  it("finds the Monday of a week, including across year ends", () => {
    expect(mondayOfIsoWeek("2026-W46")).toBe("2026-11-09");
    expect(mondayOfIsoWeek("2026-W01")).toBe("2025-12-29");
    expect(mondayOfIsoWeek("2027-W01")).toBe("2027-01-04");
    expect(mondayOfIsoWeek("2026-W53")).toBe("2026-12-28");
  });

  it("maps weekday to date and back", () => {
    for (let day = 1; day <= 7; day++) {
      const date = dateOfWeekDay("2026-W46", day as IsoDay);
      expect(weekDayOfDate(date)).toEqual({ weekId: "2026-W46", day });
    }
    expect(dateOfWeekDay("2026-W46", 7)).toBe("2026-11-15");
    expect(weekDayOfDate("2027-01-01")).toEqual({ weekId: "2026-W53", day: 5 });
    expect(weekDayOfDate("2025-12-29")).toEqual({ weekId: "2026-W01", day: 1 });
  });

  it("gives the inclusive range of a week", () => {
    expect(weekDateRange("2026-W46")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
  });

  it("counts weeks between two weeks across a year end", () => {
    expect(weeksBetween("2026-W46", "2026-W47")).toBe(1);
    expect(weeksBetween("2026-W52", "2027-W01")).toBe(2);
    expect(weeksBetween("2026-W47", "2026-W46")).toBe(-1);
  });

  it("knows which week ids exist", () => {
    expect(isRealWeekId("2026-W46")).toBe(true);
    expect(isRealWeekId("2026-W53")).toBe(true);
    expect(isRealWeekId("2027-W53")).toBe(false);
    expect(isRealWeekId("2026-W00")).toBe(false);
    expect(isRealWeekId("2026-W54")).toBe(false);
    expect(isRealWeekId("2026-46")).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
