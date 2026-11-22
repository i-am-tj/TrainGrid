import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/social/parts";
import { memberData } from "@/lib/data/server";
import { getOwnSocialProfile, listPostableSessions } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { formatMinutes, formatSessionDate } from "@/lib/social/model";
import { getRequestToday } from "@/lib/today";
import { btnSecondary, TYPE_BAR, TYPE_SHORT } from "@/lib/ui";

export const metadata = socialMetadata("Post an update");

/**
 * Choose which of your sessions to post about: the last three weeks and the
 * week ahead. Choosing one opens the composer, where you see exactly what
 * will be shared before anything is.
 */
export default async function NewPostPage() {
  const { db, userId } = await memberData();
  const own = await getOwnSocialProfile(db, userId);
  if (!own) redirect("/profile/social?next=/feed/new");
  const today = await getRequestToday();
  const sessions = await listPostableSessions(db, userId, today.date);
  const year = Number(today.date.slice(0, 4));

  return (
    <div className="mx-auto w-[min(100%-1.5rem,44rem)] py-5 sm:py-10">
      <Link href="/feed" className="text-sm text-stone-600 hover:underline">
        ← Back to feed
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Post a session update</h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Choose one of your sessions. You’ll see exactly what’s shared before you post.
      </p>

      <div className="mt-6">
        {sessions.length === 0 ? (
          <EmptyState
            title="No recent sessions"
            actions={
              <Link href="/week/current" className={btnSecondary}>
                Open the planner
              </Link>
            }
          >
            Plan a session in the planner, then post about it here or from the session itself.
          </EmptyState>
        ) : (
          <ul aria-label="Your sessions" className="ui-panel divide-y divide-line overflow-hidden">
            {sessions.map((session) => {
              const upcoming = session.date > today.date;
              return (
                <li key={session.id}>
                  <Link
                    href={`/session/${session.id}/post`}
                    className={`group flex items-center gap-3 border-l-4 px-4 py-3.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900 sm:px-5 ${TYPE_BAR[session.category]}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold group-hover:underline">{session.name}</span>
                      <span className="block text-xs text-stone-600">
                        {TYPE_SHORT[session.category]} · {formatSessionDate(session.date, year)}
                        {session.durationMinutes != null ? ` · ${formatMinutes(session.durationMinutes)}` : ""}
                        {session.date === today.date ? " · Today" : upcoming ? " · Coming up" : ""}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-stone-400 group-hover:text-accent">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
