/** Placeholder post cards while the feed loads; announced once, politely. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading posts" data-testid="feed-loading" className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className="ui-panel p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-stone-200 motion-safe:animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-stone-200 motion-safe:animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-stone-200 motion-safe:animate-pulse" />
            </div>
          </div>
          <div className="mt-4 h-3 w-4/5 rounded bg-stone-200 motion-safe:animate-pulse" />
          <div className="mt-4 h-16 rounded-xl bg-stone-100 motion-safe:animate-pulse" />
        </div>
      ))}
      <span className="sr-only">Loading posts…</span>
    </div>
  );
}
