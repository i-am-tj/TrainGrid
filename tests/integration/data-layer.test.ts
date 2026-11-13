import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportUserData } from "@/lib/data/export";
import { DataError } from "@/lib/data/model";
import {
  copyGlobalRoutine,
  deletePersonalRoutine,
  findGlobalRoutineIdBySlug,
  listLibraryRoutines,
  getRoutine,
  listRoutines,
  savePersonalRoutine,
} from "@/lib/data/routines";
import {
  createAdhocSession,
  deleteSession,
  duplicateWeek,
  getSession,
  listSessionsForWeek,
  replaceSessionItems,
  scheduleRoutine,
  updateSessionDetails,
} from "@/lib/data/sessions";
import {
  anonymous,
  createGlobalRoutine,
  createTestUser,
  deleteGlobalRoutine,
  deleteTestUsers,
  integrationReady,
  service,
  type TestUser,
} from "./helpers";

/**
 * The data layer against a real database, as real users. Cross-user cases
 * call the functions with the attacker's own client and own user id — the
 * only things the app would ever give them — and then try harder by calling
 * the database directly, to show RLS holds even when the app's own filters
 * are bypassed.
 */

const WEEK = "2026-W46";
const NEXT_WEEK = "2026-W47";
const MONDAY = "2026-11-09";
const WEDNESDAY = "2026-11-11";

async function rejects(promise: Promise<unknown>, code: DataError["code"]) {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => error instanceof DataError && error.code === code,
  );
}

