"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { IDLE, type FormState } from "@/lib/social/form-state";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Action = (previous: FormState, form: FormData) => Promise<FormState>;

/**
 * A one-click social action (Follow, Approve, Decline) as a small form, so it
 * works before JavaScript loads. Shows "busy" while it runs and an error from
 * the server, if any, right under the button.
 */
export function ActionButton({
  action,
  userId,
  label,
  busy,
  className = btnPrimary,
  ariaLabel,
  testId,
}: {
  action: Action;
  userId: string;
  label: string;
  busy: string;
  className?: string;
  ariaLabel?: string;
  testId?: string;
}) {
  const [state, run, pending] = useActionState(action, IDLE);
  return (
    <form action={run} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className={className}
        disabled={pending}
        aria-busy={pending}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {pending ? busy : label}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="max-w-60 text-right text-xs text-red-800">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

/**
 * An action that takes something away (unfollow, cancel a request, remove a
 * follower): the button opens TrainGrid's dialog, which says what happens and
 * asks once more.
 */
export function ConfirmActionButton({
  action,
  userId,
  label,
  title,
  description,
  confirm,
  busy,
  className = btnSecondary,
  confirmClassName = btnPrimary,
  ariaLabel,
  testId,
}: {
  action: Action;
  userId: string;
  label: ReactNode;
  title: string;
  description: ReactNode;
  confirm: string;
  busy: string;
  className?: string;
  confirmClassName?: string;
  ariaLabel?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(async (previous: FormState, form: FormData) => {
    const next = await action(previous, form);
    if (next.status !== "error") setOpen(false);
    return next;
  }, IDLE);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={ariaLabel} data-testid={testId}>
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        dismissible={!pending}
        initialFocus="[data-cancel]"
        className="max-w-md"
      >
        <form action={run} className="flex flex-wrap justify-end gap-2">
          <input type="hidden" name="userId" value={userId} />
          {state.status === "error" ? (
            <p role="alert" className="w-full text-sm text-red-800">
              {state.message}
            </p>
          ) : null}
          <button type="button" data-cancel className={btnSecondary} disabled={pending} onClick={() => setOpen(false)}>
            Keep
          </button>
          <button type="submit" className={confirmClassName} disabled={pending} aria-busy={pending}>
            {pending ? busy : confirm}
          </button>
        </form>
      </Modal>
    </>
  );
}
