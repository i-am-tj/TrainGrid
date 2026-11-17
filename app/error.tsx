"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

/**
 * Last-resort boundary for errors outside the app shell (for example in a
 * route group layout). It replaces that layout, so it renders the main
 * landmark itself. Errors in app pages are caught by app/(app)/error.tsx,
 * which keeps the header.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="app-main flex-1">
      <ErrorPanel error={error} reset={reset} />
    </main>
  );
}
