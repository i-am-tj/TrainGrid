# ADR 003: Quick workouts, workout totals on posts, likes and comments

- Status: accepted
- Date: 2026-11-23
- Migration: `supabase/migrations/20261123000000_quick_workouts_likes_comments.sql`
- Amends: [ADR 002](002-members-only-social-layer.md) (which kept posts text-only, with no likes or comments)

## Context

Members asked to start training without planning first, then share the workout, and to react to
each other's posts. The owner chose, for this release:

- a quick workout **adds exercises as you go**, using the existing live-workout screen;
- finished workouts are shared **only when the member posts** (nothing is published
  automatically), and the finish leads straight to the post screen;
- a post may carry a **workout summary**: time trained, sets done and volume lifted, each opt-in,
  and never the exercises or individual sets;
- posts get **likes and comments**.

## Decision

### 1. A quick workout is an ordinary session marked `origin = 'quick'`

`scheduled_sessions.origin` is `planned` (default) or `quick`. **Start a workout** on Home creates
a session for the member's today with no plan, and starts its workout log in the same request.
Being a real session, it appears on Home, in the planner and in the data download, and the existing
workout rules (RLS, one log per session) apply unchanged.

- Exercises live in the **workout log**: each logged exercise may now carry `mode`
  (`load` / `reps` / `done`) and `rest_seconds`, optional fields in the existing versioned document,
  so older logs stay valid. Any session without planned exercises runs this way ("free-form").
- At the finish the member **names** it; the session records that name and the minutes trained
  (quick sessions only; planned sessions keep their name and planned duration).
- *Amended 2026-11-25 (PRODUCT_AUDIT F18):* starting and finishing are each **one database
  transaction**: `start_quick_workout()` creates the session and its log together, under a session
  id the form supplies, so a resent start returns the same workout; `finish_workout()` completes
  the log and, for a quick session, records its name and time trained together. Both are security
  invoker, like `save_personal_routine()`.
- **Discarding** a quick workout deletes the session too (it existed only for that workout);
  discarding a planned workout still keeps the session.
- The summary screen's main action is **Post about it**, which opens the usual composer.
  *Amended 2026-11-23 (PRODUCT_AUDIT F16):* **Done** is now the primary action, since finishing is
  the natural end for a member who does not post; **Post about it** stays one tap away beside
  **Edit sets**.

### 2. Workout totals are part of the post's snapshot

As with the session summary (ADR 002), the database copies the totals when the post is created,
from the author's **own completed** workout log, by the security-invoker insert trigger:

- `shows_duration` now means the time actually trained when there is a finished workout (else the
  planned duration);
- `shows_sets` / `shows_volume` (insertable) select whether `workout_sets` / `workout_volume` (+
  `workout_unit`) are copied; the members cannot write those columns, and they never change.
  `private.workout_totals()` computes them with the same rules as `summarize()` in the app.
- `workout_completed` records that the session had a finished workout when posted.

Exercises, set-by-set weights and reps, and workout notes are never copied.

### 3. Likes and comments follow the post's visibility

`post_likes (post_id, user_id)` (one per member per post) and `post_comments (id, post_id,
author_id, body ≤ 500)`. Both reference `social_profiles`, so reacting needs a social profile.

- **Visible** to exactly those who may see the post (`private.can_view_post`, built on ADR 002's
  `can_view_content`), and only from active members. A member always sees their **own** likes and
  comments, so they can take them back even after losing access to the post.
- **Inserted** only as yourself, on a post you can see. **Deleted** by their author; a comment also
  by the post's author. Comments are not edited.
- Limits: one like per post (primary key); 100 comments per member per day (trigger, run as the
  caller).
- Removing a follower, going private or revocation hides likes and comments with the post, on the
  next query.

### 4. The feed function returns everything a card needs

`public.social_posts` (still security invoker) now also returns the workout summary, like and
comment counts and `viewer_liked`, and takes `p_post` to read a single post, so a card is one query
and every count is computed under RLS.

## Consequences

- The data download (`traingrid-export` v5) adds the member's comments and likes.
- The privacy notice describes reactions and workout totals.
- Photos, notifications, mentions, comment editing, blocking and reporting remain out of scope.
