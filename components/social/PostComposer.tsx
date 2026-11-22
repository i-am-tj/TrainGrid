"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { createPostAction, updatePostAction } from "@/lib/social/actions";
import { IDLE } from "@/lib/social/form-state";
import { CAPTION_MAX, type SessionSummary, type Visibility } from "@/lib/social/model";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";
import { SessionSummaryBlock, VisibilityBadge } from "./parts";
import { SocialAvatar } from "./SocialAvatar";

type Author = { username: string; displayName: string; avatarUrl: string | null; visibility: Visibility };

/**
 * Writes a session update. The preview on the right (below, on phones) is
 * exactly what followers will see: the caption, the session's name,
 * category and date, and its duration only when ticked. Start time, notes,
 * exercises and logged sets are never part of a post, and the page says so.
 *
 * With `postId` it edits an existing post's caption; the session summary is
 * a snapshot and cannot change.
 */
export function PostComposer({
  author,
  session,
  sessionId,
  postId,
  initialCaption = "",
  initialShowsDuration = false,
  cancelHref,
  currentYear,
}: {
  author: Author;
  /** The full summary, with the duration the session has (if any). */
  session: SessionSummary;
  sessionId?: string;
  postId?: string;
  initialCaption?: string;
  initialShowsDuration?: boolean;
  cancelHref: string;
  currentYear: number;
}) {
  const editing = postId !== undefined;
  const [state, action, pending] = useActionState(editing ? updatePostAction : createPostAction, IDLE);
  const [caption, setCaption] = useState(initialCaption);
  const [showsDuration, setShowsDuration] = useState(initialShowsDuration);
  const captionId = useId();
  const counterId = useId();
  const errorId = useId();
  const hasDuration = session.durationMinutes != null;
  // When editing, `session` is the post's own snapshot, already as shared.
  const shared: SessionSummary = editing ? session : { ...session, durationMinutes: showsDuration ? session.durationMinutes : null };
  const over = caption.length > CAPTION_MAX;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      {sessionId ? <input type="hidden" name="sessionId" value={sessionId} /> : null}
      {postId ? <input type="hidden" name="id" value={postId} /> : null}

      <div className="min-w-0 space-y-5">
        <div>
          <label htmlFor={captionId} className="text-sm font-medium">
            Caption
          </label>
          <textarea
            id={captionId}
            name="caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={5}
            aria-describedby={`${counterId}${state.status === "error" ? ` ${errorId}` : ""}`}
            aria-invalid={over || undefined}
            placeholder="How it went, what’s next, or why this one matters."
            className={`${fieldClass} min-h-32 resize-y leading-6`}
          />
          <p id={counterId} className={`mt-1 text-right text-xs tabular-nums ${over ? "text-red-800" : "text-stone-600"}`}>
            {caption.length}/{CAPTION_MAX}
            {over ? " — too long" : ""}
          </p>
        </div>

        {editing ? (
          <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-700">
            The session summary is fixed when you post, so it stays true even if you change or delete the session later.
          </p>
        ) : (
          <fieldset>
            <legend className="text-sm font-medium">Share from this session</legend>
            <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
              <li className="flex items-center gap-2">
                <Tick /> Name, type and date
              </li>
              <li>
                <label className={`flex items-center gap-2 ${hasDuration ? "cursor-pointer" : "text-stone-500"}`}>
                  <input
                    type="checkbox"
                    name="showsDuration"
                    checked={showsDuration}
                    disabled={!hasDuration}
                    onChange={(event) => setShowsDuration(event.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {hasDuration ? "Duration" : "Duration (this session has none)"}
                </label>
              </li>
            </ul>
            <p className="mt-3 text-xs leading-5 text-stone-600">
              Never shared: the start time, your notes, the exercises and anything you logged. Posting doesn’t mark the session as done.
            </p>
          </fieldset>
        )}

        {state.status === "error" ? (
          <p id={errorId} role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary} disabled={pending || over} aria-busy={pending}>
            {pending ? (editing ? "Saving…" : "Posting…") : editing ? "Save changes" : "Post update"}
          </button>
          <Link href={cancelHref} className={btnSecondary}>
            Cancel
          </Link>
        </div>
      </div>

      <section aria-labelledby="preview-title" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="preview-title" className="text-sm font-medium">
            Preview
          </h2>
          <VisibilityBadge visibility={author.visibility} />
        </div>
        <div data-testid="post-preview" className="ui-panel mt-2 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <SocialAvatar displayName={author.displayName} username={author.username} avatarUrl={author.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{author.displayName}</p>
              <p className="truncate text-xs text-stone-600">@{author.username} · just now</p>
            </div>
          </div>
          {caption.trim() ? (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-7 [overflow-wrap:anywhere]">{caption.trim()}</p>
          ) : (
            <p className="mt-3 text-sm italic text-stone-500">Your caption appears here.</p>
          )}
          <div className="mt-3">
            <SessionSummaryBlock session={shared} currentYear={currentYear} />
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-600">
          {author.visibility === "private"
            ? "Seen by you and the followers you’ve approved."
            : "Seen by any signed-in TrainGrid member who visits your profile, and in your followers’ feeds."}
        </p>
      </section>
    </form>
  );
}

function Tick() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}
