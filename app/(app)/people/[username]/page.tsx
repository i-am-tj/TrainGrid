import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostCard } from "@/components/social/PostCard";
import { ProfileHeader } from "@/components/social/ProfileHeader";
import { EmptyState, FeedIcon, LockIcon, Notice } from "@/components/social/parts";
import { memberData } from "@/lib/data/server";
import { getOwnSocialProfile, getProfileCard, listPosts } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { decodeCursor } from "@/lib/social/model";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Profile");

/**
 * A member's profile. Everyone signed in sees the basic identity; the posts
 * only when the database says so (own profile, a public profile, or an
 * accepted follow). An unknown, revoked or malformed username is a 404, the
 * same answer in every case.
 */
async function PersonPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, userId } = await memberData();
  const { username } = await params;
  const query = await searchParams;
  const card = await getProfileCard(db, username);
  if (!card) notFound();
  if (username !== card.username) redirect(`/people/${card.username}`);

  const before = typeof query.before === "string" && decodeCursor(query.before) ? query.before : null;
  const [own, page] = await Promise.all([
    card.isSelf ? null : getOwnSocialProfile(db, userId),
    card.canViewPosts ? listPosts(db, { authorId: card.userId, cursor: before }) : null,
  ]);
  const base = `/people/${card.username}`;
  const now = new Date();

  return (
    <div className="mx-auto w-[min(100%-1.5rem,52rem)] py-5 sm:py-10">
      <Link href="/people" className="text-sm text-stone-600 hover:underline">
        ← People
      </Link>
      <div className="mt-4 space-y-5">
        {query.saved === "1" && card.isSelf ? <Notice>Profile saved.</Notice> : null}
        <ProfileHeader card={card} viewerHasProfile={card.isSelf || own !== null} />

        <section aria-labelledby="posts-title">
          <h2 id="posts-title" className="mb-3 text-base font-semibold tracking-tight">
            Posts
          </h2>
          {!page ? (
            <EmptyState
              testId="private-profile"
              icon={<LockIcon className="size-5" />}
              title="This profile is private"
            >
              {card.viewerFollow === "pending"
                ? `Your request is waiting for ${card.displayName} to approve it.`
                : `Follow ${card.displayName} to see their session updates. They’ll approve your request first.`}
            </EmptyState>
          ) : page.posts.length === 0 ? (
            <EmptyState
              testId="profile-no-posts"
              icon={<FeedIcon />}
              title={before ? "No older posts" : card.isSelf ? "You haven’t posted yet" : "No posts yet"}
              actions={
                card.isSelf && !before ? (
                  <Link href="/feed/new" className={btnPrimary}>
                    Post a session update
                  </Link>
                ) : before ? (
                  <Link href={base} className={btnSecondary}>
                    Back to newest
                  </Link>
                ) : undefined
              }
            >
              {card.isSelf && !before ? "Share how a planned session went. You choose what’s included." : null}
            </EmptyState>
          ) : (
            <>
              <ol className="space-y-4" aria-label={`Posts by ${card.displayName}, newest first`}>
                {page.posts.map((post) => (
                  <li key={post.id}>
                    <PostCard post={post} isOwn={card.isSelf} returnTo={base} now={now} headingLevel="h3" />
                  </li>
                ))}
              </ol>
              <nav aria-label="More posts" className="mt-4 flex flex-wrap justify-center gap-2">
                {before ? (
                  <Link href={base} className={btnSecondary}>
                    Back to newest
                  </Link>
                ) : null}
                {page.nextCursor ? (
                  <Link href={`${base}?before=${encodeURIComponent(page.nextCursor)}`} className={btnSecondary}>
                    Older posts
                  </Link>
                ) : null}
              </nav>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function PersonPage(props: Parameters<typeof PersonPageContent>[0]) {
  return socialPage(() => PersonPageContent(props));
}
