import type { SessionType } from "@/lib/domain";

/** Prepared, member-scoped display data. This module contains no query or date logic. */
export type DashboardSession = {
  id: string;
  name: string;
  category: SessionType;
  timeLabel: string | null;
  durationLabel: string | null;
  detail: string;
  href: string;
};
export type DashboardDay = {
  date: string;
  weekdayLabel: string;
  dayLabel: string;
  plannedCount: number;
  isToday: boolean;
  isSelected: boolean;
  href: string;
};
/** Monday through Sunday, prepared by the integration layer. */
export type DashboardWeek = readonly [
  DashboardDay,
  DashboardDay,
  DashboardDay,
  DashboardDay,
  DashboardDay,
  DashboardDay,
  DashboardDay,
];
export type DashboardRoutine = {
  id: string;
  name: string;
  categoryLabel: string;
  detail: string;
  viewHref: string;
  scheduleHref: string;
};
export type DashboardData = {
  displayName: string | null;
  dateLabel: string;
  todaySessions: readonly DashboardSession[];
  week: DashboardWeek;
  routines: readonly DashboardRoutine[];
  plannerHref: string;
  addSessionHref: string;
  myLibraryHref: string;
  sharedLibraryHref: string;
  createRoutineHref: string;
};
export type DashboardState =
  | { status: "ready"; data: DashboardData }
  | { status: "loading" }
  | { status: "error"; message: string; retryHref: string };
