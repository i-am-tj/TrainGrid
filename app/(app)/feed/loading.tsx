import { FeedSkeleton } from "./FeedSkeleton";

/** The feed's first load: the column and placeholder cards, before any data. */
export default function FeedLoading() {
  return (
    <div className="mx-auto w-[min(100%-1.5rem,44rem)] py-5 sm:py-10">
      <div className="border-b border-line pb-5 sm:pb-7">
        <p className="ui-eyebrow">Feed</p>
        <div aria-hidden="true" className="mt-3 h-8 w-56 rounded bg-stone-200 motion-safe:animate-pulse" />
      </div>
      <div className="mt-5 sm:mt-7">
        <FeedSkeleton />
      </div>
    </div>
  );
}
