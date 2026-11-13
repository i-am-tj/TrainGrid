/**
 * Shown while the library list loads (E2-D14). It lives in the (list) route
 * group so it applies to /library only: a loading boundary makes a route
 * stream, and detail pages must keep real 404 statuses and redirects.
 * The heading and view control stay on screen (they are in the layout).
 */
export default function LibraryLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading the library…</p>
      <div className="h-[4.5rem] animate-pulse rounded-lg bg-stone-200 sm:h-[3.75rem]" />
      <div className="mt-3 h-10 w-80 max-w-full animate-pulse rounded-md bg-stone-200" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-stone-100" />
        ))}
      </div>
    </div>
  );
}
