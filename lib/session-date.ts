import { addDays, isIsoDate, mondayOfIsoWeek, weekDayOfDate, weeksBetween } from "./calendar-date";

/**
 * Choosing the day of a session: one date, the same way when adding and when
 * moving one (PRODUCT_AUDIT F2). Dates are "YYYY-MM-DD" calendar dates, so all
 * of this is pure and independent of the server's time zone; "today" is the
 * member's own (lib/today.ts), passed in.
 */

export const DATE_MIN = "2000-01-01";
export const DATE_MAX = "2099-12-31";

/** Why a submitted date cannot be used, in words for beside the field; null when it can. */
export function dateProblem(value: string): string | null {
  const date = value.trim();
  if (!date) return "Choose a date.";
  if (!isIsoDate(date)) return "That isn’t a real date. Use the calendar to choose one.";
  if (date < DATE_MIN || date > DATE_MAX) return "Choose a date between 2000 and 2099.";
  return null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "Monday 4 January 2027" */
export function formatFullDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]} ${year}`;
}

/** Where a date sits relative to today: "today", "tomorrow", "next week", "in 3 weeks"… */
export function relativeToToday(isoDate: string, today: string): string {
  if (isoDate === today) return "today";
  if (isoDate === addDays(today, 1)) return "tomorrow";
  if (isoDate === addDays(today, -1)) return "yesterday";
  const weeks = weeksBetween(weekDayOfDate(today).weekId, weekDayOfDate(isoDate).weekId);
  if (weeks === 0) return "this week";
  if (weeks === 1) return "next week";
  if (weeks === -1) return "last week";
  return weeks > 1 ? `in ${weeks} weeks` : `${-weeks} weeks ago`;
}

/** The line under the date field: "Monday 4 January 2027 · next week". */
export function describeDate(isoDate: string, today: string): string | null {
  if (dateProblem(isoDate)) return null;
  return `${formatFullDate(isoDate)} · ${relativeToToday(isoDate, today)}`;
}

/** One-tap choices beside the calendar. Next Monday is always in the next week, even on a Sunday. */
export function dateShortcuts(today: string): Array<{ label: string; date: string }> {
  return [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "Next Monday", date: addDays(mondayOfIsoWeek(weekDayOfDate(today).weekId), 7) },
  ];
}
