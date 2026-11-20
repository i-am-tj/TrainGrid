"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

/** Errors in focused pages (the live workout). */
export default function FocusError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="px-3 pt-[env(safe-area-inset-top)]">
      <ErrorPanel error={error} reset={reset} />
    </div>
  );
}
