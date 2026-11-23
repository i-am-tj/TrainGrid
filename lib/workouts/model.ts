import { z } from "zod";
import type { EquipmentType, SessionType } from "@/lib/domain";

/**
 * Live workouts: what a member actually did in a scheduled session.
 *
 * Pure and shared by the server (validation, storage) and the workout screen
 * (planning sets, suggestions, the summary). The planned session is never
 * changed by logging; a log only records performed sets against it.
 */

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const WORKOUT_STATUSES = ["in_progress", "completed"] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

/**
 * How an exercise is logged:
 *   load  weight and reps (a barbell, dumbbell, machine… lift)
 *   reps  reps only (bodyweight)
 *   done  a tick per set (runs, strides, carries, anything without a rep count)
 */
export const SET_MODES = ["load", "reps", "done"] as const;
export type SetMode = (typeof SET_MODES)[number];

export const MAX_SETS = 30;
const MAX_LOGGED_ITEMS = 200;
export const MAX_WEIGHT = 2000;
export const MAX_REPS = 1000;

// ---------------------------------------------------------------------------
// The stored document
// ---------------------------------------------------------------------------

const weightSchema = z
  .number()
  .min(0)
  .max(MAX_WEIGHT)
  .transform((value) => Math.round(value * 100) / 100)
  .nullable();
const repsSchema = z.number().int().min(0).max(MAX_REPS).nullable();

export const loggedSetSchema = z.object({
  weight: weightSchema,
  reps: repsSchema,
  done: z.boolean(),
});

export const loggedExerciseSchema = z.object({
  item_id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  sets: z.array(loggedSetSchema).max(MAX_SETS),
  /**
   * Free-form workouts only (no plan to read): how the exercise is logged and
   * its rest, chosen when it was added. Planned exercises leave these out.
   */
  mode: z.enum(SET_MODES).optional(),
  rest_seconds: z.number().int().min(5).max(1800).nullable().optional(),
});

export const workoutEntriesSchema = z.object({
  version: z.literal(1),
  items: z.array(loggedExerciseSchema).max(MAX_LOGGED_ITEMS),
});

export type LoggedSet = z.infer<typeof loggedSetSchema>;
export type LoggedExercise = z.infer<typeof loggedExerciseSchema>;
export type WorkoutEntries = z.infer<typeof workoutEntriesSchema>;

/** What the workout screen sends on every save. */
export const workoutProgressSchema = z.object({
  unit: z.enum(WEIGHT_UNITS),
  entries: workoutEntriesSchema,
  notes: z.string().trim().max(2000).default(""),
});

export type WorkoutProgress = z.input<typeof workoutProgressSchema>;

/** A log as the app sees it. */
export type WorkoutLog = {
  id: string;
  sessionId: string;
  status: WorkoutStatus;
  startedAt: string;
  finishedAt: string | null;
  unit: WeightUnit;
  entries: WorkoutEntries;
  notes: string;
  updatedAt: string;
};

export const EMPTY_ENTRIES: WorkoutEntries = { version: 1, items: [] };

// ---------------------------------------------------------------------------
// Reading the plan: "4 × 5–6", "Rest: 2 min"
// ---------------------------------------------------------------------------

/** One exercise of the session as the workout screen runs it. */
export type PlannedExercise = {
  itemId: string;
  name: string;
  mode: SetMode;
  /** Planned number of sets (at least 1). */
  sets: number;
  /** The planned reps as written ("5–6", "8 / side", "200m hard"), or null. */
  repsLabel: string | null;
  /** A starting rep count when the plan gives a number. */
  suggestedReps: number | null;
  restSeconds: number | null;
  rest: string;
  target: string;
  /** The planned work as written, e.g. "4 × 5–6". */
  instruction: string;
  notes: string;
  equipment: EquipmentType[];
  videoUrl: string | null;
};

type PlanItem = {
  id: string;
  name: string;
  instruction: string;
  rest: string;
  target: string;
  notes: string;
  equipment: EquipmentType[];
  videoUrl: string | null;
};

const LOADED_EQUIPMENT: readonly EquipmentType[] = ["barbell", "dumbbell", "kettlebell", "machine", "cable"];

