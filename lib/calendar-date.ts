import type { IsoDay } from "./domain";
import { formatWeekId, isValidWeekId, parseWeekId } from "./week";

/**
 * Calendar dates as stored in the database: "YYYY-MM-DD", with no time and no
 * time zone. All arithmetic here is done in UTC so the result never depends
 * on the server's time zone.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function toUtc(isoDate: string): Date {
  if (!isIsoDate(isoDate)) throw new Error(`Invalid date: ${isoDate}`);
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return fromUtc(new Date(toUtc(isoDate).getTime() + days * DAY_MS));
}

/** Monday of an ISO week, e.g. "2026-W46" → "2026-11-09". */
export function mondayOfIsoWeek(weekId: string): string {
  const { year, week } = parseWeekId(weekId);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() + (1 - jan4Day + (week - 1) * 7) * DAY_MS);
  return fromUtc(monday);
}

/** The date of a weekday (1 = Monday … 7 = Sunday) in an ISO week. */
export function dateOfWeekDay(weekId: string, day: IsoDay): string {
  return addDays(mondayOfIsoWeek(weekId), day - 1);
}

/** The ISO week and weekday a date falls on. */
export function weekDayOfDate(isoDate: string): { weekId: string; day: IsoDay } {
  const date = toUtc(isoDate);
  const day = (date.getUTCDay() || 7) as IsoDay;
  const thursday = new Date(date.getTime() + (4 - day) * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7);
  return { weekId: formatWeekId(thursday.getUTCFullYear(), week), day };
}

/** First and last date (inclusive) of an ISO week. */
export function weekDateRange(weekId: string): { start: string; end: string } {
  const start = mondayOfIsoWeek(weekId);
  return { start, end: addDays(start, 6) };
}

/** Whole weeks from one ISO week to another (may be negative). */
export function weeksBetween(fromWeekId: string, toWeekId: string): number {
  const from = toUtc(mondayOfIsoWeek(fromWeekId)).getTime();
  const to = toUtc(mondayOfIsoWeek(toWeekId)).getTime();
  return Math.round((to - from) / (7 * DAY_MS));
}

/** True for a well-formed week id that names a week that exists (W53 only in long years). */
export function isRealWeekId(weekId: string): boolean {
  if (!isValidWeekId(weekId)) return false;
  const { week } = parseWeekId(weekId);
  if (week < 1 || week > 53) return false;
  return weekDayOfDate(mondayOfIsoWeek(weekId)).weekId === weekId;
}
