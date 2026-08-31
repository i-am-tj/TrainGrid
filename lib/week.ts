import type { IsoDay } from "./domain";

const WEEK_ID = /^(\d{4})-W(\d{2})$/;

export function getISOWeekId(date: Date): string {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = tmp.getDay() || 7;
  tmp.setDate(tmp.getDate() + 4 - day);
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return formatWeekId(tmp.getFullYear(), week);
}

export function formatWeekId(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function parseWeekId(weekId: string): { year: number; week: number } {
  const match = WEEK_ID.exec(weekId);
  if (!match) {
    throw new Error(`Invalid week id: ${weekId}`);
  }
  return { year: Number(match[1]), week: Number(match[2]) };
}

export function isValidWeekId(weekId: string): boolean {
  return WEEK_ID.test(weekId);
}

export function mondayOfWeek(weekId: string): Date {
  const { year, week } = parseWeekId(weekId);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(year, 0, 4 - jan4Day + 1);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  return monday;
}

export function datesOfWeek(weekId: string): Date[] {
  const monday = mondayOfWeek(weekId);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function addWeeks(weekId: string, delta: number): string {
  const monday = mondayOfWeek(weekId);
  monday.setDate(monday.getDate() + delta * 7);
  return getISOWeekId(monday);
}

export function isoDayFromDate(date: Date): IsoDay {
  const n = date.getDay();
  return (n === 0 ? 7 : n) as IsoDay;
}

export function todayParts(): {
  weekId: string;
  day: IsoDay;
  date: Date;
} {
  const date = new Date();
  return {
    weekId: getISOWeekId(date),
    day: isoDayFromDate(date),
    date,
  };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_NARROW = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function formatWeekLabel(weekId: string): string {
  const monday = mondayOfWeek(weekId);
  return `Week of ${formatShortDate(monday)}`;
}

export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDayHeading(date: Date): { weekday: string; dayNum: string } {
  return {
    weekday: WEEKDAYS_SHORT[date.getDay()]!.toUpperCase(),
    dayNum: String(date.getDate()),
  };
}

export function formatLongDay(date: Date): string {
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDayNarrow(date: Date): string {
  return WEEKDAYS_NARROW[date.getDay()]!;
}

export function nearbyWeekIds(centerWeekId: string, radius = 8): string[] {
  const ids: string[] = [];
  for (let i = -radius; i <= radius; i++) {
    ids.push(addWeeks(centerWeekId, i));
  }
  return ids;
}

export function isValidTime(time: string): boolean {
  return /^(?:[01]\d|2[0-3]):(?:00|30)$/.test(time);
}

export function hourFromTime(time: string): number {
  if (!isValidTime(time)) return 0;
  return Number(time.slice(0, 2));
}

export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