const SCHEME = /^(\d{1,2})\s*[×xX*]\s*(.+)$/;
const NUMERIC_REPS = /^(\d{1,3})(?:\s*[–—-]\s*(\d{1,3}))?(?:\s*(?:\/\s*side|per side|each(?: side| leg| arm)?|reps?))?$/i;

/** "4 × 5–6" → 4 sets of "5–6". Only the first line counts. */
export function parseSetScheme(instruction: string): { sets: number; reps: string } | null {
  const first = instruction.split("\n")[0]?.trim() ?? "";
  const match = SCHEME.exec(first);
  if (!match) return null;
  const sets = Number(match[1]);
  if (sets < 1 || sets > MAX_SETS) return null;
  return { sets, reps: match[2]!.trim() };
}

/** "5–6" → 5, "8 / side" → 8, "20m" → null. The lower end of a range is the suggestion. */
export function parseReps(reps: string): number | null {
  const match = NUMERIC_REPS.exec(reps.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 ? value : null;
}

/** "90 sec" → 90, "2–3 min" → 120, "1:30" → 90, "walk back" → null. */
export function parseRestSeconds(rest: string): number | null {
  const text = rest.trim().toLowerCase();
  if (!text) return null;
  const clock = /(\d{1,2}):([0-5]\d)/.exec(text);
  let seconds: number | null = null;
  if (clock) {
    seconds = Number(clock[1]) * 60 + Number(clock[2]);
  } else {
    const match = /(\d+(?:\.\d+)?)\s*(?:[–—-]\s*\d+(?:\.\d+)?\s*)?(minutes?|mins?|m|seconds?|secs?|s)\b/.exec(text);
    if (match) {
      const value = Number(match[1]);
      seconds = match[2]!.startsWith("m") ? value * 60 : value;
    }
  }
  if (seconds === null) return null;
  seconds = Math.round(seconds);
  return seconds >= 5 && seconds <= 1800 ? seconds : null;
}

/** How one planned item is run in the workout screen. */
export function planExercise(item: PlanItem, category: SessionType): PlannedExercise {
  const scheme = parseSetScheme(item.instruction);
  const firstLine = item.instruction.split("\n")[0]?.trim() ?? "";
  // "10 / side" with no "×" is one set of ten.
  const repsLabel = scheme?.reps ?? (parseReps(firstLine) !== null ? firstLine : null);
  const suggestedReps = repsLabel ? parseReps(repsLabel) : null;

  let mode: SetMode = "done";
  if (category !== "running" && suggestedReps !== null) {
    const loaded =
      item.equipment.some((tag) => LOADED_EQUIPMENT.includes(tag)) ||
      (item.equipment.length === 0 && category === "strength");
    mode = loaded ? "load" : "reps";
  }

  return {
    itemId: item.id,
    name: item.name,
    mode,
    sets: scheme?.sets ?? 1,
    repsLabel,
    suggestedReps,
    restSeconds: parseRestSeconds(item.rest),
    rest: item.rest,
    target: item.target,
    instruction: item.instruction,
    notes: item.notes,
    equipment: item.equipment,
    videoUrl: item.videoUrl,
  };
}

// ---------------------------------------------------------------------------
// Building and merging the log
// ---------------------------------------------------------------------------

export function emptySet(): LoggedSet {
  return { weight: null, reps: null, done: false };
}

/** A fresh log for the planned exercises: every set open, nothing filled in. */
export function initialEntries(exercises: readonly PlannedExercise[]): WorkoutEntries {
  return {
    version: 1,
    items: exercises.map((exercise) => ({
      item_id: exercise.itemId,
      name: exercise.name,
      sets: Array.from({ length: exercise.sets }, emptySet),
    })),
  };
}

/**
 * The plan and a stored log, lined up: one entry per planned exercise, in the
 * plan's order, keeping whatever was logged against it. An exercise the
 * session no longer has (it was customised mid-workout) is kept at the end if
 * anything was done in it, so no logged set is ever dropped.
 */
export function alignEntries(
  exercises: readonly PlannedExercise[],
  stored: WorkoutEntries,
): { exercises: PlannedExercise[]; entries: WorkoutEntries } {
  const byId = new Map(stored.items.map((item) => [item.item_id, item]));
  const planned = new Set(exercises.map((exercise) => exercise.itemId));

  const items = exercises.map((exercise) => {
    const logged = byId.get(exercise.itemId);
    return logged && logged.sets.length > 0
      ? { ...logged, name: exercise.name }
      : { item_id: exercise.itemId, name: exercise.name, sets: Array.from({ length: exercise.sets }, emptySet) };
  });

  const orphans = stored.items.filter(
    (item) => !planned.has(item.item_id) && item.sets.some((set) => set.done),
  );
  const orphanPlans = orphans.map((item): PlannedExercise => {
    const loaded = item.sets.some((set) => set.weight !== null);
    const counted = item.sets.some((set) => set.reps !== null);
    return {
      itemId: item.item_id,
      name: item.name,
      mode: loaded ? "load" : counted ? "reps" : "done",
      sets: item.sets.length,
      repsLabel: null,
      suggestedReps: null,
      restSeconds: null,
      rest: "",
      target: "",
      instruction: "",
      notes: "No longer in this session’s plan.",
      equipment: [],
      videoUrl: null,
    };
  });

  return {
    exercises: [...exercises, ...orphanPlans],
    entries: { version: 1, items: [...items, ...orphans] },
  };
}

// ---------------------------------------------------------------------------
// Free-form workouts: no plan, exercises added as you go
// ---------------------------------------------------------------------------

/** A quick workout's name until the member names it at the finish. */
export const QUICK_WORKOUT_NAMES: Record<SessionType, string> = {
  running: "Quick run",
  strength: "Quick lift",
  plyometrics: "Quick plyo",
  other: "Quick workout",
};

/** How a new exercise is logged by default in a session of this type. */
export function defaultSetMode(category: SessionType): SetMode {
  if (category === "strength") return "load";
  if (category === "running") return "done";
  return "reps";
}

/** The rest choices offered when adding an exercise, in seconds (null: no timer). */
export const REST_CHOICES: ReadonlyArray<number | null> = [null, 60, 90, 120, 180];

export const newExerciseSchema = z.object({
  name: z.string().trim().min(1, "Name the exercise.").max(200, "Keep the name to 200 characters."),
  mode: z.enum(SET_MODES),
  restSeconds: z.number().int().min(5).max(1800).nullable(),
});

export type NewExercise = z.input<typeof newExerciseSchema>;

/** How a free-form exercise runs, from what is stored with it. */
export function freeFormPlan(item: LoggedExercise): PlannedExercise {
  const loaded = item.sets.some((set) => set.weight !== null);
  const counted = item.sets.some((set) => set.reps !== null);
  return {
    itemId: item.item_id,
    name: item.name,
    mode: item.mode ?? (loaded ? "load" : counted ? "reps" : "done"),
    sets: Math.max(1, item.sets.length),
    repsLabel: null,
    suggestedReps: null,
    restSeconds: item.rest_seconds ?? null,
    rest: item.rest_seconds ? formatRestChoice(item.rest_seconds) : "",
    target: "",
    instruction: "",
    notes: "",
    equipment: [],
    videoUrl: null,
  };
}

/** A free-form workout's exercises are exactly what its log holds. */
export function alignFreeForm(stored: WorkoutEntries): { exercises: PlannedExercise[]; entries: WorkoutEntries } {
  return { exercises: stored.items.map(freeFormPlan), entries: stored };
}

/** A new exercise for a free-form workout: three open sets (one for a tick), ready to log. */
export function newFreeFormExercise(input: NewExercise, id: string): { plan: PlannedExercise; entry: LoggedExercise } {
  const parsed = newExerciseSchema.parse(input);
  const entry: LoggedExercise = {
    item_id: id,
    name: parsed.name,
    sets: Array.from({ length: parsed.mode === "done" ? 1 : 3 }, emptySet),
    mode: parsed.mode,
    rest_seconds: parsed.restSeconds,
  };
  return { plan: freeFormPlan(entry), entry };
}

/** "90 s", "2 min", "No timer". */
export function formatRestChoice(seconds: number | null): string {
  if (seconds === null) return "No timer";
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
}

/** Minutes trained, 1–1440, from a finished workout's start and finish. */
export function trainedMinutes(startedAt: string, finishedAt: string): number {
  const minutes = Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 60000);
  return Math.min(1440, Math.max(1, Number.isFinite(minutes) ? minutes : 1));
}

