"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

/** Errors in the information pages; rendered inside their layout. */
export default function InfoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
