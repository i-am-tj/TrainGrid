"use client";

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
    <div className="mx-auto max-w-xl px-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Could not complete that action</h1>
      <p className="mt-2 text-sm text-stone-600">{message}</p>
      <button
        type="button"
        className="mt-4 inline-flex min-h-10 items-center rounded-md bg-stone-900 px-3 py-2 text-sm text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
