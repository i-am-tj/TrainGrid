import { unstable_rethrow } from "next/navigation";
import { memberData } from "@/lib/data/server";
import { countIncomingRequests } from "@/lib/data/social";

/**
 * How many people are waiting for the member to approve their follow request,
 * as a small badge on the People link. Streams in on its own and renders
 * nothing at zero (or if the count cannot be read); screen readers hear it
 * through the link's description.
 */
export async function FollowRequestsBadge({ descriptionId }: { descriptionId: string }) {
  let count = 0;
  try {
    const { db, userId } = await memberData();
    count = await countIncomingRequests(db, userId);
  } catch (error) {
    // Redirects and other Next.js signals go through; a failed count shows no badge.
    unstable_rethrow(error);
    count = 0;
  }
  if (count === 0) return <span id={descriptionId} className="sr-only" />;
  return (
    <>
      <span
        aria-hidden="true"
        data-testid="follow-requests-badge"
        className="absolute -right-3.5 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white tabular-nums ring-2 ring-card"
      >
        {count > 99 ? "99+" : count}
      </span>
      <span id={descriptionId} className="sr-only">
        {count === 1 ? "1 follow request" : `${count} follow requests`}
      </span>
    </>
  );
}
