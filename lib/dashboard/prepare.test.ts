import { describe, expect, it } from "vitest";
import type { ScheduledSessionRecord } from "@/lib/data/model";
import { todayIn } from "@/lib/time-zone";
import { formatDashboardDate, formatDuration, prepareDashboard, sessionDetail } from "./prepare";

// Wednesday 18 November 2026, in 2026-W47 (Mon 16 – Sun 22).
const today = todayIn("UTC", new Date("2026-11-18T09:00:00Z"));

function session(overrides: Partial<ScheduledSessionRecord> & { id: string; date: string }): ScheduledSessionRecord {
  return {
    weekId: "2026-W47",
    day: 3,
    startTime: null,
    name: "Session",
    category: "running",
    durationMinutes: null,
    notes: "",
    sourceRoutineId: null,
    items: [],
    ...overrides,
  };
}

const item = (equipment: ScheduledSessionRecord["items"][number]["equipment"]) => ({
  id: crypto.randomUUID(),
  sourceItemId: null,
  name: "Item",
  instruction: "",
  rest: "",
  target: "",
  notes: "",
  equipment,
  videoUrl: null,
});

describe("prepareDashboard", () => {
  it("returns exactly seven days, Monday to Sunday, with planned counts including zero", () => {
    const data = prepareDashboard({
      today,
      displayName: "Alex",
      weekSessions: [
        session({ id: "a", date: "2026-11-16" }),
        session({ id: "b", date: "2026-11-18" }),
        session({ id: "c", date: "2026-11-18", startTime: "07:00" }),
        session({ id: "d", date: "2026-11-22" }),
      ],
      routines: [],
    });
    expect(data.week).toHaveLength(7);
    expect(data.week.map((day) => day.date)).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(data.week.map((day) => day.weekdayLabel)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(data.week.map((day) => day.plannedCount)).toEqual([1, 0, 2, 0, 0, 0, 1]);
    expect(data.week.map((day) => day.dayLabel)).toEqual(["16", "17", "18", "19", "20", "21", "22"]);
    expect(data.week.filter((day) => day.isToday).map((day) => day.date)).toEqual(["2026-11-18"]);
    expect(data.week[2]).toMatchObject({ isSelected: true, href: "/week/2026-W47?day=3" });
    expect(data.week[0]!.href).toBe("/week/2026-W47?day=1");
  });

  it("lists only today's sessions, untimed first then by time, keeping missing durations", () => {
    const data = prepareDashboard({
      today,
      displayName: null,
      weekSessions: [
        session({ id: "late", date: "2026-11-18", startTime: "18:30", durationMinutes: 45 }),
        session({ id: "early", date: "2026-11-18", startTime: "06:00", durationMinutes: 90 }),
        session({ id: "untimed", date: "2026-11-18", startTime: null }),
        session({ id: "tomorrow", date: "2026-11-19", startTime: "06:00" }),
      ],
      routines: [],
    });
    expect(data.todaySessions.map((s) => s.id)).toEqual(["untimed", "early", "late"]);
    expect(data.todaySessions[0]).toMatchObject({ timeLabel: null, durationLabel: null, href: "/session/untimed" });
    expect(data.todaySessions[1]).toMatchObject({ timeLabel: "06:00", durationLabel: "1 h 30 min" });
    expect(data.todaySessions[2]).toMatchObject({ timeLabel: "18:30", durationLabel: "45 min" });
  });

  it("keeps empty arrays for an empty but successful read, and a neutral greeting", () => {
    const data = prepareDashboard({ today, displayName: null, weekSessions: [], routines: [] });
    expect(data.todaySessions).toEqual([]);
    expect(data.routines).toEqual([]);
    expect(data.displayName).toBeNull();
    expect(data.week.every((day) => day.plannedCount === 0)).toBe(true);
  });

  it("prepares the member's routines with local view and schedule links", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const data = prepareDashboard({
      today,
      displayName: "Alex",
      weekSessions: [],
      routines: [{ id, name: "A".repeat(200), category: "strength", itemCount: 3, equipment: ["barbell", "bench"] }],
    });
    expect(data.routines).toEqual([
      {
        id,
        name: "A".repeat(200),
        categoryLabel: "Strength",
        detail: "3 items · Barbell, Bench",
        viewHref: `/library/${id}`,
        scheduleHref: `/week/2026-W47/add?day=3&routine=${id}`,
      },
    ]);
  });

  it("links every action to a local application path", () => {
    const data = prepareDashboard({ today, displayName: "Alex", weekSessions: [], routines: [] });
    expect(data).toMatchObject({
      dateLabel: "Wednesday, 18 November 2026",
      plannerHref: "/week/2026-W47?day=3",
      addSessionHref: "/week/2026-W47/add?day=3",
      myLibraryHref: "/library?scope=mine",
      sharedLibraryHref: "/library?scope=global",
      createRoutineHref: "/library/new",
    });
    for (const href of [data.plannerHref, data.addSessionHref, data.myLibraryHref, data.sharedLibraryHref, data.createRoutineHref]) {
      expect(href.startsWith("/") && !href.startsWith("//")).toBe(true);
    }
  });

  it("uses the member's day across a time-zone boundary", () => {
    // 22:30 Sunday UTC is already Monday of the next week in Sydney.
    const sydney = todayIn("Australia/Sydney", new Date("2026-11-22T22:30:00Z"));
    const data = prepareDashboard({
      today: sydney,
      displayName: null,
      weekSessions: [session({ id: "mon", date: "2026-11-23", weekId: "2026-W48", day: 1 })],
      routines: [],
    });
    expect(data.week[0]).toMatchObject({ date: "2026-11-23", isToday: true, plannedCount: 1 });
    expect(data.todaySessions.map((s) => s.id)).toEqual(["mon"]);
  });
});

describe("helpers", () => {
  it("formats durations", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(135)).toBe("2 h 15 min");
  });

  it("formats the date label without depending on the server zone", () => {
    expect(formatDashboardDate("2026-01-01")).toBe("Thursday, 1 January 2026");
  });

  it("summarises the snapshot, falling back to notes", () => {
    expect(sessionDetail(session({ id: "x", date: "2026-11-18", items: [item(["dumbbell"]), item([])] }))).toBe(
      "2 items · Dumbbell",
    );
    expect(sessionDetail(session({ id: "x", date: "2026-11-18", notes: "  Easy   shakeout " }))).toBe("Easy shakeout");
    expect(sessionDetail(session({ id: "x", date: "2026-11-18", notes: "n".repeat(300) }))).toHaveLength(140);
    expect(sessionDetail(session({ id: "x", date: "2026-11-18" }))).toBe("");
  });
});
