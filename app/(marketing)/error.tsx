"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

/** Errors in the landing page; rendered inside the marketing layout. */
export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
