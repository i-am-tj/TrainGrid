"use client";

import { useState } from "react";
import { renderInvitationEmail } from "@/lib/email/invitation";
import { btnSecondary, fieldClass } from "@/lib/ui";
import {
  EmailWorkflowPreview,
  type EmailDeliveryPreviewState,
} from "./EmailWorkflowPreview";

export function InvitationEmailPreview({ loginUrl }: { loginUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="ui-panel mt-6"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer rounded-2xl px-5 py-4 text-sm font-semibold focus-visible:outline-offset-4">
        Preview invitation email{" "}
        <span className="ml-2 font-normal text-stone-500">
          · no email is sent
        </span>
      </summary>
      {open && <PreviewContent loginUrl={loginUrl} />}
    </details>
  );
}

function PreviewContent({ loginUrl }: { loginUrl: string }) {
  const [recipient, setRecipient] = useState("friend@example.test");
  let email;
  try {
    email = renderInvitationEmail({ recipientEmail: recipient, loginUrl });
  } catch {
    /* Invalid draft is feedback, never an email operation. */
  }
  return (
    <div className="min-w-0 border-t border-line p-4 sm:p-5">
      <p className="text-sm leading-7 text-stone-600">
        This preview uses an example address. Change it to prepare copy for a
        recipient. It does not create an invitation or send an email.
      </p>
      <label
        htmlFor="preview-recipient"
        className="mt-4 block text-sm font-medium"
      >
        Preview recipient
        <input
          id="preview-recipient"
          type="email"
          autoComplete="off"
          maxLength={320}
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          aria-invalid={!email}
          aria-describedby={!email ? "preview-error" : undefined}
          className={fieldClass}
        />
      </label>
      {!email ? (
        <p
          id="preview-error"
          role="alert"
          className="mt-3 text-sm text-red-800"
        >
          Enter a valid email address to preview the invitation.
        </p>
      ) : (
        <>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-stone-500">Subject</dt>
              <dd className="mt-1 font-medium">{email.subject}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Preheader</dt>
              <dd className="mt-1 leading-6 text-stone-600">
                {email.preheader}
              </dd>
            </div>
          </dl>
          <iframe
            title="Invitation email preview"
            sandbox=""
            srcDoc={email.html}
            className="mt-5 h-[38rem] w-full rounded-xl border border-line bg-white"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton
              key={email.text}
              label="Copy invitation text"
              text={email.text}
            />
            <CopyButton label="Copy sign-in link" text={loginUrl} />
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer py-2 text-sm font-medium">
              Plain-text alternative
            </summary>
            <textarea
              aria-label="Plain-text invitation"
              readOnly
              value={email.text}
              className={`${fieldClass} h-64 font-mono text-xs`}
            />
          </details>
        </>
      )}
      <details className="mt-6 border-t border-line pt-4">
        <summary className="cursor-pointer py-2 text-sm font-medium">
          Future email workflow · design preview
        </summary>
        <p className="mt-2 text-xs leading-6 text-stone-600">
          Examples only. Sending and delivery tracking are not connected. These
          are separate from Pending, Accepted and Revoked membership statuses.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              "not_requested",
              "preparing",
              "accepted",
              "failed",
            ] as EmailDeliveryPreviewState[]
          ).map((state) => (
            <EmailWorkflowPreview key={state} state={state} />
          ))}
        </div>
      </details>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  return (
    <div>
      <button
        type="button"
        className={btnSecondary}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setResult("copied");
          } catch {
            setResult("failed");
          }
        }}
      >
        {label}
      </button>
      {result && (
        <p
          role="status"
          className="mt-2 max-w-xs text-xs leading-5 text-stone-600"
        >
          {result === "copied"
            ? "Copied to clipboard."
            : "Copy isn’t available here. Select the text in the plain-text alternative, or the sign-in link above."}
        </p>
      )}
    </div>
  );
}