// ---------------------------------------------------------------------------
// Summary and history
// ---------------------------------------------------------------------------

export type WorkoutSummary = {
  setsDone: number;
  setsTotal: number;
  /** Σ weight × reps over completed sets that have both. */
  volume: number;
  exercisesDone: number;
  exercisesTotal: number;
  repsDone: number;
};

export function summarize(entries: WorkoutEntries): WorkoutSummary {
  let setsDone = 0;
  let setsTotal = 0;
  let volume = 0;
  let exercisesDone = 0;
  let repsDone = 0;
  for (const item of entries.items) {
    setsTotal += item.sets.length;
    const done = item.sets.filter((set) => set.done);
    setsDone += done.length;
    if (item.sets.length > 0 && done.length === item.sets.length) exercisesDone += 1;
    for (const set of done) {
      if (set.reps !== null) repsDone += set.reps;
      if (set.weight !== null && set.reps !== null) volume += set.weight * set.reps;
    }
  }
  return {
    setsDone,
    setsTotal,
    volume: Math.round(volume * 10) / 10,
    exercisesDone,
    exercisesTotal: entries.items.length,
    repsDone,
  };
}

/** The sets done last time an exercise of the same name was completed. */
export type PreviousPerformance = {
  finishedAt: string;
  unit: WeightUnit;
  sets: Array<{ weight: number | null; reps: number | null }>;
};

