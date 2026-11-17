"use client";

import { createPortal, useFormStatus } from "react-dom";
import { LogoLoader } from "@/components/LogoLoader";
import { signOut } from "@/lib/auth/actions";

function Submit({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={className}
      >
        {pending ? "Signing you out..." : "Sign out"}
      </button>
      {pending &&
        createPortal(
          <div
            data-testid="signout-loader"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-[1px]"
          >
            <LogoLoader size="lg" label="Signing you out..." showLabel />
          </div>,
          document.body,
        )}
    </>
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
