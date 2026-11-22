import Link from "next/link";
import type { ReactNode } from "react";
import { SocialUnavailableError } from "@/lib/social/availability";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { EmptyState, PeopleIcon } from "./parts";

/**
 * What a social page shows when the social tables are not in the database
 * yet (the app was deployed before its migration). Calm, and it points back
 * to the parts of TrainGrid that work.
 */
export function SocialUnavailable() {
  return (
    <div className="mx-auto w-[min(100%-1.5rem,44rem)] py-5 sm:py-10">
      <h1 className="sr-only">Social features unavailable</h1>
      <EmptyState
        testId="social-unavailable"
        icon={<PeopleIcon />}
        title="Social features aren’t available yet"
        actions={
          <>
            <Link href="/home" className={btnPrimary}>
              Go home
            </Link>
            <Link href="/week/current" className={btnSecondary}>
              Open the planner
            </Link>
          </>
        }
      >
        People, posts and the feed are being switched on. Your plan, routines and workouts are safe and work
        as usual. Please try again a little later.
      </EmptyState>
    </div>
  );
}

/**
 * Renders a social page, or the panel above if the social schema is missing.
 * Only SocialUnavailableError is caught: redirects, 404s and every other
 * error go through unchanged.
 */
export async function socialPage(render: () => Promise<ReactNode>): Promise<ReactNode> {
  try {
    return await render();
  } catch (error) {
    if (error instanceof SocialUnavailableError) return <SocialUnavailable />;
    throw error;
  }
}
