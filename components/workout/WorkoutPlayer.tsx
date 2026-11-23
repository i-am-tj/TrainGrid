"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { discardWorkoutAction, finishWorkoutAction, startWorkoutAction } from "@/lib/workouts/actions";
import {
  alignEntries,
  alignFreeForm,
  defaultSetMode,
  emptySet,
  exerciseKey,
  formatClock,
  formatPerformance,
  initialEntries,
  newFreeFormExercise,
  REST_CHOICES,
  summarize,
  weightStep,
  WEIGHT_UNITS,
  type LoggedSet,
  type PlannedExercise,
  type SetMode,
  type PreviousPerformance,
  type WeightUnit,
  type WorkoutEntries,
  type WorkoutLog,
} from "@/lib/workouts/model";
import type { SessionType } from "@/lib/domain";
import { parseYouTubeUrl } from "@/lib/youtube";
import {
  clearLocalWorkout,
  haptic,
  readLocalWorkout,
  readPreference,
  useAutosave,
  useChime,
  useNow,
  useWakeLock,
  writeLocalWorkout,
  writePreference,
  type SaveState,
} from "./hooks";
import { Chip, describeSet, Icon, ProgressSegments, RestTimer, Segmented, SetEditor, SetRow, type SetValues } from "./parts";
import { WorkoutSummaryView } from "./WorkoutSummary";

export type WorkoutSessionInfo = {
  id: string;
  name: string;
  categoryLabel: string;
  /** The session type, which picks how a new exercise is logged by default. */
  category: SessionType;
  dateLabel: string;
  backHref: string;
  /** Started on the spot from Home: named at the finish, removed if discarded. */
  quick: boolean;
  /** No planned exercises: exercises are added during the workout. */
  freeForm: boolean;
};

type Phase = "ready" | "active" | "summary";
type Rest = { endsAt: number; total: number; label: string | null };

const UNIT_OPTIONS = WEIGHT_UNITS.map((value) => ({ value, label: value }));

/** When a timer of `seconds` started now would end (ms since epoch). */
function secondsFromNow(seconds: number): number {
  return Date.now() + seconds * 1000;
}

function firstOpen(sets: readonly LoggedSet[]): number {
  return sets.findIndex((set) => !set.done);
}

function firstOpenExercise(entries: WorkoutEntries, from = 0): number {
  const count = entries.items.length;
  for (let offset = 0; offset < count; offset += 1) {
    const index = (from + offset) % count;
    if (firstOpen(entries.items[index]!.sets) !== -1) return index;
  }
  return -1;
}

/**
 * What a set shows before it is touched: this workout's previous set, then
 * last time's same set, then the plan's reps.
 */
function suggest(
  exercise: PlannedExercise,
  sets: readonly LoggedSet[],
  index: number,
  previous: PreviousPerformance | undefined,
  unit: WeightUnit,
): SetValues {
  const set = sets[index]!;
  const earlier = sets.slice(0, index).reverse();
  const last = previous && previous.unit === unit ? previous : undefined;
  const lastSet = previous ? (previous.sets[index] ?? previous.sets.at(-1)) : undefined;
  const weight =
    set.weight ??
    earlier.find((s) => s.weight !== null)?.weight ??
    (last ? (lastSet?.weight ?? null) : null);
  const reps = set.reps ?? earlier.find((s) => s.reps !== null)?.reps ?? lastSet?.reps ?? exercise.suggestedReps;
  return {
    weight: exercise.mode === "load" ? weight : null,
    reps: exercise.mode === "done" ? null : reps,
  };
}

/**
 * The live workout: start a scheduled session, work through its exercises a
 * set at a time with a rest timer between, and finish with a summary.
 *
 * Built for a phone in one hand: the controls live at the bottom of the
 * screen, every target is at least 44px, the screen stays on, and progress
 * is saved to the phone at once and to TrainGrid a moment later, so a lost
 * signal in the gym never loses a set.
 */
