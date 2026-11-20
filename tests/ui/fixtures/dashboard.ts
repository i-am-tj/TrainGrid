/** Development/screenshot fixtures only. Never import from app/ or components/. */
import type {
  DashboardData,
  DashboardDay,
  DashboardState,
  DashboardWeek,
} from "../../../components/dashboard/types";

const day = (
  date: string,
  weekdayLabel: string,
  dayLabel: string,
  plannedCount: number,
): DashboardDay => ({
  date,
  weekdayLabel,
  dayLabel,
  plannedCount,
  isToday: weekdayLabel === "Tue",
  isSelected: weekdayLabel === "Tue",
  href: `/week/2026-W47?day=${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekdayLabel) + 1}`,
});
const week: DashboardWeek = [
  day("2026-11-16", "Mon", "16", 1),
  day("2026-11-17", "Tue", "17", 3),
  day("2026-11-18", "Wed", "18", 0),
  day("2026-11-19", "Thu", "19", 1),
  day("2026-11-20", "Fri", "20", 0),
  day("2026-11-21", "Sat", "21", 1),
  day("2026-11-22", "Sun", "22", 0),
];
const ready: DashboardData = {
  displayName: "Alex",
  dateLabel: "Tuesday, 17 November 2026",
  todaySessions: [
    {
      id: "example-run",
      name: "Easy morning run",
      category: "running",
      timeLabel: "07:00",
      durationLabel: "45 min",
      detail:
        "Conversational pace. An easy warm-up, steady running and a relaxed cooldown.",
      href: "/session/example-run",
      workout: "completed",
      workoutHref: "/workout/example-run",
    },
    {
      id: "example-lift",
      name: "Lower A",
      category: "strength",
      timeLabel: "18:00",
      durationLabel: "60 min",
      detail: "Back squat · Romanian deadlift · Split squat · Core",
      href: "/session/example-lift",
      workout: "none",
      workoutHref: "/workout/example-lift",
    },
    {
      id: "example-mobility",
      name: "Keep it moving",
      category: "other",
      timeLabel: null,
      durationLabel: null,
      detail: "A little mobility whenever the day allows.",
      href: "/session/example-mobility",
    },
  ],
  week,
  routines: [
    {
      id: "example-lower",
      name: "Lower A",
      categoryLabel: "Strength",
      detail: "5 items · Barbell, Dumbbell",
      viewHref: "/library/example-lower",
      scheduleHref: "/week/current/add?routine=example-lower",
    },
    {
      id: "example-easy",
      name: "Easy run",
      categoryLabel: "Running",
      detail: "3 items · No equipment",
      viewHref: "/library/example-easy",
      scheduleHref: "/week/current/add?routine=example-easy",
    },
    {
      id: "example-plyo",
      name: "Quick feet",
      categoryLabel: "Plyometrics",
      detail: "4 items · Plyometric Box",
      viewHref: "/library/example-plyo",
      scheduleHref: "/week/current/add?routine=example-plyo",
    },
  ],
  plannerHref: "/week/2026-W47?day=2",
  addSessionHref: "/week/2026-W47/add?day=2",
  myLibraryHref: "/library?scope=mine",
  sharedLibraryHref: "/library?scope=global",
  createRoutineHref: "/library/new",
};
const emptyWeek: DashboardWeek = [
  day("2026-11-16", "Mon", "16", 0),
  day("2026-11-17", "Tue", "17", 0),
  day("2026-11-18", "Wed", "18", 0),
  day("2026-11-19", "Thu", "19", 0),
  day("2026-11-20", "Fri", "20", 0),
  day("2026-11-21", "Sat", "21", 0),
  day("2026-11-22", "Sun", "22", 0),
];
const longName =
  "A carefully prepared strength and mobility routine for busy training weeks with a deliberately very long name ".repeat(
    2,
  ) + "WithoutWordBreaks".repeat(12);
export const dashboardFixtures = {
  ready: { status: "ready", data: ready },
  "empty-today": {
    status: "ready",
    data: {
      ...ready,
      todaySessions: [],
      week: [
        week[0],
        { ...week[1], plannedCount: 0 },
        week[2],
        week[3],
        week[4],
        week[5],
        week[6],
      ],
    },
  },
  "empty-week": {
    status: "ready",
    data: {
      ...ready,
      displayName: null,
      todaySessions: [],
      week: emptyWeek,
      routines: [],
    },
  },
  "no-routines": { status: "ready", data: { ...ready, routines: [] } },
  "long-names": {
    status: "ready",
    data: {
      ...ready,
      displayName: "Alexandra".repeat(12),
      todaySessions: [{ ...ready.todaySessions[0]!, name: longName }],
      routines: [{ ...ready.routines[0]!, name: longName }],
    },
  },
  loading: { status: "loading" },
  error: {
    status: "error",
    message: "Your training plan couldn’t be loaded. Please try again.",
    retryHref: "/home",
  },
} satisfies Record<string, DashboardState>;
