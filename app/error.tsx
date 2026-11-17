"use client";

import { btnPrimary } from "@/lib/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message =
    error.message && !/undefined|null|NaN|Invalid Date/i.test(error.message)
      ? error.message
      : "Something went wrong. Try again from the planner.";

  return (
    <div className="mx-auto my-10 max-w-xl rounded-2xl border border-line bg-card px-5 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Could not complete that action</h1>
      <p role="alert" className="mt-3 text-sm leading-7 text-red-800 [overflow-wrap:anywhere]">{message}</p>
      <button
        type="button"
        className={`${btnPrimary} mt-5`}
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
