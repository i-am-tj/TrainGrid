import { describe, expect, it } from "vitest";
import { parseLegacySchedule, planImport, type RoutineForImport } from "./schedule-import";

const USER = "00000000-0000-4000-8000-0000000000aa";
const ids = () => {
  let n = 0;
  return () => `10000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};

const lowerA: RoutineForImport = {
  id: "7e1cbd2e-12c9-5354-8281-52de7a3088af",
  slug: "lower-a",
  items: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Back Squat",
      instruction: "4 × 5–6",
      rest: "2–3 min",
      target: "RPE 7–8",
      notes: "",
      equipment: ["barbell"],
      video_url: null,
    },
  ],
};

const file = JSON.stringify({
  sessions: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Lower A",
      type: "strength",
      weekId: "2026-W46",
      day: 1,
      time: "07:30",
      durationMinutes: 60,
      notes: "Gym",
      templateId: "lower-a",
      bodySnapshot: null,
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      name: "Custom run",
      type: "running",
      weekId: "2026-W46",
      day: 3,
      time: null,
      durationMinutes: null,
      notes: "",
      templateId: "easy-run",
      bodySnapshot: "## Easy\n\n30 min\nIntensity: RPE 3\n\nEquipment: Bodyweight",
    },
    {
      id: "legacy-slug-id",
      name: "Mobility",
      type: "other",
      weekId: "2026-W47",
      day: 7,
      time: null,
      notes: "",
      templateId: "gone",
      bodySnapshot: null,
    },
  ],
});

describe("parseLegacySchedule", () => {
  it("reads the file-era format", () => {
    const sessions = parseLegacySchedule(file);
    expect(sessions).toHaveLength(3);
    expect(sessions[2]).toMatchObject({ durationMinutes: null, bodySnapshot: null });
  });

  it("accepts an empty schedule", () => {
    expect(parseLegacySchedule('{"sessions": []}')).toEqual([]);
  });

  it("refuses malformed input instead of guessing", () => {
    expect(() => parseLegacySchedule("[]")).toThrow(/sessions/);
    expect(() =>
      parseLegacySchedule(JSON.stringify({ sessions: [{ id: "x", name: "y", weekId: "2026-W46", day: 9 }] })),
    ).toThrow(/invalid day/);
    expect(() =>
      parseLegacySchedule(
        JSON.stringify({ sessions: [{ id: "x", name: "y", weekId: "2026-W46", day: 1, time: "07:15" }] }),
      ),
    ).toThrow(/invalid time/);
  });
});

describe("planImport", () => {
  const plan = planImport(parseLegacySchedule(file), USER, [lowerA], ids());

  it("assigns every row to the given user and converts week/day to a date", () => {
    expect(plan.rows.map((row) => [row.user_id, row.date])).toEqual([
      [USER, "2026-11-09"],
      [USER, "2026-11-11"],
      [USER, "2026-11-22"],
    ]);
  });

  it("D-03: a template-following session becomes a snapshot of the GLOBAL routine", () => {
    const row = plan.rows[0]!;
    expect(row.source_routine_id).toBe(lowerA.id);
    expect(row.snapshot.items).toEqual([
      expect.objectContaining({
        name: "Back Squat",
        rest: "2–3 min",
        source_item_id: lowerA.items[0]!.id,
      }),
    ]);
    expect(row.snapshot.items[0]!.id).not.toBe(lowerA.items[0]!.id);
    expect(row).toMatchObject({ start_time: "07:30", duration_minutes: 60, notes: "Gym" });
  });

  it("keeps a session's own copied content, structured", () => {
    const row = plan.rows[1]!;
    expect(row.snapshot.items).toEqual([
      expect.objectContaining({ name: "Easy", instruction: "30 min", target: "RPE 3", equipment: ["bodyweight"] }),
    ]);
    expect(row.source_routine_id).toBeNull();
  });

  it("keeps old UUID ids so a re-run skips them, and warns about the rest", () => {
    expect(plan.rows[0]!.id).toBe("30000000-0000-4000-8000-000000000001");
    expect(plan.rows[2]!.id).not.toBe("legacy-slug-id");
    expect(plan.warnings).toEqual([
      expect.stringContaining('template "gone" has no GLOBAL routine'),
      expect.stringContaining("not a UUID"),
    ]);
    expect(plan.rows[2]!.snapshot.items).toEqual([]);
  });

  it("refuses a target user that is not a UUID", () => {
    expect(() => planImport([], "tanuj", [])).toThrow(/UUID/);
  });
});
