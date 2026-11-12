import { describe, expect, it } from "vitest";
import {
  adhocSessionInputSchema,
  duplicateWeekInputSchema,
  routineInputSchema,
  scheduleRoutineInputSchema,
  sessionDetailsInputSchema,
  workoutItemInputSchema,
} from "./schemas";
import { validate } from "./validate";
import { DataError } from "./model";

const ok = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe("workoutItemInputSchema", () => {
  it("fills defaults and normalises", () => {
    expect(
      workoutItemInputSchema.parse({
        name: "  Back Squat ",
        equipment: ["bench", "barbell", "barbell"],
        videoUrl: "https://youtu.be/abcdefghijk",
      }),
    ).toEqual({
      name: "Back Squat",
      instruction: "",
      rest: "",
      target: "",
      notes: "",
      equipment: ["barbell", "bench"],
      videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    });
  });

  it("D6: keeps structured fields apart; text like 'Rest: 2 min' in notes stays in notes", () => {
    const parsed = workoutItemInputSchema.parse({ name: "Squat", notes: "Rest: 2 min" });
    expect(parsed.notes).toBe("Rest: 2 min");
    expect(parsed.rest).toBe("");
  });

  it("treats an empty video as none", () => {
    expect(workoutItemInputSchema.parse({ name: "x", videoUrl: "  " }).videoUrl).toBeNull();
    expect(workoutItemInputSchema.parse({ name: "x", videoUrl: null }).videoUrl).toBeNull();
  });

  it("rejects bad values", () => {
    expect(ok(workoutItemInputSchema, { name: "" })).toBe(false);
    expect(ok(workoutItemInputSchema, { name: "x".repeat(201) })).toBe(false);
    expect(ok(workoutItemInputSchema, { name: "x", equipment: ["trampoline"] })).toBe(false);
    expect(ok(workoutItemInputSchema, { name: "x", videoUrl: "https://vimeo.com/1" })).toBe(false);
    expect(ok(workoutItemInputSchema, { name: "x", videoUrl: "javascript:alert(1)" })).toBe(false);
    expect(ok(workoutItemInputSchema, { name: "x", rest: "r".repeat(201) })).toBe(false);
    expect(ok(workoutItemInputSchema, { name: "x", id: "not-a-uuid" })).toBe(false);
  });
});

describe("routineInputSchema", () => {
  it("accepts a routine with items", () => {
    expect(
      ok(routineInputSchema, { name: "Lower A", category: "strength", items: [{ name: "Squat" }] }),
    ).toBe(true);
  });

  it("rejects unknown categories, too many items, and ownership fields are ignored", () => {
    expect(ok(routineInputSchema, { name: "x", category: "yoga" })).toBe(false);
    expect(
      ok(routineInputSchema, {
        name: "x",
        category: "other",
        items: Array.from({ length: 101 }, () => ({ name: "i" })),
      }),
    ).toBe(false);
    const parsed = routineInputSchema.parse({
      name: "x",
      category: "other",
      scope: "GLOBAL",
      owner_user_id: "someone-else",
    });
    expect(parsed).not.toHaveProperty("scope");
    expect(parsed).not.toHaveProperty("owner_user_id");
  });
});

describe("session schemas", () => {
  const base = { date: "2026-11-16", startTime: "07:30", durationMinutes: 60, notes: "" };

  it("accepts timed and untimed sessions", () => {
    expect(ok(sessionDetailsInputSchema, { ...base, name: "Run", category: "running" })).toBe(true);
    expect(
      sessionDetailsInputSchema.parse({ ...base, name: "Run", category: "running", startTime: "" })
        .startTime,
    ).toBeNull();
  });

  it("rejects bad dates, times and durations", () => {
    const valid = { ...base, name: "Run", category: "running" };
    expect(ok(sessionDetailsInputSchema, { ...valid, date: "2026-02-30" })).toBe(false);
    expect(ok(sessionDetailsInputSchema, { ...valid, startTime: "07:15" })).toBe(false);
    expect(ok(sessionDetailsInputSchema, { ...valid, startTime: "25:00" })).toBe(false);
    expect(ok(sessionDetailsInputSchema, { ...valid, durationMinutes: 0 })).toBe(false);
    expect(ok(sessionDetailsInputSchema, { ...valid, durationMinutes: 1.5 })).toBe(false);
  });

  it("does not take a user id from input", () => {
    const parsed = scheduleRoutineInputSchema.parse({
      ...base,
      routineId: "10000000-0000-4000-8000-000000000001",
      user_id: "00000000-0000-4000-8000-00000000000b",
    });
    expect(parsed).not.toHaveProperty("user_id");
  });

  it("requires a valid routine id when scheduling", () => {
    expect(ok(scheduleRoutineInputSchema, { ...base, routineId: "lower-a" })).toBe(false);
  });

  it("validates ad-hoc items", () => {
    expect(
      ok(adhocSessionInputSchema, { ...base, name: "x", category: "other", items: [{ name: "" }] }),
    ).toBe(false);
  });
});

describe("duplicateWeekInputSchema", () => {
  it("needs two different, real weeks", () => {
    expect(ok(duplicateWeekInputSchema, { sourceWeekId: "2026-W46", destWeekId: "2026-W47" })).toBe(true);
    expect(ok(duplicateWeekInputSchema, { sourceWeekId: "2026-W46", destWeekId: "2026-W46" })).toBe(false);
    expect(ok(duplicateWeekInputSchema, { sourceWeekId: "2026-W46", destWeekId: "2027-W53" })).toBe(false);
    expect(ok(duplicateWeekInputSchema, { sourceWeekId: "x", destWeekId: "2026-W47" })).toBe(false);
  });
});

describe("validate", () => {
  it("throws DataError('invalid') with the first message", () => {
    try {
      validate(duplicateWeekInputSchema, { sourceWeekId: "2026-W46", destWeekId: "2026-W46" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DataError);
      expect((error as DataError).code).toBe("invalid");
      expect((error as DataError).message).toBe("Choose a different week");
    }
  });
});