export function WorkoutPlayer({
  session,
  exercises,
  log,
  previous,
  previousByName = {},
}: {
  session: WorkoutSessionInfo;
  exercises: PlannedExercise[];
  log: WorkoutLog | null;
  previous: Record<string, PreviousPerformance>;
  /** "Last time" by exercise name, for exercises added during a free-form workout. */
  previousByName?: Record<string, PreviousPerformance>;
}) {
  const router = useRouter();
  // A free-form workout's exercises are whatever its log holds; a planned one
  // lines the log up against the plan.
  const align = (stored: WorkoutEntries) => (session.freeForm ? alignFreeForm(stored) : alignEntries(exercises, stored));
  const initial = useMemo(
    () => align(log?.entries ?? initialEntries(exercises)),
    // The plan and log are read once; the screen owns them from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [plans, setPlans] = useState(initial.exercises);
  const [entries, setEntries] = useState(initial.entries);
  const [unit, setUnit] = useState<WeightUnit>(log?.unit ?? "kg");
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [startedAt, setStartedAt] = useState(log?.startedAt ?? null);
  const [finishedAt, setFinishedAt] = useState(log?.finishedAt ?? null);
  const [phase, setPhase] = useState<Phase>(!log ? "ready" : log.status === "completed" ? "summary" : "active");
  const [current, setCurrent] = useState(() => Math.max(0, firstOpenExercise(initial.entries)));
  const [focused, setFocused] = useState<number>(() => {
    const sets = initial.entries.items[Math.max(0, firstOpenExercise(initial.entries))]?.sets ?? [];
    return firstOpen(sets);
  });
  const [direction, setDirection] = useState<1 | -1>(1);
  const [rest, setRest] = useState<Rest | null>(null);
  const [restOverAt, setRestOverAt] = useState<number | null>(null);
  const [sound, setSound] = useState<"on" | "off">("on");
  const [menuOpen, setMenuOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState<"start" | "finish" | "discard" | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState(session.name);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const advanceTimer = useRef<number | undefined>(undefined);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const active = phase === "active";
  const autosave = useAutosave({ sessionId: session.id, enabled: phase !== "ready", progress: { unit, entries, notes } });
  useWakeLock(active);
  const { prime, chime } = useChime();
  const now = useNow(active, rest ? 250 : 1000);

  // Restore what this phone has that TrainGrid does not (a set logged with no signal),
  // and the device preferences. Storage is only readable in the browser.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSound(readPreference("workout-sound", ["on", "off"] as const, "on"));
    if (!log) {
      setUnit(readPreference("weight-unit", WEIGHT_UNITS, "kg"));
      return;
    }
    const local = readLocalWorkout(session.id);
    if (!local) return;
    if (log.status === "in_progress" && local.savedAt > Date.parse(log.updatedAt)) {
      const restored = align(local.entries);
      setPlans(restored.exercises);
      setEntries(restored.entries);
      setUnit(local.unit);
      setNotes(local.notes);
      const index = Math.max(0, firstOpenExercise(restored.entries));
      setCurrent(index);
      setFocused(firstOpen(restored.entries.items[index]?.sets ?? []));
      autosave.markDirty();
    }
    if (log.status === "in_progress" && local.restEndsAt && local.restEndsAt > Date.now()) {
      setRest({ endsAt: local.restEndsAt, total: local.restTotal ?? 60, label: null });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the rest timer on the phone too, so a reload or a locked screen keeps it.
  useEffect(() => {
    if (!active) return;
    const local = readLocalWorkout(session.id);
    if (local) writeLocalWorkout(session.id, { ...local, restEndsAt: rest?.endsAt ?? null, restTotal: rest?.total ?? null });
  }, [active, rest, session.id]);

  const remaining = rest && now !== null ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : null;
  const restDone = rest !== null && remaining === 0;

  // The rest runs out: buzz, chime, and say so.
  useEffect(() => {
    if (!restDone) return;
    haptic([180, 90, 180]);
    if (sound === "on") chime();
    /* eslint-disable react-hooks/set-state-in-effect */
    setAnnouncement("Rest over. Next set.");
    setRest(null);
    setRestOverAt(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [restDone, sound, chime]);

  useEffect(() => {
    if (restOverAt === null) return;
    const id = window.setTimeout(() => setRestOverAt(null), 5000);
    return () => window.clearTimeout(id);
  }, [restOverAt]);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const summary = useMemo(() => summarize(entries), [entries]);
  const progress = useMemo(
    () =>
      entries.items.map((item, index) => ({
        name: plans[index]?.name ?? item.name,
        done: item.sets.filter((set) => set.done).length,
        total: item.sets.length,
      })),
    [entries, plans],
  );

  const exercise = plans[current];
  const entry = entries.items[current];
  const prev = exercise ? (previous[exercise.itemId] ?? previousByName[exerciseKey(exercise.name)]) : undefined;
  const elapsed = startedAt && now !== null ? (now - Date.parse(startedAt)) / 1000 : null;
  const allDone = summary.setsTotal > 0 && summary.setsDone === summary.setsTotal;

  // -------------------------------------------------------------------------
  // Changing the log
  // -------------------------------------------------------------------------

  function updateSets(exerciseIndex: number, change: (sets: LoggedSet[]) => LoggedSet[]) {
    setEntries((state) => ({
      ...state,
      items: state.items.map((item, index) => (index === exerciseIndex ? { ...item, sets: change(item.sets) } : item)),
    }));
  }

  function goTo(index: number, focusSet?: number) {
    if (index < 0 || index >= plans.length) return;
    window.clearTimeout(advanceTimer.current);
    setDirection(index >= current ? 1 : -1);
    setCurrent(index);
    setFocused(focusSet ?? firstOpen(entries.items[index]?.sets ?? []));
  }

  function logSet(index: number) {
    if (!exercise || !entry) return;
    const values = suggest(exercise, entry.sets, index, prev, unit);
    const nextSets = entry.sets.map((set, i) => (i === index ? { ...values, done: true } : set));
    updateSets(current, () => nextSets);
    haptic(14);
    prime();

    const doneText = exercise.mode === "done" ? "done" : describeSet(values, exercise.mode, unit);
    const nextOpenSet = firstOpen(nextSets);
    const nextEntries: WorkoutEntries = {
      ...entries,
      items: entries.items.map((item, i) => (i === current ? { ...item, sets: nextSets } : item)),
    };
    const nextExercise = nextOpenSet === -1 ? firstOpenExercise(nextEntries, current + 1) : current;
    const finished = nextOpenSet === -1 && nextExercise === -1;

    if (exercise.restSeconds && !finished) {
      const label =
        nextOpenSet !== -1
          ? `Next: set ${nextOpenSet + 1} of ${exercise.name}`
          : `Next: ${plans[nextExercise]?.name ?? "the next exercise"}`;
      setRest({ endsAt: secondsFromNow(exercise.restSeconds), total: exercise.restSeconds, label });
      setRestOverAt(null);
    }

    if (nextOpenSet !== -1) {
      setFocused(nextOpenSet);
      setAnnouncement(`Set ${index + 1} logged: ${doneText}.`);
    } else if (finished) {
      setFocused(-1);
      setAnnouncement(`Set ${index + 1} logged. Every set is done. Finish when you're ready.`);
    } else {
      setFocused(-1);
      setAnnouncement(`${exercise.name} complete. Next: ${plans[nextExercise]?.name}.`);
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => {
        setDirection(1);
        setCurrent(nextExercise);
        setFocused(firstOpen(nextEntries.items[nextExercise]?.sets ?? []));
      }, 650);
    }
  }

  function changeSet(index: number, values: Partial<SetValues>) {
    updateSets(current, (sets) => sets.map((set, i) => (i === index ? { ...set, ...values } : set)));
  }

  function undoSet(index: number) {
    updateSets(current, (sets) => sets.map((set, i) => (i === index ? { ...set, done: false } : set)));
    setAnnouncement(`Set ${index + 1} is open again.`);
  }

  function addSet() {
    if (!entry || entry.sets.length >= 30) return;
    updateSets(current, (sets) => [...sets, emptySet()]);
    setFocused(entry.sets.length);
  }

  function removeSet(index: number) {
    if (!entry || entry.sets.length <= 1) return;
    updateSets(current, (sets) => sets.filter((_, i) => i !== index));
    setFocused(firstOpen(entry.sets.filter((_, i) => i !== index)));
  }

  /** Adds an exercise to a free-form workout and goes to it. */
  function addExercise(input: { name: string; mode: SetMode; restSeconds: number | null }) {
    const { plan, entry: added } = newFreeFormExercise(input, crypto.randomUUID());
    const index = plans.length;
    setPlans((state) => [...state, plan]);
    setEntries((state) => ({ ...state, items: [...state.items, added] }));
    window.clearTimeout(advanceTimer.current);
    setDirection(1);
    setCurrent(index);
    setFocused(0);
    setAddOpen(false);
    setAnnouncement(`${plan.name} added.`);
  }

  function changeUnit(next: WeightUnit) {
    setUnit(next);
    writePreference("weight-unit", next);
  }

  // -------------------------------------------------------------------------
  // Start, finish, discard
  // -------------------------------------------------------------------------

  async function start() {
    setBusy("start");
    setProblem(null);
    prime();
    const result = await startWorkoutAction(session.id, { unit, entries, notes: "" }).catch(() => null);
    setBusy(null);
    if (!result?.ok) {
      setProblem(
        result?.reason === "not_found"
          ? "This session no longer exists."
          : "Couldn’t start the workout. Check your connection and try again.",
      );
      return;
    }
    const aligned = align(result.value.entries);
    setPlans(aligned.exercises);
    setEntries(aligned.entries);
    setUnit(result.value.unit);
    setStartedAt(result.value.startedAt);
    const index = Math.max(0, firstOpenExercise(aligned.entries));
    setCurrent(index);
    setFocused(firstOpen(aligned.entries.items[index]?.sets ?? []));
    haptic(20);
    setPhase("active");
  }

  async function finish() {
    setBusy("finish");
    setProblem(null);
    const at = finishedAt ?? new Date().toISOString();
    if (session.quick && !name.trim()) {
      setBusy(null);
      setProblem("Give your workout a name.");
      return;
    }
    const result = await finishWorkoutAction(session.id, { unit, entries, notes }, at, session.quick ? name.trim() : undefined).catch(
      () => null,
    );
    setBusy(null);
    if (!result?.ok) {
      setProblem("Couldn’t finish just now — no connection? Your sets are saved on this phone. Try again in a moment.");
      return;
    }
    clearLocalWorkout(session.id);
    setFinishedAt(result.value.finishedAt);
    setStartedAt(result.value.startedAt);
    setRest(null);
    setFinishOpen(false);
    haptic([20, 60, 40]);
    setPhase("summary");
    window.scrollTo({ top: 0 });
  }

  async function discard() {
    setBusy("discard");
    const result = await discardWorkoutAction(session.id).catch(() => null);
    setBusy(null);
    if (!result?.ok) {
      setProblem("Couldn’t discard the workout. Check your connection and try again.");
      return;
    }
    clearLocalWorkout(session.id);
    router.replace(session.backHref);
  }

  // -------------------------------------------------------------------------
  // Gestures
  // -------------------------------------------------------------------------

  function onTouchStart(event: TouchEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, .workout-set-editor")) {
      touchStart.current = null;
      return;
    }
    const touch = event.touches[0]!;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: TouchEvent) {
    const startPoint = touchStart.current;
    touchStart.current = null;
    if (!startPoint) return;
    const touch = event.changedTouches[0]!;
    const dx = touch.clientX - startPoint.x;
    const dy = touch.clientY - startPoint.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) goTo(current + (dx < 0 ? 1 : -1));
  }

  // -------------------------------------------------------------------------
  // Screens
  // -------------------------------------------------------------------------

  if (phase === "ready") {
    return (
      <ReadyScreen
        session={session}
        plans={plans}
        previous={previous}
        unit={unit}
        onUnit={changeUnit}
        onStart={start}
        starting={busy === "start"}
        problem={problem}
      />
    );
  }

  if (phase === "summary") {
    return (
      <WorkoutSummaryView
        session={{ ...session, name }}
        postHref={`/session/${session.id}/post`}
        plans={plans}
        entries={entries}
        unit={unit}
        notes={notes}
        startedAt={startedAt}
        finishedAt={finishedAt}
        onEdit={() => {
          const index = Math.max(0, firstOpenExercise(entries));
          setCurrent(index);
          setFocused(firstOpen(entries.items[index]?.sets ?? []));
          setPhase("active");
        }}
      />
    );
  }

  const isLast = current >= plans.length - 1;
  const exerciseComplete = entry ? firstOpen(entry.sets) === -1 : false;
  const nextName = plans[current + 1]?.name;
  const showRest = rest !== null || restOverAt !== null;

  return (
    <div className="workout-screen min-h-dvh">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <header className="sticky top-0 z-30 border-b border-line bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-1 px-2">
          <Link
            href={session.backHref}
            onClick={() => void autosave.flush()}
            aria-label="Leave the workout. Your progress is kept."
            className="ui-control grid size-11 shrink-0 place-items-center rounded-full text-stone-700 hover:bg-stone-100"
          >
            <Icon name="close" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">{session.name}</p>
            <p className="flex items-center justify-center gap-1.5 text-xs text-stone-600">
              <span className="font-mono tabular-nums" aria-label="Time elapsed">
                {elapsed === null ? "0:00" : formatClock(elapsed)}
              </span>
              <span aria-hidden="true">·</span>
              <SaveBadge state={autosave.state} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="All exercises and workout options"
            className="ui-control grid size-11 shrink-0 place-items-center rounded-full text-stone-700 hover:bg-stone-100"
          >
            <Icon name="list" />
          </button>
        </div>
        <div className="mx-auto max-w-lg">
          <ProgressSegments items={progress} current={current} onSelect={(index) => goTo(index)} />
        </div>
      </header>

      <div
        className="mx-auto max-w-lg px-4 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-5"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {exercise && entry ? (
          <section key={current} aria-labelledby="exercise-title" className="workout-exercise" data-direction={direction}>
            <p className="ui-eyebrow">
              Exercise {current + 1} of {plans.length}
            </p>
            <h1 id="exercise-title" className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">
              {exercise.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {exercise.instruction ? <Chip>{exercise.instruction.split("\n")[0]}</Chip> : null}
              {exercise.target ? <Chip>{exercise.target}</Chip> : null}
              {exercise.rest ? <Chip>Rest {exercise.rest}</Chip> : null}
            </div>
            {prev ? (
              <p className="mt-3 text-sm text-stone-600">
                Last time <span className="font-semibold tabular-nums text-stone-900">{formatPerformance(prev)}</span>
              </p>
            ) : null}
            <ExerciseNotes exercise={exercise} />

            <div className="mt-5 space-y-2">
              {entry.sets.map((set, index) =>
                index === focused ? (
                  <SetEditor
                    key={index}
                    index={index}
                    total={entry.sets.length}
                    set={set}
                    shown={suggest(exercise, entry.sets, index, prev, unit)}
                    exercise={exercise}
                    unit={unit}
                    step={weightStep(unit)}
                    canRemove={entry.sets.length > 1 && index === entry.sets.length - 1}
                    onChange={(values) => changeSet(index, values)}
                    onLog={() => logSet(index)}
                    onUndo={() => undoSet(index)}
                    onRemove={() => removeSet(index)}
                  />
                ) : (
                  <SetRow
                    key={index}
                    index={index}
                    set={set}
                    shown={suggest(exercise, entry.sets, index, prev, unit)}
                    mode={exercise.mode}
                    unit={unit}
                    onSelect={() => setFocused(index)}
                  />
                ),
              )}
            </div>

            <button
              type="button"
              onClick={addSet}
              className="ui-control mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              <Icon name="plus" className="size-4" />
              Add set
            </button>

            {exerciseComplete ? (
              <p className="workout-complete-note mt-4 rounded-2xl px-4 py-3 text-sm font-medium">
                {allDone ? "Every set is done. Great work — finish when you’re ready." : "Exercise complete."}
              </p>
            ) : null}
          </section>
        ) : session.freeForm ? (
          <div className="mt-8 text-center">
            <p className="ui-eyebrow">{session.categoryLabel} · {session.dateLabel}</p>
            <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight">Your workout is running</h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">Add your first exercise, then log each set as you go.</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              data-testid="add-first-exercise"
              className="workout-log-button ui-control mt-6 inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-base font-semibold"
            >
              <Icon name="plus" className="size-4" />
              Add exercise
            </button>
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-stone-600">This session has no exercises.</p>
        )}
        {session.freeForm && exercise ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="ui-control mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            <Icon name="plus" className="size-4" />
            Add exercise
          </button>
        ) : null}
      </div>

      {/* Thumb zone: the rest timer floats above the step controls. */}
      <div className="fixed inset-x-0 bottom-0 z-30">
        {showRest ? (
          <div className="pointer-events-none px-3 pb-2">
            <RestTimer
              remaining={remaining ?? rest?.total ?? 0}
              total={rest?.total ?? 1}
              over={rest === null}
              nextLabel={rest?.label ?? null}
              onAdjust={(seconds) =>
                setRest((state) =>
                  state ? { ...state, endsAt: Math.max(secondsFromNow(1), state.endsAt + seconds * 1000), total: Math.max(1, state.total + seconds) } : state,
                )
              }
              onSkip={() => {
                setRest(null);
                setRestOverAt(null);
              }}
            />
          </div>
        ) : null}
        <nav
          aria-label="Workout steps"
          className="border-t border-line bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-lg gap-2">
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              aria-label="Previous exercise"
              className="ui-control grid size-14 shrink-0 place-items-center rounded-2xl border border-stone-300 text-stone-800 hover:bg-stone-100"
            >
              <Icon name="prev" />
            </button>
            {isLast || allDone ? (
              <button
                type="button"
                onClick={() => setFinishOpen(true)}
                className={`ui-control inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-semibold ${
                  allDone ? "workout-log-button" : "border border-stone-300 text-stone-900 hover:bg-stone-100"
                }`}
              >
                <Icon name="flag" />
                Finish workout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                className={`ui-control inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold ${
                  exerciseComplete ? "workout-log-button" : "border border-stone-300 text-stone-900 hover:bg-stone-100"
                }`}
              >
                <span className="truncate">
                  Next<span className="font-normal opacity-80">{nextName ? ` · ${nextName}` : ""}</span>
                </span>
                <Icon name="next" className="size-5 shrink-0" />
              </button>
            )}
          </div>
        </nav>
      </div>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Workout" className="max-w-md">
        <ol className="-mx-2 space-y-1">
          {progress.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  goTo(index);
                  setMenuOpen(false);
                }}
                aria-current={index === current ? "step" : undefined}
                className={`ui-control flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left ${index === current ? "bg-stone-100" : "hover:bg-stone-100"}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    item.total > 0 && item.done === item.total ? "workout-done-dot text-white" : "border border-stone-300 text-stone-600"
                  }`}
                >
                  {item.total > 0 && item.done === item.total ? <Icon name="check" className="size-3.5" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                <span className="text-xs tabular-nums text-stone-600">
                  {item.done}/{item.total}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {session.freeForm ? (
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setAddOpen(true);
            }}
            className="ui-control mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            <Icon name="plus" className="size-4" />
            Add exercise
          </button>
        ) : null}
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-stone-700">Weights in</span>
            <Segmented label="Weight unit" value={unit} options={UNIT_OPTIONS} onChange={changeUnit} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-stone-700">Sound when rest ends</span>
            <Segmented
              label="Rest sound"
              value={sound}
              options={[
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
              ]}
              onChange={(value) => {
                setSound(value);
                writePreference("workout-sound", value);
              }}
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setFinishOpen(true);
            }}
            className="ui-control inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Finish workout
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setDiscardOpen(true);
            }}
            className="ui-control inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-red-800 hover:bg-red-50"
          >
            Discard workout
          </button>
        </div>
      </Modal>

      <Modal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        dismissible={busy !== "finish"}
        title="Finish workout?"
        description={
          allDone
            ? `All ${summary.setsTotal} sets done${elapsed !== null ? ` in ${formatClock(elapsed)}` : ""}.`
            : `You’ve logged ${summary.setsDone} of ${summary.setsTotal} sets. Sets you didn’t log are left out.`
        }
        className="max-w-md"
      >
        {session.quick ? (
          <div className="mb-4">
            <label htmlFor="workout-name" className="text-sm font-medium text-stone-800">
              Name this workout
            </label>
            <input
              id="workout-name"
              value={name}
              maxLength={200}
              required
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              className="ui-control mt-1.5 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            />
          </div>
        ) : null}
        <label htmlFor="workout-notes" className="text-sm font-medium text-stone-800">
          How did it feel? <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <textarea
          id="workout-notes"
          value={notes}
          maxLength={2000}
          rows={3}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Energy, a niggle, what to change next time…"
          className="ui-control mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 placeholder:text-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        />
        {problem ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
            {problem}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setFinishOpen(false)}
            disabled={busy === "finish"}
            className="ui-control inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Keep going
          </button>
          <button
            type="button"
            onClick={() => void finish()}
            disabled={busy === "finish" || (session.freeForm && summary.setsDone === 0)}
            className="workout-log-button ui-control inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
          >
            <Icon name="flag" className="size-4" />
            {busy === "finish" ? "Finishing…" : "Finish workout"}
          </button>
        </div>
      </Modal>

      <AddExerciseDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultMode={defaultSetMode(session.category)}
        onAdd={addExercise}
      />

      <Modal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        dismissible={busy !== "discard"}
        title="Discard this workout?"
        description={
          session.quick
            ? "This quick workout and every set in it are deleted."
            : "Every set you logged in this workout is deleted. The planned session stays on your calendar."
        }
        className="max-w-md"
      >
        {problem ? (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setDiscardOpen(false)}
            disabled={busy === "discard"}
            className="ui-control inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Keep workout
          </button>
          <button
            type="button"
            onClick={() => void discard()}
            disabled={busy === "discard"}
            className="ui-control inline-flex min-h-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            {busy === "discard" ? "Discarding…" : "Discard workout"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "offline") return <span className="font-medium text-amber-700">Saved on this phone</span>;
  if (state === "saving") return <span>Saving…</span>;
  return <span>Saved</span>;
}

