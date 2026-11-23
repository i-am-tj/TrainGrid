"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { btnSecondaryCompact } from "@/lib/ui";

/**
 * Shown instead of "No requests waiting" when the list could not be read, so
 * a failed query never looks like an empty queue (PRODUCT_AUDIT F8).
 */
export function RequestsUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div
      role="alert"
      data-testid="invite-requests-unavailable"
      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
    >
      <p>
        <span className="font-semibold">Requests couldn’t be loaded.</span> People may be waiting; this is not an empty list.
      </p>
      <button
        type="button"
        className={btnSecondaryCompact}
        disabled={pending}
        aria-busy={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Trying again…" : "Try again"}
      </button>
    </div>
  );
}
