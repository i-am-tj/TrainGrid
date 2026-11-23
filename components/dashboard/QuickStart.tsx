"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/ui/Modal";
import { readPreference } from "@/components/workout/hooks";
import { SESSION_TYPES, type SessionType } from "@/lib/domain";
import { btnPrimary } from "@/lib/ui";
import { startQuickWorkoutAction } from "@/lib/workouts/actions";
import { WEIGHT_UNITS, type WeightUnit } from "@/lib/workouts/model";

const CHOICES: Record<SessionType, { label: string; detail: string }> = {
  strength: { label: "Lift", detail: "Weights and reps" },
  running: { label: "Run", detail: "Intervals, tempo, easy miles" },
  plyometrics: { label: "Plyo", detail: "Jumps, bounds, sprints" },
  other: { label: "Other", detail: "Mobility, core, anything else" },
};

/**
 * "Start a workout" on Home: pick the type, and the workout starts at once,
 * with nothing planned. Exercises are added during the workout; it is named
 * at the finish, and can then be posted. A plain form, so it works before
 * JavaScript has loaded too (the dialog then simply opens on the next tap).
 */
export function QuickStart() {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<WeightUnit>("kg");

  // The weight unit this phone last used in a workout.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnit(readPreference("weight-unit", WEIGHT_UNITS, "kg"));
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="quick-start" className={`${btnPrimary} shrink-0 gap-2`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M8 5.5v13l11-6.5-11-6.5z" />
        </svg>
        Start a workout
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start a workout now"
        description="Nothing to plan: pick the type, add exercises as you go, and name it when you finish."
        className="max-w-md"
      >
        <form action={startQuickWorkoutAction}>
          <input type="hidden" name="unit" value={unit} />
          <fieldset>
            <legend className="sr-only">Workout type</legend>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_TYPES.map((type) => (
                <TypeButton key={type} type={type} />
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>
    </>
  );
}

function TypeButton({ type }: { type: SessionType }) {
  const { pending, data } = useFormStatus();
  const chosen = pending && data?.get("category") === type;
  return (
    <button
      type="submit"
      name="category"
      value={type}
      disabled={pending}
      aria-busy={chosen}
      className="ui-control flex min-h-20 flex-col items-start justify-center rounded-xl border border-line bg-card px-4 py-3 text-left hover:border-accent hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-60"
    >
      <span className="text-base font-semibold">{chosen ? "Starting…" : CHOICES[type].label}</span>
      <span className="mt-0.5 text-xs text-stone-600">{CHOICES[type].detail}</span>
    </button>
  );
}
