"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/auth/actions";

function Submit({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** Ends the session. Shows progress immediately so the click never feels ignored. */
export function SignOutButton({ className }: { className: string }) {
  return (
    <form action={signOut}>
      <Submit className={className} />
    </form>
  );
}
