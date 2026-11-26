"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/ui/Modal";
import { quickStartRequestId, readPreference } from "@/components/workout/hooks";
import { SESSION_TYPES, type SessionType } from "@/lib/domain";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { startQuickWorkoutAction } from "@/lib/workouts/actions";
import { WEIGHT_UNITS, type WeightUnit } from "@/lib/workouts/model";

const CHOICES: Record<SessionType, { label: string; detail: string }> = {
  strength: { label: "Lift", detail: "Weights and reps" },
  running: { label: "Run", detail: "Intervals, tempo, easy miles" },
  plyometrics: { label: "Plyo", detail: "Jumps, bounds, sprints" },
  other: { label: "Other", detail: "Mobility, core, anything else" },
};

/**
 * "Start an unplanned workout" on Home: pick the type, and the workout starts at once,
 * with nothing planned. Exercises are added during the workout; it is named
 * at the finish, and can then be posted. A plain form, so it works before
 * JavaScript has loaded too (the dialog then simply opens on the next tap).
 *
 * The form carries a request id, kept for this tab until the workout opens.
 * It becomes the new session's id, so a form sent twice (a double tap, a
 * retry after a dropped response) opens the same workout instead of starting
 * a second one.
 */
export function QuickStart({
  leadsElsewhere,
}: {
  /**
   * Resolves to true when Home already leads with a planned session or the
   * first routine: the button then steps back to secondary, so the two start
   * actions don't compete (UI_DESIGN_AUDIT rank 6). Read without suspending,
   * so the button renders at once and keeps its state.
   */
  leadsElsewhere?: Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [prominence, setProminence] = useState<"primary" | "secondary">(leadsElsewhere ? "secondary" : "primary");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [requestId, setRequestId] = useState("");

  // The weight unit this phone last used in a workout, and the request id
  // (read here, not while rendering, so server and browser agree).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnit(readPreference("weight-unit", WEIGHT_UNITS, "kg"));
    setRequestId(quickStartRequestId());
  }, []);

  useEffect(() => {
    let current = true;
    leadsElsewhere?.then(
      (leads) => current && setProminence(leads ? "secondary" : "primary"),
      () => current && setProminence("primary"),
    );
    return () => {
      current = false;
    };
  }, [leadsElsewhere]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="quick-start" data-prominence={prominence} className={`${prominence === "primary" ? btnPrimary : btnSecondary} shrink-0 gap-2`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M8 5.5v13l11-6.5-11-6.5z" />
        </svg>
        Start an unplanned workout
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Start an unplanned workout"
        description="Nothing to plan: pick the type, add exercises as you go, and name it when you finish."
        className="max-w-md"
      >
        <form action={startQuickWorkoutAction}>
          <input type="hidden" name="unit" value={unit} />
          <input type="hidden" name="request" value={requestId} />
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
