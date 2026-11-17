"use client";

import { useId, useRef, useState } from "react";
import { ActionSubmit } from "@/components/ui/ActionSubmit";
import { deleteRoutineAction } from "@/lib/actions";
import { btnDanger, btnSecondary } from "@/lib/ui";

/** Native modal provides focus containment, Escape dismissal and focus restoration. */
export function DeleteRoutineButton({ routineId }: { routineId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        className={btnDanger}
        onClick={() => {
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        Delete routine
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (submitting) event.preventDefault();
        }}
        className="ui-panel m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-5 text-foreground backdrop:bg-black/50 sm:p-6"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          Delete this routine?
        </h2>
        <p id={descriptionId} className="mt-3 text-sm leading-6 text-stone-600">
          This permanently deletes your routine. Sessions already on your
          calendar keep their own copy of the workout.
        </p>
        <form
          action={deleteRoutineAction}
          onSubmit={() => setSubmitting(true)}
          className="mt-6 flex flex-wrap justify-end gap-2"
        >
          <input type="hidden" name="id" value={routineId} />
          <button
            ref={cancel}
            type="button"
            disabled={submitting}
            className={btnSecondary}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <ActionSubmit
            label="Delete routine"
            busy="Deleting…"
            className={btnDanger}
          />
        </form>
      </dialog>
    </>
  );
}
