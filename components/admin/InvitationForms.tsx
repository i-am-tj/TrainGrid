"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { inviteAction, revokeAction, type InvitationFormState } from "@/lib/admin/actions";
import { btnDanger, btnPrimary, fieldClass } from "@/lib/ui";

function Message({ state }: { state: InvitationFormState }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`mt-2 text-sm ${state.ok ? "text-emerald-800" : "text-red-800"}`}
    >
      {state.message}
    </p>
  );
}

function Submit({ label, busy, className }: { label: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className} disabled:opacity-60`}>
      {pending ? busy : label}
    </button>
  );
}

export function InviteForm() {
  const [state, action] = useActionState(inviteAction, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action}>
      <label htmlFor="invite-email" className="text-sm font-medium text-stone-800">
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
          className={`${fieldClass} sm:flex-1`}
        />
        <Submit label="Invite" busy="Inviting…" className={btnPrimary} />
      </div>
      <Message state={state} />
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
  const [state, action] = useActionState(revokeAction, null);
  const question =
    kind === "access"
      ? `Revoke access for ${email}?\n\nThey lose access to TrainGrid straight away. Their routines and sessions are kept, and inviting this email again restores them.`
      : `Revoke the invitation for ${email}?`;
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(question)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Submit
        label={kind === "access" ? "Revoke access" : "Revoke"}
        busy="Revoking…"
        className={btnDanger}
      />
      <Message state={state} />
    </form>
  );
}
