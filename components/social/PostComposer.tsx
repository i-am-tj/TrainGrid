"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { createPostAction, updatePostAction } from "@/lib/social/actions";
import { IDLE } from "@/lib/social/form-state";
import { CAPTION_MAX, formatMinutes, type SessionSummary, type Visibility, type WorkoutShare } from "@/lib/social/model";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";
import { SessionSummaryBlock, VisibilityBadge } from "./parts";
import { SocialAvatar } from "./SocialAvatar";

type Author = { username: string; displayName: string; avatarUrl: string | null; visibility: Visibility };

/** The session's finished workout, as the database will summarise it when posting. */
export type FinishedWorkout = { minutes: number; sets: number; volume: number; unit: "kg" | "lb" };

/**
 * Writes a session update. The preview on the right (below, on phones) is
 * exactly what followers will see. On phones the submit button comes after
 * the preview and its audience, in reading and Tab order, so the author
 * reviews before posting (UI_DESIGN_AUDIT rank 5): the caption, the session's name,
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
  workout = null,
  postedWorkout,
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
  /** When posting: the session's finished workout, if any. */
  workout?: FinishedWorkout | null;
  /** When editing: what the post already shares from its workout. */
  postedWorkout?: WorkoutShare;
  cancelHref: string;
  currentYear: number;
}) {
  const editing = postId !== undefined;
  const [state, action, pending] = useActionState(editing ? updatePostAction : createPostAction, IDLE);
  const [caption, setCaption] = useState(initialCaption);
  const [showsDuration, setShowsDuration] = useState(initialShowsDuration || workout !== null);
  const [showsSets, setShowsSets] = useState(workout !== null && workout.sets > 0);
  const [showsVolume, setShowsVolume] = useState(false);
  const captionId = useId();
  const counterId = useId();
  const errorId = useId();
  // A finished workout's real time beats the planned duration (as the database does).
  const durationToShare = workout ? workout.minutes : session.durationMinutes;
  const hasDuration = durationToShare != null;
  // When editing, `session` is the post's own snapshot, already as shared.
  const shared: SessionSummary = editing ? session : { ...session, durationMinutes: showsDuration ? durationToShare : null };
  const sharedWorkout: WorkoutShare | undefined = editing
    ? postedWorkout
    : workout
      ? {
          completed: true,
          sets: showsSets && workout.sets > 0 ? workout.sets : null,
          volume: showsVolume && workout.volume > 0 ? workout.volume : null,
          unit: showsVolume && workout.volume > 0 ? workout.unit : null,
        }
      : undefined;
  const over = caption.length > CAPTION_MAX;

  return (
    <form
      action={action}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8"
    >
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
                  {workout
                    ? `Time trained (${formatMinutes(workout.minutes)})`
                    : hasDuration
                      ? "Duration"
                      : "Duration (this session has none)"}
                </label>
              </li>
              {workout && workout.sets > 0 ? (
                <li>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="showsSets"
                      checked={showsSets}
                      onChange={(event) => setShowsSets(event.target.checked)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    Sets done ({workout.sets})
                  </label>
                </li>
              ) : null}
              {workout && workout.volume > 0 ? (
                <li>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      name="showsVolume"
                      checked={showsVolume}
                      onChange={(event) => setShowsVolume(event.target.checked)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    Volume lifted ({workout.volume.toLocaleString("en-AU")} {workout.unit})
                  </label>
                </li>
              ) : null}
            </ul>
            <p className="mt-3 text-xs leading-5 text-stone-600">
              {workout
                ? "Never shared: the start time, your notes, the exercises and the weight or reps of any set."
                : "Never shared: the start time, your notes, the exercises and anything you logged. Posting doesn’t mark the session as done."}
            </p>
          </fieldset>
        )}

      </div>

      <section aria-labelledby="preview-title" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
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
            <SessionSummaryBlock session={shared} workout={sharedWorkout} currentYear={currentYear} />
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-600">
          {author.visibility === "private"
            ? "Seen by you and the followers you’ve approved."
            : "Seen by any signed-in TrainGrid member who visits your profile, and in your followers’ feeds."}
        </p>
      </section>

      <div className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-2 lg:self-start">
        {state.status === "error" ? (
          <p id={errorId} role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={btnPrimary} disabled={pending || over} aria-busy={pending}>
            {pending ? (editing ? "Saving…" : "Posting…") : editing ? "Save changes" : "Post update"}
          </button>
          <Link href={cancelHref} className={btnSecondary}>
            Cancel
          </Link>
          <p data-testid="post-audience" className="text-xs leading-5 text-stone-600">
            {author.visibility === "private" ? "For approved followers" : "For all signed-in members"}
          </p>
        </div>
      </div>
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
