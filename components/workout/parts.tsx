"use client";

import { useId, useState, type ReactNode } from "react";
import {
  formatClock,
  formatWeight,
  MAX_REPS,
  MAX_WEIGHT,
  type LoggedSet,
  type PlannedExercise,
  type WeightUnit,
} from "@/lib/workouts/model";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

export function Icon({ name, className = "size-5" }: { name: "close" | "list" | "prev" | "next" | "check" | "play" | "plus" | "minus" | "undo" | "flag"; className?: string }) {
  const paths: Record<typeof name, ReactNode> = {
    close: <path d="M6 6l12 12M18 6L6 18" />,
    list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    prev: <path d="M15 5l-7 7 7 7" />,
    next: <path d="M9 5l7 7-7 7" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    play: <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />,
    flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Number steppers
// ---------------------------------------------------------------------------

function parseNumber(text: string, decimals: boolean, max: number): number | null | undefined {
  const cleaned = text.trim().replace(",", ".");
  if (cleaned === "") return null;
  if (!(decimals ? /^\d{0,4}(\.\d{0,2})?$/ : /^\d{0,4}$/).test(cleaned)) return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value > max) return undefined;
  return value;
}

/**
 * A large number field with − and + either side: thumb-sized for a phone in
 * a sweaty hand, with the numeric keypad when the number itself is tapped.
 */
export function Stepper({
  label,
  value,
  step,
  decimals,
  onChange,
  suffix,
}: {
  label: string;
  value: number | null;
  step: number;
  decimals: boolean;
  onChange: (value: number | null) => void;
  suffix?: string;
}) {
  const id = useId();
  const max = decimals ? MAX_WEIGHT : MAX_REPS;
  const shownValue = value === null ? "" : decimals ? formatWeight(value) : String(value);
  const [draft, setDraft] = useState<string | null>(null);

  const nudge = (direction: 1 | -1) => {
    const base = value ?? 0;
    const next = Math.min(max, Math.max(0, Math.round((base + direction * step) * 100) / 100));
    setDraft(null);
    onChange(next);
  };

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-stone-600">
        {label}
        {suffix ? <span className="ml-1 normal-case tracking-normal text-stone-500">({suffix})</span> : null}
      </label>
      <div className="workout-stepper mt-1.5 flex h-14 items-stretch overflow-hidden rounded-2xl border border-stone-300 bg-white">
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label={`Less ${label.toLowerCase()}`}
          className="ui-control grid w-11 shrink-0 place-items-center text-stone-700 active:bg-stone-100 sm:w-12"
        >
          <Icon name="minus" />
        </button>
        <input
          id={id}
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          autoComplete="off"
          enterKeyHint="done"
          value={draft ?? shownValue}
          placeholder="–"
          onFocus={(event) => {
            setDraft(shownValue);
            event.currentTarget.select();
          }}
          onBlur={() => setDraft(null)}
          onChange={(event) => {
            const parsed = parseNumber(event.target.value, decimals, max);
            if (parsed === undefined) return;
            setDraft(event.target.value);
            onChange(parsed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-w-0 flex-1 bg-transparent text-center text-2xl font-semibold tabular-nums text-stone-900 outline-none placeholder:text-stone-400 focus-visible:bg-stone-50"
        />
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label={`More ${label.toLowerCase()}`}
          className="ui-control grid w-11 shrink-0 place-items-center text-stone-700 active:bg-stone-100 sm:w-12"
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export type SetValues = { weight: number | null; reps: number | null };

export function describeSet(set: SetValues, mode: PlannedExercise["mode"], unit: WeightUnit): string {
  if (mode === "load") {
    const weight = set.weight === null ? "–" : `${formatWeight(set.weight)} ${unit}`;
    return `${weight} × ${set.reps ?? "–"}`;
  }
  if (mode === "reps") return set.reps === null ? "–" : `${set.reps} reps`;
  return "Done";
}

/** One set that is not being edited: a compact, tappable row. */
export function SetRow({
  index,
  set,
  shown,
  mode,
  unit,
  onSelect,
}: {
  index: number;
  set: LoggedSet;
  shown: SetValues;
  mode: PlannedExercise["mode"];
  unit: WeightUnit;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Set ${index + 1}, ${set.done ? `logged: ${describeSet(set, mode, unit)}` : "not done yet"}. Edit`}
      className={`ui-control flex min-h-13 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ${
        set.done ? "bg-emerald-50 text-emerald-900" : "text-stone-600 hover:bg-stone-100"
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
          set.done ? "workout-done-dot text-white" : "border border-stone-300 text-stone-600"
        }`}
      >
        {set.done ? <Icon name="check" className="size-4" /> : index + 1}
      </span>
      <span className={`text-base tabular-nums ${set.done ? "font-semibold" : ""}`}>
        {set.done ? describeSet(set, mode, unit) : mode === "done" ? `Set ${index + 1}` : describeSet(shown, mode, unit)}
      </span>
      <span className="ml-auto text-xs text-stone-500">{set.done ? "Edit" : ""}</span>
    </button>
  );
}

/** The set being worked on: steppers and one big button. */
export function SetEditor({
  index,
  total,
  set,
  shown,
  exercise,
  unit,
  step,
  canRemove,
  onChange,
  onLog,
  onUndo,
  onRemove,
}: {
  index: number;
  total: number;
  set: LoggedSet;
  shown: SetValues;
  exercise: PlannedExercise;
  unit: WeightUnit;
  step: number;
  canRemove: boolean;
  onChange: (values: Partial<SetValues>) => void;
  onLog: () => void;
  onUndo: () => void;
  onRemove: () => void;
}) {
  const { mode } = exercise;
  return (
    <div className="workout-set-editor rounded-3xl border border-stone-300 bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-semibold text-stone-900">
          Set {index + 1} <span className="font-normal text-stone-500">of {total}</span>
        </p>
        {exercise.repsLabel ? (
          <p className="truncate text-stone-600">
            Target <span className="font-medium tabular-nums text-stone-800">{exercise.repsLabel}</span>
          </p>
        ) : null}
      </div>

      {mode !== "done" ? (
        <div className={`mt-3 grid gap-3 ${mode === "load" ? "grid-cols-2" : "grid-cols-1"}`}>
          {mode === "load" ? (
            <Stepper
              label="Weight"
              suffix={unit}
              value={shown.weight}
              step={step}
              decimals
              onChange={(weight) => onChange({ weight })}
            />
          ) : null}
          <Stepper label="Reps" value={shown.reps} step={1} decimals={false} onChange={(reps) => onChange({ reps })} />
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        {set.done ? (
          <button
            type="button"
            onClick={onUndo}
            className="ui-control inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-stone-300 px-4 text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            <Icon name="undo" className="size-4" />
            Undo
          </button>
        ) : canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="ui-control inline-flex h-14 items-center justify-center rounded-2xl px-3 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Remove
          </button>
        ) : null}
        <button
          type="button"
          onClick={onLog}
          className="workout-log-button ui-control inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-semibold"
        >
          <Icon name="check" />
          {set.done ? "Update set" : mode === "done" ? (total === 1 ? "Mark done" : "Set done") : "Log set"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rest timer
// ---------------------------------------------------------------------------

export function RestTimer({
  remaining,
  total,
  over,
  nextLabel,
  onAdjust,
  onSkip,
}: {
  remaining: number;
  total: number;
  over: boolean;
  nextLabel: string | null;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
}) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <section
      aria-label="Rest timer"
      className={`workout-rest ui-panel pointer-events-auto mx-auto flex w-full max-w-lg items-center gap-3 p-3 shadow-xl ${over ? "workout-rest-over" : ""}`}
    >
      <div className="relative grid size-16 shrink-0 place-items-center">
        <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--line)" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className="workout-rest-ring"
          />
        </svg>
        <span className="font-mono text-sm font-semibold tabular-nums">{over ? "Go" : formatClock(remaining)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-stone-900">{over ? "Rest over" : "Rest"}</p>
        <p className="truncate text-xs text-stone-600">{nextLabel ?? "Catch your breath."}</p>
      </div>
      {over ? (
        <button type="button" onClick={onSkip} className="ui-control h-11 rounded-xl px-4 text-sm font-semibold text-stone-800 hover:bg-stone-100">
          Close
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onAdjust(-15)} aria-label="15 seconds less rest" className="ui-control h-11 min-w-11 rounded-xl px-2 text-sm font-medium tabular-nums text-stone-700 hover:bg-stone-100">
            −15
          </button>
          <button type="button" onClick={() => onAdjust(15)} aria-label="15 seconds more rest" className="ui-control h-11 min-w-11 rounded-xl px-2 text-sm font-medium tabular-nums text-stone-700 hover:bg-stone-100">
            +15
          </button>
          <button type="button" onClick={onSkip} className="ui-control h-11 rounded-xl bg-stone-900 px-3 text-sm font-semibold text-white hover:bg-stone-800">
            Skip
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function ProgressSegments({
  items,
  current,
  onSelect,
}: {
  items: Array<{ name: string; done: number; total: number }>;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex gap-1 px-3 pb-2" aria-label="Exercises">
      {items.map((item, index) => {
        const fraction = item.total > 0 ? item.done / item.total : 0;
        return (
          <li key={index} className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelect(index)}
            aria-label={`${item.name}: ${item.done} of ${item.total} sets${index === current ? ", current" : ""}`}
            aria-current={index === current ? "step" : undefined}
            className="group relative block h-6 w-full"
          >
            <span
              className={`absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full ${
                index === current ? "bg-stone-300" : "bg-stone-200"
              }`}
            >
              <span className="workout-progress-fill block h-full rounded-full" style={{ width: `${fraction * 100}%` }} />
            </span>
          </button>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-grid auto-cols-fr grid-flow-col rounded-full border border-line bg-background p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`ui-control min-h-9 rounded-full px-4 text-sm font-medium ${
            value === option.value ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-line bg-card px-2.5 text-xs font-medium tabular-nums text-stone-700">
      {children}
    </span>
  );
}