describe.skipIf(!integrationReady)("data layer (local Supabase)", () => {
  let a: TestUser;
  let b: TestUser;
  let outsider: TestUser;
  let globalId: string;

  beforeAll(async () => {
    a = await createTestUser("a");
    b = await createTestUser("b");
    outsider = await createTestUser("outsider", { member: false });
    globalId = await createGlobalRoutine("IT Global Lower", ["Back Squat", "Romanian Deadlift"]);
  });

  afterAll(async () => {
    if (!integrationReady) return;
    await deleteTestUsers();
    await deleteGlobalRoutine(globalId);
  });

  describe("routines", () => {
    it("D9: a member creates, edits and deletes a PERSONAL routine", async () => {
      const id = await savePersonalRoutine(a.db, null, {
        name: "A Upper",
        category: "strength",
        items: [
          { name: "Bench Press", instruction: "4 × 6", rest: "2 min", target: "RPE 8", equipment: ["barbell", "bench"] },
          { name: "Row", videoUrl: "https://youtu.be/abcdefghijk" },
        ],
      });

      const created = await getRoutine(a.db, a.id, id);
      expect(created).toMatchObject({ scope: "PERSONAL", isOwn: true, name: "A Upper" });
      expect(created!.items.map((item) => item.name)).toEqual(["Bench Press", "Row"]);
      expect(created!.items[0]).toMatchObject({ rest: "2 min", target: "RPE 8", equipment: ["barbell", "bench"] });
      expect(created!.items[1]!.videoUrl).toBe("https://www.youtube.com/watch?v=abcdefghijk");

      const benchId = created!.items[0]!.id;
      await savePersonalRoutine(a.db, id, {
        name: "A Upper v2",
        category: "strength",
        items: [{ name: "Pull-up" }, { id: benchId, name: "Bench Press", instruction: "5 × 5" }],
      });
      const edited = await getRoutine(a.db, a.id, id);
      expect(edited!.items.map((item) => [item.name, item.instruction])).toEqual([
        ["Pull-up", ""],
        ["Bench Press", "5 × 5"],
      ]);
      expect(edited!.items[1]!.id).toBe(benchId);

      await deletePersonalRoutine(a.db, a.id, id);
      expect(await getRoutine(a.db, a.id, id)).toBeNull();
    });

    it("lists GLOBAL routines and the caller's own, never another member's", async () => {
      const bRoutine = await savePersonalRoutine(b.db, null, { name: "B Secret", category: "running" });
      const aRoutine = await savePersonalRoutine(a.db, null, { name: "A Own", category: "running" });

      const forA = await listRoutines(a.db, a.id);
      const ids = forA.map((routine) => routine.id);
      expect(ids).toContain(globalId);
      expect(ids).toContain(aRoutine);
      expect(ids).not.toContain(bRoutine);
      expect(forA.find((routine) => routine.id === globalId)!.isOwn).toBe(false);
    });

    it("I6: A cannot read, update or delete B's personal routine", async () => {
      const bRoutine = await savePersonalRoutine(b.db, null, {
        name: "B Private",
        category: "other",
        items: [{ name: "B item" }],
      });

      expect(await getRoutine(a.db, a.id, bRoutine)).toBeNull();
      await rejects(savePersonalRoutine(a.db, bRoutine, { name: "hacked", category: "other" }), "not_found");
      await rejects(deletePersonalRoutine(a.db, a.id, bRoutine), "not_found");

      // Bypassing the app's filters: RLS alone still hides and protects it.
      const direct = await a.db.from("routines").select("id").eq("id", bRoutine);
      expect(direct.data).toEqual([]);
      const items = await a.db.from("workout_items").select("id").eq("routine_id", bRoutine);
      expect(items.data).toEqual([]);
      await a.db.from("routines").update({ name: "hacked" }).eq("id", bRoutine);
      await a.db.from("routines").delete().eq("id", bRoutine);

      const stillThere = await getRoutine(b.db, b.id, bRoutine);
      expect(stillThere).toMatchObject({ name: "B Private" });
      expect(stillThere!.items.map((item) => item.name)).toEqual(["B item"]);
    });

    it("I7, I9: members cannot change GLOBAL routines or plant routines for others", async () => {
      await rejects(savePersonalRoutine(a.db, globalId, { name: "hacked", category: "other" }), "not_found");
      await rejects(deletePersonalRoutine(a.db, a.id, globalId), "not_found");

      const planted = await a.db
        .from("routines")
        .insert({ scope: "PERSONAL", owner_user_id: b.id, name: "planted", category: "other" });
      expect(planted.error?.code).toBe("42501");
      const global = await a.db.from("routines").insert({ scope: "GLOBAL", name: "planted", category: "other" });
      expect(global.error?.code).toBe("42501");

      const unchanged = await getRoutine(a.db, a.id, globalId);
      expect(unchanged!.name).toBe("IT Global Lower");
    });

    it("rejects invalid routine input before it reaches the database", async () => {
      await rejects(savePersonalRoutine(a.db, null, { name: "", category: "other" }), "invalid");
      await rejects(savePersonalRoutine(a.db, null, { name: "x", category: "yoga" as "other" }), "invalid");
      await rejects(
        savePersonalRoutine(a.db, null, { name: "x", category: "other", items: [{ name: "v", videoUrl: "https://vimeo.com/1" }] }),
        "invalid",
      );
      await rejects(savePersonalRoutine(a.db, "not-a-uuid", { name: "x", category: "other" }), "invalid");
    });
  });

  describe("legacy slug links", () => {
    it("resolve a seeded GLOBAL routine's slug for a member", async () => {
      const slug = (await service().from("routines").select("slug").eq("id", globalId).single()).data!.slug!;
      expect(await findGlobalRoutineIdBySlug(a.db, slug)).toBe(globalId);
    });

    it("never resolve to a personal routine, and reject odd input", async () => {
      const mine = await savePersonalRoutine(a.db, null, { name: "lower-a", category: "other" });
      expect(await findGlobalRoutineIdBySlug(a.db, "it-no-such-routine")).toBeNull();
      expect(await findGlobalRoutineIdBySlug(a.db, mine)).toBeNull();
      expect(await findGlobalRoutineIdBySlug(a.db, "Lower A")).toBeNull();
      expect(await findGlobalRoutineIdBySlug(a.db, "a,b")).toBeNull();
      expect(await findGlobalRoutineIdBySlug(a.db, "%")).toBeNull();
      expect(await findGlobalRoutineIdBySlug(a.db, "x".repeat(101))).toBeNull();
      expect(await findGlobalRoutineIdBySlug(a.db, null)).toBeNull();
      // A personal routine can never carry a slug at all.
      const planted = await a.db.from("routines").update({ slug: "planted" } as never).eq("id", mine);
      expect(planted.error?.code).toBe("42501");
    });

    it("resolve nothing for a signed-in user who is not a member", async () => {
      const slug = (await service().from("routines").select("slug").eq("id", globalId).single()).data!.slug!;
      expect(await findGlobalRoutineIdBySlug(outsider.db, slug)).toBeNull();
    });
  });

  describe("library list read (Epic 2, E2-02)", () => {
    it("returns visible routines with item names and equipment in one request", async () => {
      const mine = await savePersonalRoutine(a.db, null, {
        name: "IT Library Mine",
        category: "strength",
        items: [{ name: "Goblet Squat", equipment: ["kettlebell"] }, { name: "Plank" }],
      });
      await savePersonalRoutine(b.db, null, { name: "IT Library B Secret", category: "other" });

      let requests = 0;
      const counting: typeof fetch = (input, init) => {
        requests += 1;
        return fetch(input, init);
      };
      const client = await a.clientWithFetch(counting);
      requests = 0;
      const { routines, truncated } = await listLibraryRoutines(client, a.id);

      expect(requests).toBe(1);
      expect(truncated).toBe(false);

      const own = routines.find((r) => r.id === mine)!;
      expect(own).toMatchObject({ isOwn: true, itemNames: ["Goblet Squat", "Plank"], equipment: ["kettlebell"], itemCount: 2 });

      const global = routines.find((r) => r.id === globalId)!;
      expect(global).toMatchObject({ scope: "GLOBAL", itemNames: ["Back Squat", "Romanian Deadlift"], equipment: ["barbell"] });

      expect(routines.map((r) => r.name)).not.toContain("IT Library B Secret");
      expect(routines.every((r) => r.scope === "GLOBAL" || r.isOwn)).toBe(true);

      const seeded = routines.filter((r) => r.slug && !r.slug.startsWith("it-"));
      expect(seeded.length).toBe(18);
      expect(routines.findIndex((r) => r.scope === "PERSONAL")).toBeGreaterThan(
        routines.findLastIndex((r) => r.scope === "GLOBAL"),
      );
    });

    it("is bounded and reports when it cut the list short", async () => {
      const all = await listLibraryRoutines(a.db, a.id);
      const capped = await listLibraryRoutines(a.db, a.id, { limit: 3 });
      expect(capped.routines).toHaveLength(3);
      expect(capped.truncated).toBe(true);
      expect(capped.routines.every((r) => r.scope === "GLOBAL")).toBe(true);
      expect(all.routines.length).toBeGreaterThan(3);
    });

    it("gives a signed-in non-member nothing", async () => {
      const { routines } = await listLibraryRoutines(outsider.db, outsider.id);
      expect(routines).toEqual([]);
    });
  });

  describe("copy a GLOBAL routine to My Library (Epic 2, E2-04)", () => {
    const content = (items: { name: string; instruction: string; rest: string; target: string; notes: string; equipment: string[]; videoUrl: string | null }[]) =>
      items.map(({ name, instruction, rest, target, notes, equipment, videoUrl }) => ({ name, instruction, rest, target, notes, equipment, videoUrl }));
    const ownCount = async (user: TestUser) =>
      (await service().from("routines").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id)).count ?? 0;

    it("makes an exact PERSONAL copy owned by the caller, with new ids; the source is unchanged", async () => {
      const source = await getRoutine(a.db, a.id, globalId);
      const copyId = await copyGlobalRoutine(a.db, a.id, globalId);
      const copy = await getRoutine(a.db, a.id, copyId);

      expect(copyId).not.toBe(globalId);
      expect(copy).toMatchObject({
        scope: "PERSONAL",
        isOwn: true,
        slug: null,
        name: source!.name,
        category: source!.category,
        description: source!.description,
      });
      expect(content(copy!.items)).toEqual(content(source!.items));
      const sourceItemIds = source!.items.map((item) => item.id);
      for (const item of copy!.items) expect(sourceItemIds).not.toContain(item.id);

      const [row] = (await service().from("routines").select("owner_user_id, scope").eq("id", copyId)).data ?? [];
      expect(row).toEqual({ owner_user_id: a.id, scope: "PERSONAL" });
      expect(await getRoutine(a.db, a.id, globalId)).toEqual(source);
    });

    it("copying again makes a separate routine", async () => {
      const first = await copyGlobalRoutine(a.db, a.id, globalId);
      const second = await copyGlobalRoutine(a.db, a.id, globalId);
      expect(second).not.toBe(first);
    });

    it("refuses anything that is not a GLOBAL routine the caller can see, and creates nothing", async () => {
      const bRoutine = await savePersonalRoutine(b.db, null, {
        name: "B secret",
        category: "other",
        items: [{ name: "B step", instruction: "private" }],
      });
      const aRoutine = await savePersonalRoutine(a.db, null, { name: "A own", category: "other" });
      const before = await ownCount(a);

      await rejects(copyGlobalRoutine(a.db, a.id, bRoutine), "not_found");
      await rejects(copyGlobalRoutine(a.db, a.id, aRoutine), "not_found");
      await rejects(copyGlobalRoutine(a.db, a.id, crypto.randomUUID()), "not_found");
      await rejects(copyGlobalRoutine(a.db, a.id, "not-a-uuid"), "not_found");
      await rejects(copyGlobalRoutine(a.db, a.id, null), "not_found");
      expect(await ownCount(a)).toBe(before);

      // Not even through a raw query: B's routine stays invisible to A.
      expect((await a.db.from("routines").select("id").eq("id", bRoutine)).data).toEqual([]);
    });

    it("a signed-in non-member cannot copy", async () => {
      await rejects(copyGlobalRoutine(outsider.db, outsider.id, globalId), "not_found");
      expect(await ownCount(outsider)).toBe(0);
    });

    it("G5: a session scheduled from the copy keeps its own snapshot when the copy is edited", async () => {
      const copyId = await copyGlobalRoutine(a.db, a.id, globalId);
      const session = await scheduleRoutine(a.db, a.id, { routineId: copyId, date: MONDAY });
      await savePersonalRoutine(a.db, copyId, { name: "My edited copy", category: "strength", items: [{ name: "Front Squat", instruction: "5 × 3" }] });

      const after = await getSession(a.db, a.id, session.id);
      expect(after!.items.map((item) => item.name)).toEqual(["Back Squat", "Romanian Deadlift"]);
      // And the GLOBAL routine is untouched by editing the copy.
      expect((await getRoutine(a.db, a.id, globalId))!.items.map((item) => item.name)).toEqual(["Back Squat", "Romanian Deadlift"]);
    });
  });

  describe("scheduled sessions", () => {
    it("D1, D2: scheduling copies the routine; editing the routine later changes nothing", async () => {
      const routineId = await savePersonalRoutine(a.db, null, {
        name: "A Lower",
        category: "strength",
        items: [{ name: "Back Squat", instruction: "4 × 5" }],
      });
      const session = await scheduleRoutine(a.db, a.id, {
        routineId,
        date: MONDAY,
        startTime: "07:30",
        durationMinutes: 60,
      });
      expect(session).toMatchObject({
        name: "A Lower",
        category: "strength",
        weekId: WEEK,
        day: 1,
        startTime: "07:30",
        sourceRoutineId: routineId,
      });
      expect(session.items.map((item) => [item.name, item.instruction])).toEqual([["Back Squat", "4 × 5"]]);

      const routine = await getRoutine(a.db, a.id, routineId);
      expect(session.items[0]!.sourceItemId).toBe(routine!.items[0]!.id);
      expect(session.items[0]!.id).not.toBe(routine!.items[0]!.id);

      await savePersonalRoutine(a.db, routineId, {
        name: "A Lower renamed",
        category: "strength",
        items: [{ name: "Front Squat", instruction: "3 × 3" }],
      });
      const after = await getSession(a.db, a.id, session.id);
      expect(after!.name).toBe("A Lower");
      expect(after!.items.map((item) => [item.name, item.instruction])).toEqual([["Back Squat", "4 × 5"]]);
    });

    it("D3: deleting the source routine keeps the session and clears the link", async () => {
      const routineId = await savePersonalRoutine(a.db, null, {
        name: "Temp",
        category: "running",
        items: [{ name: "Easy run", instruction: "30 min" }],
      });
      const session = await scheduleRoutine(a.db, a.id, { routineId, date: WEDNESDAY });
      await deletePersonalRoutine(a.db, a.id, routineId);

      const after = await getSession(a.db, a.id, session.id);
      expect(after!.sourceRoutineId).toBeNull();
      expect(after!.items.map((item) => item.name)).toEqual(["Easy run"]);
    });

    it("E2-05: a scheduled GLOBAL routine survives later seed edits and the routine's removal", async () => {
      const sourceId = await createGlobalRoutine("IT Global Snapshot", ["Deadlift", "Hip Thrust"]);
      try {
        const session = await scheduleRoutine(a.db, a.id, { routineId: sourceId, date: MONDAY });
        const source = await getRoutine(a.db, a.id, sourceId);
        expect(session.sourceRoutineId).toBe(sourceId);
        expect(session.items.map((item) => item.sourceItemId)).toEqual(source!.items.map((item) => item.id));
        // Fresh item ids: the snapshot is a copy, not a reference.
        for (const item of session.items) expect(source!.items.map((s) => s.id)).not.toContain(item.id);

        // Seed maintenance rewrites the shared content (only possible with the secret key).
        const admin = service();
        await admin.from("routines").update({ name: "IT Global Snapshot v2" }).eq("id", sourceId);
        await admin.from("workout_items").update({ name: "Sumo Deadlift", instruction: "5 × 3" }).eq("routine_id", sourceId);
        const edited = await getSession(a.db, a.id, session.id);
        expect(edited!.name).toBe("IT Global Snapshot");
        expect(edited!.items.map((item) => [item.name, item.instruction])).toEqual([
          ["Deadlift", "3 × 8"],
          ["Hip Thrust", "3 × 8"],
        ]);

        await deleteGlobalRoutine(sourceId);
        const removed = await getSession(a.db, a.id, session.id);
        expect(removed!.sourceRoutineId).toBeNull();
        expect(removed!.items.map((item) => item.name)).toEqual(["Deadlift", "Hip Thrust"]);
      } finally {
        await deleteGlobalRoutine(sourceId);
      }
    });

    it("schedules a GLOBAL routine and an ad-hoc session; untimed sorts first", async () => {
      const timed = await scheduleRoutine(a.db, a.id, { routineId: globalId, date: WEDNESDAY, startTime: "18:00" });
      expect(timed.items.map((item) => item.name)).toEqual(["Back Squat", "Romanian Deadlift"]);

      const untimed = await createAdhocSession(a.db, a.id, {
        name: "Mobility",
        category: "other",
        date: WEDNESDAY,
        items: [{ name: "Hip openers", notes: "Rest: 2 min" }],
      });
      expect(untimed.startTime).toBeNull();
      expect(untimed.items[0]).toMatchObject({ notes: "Rest: 2 min", rest: "", sourceItemId: null });

      const wednesday = (await listSessionsForWeek(a.db, a.id, WEEK)).filter((s) => s.date === WEDNESDAY);
      const names = wednesday.map((s) => s.name);
      expect(names.indexOf("Mobility")).toBeLessThan(names.indexOf("IT Global Lower"));
    });

    it("D4: rescheduling and customising one occurrence leaves its copies alone", async () => {
      const original = await scheduleRoutine(a.db, a.id, { routineId: globalId, date: "2026-11-12" });
      const moved = await updateSessionDetails(a.db, a.id, original.id, {
        name: "Thursday lift",
        category: "strength",
        date: "2026-11-13",
        startTime: "06:00",
        durationMinutes: 45,
        notes: "Moved",
      });
      expect(moved).toMatchObject({ date: "2026-11-13", day: 5, startTime: "06:00", durationMinutes: 45 });

      const keptId = moved.items[0]!.id;
      const customised = await replaceSessionItems(a.db, a.id, original.id, [
        { id: keptId, name: "Back Squat", instruction: "5 × 3" },
        { name: "Plank", instruction: "3 × 45 s" },
      ]);
      expect(customised.items.map((item) => item.name)).toEqual(["Back Squat", "Plank"]);
      expect(customised.items[0]!.id).toBe(keptId);
      expect(customised.items[0]!.sourceItemId).toBe(moved.items[0]!.sourceItemId);

      const routine = await getRoutine(a.db, a.id, globalId);
      expect(routine!.items.map((item) => item.instruction)).toEqual(["3 × 8", "3 × 8"]);
    });

    it("D5: Duplicate Week copies snapshots into the next week with new ids", async () => {
      const source = await listSessionsForWeek(a.db, a.id, WEEK);
      expect(source.length).toBeGreaterThan(0);

      const copied = await duplicateWeek(a.db, a.id, { sourceWeekId: WEEK, destWeekId: NEXT_WEEK });
      expect(copied).toBe(source.length);

      const dest = await listSessionsForWeek(a.db, a.id, NEXT_WEEK);
      expect(dest).toHaveLength(source.length);
      const sourceIds = new Set(source.flatMap((s) => [s.id, ...s.items.map((i) => i.id)]));
      for (const session of dest) {
        expect(sourceIds.has(session.id)).toBe(false);
        for (const item of session.items) expect(sourceIds.has(item.id)).toBe(false);
      }
      expect(dest.map((s) => [s.day, s.startTime, s.name]).sort()).toEqual(
        source.map((s) => [s.day, s.startTime, s.name]).sort(),
      );
    });

    it("deletes the caller's own session", async () => {
      const session = await createAdhocSession(a.db, a.id, { name: "Delete me", category: "other", date: MONDAY });
      await deleteSession(a.db, a.id, session.id);
      expect(await getSession(a.db, a.id, session.id)).toBeNull();
    });

    it("rejects invalid session input", async () => {
      await rejects(scheduleRoutine(a.db, a.id, { routineId: globalId, date: "2026-02-30" }), "invalid");
      await rejects(scheduleRoutine(a.db, a.id, { routineId: globalId, date: MONDAY, startTime: "07:15" }), "invalid");
      await rejects(duplicateWeek(a.db, a.id, { sourceWeekId: WEEK, destWeekId: WEEK }), "invalid");
      await rejects(listSessionsForWeek(a.db, a.id, "2027-W53"), "invalid");
    });
  });

  describe("cross-user isolation", () => {
    let bSessionId: string;
    let bRoutineId: string;

    beforeAll(async () => {
      bRoutineId = await savePersonalRoutine(b.db, null, {
        name: "B Plan",
        category: "running",
        items: [{ name: "Intervals" }],
      });
      const session = await scheduleRoutine(b.db, b.id, { routineId: bRoutineId, date: MONDAY, startTime: "06:00" });
      bSessionId = session.id;
    });

    it("I1: A and B each see only their own week", async () => {
      const forA = await listSessionsForWeek(a.db, a.id, WEEK);
      const forB = await listSessionsForWeek(b.db, b.id, WEEK);
      expect(forA.map((s) => s.id)).not.toContain(bSessionId);
      expect(forB.map((s) => s.id)).toEqual([bSessionId]);
    });

    it("I2, I3, I4: A cannot read, update or delete B's session", async () => {
      expect(await getSession(a.db, a.id, bSessionId)).toBeNull();
      await rejects(
        updateSessionDetails(a.db, a.id, bSessionId, { name: "hacked", category: "other", date: MONDAY }),
        "not_found",
      );
      await rejects(replaceSessionItems(a.db, a.id, bSessionId, [{ name: "hacked" }]), "not_found");
      await rejects(deleteSession(a.db, a.id, bSessionId), "not_found");

      // Passing B's id as "user id" does not help: the client is still A's, so RLS refuses.
      expect(await getSession(a.db, b.id, bSessionId)).toBeNull();
      await rejects(deleteSession(a.db, b.id, bSessionId), "not_found");

      const after = await getSession(b.db, b.id, bSessionId);
      expect(after).toMatchObject({ name: "B Plan", startTime: "06:00" });
    });

    it("I5: A cannot create a session owned by B, even calling the database directly", async () => {
      const direct = await a.db
        .from("scheduled_sessions")
        .insert({ user_id: b.id, date: MONDAY, name: "planted", category: "other" });
      expect(direct.error?.code).toBe("42501");

      await expect(createAdhocSession(a.db, b.id, { name: "planted", category: "other", date: MONDAY })).rejects.toThrow();
      expect((await listSessionsForWeek(b.db, b.id, WEEK)).map((s) => s.name)).toEqual(["B Plan"]);
    });

    it("A cannot schedule B's personal routine", async () => {
      await rejects(scheduleRoutine(a.db, a.id, { routineId: bRoutineId, date: MONDAY }), "not_found");
    });

    it("I8: A cannot duplicate B's week", async () => {
      const before = (await listSessionsForWeek(a.db, a.id, "2026-W48")).length;
      // Even naming B as the user, A's client sees none of B's rows to copy.
      expect(await duplicateWeek(a.db, b.id, { sourceWeekId: WEEK, destWeekId: "2026-W48" })).toBe(0);
      expect((await listSessionsForWeek(b.db, b.id, "2026-W48")).length).toBe(0);
      expect((await listSessionsForWeek(a.db, a.id, "2026-W48")).length).toBe(before);
    });

    it("I10: an authenticated user who is not a member can do nothing", async () => {
      expect(await listRoutines(outsider.db, outsider.id)).toEqual([]);
      expect(await listSessionsForWeek(outsider.db, outsider.id, WEEK)).toEqual([]);
      await expect(
        createAdhocSession(outsider.db, outsider.id, { name: "x", category: "other", date: MONDAY }),
      ).rejects.toThrow();
      await expect(savePersonalRoutine(outsider.db, null, { name: "x", category: "other" })).rejects.toThrow();
    });

    it("I11: the publishable key alone reads and writes nothing", async () => {
      const anon = anonymous();
      const read = await anon.from("scheduled_sessions").select("id");
      expect(read.error?.code).toBe("42501");
      const write = await anon.from("routines").insert({ scope: "PERSONAL", name: "x", category: "other" });
      expect(write.error?.code).toBe("42501");
    });
  });

  describe("revoked member", () => {
    it("keeps the data but blocks every read and write until restored", async () => {
      const c = await createTestUser("revoked");
      const routineId = await savePersonalRoutine(c.db, null, {
        name: "C Plan",
        category: "running",
        items: [{ name: "Tempo" }],
      });
      const session = await scheduleRoutine(c.db, c.id, { routineId, date: MONDAY });

      const admin = service();
      const invitation = await admin
        .from("invitations")
        .insert({ email: c.email, accepted_at: new Date().toISOString(), accepted_by: c.id })
        .select("id")
        .single();
      expect(invitation.error).toBeNull();
      const revoked = await admin.rpc("revoke_invitation", {
        p_invitation_id: invitation.data!.id,
        p_protected_user_ids: [a.id],
      });
      expect(revoked.data).toBe("revoked");

      // Same signed-in client as before: no new sign-in needed for it to apply.
      expect(await listSessionsForWeek(c.db, c.id, WEEK)).toEqual([]);
      expect(await getSession(c.db, c.id, session.id)).toBeNull();
      expect(await getRoutine(c.db, c.id, routineId)).toBeNull();
      expect(await listRoutines(c.db, c.id)).toEqual([]);
      await rejects(deleteSession(c.db, c.id, session.id), "not_found");
      await rejects(savePersonalRoutine(c.db, routineId, { name: "x", category: "other" }), "not_found");
      await expect(createAdhocSession(c.db, c.id, { name: "x", category: "other", date: MONDAY })).rejects.toThrow();
      expect((await exportUserData(c.db, c.id)).sessions).toEqual([]);

      const kept = await admin.from("scheduled_sessions").select("id").eq("user_id", c.id);
      expect(kept.data!.map((row) => row.id)).toEqual([session.id]);

      // Restoring (what a new, accepted invitation does) brings it all back.
      await admin.from("profiles").update({ revoked_at: null }).eq("id", c.id);
      expect((await getSession(c.db, c.id, session.id))!.name).toBe("C Plan");
      expect((await getRoutine(c.db, c.id, routineId))!.items.map((item) => item.name)).toEqual(["Tempo"]);

      await admin.from("invitations").delete().eq("id", invitation.data!.id);
    });

    it("an admin listed as protected cannot be revoked", async () => {
      const admin = service();
      const invitation = await admin
        .from("invitations")
        .insert({ email: a.email, accepted_at: new Date().toISOString(), accepted_by: a.id })
        .select("id")
        .single();
      const result = await admin.rpc("revoke_invitation", {
        p_invitation_id: invitation.data!.id,
        p_protected_user_ids: [a.id],
      });
      expect(result.data).toBe("protected");
      expect((await listSessionsForWeek(a.db, a.id, WEEK)).length).toBeGreaterThan(0);
      await admin.from("invitations").delete().eq("id", invitation.data!.id);
    });

    it("members cannot call revoke_invitation", async () => {
      const result = await a.db.rpc("revoke_invitation", {
        p_invitation_id: "00000000-0000-4000-8000-000000000000",
        p_protected_user_ids: [],
      });
      expect(result.error?.code).toBe("42501");
    });
  });

  describe("export", () => {
    it("D10: contains only the caller's own routines and sessions", async () => {
      const data = await exportUserData(a.db, a.id);
      expect(data).toMatchObject({ format: "traingrid-export", version: 2 });

      const allA = await service().from("scheduled_sessions").select("id").eq("user_id", a.id);
      expect(data.sessions.map((s) => s.id).sort()).toEqual(allA.data!.map((r) => r.id).sort());
      const allB = await service().from("scheduled_sessions").select("id").eq("user_id", b.id);
      expect(allB.data!.length).toBeGreaterThan(0);
      for (const row of allB.data!) expect(data.sessions.map((s) => s.id)).not.toContain(row.id);

      const routineIds = data.routines.map((r) => r.id);
      expect(routineIds).not.toContain(globalId);
      const ownA = await service().from("routines").select("id").eq("owner_user_id", a.id);
      expect(routineIds.sort()).toEqual(ownA.data!.map((r) => r.id).sort());

      const text = JSON.stringify(data);
      expect(text).not.toContain(b.id);
      expect(text).not.toContain(b.email);
      expect(text).not.toContain(a.email);
      expect(text).not.toContain("invitation");
    });
  });
});
