"use client";

import { usePathname } from "next/navigation";
import { createContext, useActionState, useContext, useId, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { ActionSubmit } from "@/components/ui/ActionSubmit";
import { sendFeedbackAction } from "@/lib/feedback/actions";
import {
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  FEEDBACK_MAX_LENGTH,
  type FeedbackKind,
} from "@/lib/feedback/model";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

/**
 * The Feedback dialog. One dialog per page, owned by FeedbackProvider (in the
 * app header); any FeedbackTrigger opens it. Keeping the dialog outside the
 * phone menu means closing that menu never hides an open dialog.
 */
const OpenFeedback = createContext<(() => void) | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // A fresh form each time it opens: no stale message or "sent" state.
  const [round, setRound] = useState(0);
  return (
    <OpenFeedback.Provider
      value={() => {
        setRound((value) => value + 1);
        setOpen(true);
      }}
    >
      {children}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Share feedback"
        description="Ideas, problems or praise: it goes straight to the person who builds TrainGrid."
        initialFocus="input[name=kind]:checked"
      >
        <FeedbackForm key={round} onDone={() => setOpen(false)} />
      </Modal>
    </OpenFeedback.Provider>
  );
}

export function FeedbackTrigger({ className }: { className: string }) {
  const open = useContext(OpenFeedback);
  if (!open) return null;
  return (
    <button type="button" className={className} onClick={open} data-closes-menu>
      Feedback
    </button>
  );
}

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(sendFeedbackAction, null);
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const pathname = usePathname();
  const messageId = useId();
  const counterId = useId();
  const errorId = useId();

  if (state?.status === "sent") return <FeedbackSent onDone={onDone} />;

  const error = state ? state.message : null;
  const remaining = FEEDBACK_MAX_LENGTH - message.length;

  return (
    <form action={action} noValidate>
      <input type="hidden" name="page_path" value={pathname} />
      <fieldset>
        <legend className="text-sm font-medium text-stone-800">What kind of feedback?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {FEEDBACK_KINDS.map((value) => (
            <label
              key={value}
              className="ui-control group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-line bg-background/60 px-2 py-3 text-center hover:border-stone-400 has-[:checked]:border-accent has-[:checked]:bg-card has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stone-900 has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <KindIcon kind={value} />
              <span className="text-sm font-medium">{FEEDBACK_KIND_LABELS[value].label}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-600" aria-live="polite">
          {FEEDBACK_KIND_LABELS[kind].hint}
        </p>
      </fieldset>

      <label htmlFor={messageId} className="mt-5 block text-sm font-medium text-stone-800">
        Your message
      </label>
      <textarea
        id={messageId}
        name="message"
        rows={5}
        maxLength={FEEDBACK_MAX_LENGTH}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={FEEDBACK_KIND_LABELS[kind].placeholder}
        aria-describedby={`${counterId}${error ? ` ${errorId}` : ""}`}
        aria-invalid={state?.status === "invalid" && state.field === "message"}
        className={`${fieldClass} min-h-32 resize-y leading-6`}
      />
      <p id={counterId} className={`mt-1.5 text-right text-xs ${remaining < 100 ? "text-amber-800" : "text-stone-600"}`}>
        {message.length.toLocaleString("en-GB")} / {FEEDBACK_MAX_LENGTH.toLocaleString("en-GB")}
      </p>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs leading-5 text-stone-600">Sent with your name and this page’s address.</p>
        <div className="flex shrink-0 justify-end gap-2">
          <button type="button" className={`${btnSecondary} whitespace-nowrap`} onClick={onDone}>
            Cancel
          </button>
          <ActionSubmit
            label="Send feedback"
            busy="Sending…"
            className={`${btnPrimary} whitespace-nowrap`}
            disabled={!message.trim()}
          />
        </div>
      </div>
    </form>
  );
}

function FeedbackSent({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center" role="status">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-check-draw size-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h3 className="mt-4 text-lg font-semibold">Thank you</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-stone-600">
        Your feedback is on its way. Every note is read, and it shapes what TrainGrid does next.
      </p>
      {/* autoFocus: the form that held focus is gone; keep the keyboard in the dialog. */}
      <button type="button" autoFocus className={`${btnPrimary} mt-6 min-w-28`} onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function KindIcon({ kind }: { kind: FeedbackKind }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    className: "size-6 text-stone-600 group-has-[:checked]:text-accent",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "idea")
    return (
      <svg {...common}>
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z" />
      </svg>
    );
  if (kind === "problem")
    return (
      <svg {...common}>
        <path d="M12 3.5l9 16H3l9-16z" />
        <path d="M12 10v4M12 17h.01" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}
