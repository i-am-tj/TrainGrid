import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { memberData } from "@/lib/data/server";
import { getProfileCard, listConnections } from "@/lib/data/social";
import { removeFollowerAction } from "@/lib/social/actions";
import { pageNumber } from "@/lib/social/model";
import { btnDanger, btnSecondary, btnSecondaryCompact } from "@/lib/ui";
import { ConfirmActionButton } from "./ActionButtons";
import { EmptyState, LockIcon, PeopleIcon } from "./parts";
import { PeopleList, PersonRow } from "./PersonRow";

/**
 * Followers or following of one profile. A private profile's lists are shown
 * only to its owner and approved followers, and the database returns nothing
 * to anyone else either. On your own followers list, each follower can be
 * removed; they lose access to a private profile at once.
 */
export async function ConnectionsView({
  username,
  kind,
  rawPage,
}: {
  username: string;
  kind: "followers" | "following";
  rawPage: unknown;
}) {
  const { db } = await memberData();
  const card = await getProfileCard(db, username);
  if (!card) notFound();
  if (username !== card.username) redirect(`/people/${card.username}/${kind}`);
  const page = pageNumber(rawPage);
  const list = card.canViewPosts ? await listConnections(db, card.userId, kind, page) : null;
  const base = `/people/${card.username}`;
  const title = kind === "followers" ? "Followers" : "Following";
  const count = kind === "followers" ? card.followerCount : card.followingCount;

  return (
    <div className="mx-auto w-[min(100%-1.5rem,44rem)] py-5 sm:py-10">
      <Link href={base} className="text-sm text-stone-600 hover:underline">
        ← {card.displayName}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-stone-600">
        @{card.username} · {count.toLocaleString("en-AU")} {kind === "followers" ? (count === 1 ? "follower" : "followers") : "following"}
      </p>

      <nav aria-label="Connections" className="mt-4 inline-flex gap-1 rounded-full border border-line bg-card p-1">
        {(["followers", "following"] as const).map((tab) => (
          <Link
            key={tab}
            href={`${base}/${tab}`}
            aria-current={tab === kind ? "page" : undefined}
            className={`ui-control inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
              tab === kind ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            {tab === "followers" ? "Followers" : "Following"}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {!list ? (
          <EmptyState testId="private-list" icon={<LockIcon className="size-5" />} title="This list is private">
            Only people {card.displayName} has approved can see who they follow and who follows them.
          </EmptyState>
        ) : list.people.length === 0 ? (
          <EmptyState icon={<PeopleIcon />} title={kind === "followers" ? "No followers yet" : "Not following anyone yet"}>
            {card.isSelf ? (
              <Link href="/people" className="text-accent underline underline-offset-4">
                Find people
              </Link>
            ) : null}
          </EmptyState>
        ) : (
          <>
            <PeopleList label={title}>
              {list.people.map((person) => (
                <PersonRow
                  key={person.userId}
                  person={person}
                  actions={
                    card.isSelf && kind === "followers" ? (
                      <ConfirmActionButton
                        action={removeFollowerAction}
                        userId={person.userId}
                        label="Remove"
                        ariaLabel={`Remove ${person.displayName} as a follower`}
                        title={`Remove ${person.displayName}?`}
                        description={
                          card.visibility === "private"
                            ? "They stop seeing your posts and lists straight away. They aren’t told, and would need to request again."
                            : "They stop following you. Your profile is public, so they could follow again."
                        }
                        confirm="Remove follower"
                        busy="Removing…"
                        className={btnSecondaryCompact}
                        confirmClassName={btnDanger}
                      />
                    ) : undefined
                  }
                />
              ))}
            </PeopleList>
            {list.people.length < count && !list.hasMore && page === 1 ? (
              <p className="mt-2 text-xs text-stone-600">Some people in this list are private and aren’t shown.</p>
            ) : null}
            <nav aria-label="More people" className="mt-4 flex justify-center gap-2">
              {page > 1 ? (
                <Link href={`${base}/${kind}?page=${page - 1}`} className={btnSecondary}>
                  Previous
                </Link>
              ) : null}
              {list.hasMore ? (
                <Link href={`${base}/${kind}?page=${page + 1}`} className={btnSecondary}>
                  More
                </Link>
              ) : null}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