function ExerciseNotes({ exercise }: { exercise: PlannedExercise }) {
  const extra = exercise.instruction.split("\n").slice(1).join("\n").trim();
  const video = exercise.videoUrl ? parseYouTubeUrl(exercise.videoUrl) : null;
  if (!extra && !exercise.notes && !video) return null;
  return (
    <div className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
      {extra ? <p className="whitespace-pre-line">{extra}</p> : null}
      {exercise.notes ? <p className="whitespace-pre-line">{exercise.notes}</p> : null}
      {video ? (
        <a
          href={video}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-sm font-medium text-accent underline underline-offset-4"
        >
          <Icon name="play" className="size-3.5" />
          Watch demo
          <span className="sr-only"> of {exercise.name} on YouTube (opens in a new tab)</span>
        </a>
      ) : null}
    </div>
  );
}

function ReadyScreen({
  session,
  plans,
  previous,
  unit,
  onUnit,
  onStart,
  starting,
  problem,
}: {
  session: WorkoutSessionInfo;
  plans: PlannedExercise[];
  previous: Record<string, PreviousPerformance>;
  unit: WeightUnit;
  onUnit: (unit: WeightUnit) => void;
  onStart: () => void;
  starting: boolean;
  problem: string | null;
}) {
  const totalSets = plans.reduce((sum, plan) => sum + plan.sets, 0);
  const lifts = plans.some((plan) => plan.mode === "load");
  return (
    <div className="workout-screen min-h-dvh">
      <div className="mx-auto max-w-lg px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <Link href={session.backHref} className="inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm text-stone-600 hover:text-foreground">
          <Icon name="prev" className="size-4" />
          Session details
        </Link>
        <p className="ui-eyebrow mt-6">
          {session.categoryLabel} · {session.dateLabel}
        </p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{session.name}</h1>
        <p className="mt-2 text-sm text-stone-600">
          {plans.length} {plans.length === 1 ? "exercise" : "exercises"} · {totalSets} {totalSets === 1 ? "set" : "sets"}
        </p>

        {plans.length > 0 ? (
          <ol className="ui-panel mt-6 divide-y divide-line overflow-hidden">
            {plans.map((plan, index) => {
              const prev = previous[plan.itemId];
              return (
                <li key={plan.itemId} className="flex gap-3 px-4 py-3.5">
                  <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-stone-300 text-xs font-semibold text-stone-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-6 [overflow-wrap:anywhere]">{plan.name}</p>
                    <p className="text-sm text-stone-600">
                      {[plan.instruction.split("\n")[0], plan.rest ? `rest ${plan.rest}` : ""].filter(Boolean).join(" · ") || "As planned"}
                    </p>
                    {prev ? (
                      <p className="mt-0.5 text-xs text-stone-500">
                        Last time <span className="tabular-nums text-stone-700">{formatPerformance(prev)}</span>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="ui-panel mt-6 p-5 text-sm text-stone-700">
            No exercises planned. Start, then add each exercise as you go.
          </p>
        )}

        {lifts ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-sm text-stone-700">Weights in</span>
            <Segmented label="Weight unit" value={unit} options={UNIT_OPTIONS} onChange={onUnit} />
          </div>
        ) : null}

        <ul className="mt-6 space-y-2 text-sm text-stone-600">
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-accent">•</span>
            <span>
              Tap <span className="font-medium text-stone-800">Log set</span> after each set. The rest timer starts on its own.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="text-accent">•</span>
            <span>Your screen stays on, and every set is saved as you go — even without signal.</span>
          </li>
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-lg">
          {problem ? (
            <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
              {problem}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onStart}
            disabled={starting || (plans.length === 0 && !session.freeForm)}
            className="workout-log-button workout-start ui-control inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold"
          >
            <Icon name="play" className="size-4" />
            {starting ? "Starting…" : "Start workout"}
          </button>
        </div>
      </div>
    </div>
  );
}

const MODE_OPTIONS: ReadonlyArray<{ value: SetMode; label: string }> = [
  { value: "load", label: "Weight" },
  { value: "reps", label: "Reps" },
  { value: "done", label: "Tick" },
];

const MODE_HELP: Record<SetMode, string> = {
  load: "Log weight and reps for each set.",
  reps: "Log reps for each set (bodyweight).",
  done: "Tick each set or rep off (runs, carries, holds).",
};

const restKey = (seconds: number | null) => (seconds === null ? "off" : String(seconds));

/**
 * Adds an exercise to a free-form workout: a name, how its sets are logged,
 * and the rest between them. Opens with the name field focused; Enter adds.
 */
function AddExerciseDialog({
  open,
  onClose,
  defaultMode,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  defaultMode: SetMode;
  onAdd: (input: { name: string; mode: SetMode; restSeconds: number | null }) => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<SetMode>(defaultMode);
  const [rest, setRest] = useState<string>(restKey(defaultMode === "load" ? 90 : null));
  const [touched, setTouched] = useState(false);
  const problem = touched && !name.trim() ? "Name the exercise." : null;

  function close() {
    setName("");
    setTouched(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Add exercise" initialFocus="#new-exercise-name" className="max-w-md">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!name.trim()) return;
          onAdd({ name: name.trim().slice(0, 200), mode, restSeconds: rest === "off" ? null : Number(rest) });
          setName("");
          setTouched(false);
        }}
        className="space-y-5"
      >
        <div>
          <label htmlFor="new-exercise-name" className="text-sm font-medium text-stone-800">
            Exercise
          </label>
          <input
            id="new-exercise-name"
            value={name}
            maxLength={200}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Back squat, 400 m repeat, plank…"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "new-exercise-problem" : undefined}
            onChange={(event) => setName(event.target.value)}
            className="ui-control mt-1.5 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          />
          {problem ? (
            <p id="new-exercise-problem" role="alert" className="mt-1 text-sm text-red-800">
              {problem}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-medium text-stone-800">Log each set by</p>
          <div className="mt-1.5">
            <Segmented label="Log each set by" value={mode} options={MODE_OPTIONS} onChange={setMode} />
          </div>
          <p className="mt-1.5 text-xs text-stone-600">{MODE_HELP[mode]}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-800">Rest between sets</p>
          <div className="mt-1.5 overflow-x-auto">
            <Segmented
              compact
              label="Rest between sets"
              value={rest}
              // Clock labels ("1:30") stay on one line on a phone.
              options={REST_CHOICES.map((seconds) => ({ value: restKey(seconds), label: seconds === null ? "Off" : formatClock(seconds) }))}
              onChange={setRest}
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            className="ui-control inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 px-4 text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="workout-log-button ui-control inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
          >
            <Icon name="plus" className="size-4" />
            Add exercise
          </button>
        </div>
      </form>
    </Modal>
  );
}
