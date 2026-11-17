import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareDashboard } from "@/lib/dashboard/prepare";
import { listOwnRoutinesForDashboard } from "@/lib/data/dashboard";
import { savePersonalRoutine } from "@/lib/data/routines";
import { createAdhocSession, listSessionsForWeek } from "@/lib/data/sessions";
import { todayIn } from "@/lib/time-zone";
import {
  createGlobalRoutine,
  createTestUser,
  deleteGlobalRoutine,
  deleteTestUsers,
  integrationReady,
  service,
  type TestUser,
} from "./helpers";

/**
 * /home's data, read exactly as the page reads it: as the member, through the
 * data layer, under RLS. Two members with overlapping weeks must never see
 * each other's sessions, counts or routines.
 */

// Wednesday 2026-11-18 in Sydney; still Tuesday 17th in UTC.
const today = todayIn("Australia/Sydney", new Date("2026-11-17T20:00:00Z"));

describe.skipIf(!integrationReady)("dashboard data (local Supabase)", () => {
  let alex: TestUser;
  let blair: TestUser;
  let globalId: string;

  const adhoc = (date: string, name: string, startTime: string | null, durationMinutes: number | null = null) => ({
    date,
    startTime,
    name,
    category: "running" as const,
    durationMinutes,
    notes: "",
    items: [],
  });

  beforeAll(async () => {
    alex = await createTestUser("dash-alex");
    blair = await createTestUser("dash-blair");
    globalId = await createGlobalRoutine("Global for dashboard", ["Squat"]);

    // Alex: two sessions today (one untimed), one Monday, one next week.
    await createAdhocSession(alex.db, alex.id, adhoc("2026-11-18", "Alex evening run", "18:00", 40));
    await createAdhocSession(alex.db, alex.id, adhoc("2026-11-18", "Alex anytime mobility", null));
    await createAdhocSession(alex.db, alex.id, adhoc("2026-11-16", "Alex Monday", "06:00"));
    await createAdhocSession(alex.db, alex.id, adhoc("2026-11-23", "Alex next week", "06:00"));
    await savePersonalRoutine(alex.db, null, {
      name: "Alex strength",
      category: "strength",
      description: "",
      items: [{ name: "Deadlift", instruction: "", rest: "", target: "", notes: "", equipment: ["barbell"], videoUrl: null }],
    });

    // Blair: same days, different content.
    await createAdhocSession(blair.db, blair.id, adhoc("2026-11-18", "Blair secret tempo", "07:00"));
    await createAdhocSession(blair.db, blair.id, adhoc("2026-11-19", "Blair Thursday", "07:00"));
    await savePersonalRoutine(blair.db, null, {
      name: "Blair private routine",
      category: "running",
      description: "",
      items: [],
    });
  });

  afterAll(async () => {
    await deleteGlobalRoutine(globalId);
    await deleteTestUsers();
  });

  async function dashboardFor(user: TestUser) {
    const [weekSessions, routines] = await Promise.all([
      listSessionsForWeek(user.db, user.id, today.weekId),
      listOwnRoutinesForDashboard(user.db, user.id),
    ]);
    return prepareDashboard({ today, displayName: null, weekSessions, routines });
  }

  it("shows only the member's own sessions, in the planner's order", async () => {
    const data = await dashboardFor(alex);
    expect(data.todaySessions.map((s) => s.name)).toEqual(["Alex anytime mobility", "Alex evening run"]);
    expect(data.todaySessions[1]).toMatchObject({ timeLabel: "18:00", durationLabel: "40 min" });
    expect(JSON.stringify(data)).not.toContain("Blair");
  });

  it("counts planned sessions per day for this member only, Monday to Sunday", async () => {
    const alexWeek = (await dashboardFor(alex)).week.map((day) => day.plannedCount);
    const blairWeek = (await dashboardFor(blair)).week.map((day) => day.plannedCount);
    expect(alexWeek).toEqual([1, 0, 2, 0, 0, 0, 0]);
    expect(blairWeek).toEqual([0, 0, 1, 1, 0, 0, 0]);
  });

  it("lists only the member's own PERSONAL routines, never GLOBAL or another member's", async () => {
    const alexRoutines = await listOwnRoutinesForDashboard(alex.db, alex.id);
    expect(alexRoutines.map((r) => r.name)).toEqual(["Alex strength"]);
    expect(alexRoutines[0]).toMatchObject({ category: "strength", itemCount: 1, equipment: ["barbell"] });

    // Even asking with another member's id returns nothing: RLS holds.
    expect(await listOwnRoutinesForDashboard(alex.db, blair.id)).toEqual([]);
  });

  it("caps routines at three, most recently changed first", async () => {
    for (const name of ["R1", "R2", "R3"]) {
      await savePersonalRoutine(alex.db, null, { name, category: "other", description: "", items: [] });
    }
    const names = (await listOwnRoutinesForDashboard(alex.db, alex.id)).map((r) => r.name);
    expect(names).toHaveLength(3);
    expect(names).toEqual(["R3", "R2", "R1"]);
  });

  it("returns empty sections for a member with nothing planned", async () => {
    const newcomer = await createTestUser("dash-new");
    const data = await dashboardFor(newcomer);
    expect(data.todaySessions).toEqual([]);
    expect(data.routines).toEqual([]);
    expect(data.week.every((day) => day.plannedCount === 0)).toBe(true);
  });

  it("refuses a revoked member's reads instead of returning their old data", async () => {
    const revoked = await createTestUser("dash-revoked");
    await createAdhocSession(revoked.db, revoked.id, adhoc("2026-11-18", "Before revocation", null));
    await service().from("profiles").update({ revoked_at: new Date().toISOString() }).eq("id", revoked.id);

    expect(await listSessionsForWeek(revoked.db, revoked.id, today.weekId)).toEqual([]);
    expect(await listOwnRoutinesForDashboard(revoked.db, revoked.id)).toEqual([]);
  });
});
