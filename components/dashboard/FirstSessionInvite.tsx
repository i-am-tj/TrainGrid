import Link from "next/link";
import { hideFirstSessionInviteAction } from "@/lib/onboarding/actions";
import { btnPrimary, textLink } from "@/lib/ui";

/**
 * Today's empty state for a member who has never planned a session
 * (PRODUCT_AUDIT F14): one invitation, routine first, instead of a checklist.
 * Hidden for good once any session is planned, or on this device when the
 * member hides it (a cookie read on the server, so it never flashes).
 */
export function FirstSessionInvite({ libraryHref, addSessionHref }: { libraryHref: string; addSessionHref: string }) {
  return (
    <section
      aria-labelledby="first-session-title"
      className="ui-panel relative mt-5 overflow-hidden p-4 sm:p-6"
      data-testid="first-session"
    >
      {/* A soft wash of the accent in one corner. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="ui-eyebrow">Your first session</p>
          <h3 id="first-session-title" className="mt-2 text-xl font-semibold tracking-tight">
            Put a workout on your week
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Pick a TrainGrid routine and schedule it on any day, with the whole workout ready to start.
            Your own routines and plans can come later.
          </p>
        </div>
        <form action={hideFirstSessionInviteAction}>
          <button
            type="submit"
            aria-label="Hide this suggestion"
            title="Hide"
            className="ui-control inline-flex size-9 shrink-0 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </form>
      </div>
      <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href={libraryHref} className={`${btnPrimary} gap-2`}>
          Choose a routine <span aria-hidden="true">→</span>
        </Link>
        <Link href={addSessionHref} className={`${textLink} inline-flex min-h-10 items-center text-sm`}>
          or plan your own session
        </Link>
      </div>
    </section>
  );
}
