/**
 * Shown while the library list loads (E2-D14). It lives in the (list) route
 * group so it applies to /library only: a loading boundary makes a route
 * stream, and detail pages must keep real 404 statuses and redirects.
 */
export default function LibraryLoading() {
  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading the library…</p>
      <div className="h-7 w-28 animate-pulse rounded bg-stone-200" />
      <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-stone-200" />
      <div className="mt-5 h-12 w-64 animate-pulse rounded-lg bg-stone-200" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-stone-100" />
        ))}
      </div>
    </div>
  );
}
