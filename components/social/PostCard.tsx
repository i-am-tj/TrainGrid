import Link from "next/link";
import { timeAgo, type PostView } from "@/lib/social/model";
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
}: {
  post: PostView;
  isOwn: boolean;
  returnTo: string;
  now?: Date;
  headingLevel?: "h2" | "h3";
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
        <SessionSummaryBlock session={post.session} currentYear={now.getUTCFullYear()} />
      </div>
    </article>
  );
}
