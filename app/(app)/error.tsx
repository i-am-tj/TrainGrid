"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

/** Errors in app pages; rendered inside the app layout, so the header stays. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
