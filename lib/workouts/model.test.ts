import { describe, expect, it } from "vitest";
import {
  alignEntries,
  formatClock,
  formatDurationWords,
  formatPerformance,
  formatVolume,
  initialEntries,
  latestPerformances,
  parseReps,
  parseRestSeconds,
  parseSetScheme,
  planExercise,
  summarize,
  workoutProgressSchema,
  type PlannedExercise,
  type WorkoutEntries,
} from "./model";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function item(overrides: Partial<Parameters<typeof planExercise>[0]> = {}) {
  return {
    id: ID(1),
    name: "Bench Press",
    instruction: "4 × 5–6",
    rest: "2–3 min",
    target: "RPE 7–8",
    notes: "",
    videoUrl: null,
    ...overrides,
    equipment: [...(overrides.equipment ?? ["barbell", "bench"])],
  } as Parameters<typeof planExercise>[0];
}

describe("parsing the plan", () => {
  it("reads set schemes as the templates write them", () => {
    expect(parseSetScheme("4 × 5–6")).toEqual({ sets: 4, reps: "5–6" });
    expect(parseSetScheme("3 x 8 / side")).toEqual({ sets: 3, reps: "8 / side" });
    expect(parseSetScheme("6 × 200m hard\nwalk back")).toEqual({ sets: 6, reps: "200m hard" });
    expect(parseSetScheme("10 min easy jog")).toBeNull();
    expect(parseSetScheme("2–4 light sets of the first lift")).toBeNull();
    expect(parseSetScheme("")).toBeNull();
    expect(parseSetScheme("99 × 5")).toBeNull();
  });

  it("suggests the low end of a numeric rep range", () => {
    expect(parseReps("5–6")).toBe(5);
    expect(parseReps("8-10")).toBe(8);
    expect(parseReps("12")).toBe(12);
    expect(parseReps("8 / side")).toBe(8);
    expect(parseReps("10 each")).toBe(10);
    expect(parseReps("20m")).toBeNull();
    expect(parseReps("20s strides")).toBeNull();
    expect(parseReps("200m hard")).toBeNull();
  });

  it("turns rest into seconds", () => {
    expect(parseRestSeconds("90 sec")).toBe(90);
    expect(parseRestSeconds("2 min")).toBe(120);
    expect(parseRestSeconds("2–3 min")).toBe(120);
    expect(parseRestSeconds("45–60 sec")).toBe(45);
    expect(parseRestSeconds("1:30")).toBe(90);
    expect(parseRestSeconds("1.5 minutes")).toBe(90);
    expect(parseRestSeconds("walk back")).toBeNull();
    expect(parseRestSeconds("")).toBeNull();
    expect(parseRestSeconds("2 s")).toBeNull();
  });
});

describe("planExercise", () => {
  it("logs weight and reps for loaded lifts", () => {
    const plan = planExercise(item(), "strength");
    expect(plan).toMatchObject({ mode: "load", sets: 4, repsLabel: "5–6", suggestedReps: 5, restSeconds: 120 });
  });

  it("logs reps only for bodyweight work", () => {
    const plan = planExercise(item({ name: "Push-up", instruction: "2 × 8–12", equipment: ["bodyweight"] }), "strength");
    expect(plan).toMatchObject({ mode: "reps", sets: 2, suggestedReps: 8 });
  });

  it("assumes a load for strength items without equipment", () => {
    expect(planExercise(item({ equipment: [] }), "strength").mode).toBe("load");
    expect(planExercise(item({ equipment: [] }), "plyometrics").mode).toBe("reps");
  });

  it("ticks sets off for runs and distances", () => {
    expect(planExercise(item({ instruction: "6 × 200m hard", equipment: [] }), "running")).toMatchObject({
      mode: "done",
      sets: 6,
      suggestedReps: null,
    });
    expect(planExercise(item({ instruction: "3 × 20m", equipment: ["bodyweight"] }), "plyometrics")).toMatchObject({
      mode: "done",
      sets: 3,
    });
  });

  it("treats free text as one thing to do", () => {
    expect(planExercise(item({ instruction: "10 min easy jog", rest: "" }), "running")).toMatchObject({
      mode: "done",
      sets: 1,
      restSeconds: null,
    });
  });

  it("reads a bare rep count as one set", () => {
    expect(planExercise(item({ instruction: "10 / side", equipment: ["bodyweight"] }), "other")).toMatchObject({
      mode: "reps",
      sets: 1,
      suggestedReps: 10,
    });
  });
});

