import type {
  DashboardData,
  DashboardDay,
  DashboardRoutine,
  DashboardSession,
  DashboardWeek,
} from "@/components/dashboard/types";
import { addDays, mondayOfIsoWeek } from "@/lib/calendar-date";
import type { ScheduledSessionRecord } from "@/lib/data/model";
import { toPlannerSession } from "@/lib/data/planner";
import { SESSION_TYPE_LABELS, compareSessions, type EquipmentType, type SessionType } from "@/lib/domain";
import { equipmentUsed, routineAtAGlance } from "@/lib/library/summary";
import type { MemberToday } from "@/lib/time-zone";

/**
 * Turns the member's own records into the dashboard's display contract
 * (components/dashboard/types.ts). Pure: no queries, no clock, no fixtures.
 *
 * Counts are PLANNED sessions per day, never completion or performance.
 * Every link is a local path built from ids and dates the data layer
 * returned for this member.
 */

export type DashboardRoutineInput = {
  id: string;
  name: string;
  category: SessionType;
  itemCount: number;
  equipment: readonly EquipmentType[];
};

export type DashboardInput = {
  today: MemberToday;
  displayName: string | null;
  /** True during the member's first session after accepting their invitation. */
  firstVisit?: boolean;
  /** Every session of today's ISO week, for this member only. */
  weekSessions: readonly ScheduledSessionRecord[];
  /** The member's own PERSONAL routines, already ordered and capped. */
  routines: readonly DashboardRoutineInput[];
};

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Calendar dates are formatted at UTC midnight, so the server zone never shifts them. */
function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function formatDashboardDate(isoDate: string): string {
  return LONG_DATE.format(utcDate(isoDate));
}

/** 45 → "45 min", 60 → "1 h", 90 → "1 h 30 min"; null stays null. */
export function formatDuration(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A brief, honest summary of the session's own snapshot. */
export function sessionDetail(session: ScheduledSessionRecord): string {
  if (session.items.length > 0) {
    return routineAtAGlance(session.items.length, equipmentUsed(session.items));
  }
  const notes = session.notes.replace(/\s+/g, " ").trim();
  return notes.length > 140 ? `${notes.slice(0, 139).trimEnd()}…` : notes;
}

function weekHref(weekId: string, day: number): string {
  return `/week/${weekId}?day=${day}`;
}

export type DashboardFrame = Omit<DashboardData, "todaySessions" | "week" | "routines">;

/** The parts of the dashboard that need no query: greeting, date and links. */
export function prepareDashboardFrame({
  today,
  displayName,
  firstVisit = false,
}: Pick<DashboardInput, "today" | "displayName" | "firstVisit">): DashboardFrame {
  return {
    displayName,
    firstVisit,
    dateLabel: formatDashboardDate(today.date),
    plannerHref: weekHref(today.weekId, today.day),
    addSessionHref: `/week/${today.weekId}/add?day=${today.day}`,
    myLibraryHref: "/library?scope=mine",
    sharedLibraryHref: "/library?scope=global",
    createRoutineHref: "/library/new",
  };
}

/** Today's sessions and the week's planned counts, from one read of the week. */
export function prepareDashboardWeek(
  today: MemberToday,
  weekSessions: readonly ScheduledSessionRecord[],
): Pick<DashboardData, "todaySessions" | "week"> {
  const monday = mondayOfIsoWeek(today.weekId);
  const counts = new Map<string, number>();
  for (const session of weekSessions) {
    counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
  }

  const days = Array.from({ length: 7 }, (_, index): DashboardDay => {
    const date = addDays(monday, index);
    const isToday = date === today.date;
    return {
      date,
      weekdayLabel: WEEKDAY.format(utcDate(date)),
      dayLabel: String(Number(date.slice(8, 10))),
      plannedCount: counts.get(date) ?? 0,
      isToday,
      isSelected: isToday,
      href: weekHref(today.weekId, index + 1),
    };
  });
  const week = days as unknown as DashboardWeek;

  // The planner's own order: untimed first, then by start time.
  const todaySessions = weekSessions
    .filter((session) => session.date === today.date)
    .map((record) => ({ record, planner: toPlannerSession(record) }))
    .sort((a, b) => compareSessions(a.planner, b.planner))
    .map(
      ({ record }): DashboardSession => ({
        id: record.id,
        name: record.name,
        category: record.category,
        timeLabel: record.startTime,
        durationLabel: formatDuration(record.durationMinutes),
        detail: sessionDetail(record),
        href: `/session/${encodeURIComponent(record.id)}`,
        workout: record.workoutStatus ?? "none",
        workoutHref: `/workout/${encodeURIComponent(record.id)}`,
      }),
    );

  return { todaySessions, week };
}

/** The member's routines, with links that schedule them for today. */
export function prepareDashboardRoutines(
  today: MemberToday,
  routines: readonly DashboardRoutineInput[],
): DashboardRoutine[] {
  const addSessionHref = `/week/${today.weekId}/add?day=${today.day}`;
  return routines.map(
    (routine): DashboardRoutine => ({
      id: routine.id,
      name: routine.name,
      categoryLabel: SESSION_TYPE_LABELS[routine.category],
      detail: routineAtAGlance(routine.itemCount, routine.equipment),
      viewHref: `/library/${encodeURIComponent(routine.id)}`,
      scheduleHref: `${addSessionHref}&routine=${encodeURIComponent(routine.id)}`,
    }),
  );
}

export function prepareDashboard({
  today,
  displayName,
  firstVisit = false,
  weekSessions,
  routines,
}: DashboardInput): DashboardData {
  return {
    ...prepareDashboardFrame({ today, displayName, firstVisit }),
    ...prepareDashboardWeek(today, weekSessions),
    routines: prepareDashboardRoutines(today, routines),
  };
}
