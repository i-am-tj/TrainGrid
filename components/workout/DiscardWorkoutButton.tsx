"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { btnDanger, btnSecondary, textLink } from "@/lib/ui";
import { discardWorkoutAction } from "@/lib/workouts/actions";
import { clearLocalWorkout } from "./hooks";

/**
 * Discards a started workout from outside the workout screen (Home, the
 * session page), after asking in TrainGrid's own dialog. A planned session
 * stays on the calendar with its workout cleared; a quick workout existed only
 * for this, so it goes entirely and the member lands on Home.
 */
export function DiscardWorkoutButton({
  sessionId,
  name,
  quick,
  variant = "button",
}: {
  sessionId: string;
  name: string;
  quick: boolean;
  /** "link" for a quiet text action beside other links (Home's card). */
  variant?: "button" | "link";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function discard() {
    setBusy(true);
    setProblem(null);
    const result = await discardWorkoutAction(sessionId).catch(() => null);
    setBusy(false);
    if (!result?.ok) {
      setProblem("Couldn’t discard the workout. Check your connection and try again.");
      return;
    }
    // Sets this phone kept for the workout go too.
    clearLocalWorkout(sessionId);
    setOpen(false);
    if (quick) router.replace("/home");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Discard workout: ${name}`}
        data-testid="discard-workout"
        className={
          variant === "link"
            ? `${textLink} inline-flex min-h-10 items-center text-sm text-red-800 decoration-red-800/40 hover:text-red-900`
            : `${btnSecondary} min-h-12 rounded-xl px-4 text-red-800 hover:bg-red-50`
        }
      >
        Discard workout
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!busy}
        title="Discard this workout?"
        description={
          quick
            ? "This quick workout and every set in it are deleted."
            : "Every set you logged in this workout is deleted. The planned session stays on your calendar, ready to start again."
        }
        initialFocus="[data-cancel]"
        className="max-w-md"
      >
        {problem ? (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" data-cancel className={btnSecondary} disabled={busy} onClick={() => setOpen(false)}>
            Keep workout
          </button>
          <button type="button" className={btnDanger} disabled={busy} aria-busy={busy} onClick={() => void discard()}>
            {busy ? "Discarding…" : "Discard workout"}
          </button>
        </div>
      </Modal>
    </>
  );
}
