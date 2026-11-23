import Link from "next/link";
import { timeAgo, type CommentView } from "@/lib/social/model";
import { CommentForm, DeleteComment } from "./CommentControls";
import { SocialAvatar } from "./SocialAvatar";

/**
 * A post's comments, oldest first, and a box to add one. Each comment can be
 * deleted by whoever wrote it, and by the post's author. The database decides
 * who may read, write and delete; this only offers what it allows.
 */
export function Comments({
  postId,
  comments,
  viewerId,
  postAuthorId,
  canComment,
}: {
  postId: string;
  comments: CommentView[];
  viewerId: string;
  postAuthorId: string;
  /** False for members without a social profile. */
  canComment: boolean;
}) {
  const now = new Date();
  return (
    <section id="comments" aria-labelledby="comments-title" className="ui-panel scroll-mt-20 p-4 sm:p-5">
      <h2 id="comments-title" className="text-base font-semibold tracking-tight">
        Comments <span className="font-normal text-stone-600">({comments.length})</span>
      </h2>

      {comments.length === 0 ? (
        <p className="mt-2 text-sm text-stone-600">No comments yet. Say something encouraging.</p>
      ) : (
        <ol className="mt-3 space-y-4" aria-label="Comments, oldest first">
          {comments.map((comment) => (
            <li key={comment.id} data-testid="comment" className="flex gap-3">
              <SocialAvatar
                displayName={comment.author.displayName}
                username={comment.author.username}
                avatarUrl={comment.author.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <Link href={`/people/${comment.author.username}`} className="font-semibold hover:underline">
                    {comment.author.displayName}
                  </Link>{" "}
                  <span className="text-xs text-stone-600">
                    <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt, now)}</time>
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm leading-6 [overflow-wrap:anywhere]">{comment.body}</p>
              </div>
              {comment.author.userId === viewerId || postAuthorId === viewerId ? (
                <DeleteComment id={comment.id} own={comment.author.userId === viewerId} />
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 border-t border-line pt-4">
        {canComment ? (
          <CommentForm postId={postId} />
        ) : (
          <p className="text-sm text-stone-600">
            <Link href={`/profile/social?next=${encodeURIComponent(`/posts/${postId}`)}`} className="text-accent underline underline-offset-4">
              Set up your social profile
            </Link>{" "}
            to comment.
          </p>
        )}
      </div>
    </section>
  );
}
