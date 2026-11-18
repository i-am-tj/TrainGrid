"use client";

import { useId, useRef, useState } from "react";
import { duplicateWeekAction } from "@/lib/actions";
import { ActionSubmit } from "@/components/ui/ActionSubmit";
import { btnGhost, btnSecondary, fieldClass } from "@/lib/ui";

export function DuplicateWeekForm({
  sourceWeekId,
  sourceCount,
  defaultDestWeekId,
  options,
}: {
  sourceWeekId: string;
  sourceCount: number;
  defaultDestWeekId: string;
  options: Array<{ id: string; label: string; existing: number }>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [destination, setDestination] = useState(defaultDestWeekId);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const selected = options.find((option) => option.id === destination);
  return (
    <div className="mt-2 flex justify-end">
      <button
        type="button"
        aria-haspopup="dialog"
        className={`${btnGhost} gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2`}
        onClick={() => {
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        Week actions <span aria-hidden="true">···</span>
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
          Duplicate week
        </h2>
        <p id={descriptionId} className="mt-3 text-sm leading-6 text-stone-600">
          Copy {sourceCount} session(s) from this week. Each session gets its
          own copy of the workout.
        </p>
        <form
          action={duplicateWeekAction}
          onSubmit={() => setSubmitting(true)}
          className="mt-5 space-y-4"
        >
          <input type="hidden" name="sourceWeekId" value={sourceWeekId} />
          <label className="block text-sm">
            Duplicate week onto
            <select
              name="destWeekId"
              className={fieldClass}
              value={destination}
              onChange={(event) => {
                if (!submitting) setDestination(event.target.value);
              }}
              aria-disabled={submitting}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.existing ? ` (${option.existing} existing)` : ""}
                </option>
              ))}
            </select>
          </label>
          {selected && selected.existing > 0 ? (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
            >
              {selected.label} already has {selected.existing} session(s).
              Copies will be added alongside them.
            </p>
          ) : null}
          {sourceCount === 0 ? (
            <p className="text-sm text-stone-600">
              There are no sessions in this week to copy.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              ref={cancel}
              type="button"
              className={btnSecondary}
              disabled={submitting}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <ActionSubmit
              label="Duplicate week"
              busy="Copying week…"
              className={btnSecondary}
              disabled={sourceCount === 0}
            />
          </div>
        </form>
      </dialog>
    </div>
  );
}
