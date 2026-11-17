import { describe, expect, it } from "vitest";
import { calendarDateIn, isValidTimeZone, resolveTimeZone, todayIn } from "./time-zone";

describe("isValidTimeZone", () => {
  it("accepts IANA zones", () => {
    for (const zone of ["UTC", "Australia/Sydney", "America/Argentina/Buenos_Aires", "Etc/GMT+10"]) {
      expect(isValidTimeZone(zone), zone).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const zone of ["", "Mars/Olympus", "Australia/Sydney; path=/", "<script>", "a".repeat(80), 42, null]) {
      expect(isValidTimeZone(zone), String(zone)).toBe(false);
    }
  });
});

describe("resolveTimeZone", () => {
  it("prefers a valid cookie, then a valid fallback, then UTC", () => {
    expect(resolveTimeZone("Asia/Kolkata", "Australia/Sydney")).toBe("Asia/Kolkata");
    expect(resolveTimeZone("nope", "Australia/Sydney")).toBe("Australia/Sydney");
    expect(resolveTimeZone(undefined, "also nope")).toBe("UTC");
  });
});

describe("todayIn", () => {
  // 2026-11-15T14:30Z is Sunday afternoon in London, already Monday in Sydney,
  // and still Sunday morning in Los Angeles.
  const instant = new Date("2026-11-15T14:30:00Z");

  it("decides the calendar day in the member's zone, not the server's", () => {
    expect(calendarDateIn("UTC", instant)).toBe("2026-11-15");
    expect(calendarDateIn("Australia/Sydney", instant)).toBe("2026-11-16");
    expect(calendarDateIn("America/Los_Angeles", instant)).toBe("2026-11-15");
  });

  it("crosses an ISO week boundary at the member's midnight", () => {
    expect(todayIn("UTC", instant)).toEqual({
      date: "2026-11-15",
      weekId: "2026-W46",
      day: 7,
      timeZone: "UTC",
    });
    expect(todayIn("Australia/Sydney", instant)).toEqual({
      date: "2026-11-16",
      weekId: "2026-W47",
      day: 1,
      timeZone: "Australia/Sydney",
    });
  });

  it("handles the ISO year boundary", () => {
    // 2026-12-31 (Thursday) in Sydney is already 2027-01-01 (Friday, 2026-W53).
    const newYear = new Date("2026-12-31T14:00:00Z");
    expect(todayIn("Australia/Sydney", newYear)).toMatchObject({ date: "2027-01-01", weekId: "2026-W53", day: 5 });
  });
});
