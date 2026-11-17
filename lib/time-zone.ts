import { weekDayOfDate } from "./calendar-date";
import type { IsoDay } from "./domain";

/**
 * Which calendar day is "today" for a member (Epic 3 time-zone policy).
 *
 * Sessions are stored as calendar dates with no time zone (D-54), so "today"
 * must be decided in the member's own zone, not the server's (UTC on Vercel).
 *
 *   1. The browser writes its IANA time zone to the `tg_tz` cookie before the
 *      first paint (app/layout.tsx), and refreshes it when it changes.
 *   2. The server validates that value and uses it.
 *   3. Without a valid cookie (the very first request, or a bot), it uses
 *      TRAINGRID_DEFAULT_TIME_ZONE, else UTC.
 *
 * The same answer is used for /home and the planner, and the planner's own
 * client-side "today" highlight uses the browser's clock in the same zone,
 * so server and browser cannot disagree about which day it is.
 *
 * Pure: no Next.js imports.
 */

export const TIME_ZONE_COOKIE = "tg_tz";

const TIME_ZONE_SHAPE = /^[A-Za-z0-9_+\-/]{1,64}$/;

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !TIME_ZONE_SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(cookieValue: unknown, fallback: unknown): string {
  if (isValidTimeZone(cookieValue)) return cookieValue;
  if (isValidTimeZone(fallback)) return fallback;
  return "UTC";
}

/** "YYYY-MM-DD" for the instant `now` as seen in `timeZone`. */
export function calendarDateIn(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type MemberToday = {
  /** "YYYY-MM-DD" */
  date: string;
  weekId: string;
  day: IsoDay;
  timeZone: string;
};

export function todayIn(timeZone: string, now: Date = new Date()): MemberToday {
  const date = calendarDateIn(timeZone, now);
  const { weekId, day } = weekDayOfDate(date);
  return { date, weekId, day, timeZone };
}
