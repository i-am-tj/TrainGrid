import { describe, expect, it } from "vitest";
import { weekDayOfDate } from "./calendar-date";
import { dateProblem, dateShortcuts, describeDate, formatFullDate, relativeToToday } from "./session-date";

describe("dateProblem", () => {
  it("accepts real dates in range", () => {
    expect(dateProblem("2026-11-30")).toBeNull();
    expect(dateProblem(" 2027-01-04 ")).toBeNull();
    expect(dateProblem("2028-02-29")).toBeNull();
  });

  it("explains what is wrong", () => {
    expect(dateProblem("")).toBe("Choose a date.");
    expect(dateProblem("2026-02-30")).toMatch(/isn’t a real date/);
    expect(dateProblem("2026-W60")).toMatch(/isn’t a real date/);
    expect(dateProblem("1999-12-31")).toBe("Choose a date between 2000 and 2099.");
    expect(dateProblem("2100-01-01")).toBe("Choose a date between 2000 and 2099.");
  });
});

describe("describing a date", () => {
  it("names the weekday and where it sits from today", () => {
    expect(formatFullDate("2027-01-04")).toBe("Monday 4 January 2027");
    // Sunday 3 January 2027 → Monday 4 January is tomorrow, in the next ISO week.
    expect(describeDate("2027-01-04", "2027-01-03")).toBe("Monday 4 January 2027 · tomorrow");
    expect(relativeToToday("2026-11-23", "2026-11-23")).toBe("today");
    expect(relativeToToday("2026-11-27", "2026-11-23")).toBe("this week");
    expect(relativeToToday("2026-12-03", "2026-11-23")).toBe("next week");
    expect(relativeToToday("2027-01-05", "2026-12-28")).toBe("next week"); // December → January
    expect(relativeToToday("2026-12-21", "2026-11-23")).toBe("in 4 weeks");
    expect(relativeToToday("2026-11-17", "2026-11-23")).toBe("last week");
    expect(relativeToToday("2026-11-02", "2026-11-23")).toBe("3 weeks ago");
    expect(describeDate("", "2026-11-23")).toBeNull();
  });
});

describe("dateShortcuts", () => {
  it("offers today, tomorrow and next Monday", () => {
    expect(dateShortcuts("2026-11-25")).toEqual([
      { label: "Today", date: "2026-11-25" },
      { label: "Tomorrow", date: "2026-11-26" },
      { label: "Next Monday", date: "2026-11-30" },
    ]);
  });

  it("from a Sunday, next Monday is tomorrow and starts the next week", () => {
    const [, tomorrow, nextMonday] = dateShortcuts("2027-01-03");
    expect(tomorrow!.date).toBe("2027-01-04");
    expect(nextMonday!.date).toBe("2027-01-04");
    expect(weekDayOfDate(nextMonday!.date)).toEqual({ weekId: "2027-W01", day: 1 });
  });

  it("from a Monday, next Monday is a week away", () => {
    expect(dateShortcuts("2026-12-28")[2]!.date).toBe("2027-01-04");
  });
});
