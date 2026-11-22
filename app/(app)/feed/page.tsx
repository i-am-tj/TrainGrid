import Link from "next/link";
import { Suspense } from "react";
import { PostCard } from "@/components/social/PostCard";
import { EmptyState, FeedIcon, Notice, PeopleIcon } from "@/components/social/parts";
import type { Db } from "@/lib/data/model";
import { memberData } from "@/lib/data/server";
import { getOwnSocialProfile, listPosts } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { decodeCursor } from "@/lib/social/model";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { FeedSkeleton } from "./FeedSkeleton";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Feed");

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The member's feed: their own session posts and those of the members they
 * follow (accepted), newest first, twenty at a time. Who appears is decided
 * by the database (public.social_posts and the session_posts policies).
 */
async function FeedPageContent({ searchParams }: { searchParams: SearchParams }) {
  const { db, userId } = await memberData();
  const params = await searchParams;
  const before = typeof params.before === "string" && decodeCursor(params.before) ? params.before : null;
  const posted = typeof params.posted === "string";
  const own = await getOwnSocialProfile(db, userId);

  return (
    <div className="mx-auto w-[min(100%-1.5rem,44rem)] py-5 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-7">
        <div className="min-w-0">
          <p className="ui-eyebrow">Feed</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">Training together</h1>
          <p className="mt-1 text-sm leading-6 text-stone-600 sm:mt-2">
            Session updates from you and the people you follow. Nothing is shared unless you post it.
          </p>
        </div>
        {own ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/feed/new" className={btnPrimary}>
              Post an update
            </Link>
            <Link href="/people" className={btnSecondary}>
              Find people
            </Link>
          </div>
        ) : null}
      </header>

      <div className="mt-5 space-y-4 sm:mt-7">
        {posted ? <Notice>Posted. Your update is on your profile and in your followers’ feeds.</Notice> : null}

        {!own ? (
          <EmptyState
            testId="feed-setup"
            icon={<PeopleIcon />}
            title="Set up your social profile"
            actions={
              <>
                <Link href="/profile/social?next=/feed" className={btnPrimary}>
                  Set up profile
                </Link>
                <Link href="/people" className={btnSecondary}>
                  Browse people
                </Link>
              </>
            }
          >
            Choose a username to follow other members and share updates about your sessions. Your profile starts
            private, and nothing from your plan is shared unless you post it.
          </EmptyState>
        ) : (
          <Suspense key={before ?? "newest"} fallback={<FeedSkeleton />}>
            <FeedPosts db={db} userId={userId} before={before} username={own.username} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

async function FeedPosts({ db, userId, before, username }: { db: Db; userId: string; before: string | null; username: string }) {
  let page;
  try {
    page = await listPosts(db, { cursor: before });
  } catch {
    return (
      <div role="alert" data-testid="feed-error" className="ui-panel px-5 py-8 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Your feed couldn’t load</h2>
        <p className="mt-2 text-sm text-stone-600">Your posts and plan are safe. Check your connection and try again.</p>
        <Link href={before ? `/feed?before=${encodeURIComponent(before)}` : "/feed"} className={`${btnSecondary} mt-4`}>
          Try again
        </Link>
      </div>
    );
  }

  if (page.posts.length === 0) {
    return before ? (
      <EmptyState title="You’re all caught up" actions={<Link href="/feed" className={btnSecondary}>Back to newest</Link>}>
        There are no older posts.
      </EmptyState>
    ) : (
      <EmptyState
        testId="feed-empty"
        icon={<FeedIcon />}
        title="Your feed is quiet"
        actions={
          <>
            <Link href="/feed/new" className={btnPrimary}>
              Post a session update
            </Link>
            <Link href="/people" className={btnSecondary}>
              Discover people
            </Link>
          </>
        }
      >
        Share how a planned session went, or follow members to see theirs here. Your profile is{" "}
        <Link href={`/people/${username}`} className="text-accent underline underline-offset-4">
          @{username}
        </Link>
        .
      </EmptyState>
    );
  }

  const now = new Date();
  return (
    <>
      <h2 className="sr-only">Posts</h2>
      <ol className="space-y-4" aria-label="Posts, newest first">
        {page.posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} isOwn={post.author.userId === userId} returnTo="/feed" now={now} headingLevel="h3" />
          </li>
        ))}
      </ol>
      <nav aria-label="More posts" className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {before ? (
          <Link href="/feed" className={btnSecondary}>
            Back to newest
          </Link>
        ) : null}
        {page.nextCursor ? (
          <Link href={`/feed?before=${encodeURIComponent(page.nextCursor)}`} className={btnSecondary} data-testid="older-posts">
            Older posts
          </Link>
        ) : (
          <p className="text-xs text-stone-600">You’re all caught up.</p>
        )}
      </nav>
    </>
  );
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function FeedPage(props: Parameters<typeof FeedPageContent>[0]) {
  return socialPage(() => FeedPageContent(props));
}
