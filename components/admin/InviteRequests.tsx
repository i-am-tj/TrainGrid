"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { dismissInviteRequestAction, inviteAction } from "@/lib/admin/actions";
import { btnPrimary, btnSecondaryCompact } from "@/lib/ui";

export type InviteRequestItem = {
  id: string;
  email: string;
  name: string | null;
  note: string | null;
  requestedLabel: string;
};

type Notice = { tone: "success" | "warning" | "error"; message: string };

const NOTICE_STYLE: Record<Notice["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

/**
 * Pending invite requests. Invite creates the invitation (and emails it when
 * email is set up), which also marks the request invited; Dismiss declines it
 * quietly. A handled row leaves the list, so the outcome is reported above it.
 */
export function InviteRequestList({ requests, emailReady }: { requests: InviteRequestItem[]; emailReady: boolean }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  return (
    <div>
      <div aria-live="polite">
        {notice ? (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={`mt-3 rounded-lg border px-3 py-2 text-sm leading-6 ${NOTICE_STYLE[notice.tone]}`}
          >
            {notice.message}
          </p>
        ) : null}
      </div>
      {requests.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-stone-600">
          No requests waiting. New ones appear here, and arrive by email.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card" data-testid="invite-requests">
          {requests.map((request) => (
            <RequestRow key={request.id} request={request} emailReady={emailReady} onNotice={setNotice} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestRow({
  request,
  emailReady,
  onNotice,
}: {
  request: InviteRequestItem;
  emailReady: boolean;
  onNotice: (notice: Notice) => void;
}) {
  // A handled row leaves the list in the same render that returns its result,
  // so each action reports to the list (which stays) as soon as it finishes.
  const invite = async (form: FormData) => {
    const result = await inviteAction(null, form);
    if (!result) return;
    if (!result.ok) return onNotice({ tone: "error", message: `${request.email}: ${result.message}` });
    const email = result.email;
    onNotice({
      tone: email && email.tone !== "success" ? "warning" : "success",
      message: `Invited ${request.email}.${email ? ` ${email.message}` : ""}`,
    });
  };
  const dismiss = async (form: FormData) => {
    const result = await dismissInviteRequestAction(null, form);
    onNotice(
      result?.ok
        ? { tone: "success", message: `Dismissed the request from ${request.email}.` }
        : { tone: "error", message: `${request.email}: ${result?.message ?? "Something went wrong."}` },
    );
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-medium [overflow-wrap:anywhere]">
          {request.name ? (
            <>
              {request.name} <span className="font-normal text-stone-600">· {request.email}</span>
            </>
          ) : (
            request.email
          )}
        </p>
        <p className="mt-0.5 text-xs text-stone-600">Requested {request.requestedLabel}</p>
        {request.note ? (
          <p className="mt-2 max-w-xl whitespace-pre-wrap border-l-2 border-accent/60 pl-3 text-sm leading-6 text-stone-700 [overflow-wrap:anywhere]">
            {request.note}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <form action={dismiss}>
          <input type="hidden" name="id" value={request.id} />
          <RowButton label="Dismiss" busy="Dismissing…" className={btnSecondaryCompact} />
        </form>
        <form action={invite}>
          <input type="hidden" name="email" value={request.email} />
          {emailReady ? <input type="hidden" name="send_email" value="on" /> : null}
          <RowButton
            label={emailReady ? "Invite and email" : "Invite"}
            busy="Inviting…"
            className={btnPrimary.replace("min-h-10", "min-h-8").replace("px-3 py-2 text-sm", "px-2.5 py-1 text-xs")}
          />
        </form>
      </div>
    </li>
  );
}

function RowButton({ label, busy, className }: { label: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} aria-label={label} className={`${className} whitespace-nowrap disabled:opacity-60`}>
      {pending ? busy : label}
    </button>
  );
}