describe("the log", () => {
  const plans: PlannedExercise[] = [
    planExercise(item({ id: ID(1) }), "strength"),
    planExercise(item({ id: ID(2), name: "Row", instruction: "3 × 8–10" }), "strength"),
  ];

  it("starts with every planned set open", () => {
    const entries = initialEntries(plans);
    expect(entries.items.map((entry) => entry.sets.length)).toEqual([4, 3]);
    expect(entries.items[0]!.sets[0]).toEqual({ weight: null, reps: null, done: false });
  });

  it("keeps logged sets and the plan's order when they are lined up again", () => {
    const stored: WorkoutEntries = {
      version: 1,
      items: [
        { item_id: ID(2), name: "Row", sets: [{ weight: 60, reps: 8, done: true }] },
        { item_id: ID(9), name: "Removed curl", sets: [{ weight: 12, reps: 10, done: true }] },
        { item_id: ID(8), name: "Removed untouched", sets: [{ weight: null, reps: null, done: false }] },
      ],
    };
    const aligned = alignEntries(plans, stored);
    expect(aligned.entries.items.map((entry) => entry.item_id)).toEqual([ID(1), ID(2), ID(9)]);
    expect(aligned.entries.items[1]!.sets).toEqual([{ weight: 60, reps: 8, done: true }]);
    expect(aligned.exercises[2]).toMatchObject({ name: "Removed curl", mode: "load", sets: 1 });
  });

  it("summarises what was done", () => {
    const entries: WorkoutEntries = {
      version: 1,
      items: [
        {
          item_id: ID(1),
          name: "Bench",
          sets: [
            { weight: 80, reps: 6, done: true },
            { weight: 80, reps: 5, done: true },
          ],
        },
        {
          item_id: ID(2),
          name: "Push-up",
          sets: [
            { weight: null, reps: 12, done: true },
            { weight: 100, reps: 100, done: false },
          ],
        },
      ],
    };
    expect(summarize(entries)).toEqual({
      setsDone: 3,
      setsTotal: 4,
      volume: 880,
      exercisesDone: 1,
      exercisesTotal: 2,
      repsDone: 23,
    });
  });

  it("validates what the screen sends", () => {
    const ok = workoutProgressSchema.safeParse({
      unit: "kg",
      entries: { version: 1, items: [{ item_id: ID(1), name: "Bench", sets: [{ weight: 80.333, reps: 6, done: true }] }] },
    });
    expect(ok.success && ok.data.entries.items[0]!.sets[0]!.weight).toBe(80.33);
    expect(ok.success && ok.data.notes).toBe("");

    const bad = [
      { unit: "stone", entries: { version: 1, items: [] } },
      { unit: "kg", entries: { version: 2, items: [] } },
      { unit: "kg", entries: { version: 1, items: [{ item_id: "x", name: "a", sets: [] }] } },
      { unit: "kg", entries: { version: 1, items: [{ item_id: ID(1), name: "a", sets: [{ weight: -1, reps: 1, done: true }] }] } },
      { unit: "kg", entries: { version: 1, items: [{ item_id: ID(1), name: "a", sets: [{ weight: 1, reps: 1.5, done: true }] }] } },
    ];
    for (const value of bad) expect(workoutProgressSchema.safeParse(value).success).toBe(false);
  });
});

describe("history", () => {
  it("finds the latest completed sets per exercise name", () => {
    const logs = [
      {
        finishedAt: "2026-11-18T10:00:00Z",
        unit: "kg" as const,
        entries: {
          version: 1 as const,
          items: [
            { item_id: ID(1), name: "Bench  Press", sets: [{ weight: 80, reps: 6, done: true }, { weight: 85, reps: 3, done: false }] },
            { item_id: ID(2), name: "Row", sets: [{ weight: null, reps: null, done: false }] },
          ],
        },
      },
      {
        finishedAt: "2026-11-11T10:00:00Z",
        unit: "kg" as const,
        entries: {
          version: 1 as const,
          items: [
            { item_id: ID(3), name: "bench press", sets: [{ weight: 75, reps: 6, done: true }] },
            { item_id: ID(4), name: "Row", sets: [{ weight: 60, reps: 8, done: true }] },
          ],
        },
      },
    ];
    const latest = latestPerformances(logs);
    expect(latest.get("bench press")).toEqual({
      finishedAt: "2026-11-18T10:00:00Z",
      unit: "kg",
      sets: [{ weight: 80, reps: 6 }],
    });
    expect(latest.get("row")?.finishedAt).toBe("2026-11-11T10:00:00Z");
  });

  it("formats a previous performance compactly", () => {
    expect(formatPerformance({ unit: "kg", sets: [{ weight: 80, reps: 6 }, { weight: 80, reps: 5 }] })).toBe("80 kg × 6, 5");
    expect(formatPerformance({ unit: "lb", sets: [{ weight: 135, reps: 8 }, { weight: 145.5, reps: 6 }] })).toBe(
      "135 × 8 · 145.5 × 6 lb",
    );
    expect(formatPerformance({ unit: "kg", sets: [{ weight: null, reps: 12 }, { weight: null, reps: 10 }] })).toBe("12, 10");
  });

  it("formats time", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(3909)).toBe("1:05:09");
    expect(formatDurationWords(52 * 60 + 14)).toBe("52 min");
    expect(formatDurationWords(65 * 60)).toBe("1 h 5 min");
    expect(formatVolume(612.5)).toBe("612.5");
    expect(formatVolume(6240)).toBe("6,240");
    expect(formatVolume(12_430)).toBe("12.4k");
  });
});