export function exerciseKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The most recent performance of each named exercise, from completed logs
 * given newest first. Only sets that were done count.
 */
export function latestPerformances(
  logs: ReadonlyArray<{ finishedAt: string; unit: WeightUnit; entries: WorkoutEntries }>,
): Map<string, PreviousPerformance> {
  const result = new Map<string, PreviousPerformance>();
  for (const log of logs) {
    for (const item of log.entries.items) {
      const key = exerciseKey(item.name);
      if (result.has(key)) continue;
      const sets = item.sets
        .filter((set) => set.done && (set.weight !== null || set.reps !== null))
        .map(({ weight, reps }) => ({ weight, reps }));
      if (sets.length > 0) result.set(key, { finishedAt: log.finishedAt, unit: log.unit, sets });
    }
  }
  return result;
}

export function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

/** "80 kg × 6, 6, 5" when the weight held; "80 × 6 · 77.5 × 5 kg" when it changed; "12, 10, 8" for reps. */
export function formatPerformance(previous: Pick<PreviousPerformance, "sets" | "unit">): string {
  const sets = previous.sets;
  if (sets.length === 0) return "";
  const weights = sets.map((set) => set.weight);
  if (weights.every((weight) => weight === null)) {
    return sets.map((set) => (set.reps === null ? "✓" : String(set.reps))).join(", ");
  }
  const same = weights.every((weight) => weight === weights[0]);
  if (same) {
    return `${formatWeight(weights[0]!)} ${previous.unit} × ${sets.map((set) => set.reps ?? "–").join(", ")}`;
  }
  return `${sets
    .map((set) => `${set.weight === null ? "–" : formatWeight(set.weight)} × ${set.reps ?? "–"}`)
    .join(" · ")} ${previous.unit}`;
}

/** "52:14", or "1:05:09" past an hour. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "52 min", "1 h 5 min". */
export function formatDurationWords(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const VOLUME_FORMAT = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/** "612.5", "6,240", "12.4k" past 10,000. */
export function formatVolume(volume: number): string {
  if (volume >= 10000) return `${VOLUME_FORMAT.format(Math.round(volume / 100) / 10)}k`;
  return VOLUME_FORMAT.format(volume);
}

/** Steps for the weight buttons. */
export function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
}
