"use client";

import { useState } from "react";
import { ActionSubmit } from "@/components/ui/ActionSubmit";
import { Modal } from "@/components/ui/Modal";
import { deleteScheduledSessionAction } from "@/lib/actions";
import { btnDanger, btnSecondary } from "@/lib/ui";
import type { SessionDeletion } from "@/lib/workouts/deletion";

/**
 * Deletes one scheduled session after TrainGrid's own confirmation, which
 * says exactly what goes with it (its workout log, if any) and what stays
 * (posts, the routine), and points a member who only wants it on another day
 * back to the date above.
 */
export function DeleteSessionButton({
  session,
  deletion,
}: {
  session: { id: string; weekId: string; day: number; name: string };
  deletion: SessionDeletion;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <button type="button" className={btnDanger} onClick={() => setOpen(true)}>
        Delete session
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        dismissible={!submitting}
        title={`Delete ${session.name}?`}
        initialFocus="[data-cancel]"
        className="max-w-md"
      >
        <ul className="space-y-2 text-sm leading-6 text-stone-700" data-testid="delete-consequences">
          {deletion.consequences.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-stone-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg bg-stone-100 px-3 py-2 text-sm leading-6 text-stone-700">
          Only on the wrong day? Keep it and change the date in the form instead.
        </p>
        <form
          action={deleteScheduledSessionAction}
          onSubmit={() => setSubmitting(true)}
          className="mt-6 flex flex-wrap justify-end gap-2"
        >
          <input type="hidden" name="id" value={session.id} />
          <input type="hidden" name="weekId" value={session.weekId} />
          <input type="hidden" name="day" value={session.day} />
          <button type="button" data-cancel className={btnSecondary} disabled={submitting} onClick={() => setOpen(false)}>
            Keep session
          </button>
          <ActionSubmit label={deletion.confirmLabel} busy="Deleting…" className={btnDanger} />
        </form>
      </Modal>
    </>
  );
}
