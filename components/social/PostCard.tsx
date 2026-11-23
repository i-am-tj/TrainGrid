import Link from "next/link";
import { countLabel, timeAgo, type PostView } from "@/lib/social/model";
import { LikeButton } from "./LikeButton";
import { PostActions } from "./PostActions";
import { SessionSummaryBlock } from "./parts";
import { SocialAvatar } from "./SocialAvatar";

/**
 * One session post: who posted it (linking to their profile), when, the
 * caption and the session summary snapshot. The author also gets Edit and
 * Delete. `returnTo` is where Delete lands afterwards.
 */
export function PostCard({
  post,
  isOwn,
  returnTo,
  now = new Date(),
  headingLevel = "h2",
  canReact = true,
  showCommentsLink = true,
}: {
  post: PostView;
  isOwn: boolean;
  returnTo: string;
  now?: Date;
  headingLevel?: "h2" | "h3";
  /** Whether the viewer has a social profile, needed to like. */
  canReact?: boolean;
  /** Off on the post's own page, where the comments are listed below. */
  showCommentsLink?: boolean;
}) {
  const Heading = headingLevel;
  const profileHref = `/people/${post.author.username}`;
  const posted = new Date(post.createdAt);
  return (
    <article
      aria-labelledby={`post-${post.id}-author`}
      data-testid="post-card"
      className="ui-panel p-4 sm:p-5"
    >
      <header className="flex items-start gap-3">
        <SocialAvatar displayName={post.author.displayName} username={post.author.username} avatarUrl={post.author.avatarUrl} />
        <div className="min-w-0 flex-1">
          <Heading id={`post-${post.id}-author`} className="text-sm font-semibold leading-5 [overflow-wrap:anywhere]">
            <Link href={profileHref} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900">
              {post.author.displayName}
            </Link>
          </Heading>
          <p className="text-xs leading-5 text-stone-600">
            <span className="[overflow-wrap:anywhere]">@{post.author.username}</span>
            <span aria-hidden="true" className="px-1">·</span>
            <Link
              href={`/posts/${post.id}`}
              className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              <time dateTime={post.createdAt} title={posted.toUTCString()}>
                {timeAgo(post.createdAt, now)}
              </time>
            </Link>
            {post.editedAt ? (
              <>
                <span aria-hidden="true" className="px-1">·</span>
                <span>edited</span>
              </>
            ) : null}
          </p>
        </div>
        {isOwn ? <PostActions postId={post.id} returnTo={returnTo} /> : null}
      </header>

      {post.caption ? (
        <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-foreground [overflow-wrap:anywhere]">{post.caption}</p>
      ) : null}

      <div className="mt-3">
        <SessionSummaryBlock session={post.session} workout={post.workout} currentYear={now.getUTCFullYear()} />
      </div>

      <footer className="-mb-1 mt-3 flex items-center gap-1 border-t border-line pt-2">
        <LikeButton postId={post.id} liked={post.viewerLiked} count={post.likeCount} canLike={canReact} />
        {showCommentsLink ? (
          <Link
            href={`/posts/${post.id}#comments`}
            data-testid="comments-link"
            className="ui-control inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
              <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h0A1.5 1.5 0 0 1 4 11.5z" />
            </svg>
            {post.commentCount > 0 ? countLabel(post.commentCount, "comment") : "Comment"}
          </Link>
        ) : (
          <span className="px-2.5 text-sm text-stone-600">{countLabel(post.commentCount, "comment")}</span>
        )}
      </footer>
    </article>
  );
}
