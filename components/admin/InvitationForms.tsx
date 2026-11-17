"use client";

import { useActionState, useEffect, useId, useMemo, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  inviteAction,
  revokeAction,
  sendInvitationEmailAction,
  type EmailActionState,
  type InvitationFormState,
} from "@/lib/admin/actions";
import type { EmailFeedback } from "@/lib/admin/invitation-model";
import { btnDanger, btnDangerCompact, btnPrimary, btnSecondary, btnSecondaryCompact, fieldClass } from "@/lib/ui";
import { useRowFeedback, type RowFeedbackMessage } from "@/components/admin/RowFeedback";

const FEEDBACK_STYLE: Record<EmailFeedback["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

/** The email outcome, kept apart from the invitation's own message. */
function EmailMessage({ feedback, id }: { feedback: EmailFeedback | null | undefined; id?: string }) {
  if (!feedback) return null;
  return (
    <p
      id={id}
      role={feedback.tone === "error" ? "alert" : "status"}
      data-email-feedback={feedback.tone}
      className={`mt-2 rounded-lg border px-3 py-2 text-sm leading-6 ${FEEDBACK_STYLE[feedback.tone]}`}
    >
      {feedback.message}
    </p>
  );
}

/**
 * Sends a row action's outcome to the row's full-width feedback line. Returns
 * true when a row took it, so the form renders nothing inline.
 */
function useReportToRow(feedback: RowFeedbackMessage | null): boolean {
  const report = useRowFeedback();
  useEffect(() => {
    if (report && feedback) report(feedback);
    // Each action result is a new object, so a repeated message is re-announced.
  }, [report, feedback]);
  return report !== null;
}

function Message({ state, id }: { state: InvitationFormState; id?: string }) {
  if (!state?.message) return null;
  return (
    <p
      id={id}
      role={state.ok ? "status" : "alert"}
      className={`mt-3 rounded-lg border px-3 py-2 text-sm leading-6 ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
    >
      {state.message}
    </p>
  );
}

function Submit({
  label,
  busy,
  className,
}: {
  label: string;
  busy: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:opacity-60`}
    >
      {pending ? busy : label}
    </button>
  );
}

export function InviteForm({ emailReady = false }: { emailReady?: boolean }) {
  const [state, action] = useActionState(inviteAction, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action}>
      <label
        htmlFor="invite-email"
        className="text-sm font-medium text-stone-800"
      >
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="off"
          placeholder="friend@example.com"
          aria-invalid={state?.ok === false}
          aria-describedby={state?.message ? "invite-feedback" : undefined}
          className={`${fieldClass} sm:flex-1`}
        />
        <Submit label="Invite" busy="Inviting…" className={btnPrimary} />
      </div>
      {emailReady ? (
        <label className="mt-3 flex min-h-10 items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="send_email"
            defaultChecked
            className="size-4 accent-stone-900"
          />
          Email the invitation to this address
        </label>
      ) : null}
      <Message state={state} id="invite-feedback" />
      <EmailMessage feedback={state?.email} id="invite-email-feedback" />
    </form>
  );
}

export function RevokeForm({
  id,
  email,
  kind,
}: {
  id: string;
  email: string;
  kind: "invitation" | "access";
}) {
  const [state, action, pending] = useActionState(revokeAction, null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (state) dialog.current?.close();
  }, [state]);
  const inRow = useReportToRow(
    useMemo(
      () => (state?.message ? { tone: state.ok ? "success" : "error", message: state.message } as const : null),
      [state],
    ),
  );
  const label = kind === "access" ? "Revoke access" : "Revoke";
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={btnDangerCompact}
        onClick={() => {
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="ui-panel m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-5 text-foreground backdrop:bg-black/50 sm:p-6"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          {kind === "access" ? "Revoke access?" : "Revoke invitation?"}
        </h2>
        <div id={descriptionId} className="mt-3 space-y-3 text-sm leading-6 text-stone-600">
          <p className="font-medium text-foreground [overflow-wrap:anywhere]">{email}</p>
          <p>
            {kind === "access"
              ? "They lose access to TrainGrid straight away. Their routines and sessions are kept, and inviting this email again restores them."
              : "This invitation will no longer grant access to TrainGrid."}
          </p>
        </div>
        <form action={action} className="mt-6 flex flex-wrap justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          <button
            ref={cancel}
            type="button"
            disabled={pending}
            className={btnSecondary}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <Submit label={label} busy="Revoking…" className={btnDanger} />
        </form>
      </dialog>
      {inRow ? null : <Message state={state} />}
    </>
  );
}

/**
 * Sends or re-sends the email for one invitation. The server decides whether
 * that is allowed (admin, live and not yet accepted, nothing in flight); the
 * pending state only stops a double click.
 */
export function SendEmailForm({
  id,
  email,
  resend,
}: {
  id: string;
  email: string;
  resend: boolean;
}) {
  const [state, action] = useActionState<EmailActionState, FormData>(
    sendInvitationEmailAction,
    null,
  );
  const inRow = useReportToRow(useMemo(() => (state ? { ...state, email: true } : null), [state]));
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitWithLabel
        label={resend ? "Resend email" : "Send email"}
        busy="Sending…"
        accessibleLabel={`${resend ? "Resend" : "Send"} invitation email to ${email}`}
        className={btnSecondaryCompact}
      />
      {inRow ? null : <EmailMessage feedback={state} />}
    </form>
  );
}

function SubmitWithLabel({
  label,
  busy,
  accessibleLabel,
  className,
}: {
  label: string;
  busy: string;
  accessibleLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? busy : accessibleLabel}
      className={`${className} disabled:opacity-60`}
    >
      {pending ? busy : label}
    </button>
  );
}
