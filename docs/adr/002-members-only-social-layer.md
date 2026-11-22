# ADR 002: A members-only social layer (profiles, following, session posts)

- Status: accepted
- Date: 2026-11-22
- Migration: `supabase/migrations/20261122000000_social.sql`

## Context

Members asked to share how their training is going with each other. TrainGrid is invite-only and
every plan is private to its owner (ADR 001). Any social feature has to keep both of those true:
nothing about a plan may leak unless the member deliberately shares it, and nothing is visible
outside the membership.

## Decision

### 1. An opt-in social profile, separate from `profiles`

`social_profiles` is a new table, one optional row per member. `profiles` stays what it was (the
membership record, readable only by its owner), so no existing column becomes visible to anyone.
Existing members have no social profile until they create one, so nobody appears in discovery
without choosing to. New profiles are **private** by default.

- Usernames: 3-30 characters, lower-case letters, digits and single underscores, stored
  lower-case under a unique index; route words (`feed`, `people`, `requests`, `settings`, …) are
  reserved in a check constraint.
- Display name (1-60), bio (≤ 160), visibility (`private` | `public`).
- Avatar: the member chooses to show their Google or GitHub picture (a trigger copies it from
  `profiles.avatar_url`) or initials. A URL is never typed in, so a profile cannot point other
  members' browsers at an arbitrary host. No uploads (no Supabase Storage, L-06).

### 2. Following is one row per pair, with a database-decided status

`follows (follower_id, followee_id, status, created_at, accepted_at)`, primary key on the pair,
`follower_id <> followee_id`. Members may insert only `followee_id`: the follower defaults to the
caller and the **status is set by a trigger** (`accepted` for a public profile, `pending` for a
private one). Only the followed member may update a row, and only `pending → accepted`. Either
side may delete (unfollow, cancel, decline, remove a follower). Making a profile public approves
waiting requests.

### 3. Posts carry a snapshot, never the session

`session_posts` holds a caption (≤ 500) and a copy of the session's **name, category, date and,
only if the member ticks it, duration**. The copy is made by a `BEFORE INSERT` trigger that runs
with the caller's rights, so it finds only the caller's own session; members cannot supply or
later change the snapshot (no column grants). Start time, notes, exercises and workout logs are
never copied. `session_id` is kept for provenance (set to null if the session is deleted) but is
**not readable through the API at all**, so a post link never reveals the session behind it.
This mirrors the scheduling snapshot (D-03): later edits never rewrite what was posted. Posting
never touches `workout_logs`, so a post never marks a session as done.

### 4. Visibility is decided in the database

| What | Who can see it |
| --- | --- |
| Basic identity (username, name, bio, picture, visibility, counts) | Every active member |
| Posts | The author; every active member if the profile is public; otherwise accepted followers |
| A relationship (followers / following lists) | The two members; otherwise anyone who may see the **followed** profile's posts |
| Pending requests | Only the two members |
| Anything | Never anonymous visitors, signed-in non-members or revoked members |

A revoked member's profile, posts and relationships disappear for everyone and return if they are
invited again, like the rest of their data (D-58). Removing a follower, cancelling, unfollowing or
switching to private takes effect on the very next query: there is no cache of who may see what.

The rule for relationship rows (the followed profile decides) means a private profile's followers
cannot be read through a public follower's "following" list.

### 5. Definer helpers live in a schema the API does not expose

Policies need facts the caller's RLS hides (another member's `revoked_at`, accepted-follow counts).
Those helpers are `SECURITY DEFINER` functions in a new `private` schema, which PostgREST does not
serve, so they can be used by policies but never called through `/rest/v1/rpc`. Every function in
`public` added here (`social_profile`, `social_posts`, `search_social_profiles`) is `SECURITY
INVOKER`: RLS applies to everything they read. `accept_invitation()` remains the only definer
function in `public` that signed-in users can execute (pinned by
`07_function_exposure.test.sql`). The app never uses the secret key for social data.

### 6. Keyset pagination, one function for feed and timelines

`social_posts(p_author, p_before_created_at, p_before_id, p_limit)` returns the feed (own posts plus
accepted follows) when `p_author` is null, or one member's timeline, newest first, keyed on
`(created_at, id)` with an index on `(author_id, created_at desc, id desc)`. The app reads one row
more than it shows to know whether there is a next page, and passes an opaque, validated cursor in
the URL (`?before=`), so pages work without JavaScript and never skip or repeat a post.

### 7. Limits

20 posts and 100 new follows per member per 24 hours (triggers), search needs 2-60 characters and
returns at most 20 rows, connection lists are paged by 50, captions are ≤ 500 characters. The
service role (local seeding, support) is exempt from the post limit and may date a post, but still
only from the author's own session.

### 8. No crawling, caching or previews of social pages

All social routes are members-only (the proxy and `requireMember()`), rendered per request, carry
`robots: noindex, nofollow, noarchive, nosnippet` and an `X-Robots-Tag` header (`next.config.ts`),
and use generic titles ("Profile · TrainGrid") so no member's name reaches tab titles, history sync
or link previews.

## Consequences

- Posts are text plus a session summary. Photos, likes, comments and performance sharing are out
  of scope for this release and would each need their own decision.
- Search uses `pg_trgm` GIN indexes on username and lower-cased display name.
- The data download (`traingrid-export` v4) includes the member's social profile, relationships
  (by username) and posts.
- Deleting a social profile deletes its posts and relationships; the plan is untouched.
- If the app is deployed before this migration reaches the database (as happened on 2026-11-22),
  the API answers "not found" for the social tables. `lib/social/availability.ts` turns those
  answers (`PGRST205`, `PGRST202`, `42P01`, `42883`, `3F000`, and a `HEAD` count that comes back
  empty) into a `SocialUnavailableError`: social pages show a calm "not available yet" panel,
  actions show the same message on the form, the header badge stays hidden, and the data download
  still works with an empty `social` section. The migration should still be applied before or with
  the deploy.
- Blocking and reporting are not part of this release. Because profiles are private by default and
  removing a follower is immediate, a member can always cut someone off; a block list is a natural
  next step.
