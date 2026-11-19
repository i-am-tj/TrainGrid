"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/ui/Modal";
import { requestInviteAction } from "@/lib/invite-requests/actions";
import { INVITE_NOTE_MAX, type InviteRequestState } from "@/lib/invite-requests/model";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

/** The query that opens the request dialog on arrival (links from the landing page). */
export const REQUEST_INVITE_PARAM = "request";

/**
 * "Request an invite" on the sign-in page: a button that opens a themed
 * dialog asking for an email address (and, optionally, a name and a note).
 * The request goes to the owner for review; nothing is sent to the visitor.
 * Opens on arrival with ?request=invite; closing it drops that from the URL so
 * a reload does not reopen it.
 */
export function RequestInvite({
  defaultOpen = false,
  defaultEmail = "",
  variant = "link",
}: {
  defaultOpen?: boolean;
  defaultEmail?: string;
  variant?: "link" | "button";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has(REQUEST_INVITE_PARAM)) {
      url.searchParams.delete(REQUEST_INVITE_PARAM);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRound((value) => value + 1);
          setOpen(true);
        }}
        className={
          variant === "button"
            ? `${btnSecondary} w-full`
            : "underline-reveal-parent rounded-sm font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        }
      >
        {variant === "button" ? "Request an invite" : <span className="underline-reveal">Request an invite</span>}
      </button>
      <Modal
        open={open}
        onClose={close}
        dismissible={!busy}
        title="Request an invite"
        description="TrainGrid is invite-only while it is shaped with its first members. Leave your email and Tanuj, its founder, will review your request personally."
        initialFocus="input[name=email]"
      >
        <RequestForm key={round} defaultEmail={defaultEmail} onBusy={setBusy} onDone={close} />
      </Modal>
    </>
  );
}

function RequestForm({
  defaultEmail,
  onBusy,
  onDone,
}: {
  defaultEmail: string;
  onBusy: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<InviteRequestState, FormData>(requestInviteAction, null);
  const [note, setNote] = useState("");
  const ids = { email: useId(), name: useId(), note: useId(), error: useId(), counter: useId() };

  useEffect(() => onBusy(pending), [pending, onBusy]);

  if (state?.status === "sent") return <RequestSent email={state.email} onDone={onDone} />;

  const error = state ? state.message : null;
  const invalid = (field: "email" | "name" | "note") => state?.status === "invalid" && state.field === field;
  // The error message describes the field it is about (a general error, the email).
  const describe = (field: "email" | "name" | "note") =>
    error && (invalid(field) || (field === "email" && state?.status === "error")) ? ids.error : undefined;

  return (
    <form action={action} noValidate aria-busy={pending}>
      <label htmlFor={ids.email} className="block text-sm font-medium text-stone-800">
        Email address
      </label>
      <input
        id={ids.email}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={320}
        defaultValue={defaultEmail}
        placeholder="you@example.com"
        aria-invalid={invalid("email")}
        aria-describedby={describe("email")}
        className={fieldClass}
      />
      <p className="mt-1.5 text-xs leading-5 text-stone-600">
        Use the address of the Google or GitHub account you’ll sign in with.
      </p>

      <label htmlFor={ids.name} className="mt-4 block text-sm font-medium text-stone-800">
        Your name <span className="font-normal text-stone-600">(optional)</span>
      </label>
      <input
        id={ids.name}
        name="name"
        type="text"
        autoComplete="name"
        maxLength={80}
        aria-invalid={invalid("name")}
        aria-describedby={describe("name")}
        className={fieldClass}
      />

      <label htmlFor={ids.note} className="mt-4 block text-sm font-medium text-stone-800">
        A note for Tanuj <span className="font-normal text-stone-600">(optional)</span>
      </label>
      <textarea
        id={ids.note}
        name="note"
        rows={3}
        maxLength={INVITE_NOTE_MAX}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="How you heard about TrainGrid, or what you train for."
        aria-invalid={invalid("note")}
        aria-describedby={`${ids.counter}${describe("note") ? ` ${ids.error}` : ""}`}
        className={`${fieldClass} min-h-20 resize-y leading-6`}
      />
      <p id={ids.counter} className="mt-1 text-right text-xs text-stone-600">
        {note.length} / {INVITE_NOTE_MAX}
      </p>

      {/* Never shown to people; a bot that fills it is quietly ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {error ? (
        <p
          id={ids.error}
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs leading-5 text-stone-600">
          Used only to review your request. See the{" "}
          <a href="/privacy#invite-requests" className="text-accent underline underline-offset-2">
            privacy notice
          </a>
          .
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          <button type="button" className={`${btnSecondary} whitespace-nowrap`} disabled={pending} onClick={onDone}>
            Cancel
          </button>
          <SendButton />
        </div>
      </div>
    </form>
  );
}

/** Shows progress straight away: a spinner and "Sending…" while the request is stored. */
function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${btnPrimary} min-w-36 gap-2 whitespace-nowrap disabled:cursor-wait disabled:opacity-80`}
    >
      {pending ? (
        <>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 motion-safe:animate-spin" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Sending…
        </>
      ) : (
        "Send request"
      )}
    </button>
  );
}

function RequestSent({ email, onDone }: { email: string; onDone: () => void }) {
  return (
    <div className="flex flex-col items-center py-2 text-center" role="status" data-testid="invite-request-sent">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-check-draw size-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h3 className="mt-4 text-lg font-semibold">Request sent</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-stone-600">
        Thank you. Your note is with Tanuj, who reviews every request personally, so it can take a
        little while.
      </p>
      <ol className="mt-5 w-full max-w-sm space-y-3 rounded-xl border border-line bg-background/60 p-4 text-left text-sm leading-6">
        <li className="flex gap-3">
          <span aria-hidden="true" className="font-mono text-xs leading-6 text-accent">01</span>
          <span>
            If there’s a place for you, an invitation arrives at{" "}
            <strong className="font-medium [overflow-wrap:anywhere]">{email}</strong>.
          </span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="font-mono text-xs leading-6 text-accent">02</span>
          <span>Come back here and continue with the Google or GitHub account that uses that address.</span>
        </li>
      </ol>
      {/* autoFocus: the form that held focus is gone; keep the keyboard in the dialog. */}
      <button type="button" autoFocus className={`${btnPrimary} mt-6 min-w-28`} onClick={onDone}>
        Done
      </button>
    </div>
  );
}
