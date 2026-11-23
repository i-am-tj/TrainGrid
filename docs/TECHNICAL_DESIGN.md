# TrainGrid — Technical design

Current as of TrainGrid 1.0 (November 2026). The decision record behind this design is
[ADR 001](adr/001-multi-user-supabase-architecture.md); the step-by-step reasoning is in
`agents/DECISIONS.md`.

## Stack

| Dependency | Why |
| --- | --- |
| **Next.js 16** (App Router) | Server Components, Server Actions, route proxy; deployed on Vercel. |
| **TypeScript** | Domain and database types (`lib/database.types.ts` is generated from the schema). |
| **Tailwind CSS** | Layout without a component library. |
| **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) | PostgreSQL, Row Level Security, Auth (Google and GitHub OAuth), cookie sessions. |
| **Zod** | Server-side validation of every mutation and of stored snapshots. |
| **gray-matter** | Seed tooling only: reads the Markdown templates in `data/templates/`. |

There is no ORM. Schema changes are SQL migrations in `supabase/migrations/`.

## Architecture

```text
GitHub ──push──▶ Vercel (Next.js, functions in syd1)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Supabase Auth           Supabase Postgres (ap-southeast-2)
  Google, GitHub          profiles, invitations, routines,
  cookie sessions         workout_items, scheduled_sessions
                                │
                          Row Level Security
```

Vercel functions run in Sydney (`vercel.json`), next to the database, because every page makes
several database calls.

## Security model

Every private record is protected twice, and neither layer relies on the other.

1. **Application.** `proxy.ts` turns away requests without a session (pages → `/login`, API →
   401) and fails closed if Supabase is not configured. Every page and server action then calls
   `requireMember()` / `memberData()`, which reads the user from the verified session and checks
   membership. No user id or owner is ever read from a request. The data layer also narrows every
   query by that user id.
2. **Database.** Row Level Security restricts every row to its owner **and** requires active
   membership (`is_member()`). GLOBAL routines are readable by members and writable by no API role.
   `invitations` has no policies at all.

Membership means “has a `profiles` row that is not revoked”. That row is created only by
`accept_invitation()`, which takes no arguments, reads the caller’s own confirmed email from Supabase
Auth, requires it to come from a Google or GitHub identity, and matches it against a live invitation.

The secret key bypasses RLS. It is read only in `lib/supabase/admin.ts` (marked `server-only`) and
used only for invitation management, after a server-side admin check. Admins are listed by user id
in `TRAINGRID_ADMIN_USER_IDS`.

The social layer (profiles, follows, posts) adds one rule: other members' rows are visible only
while that member is active, and posts only to the people the author's visibility allows. Helpers
that need to look past RLS for that are `SECURITY DEFINER` functions in the `private` schema, which
the API does not expose ([ADR 002](adr/002-members-only-social-layer.md)).

More: [SECURITY.md](SECURITY.md).

## Data model

```text
auth.users.id
      │
      ▼
profiles.id ── revoked_at
      ├── routines.owner_user_id          (PERSONAL; GLOBAL routines have none)
      │       └── workout_items.routine_id
      └── scheduled_sessions.user_id
              ├── snapshot (jsonb copy of the workout)
              └── workout_logs.session_id   (one per session: the sets actually done)

invitations (email, invited_by, accepted_at, accepted_by, revoked_at)
      └── invitation_email_deliveries (one row per send attempt; service role only)

member_feedback (user_id, kind, message, page_path; insert-only for members)

profiles.id
      └── social_profiles.user_id   (optional; username, display_name, bio, visibility)
              ├── follows (follower_id, followee_id, status pending|accepted)
              └── session_posts.author_id   (caption + snapshot of name, category, date, duration,
                      │                        and opt-in workout totals: sets, volume)
                      ├── session_id → scheduled_sessions (provenance; never readable by API roles)
                      ├── post_likes (post_id, user_id)
                      └── post_comments (id, post_id, author_id, body)
```

| Table | Key columns | Rules |
| --- | --- | --- |
| `profiles` | `id` = auth user id, `display_name`, `avatar_url`, `revoked_at` | Created only by `accept_invitation()`. Members read their own row; cannot change `revoked_at`. |
| `invitations` | `email` (lower-case), `accepted_at`, `accepted_by`, `revoked_at` | One live invitation per email. No member access. |
| `routines` | `scope` (`GLOBAL`/`PERSONAL`), `owner_user_id`, `slug`, `name`, `category`, `description` | Check constraint: GLOBAL ⇔ no owner. Only GLOBAL routines have slugs. |
| `workout_items` | `routine_id`, `name`, `instruction`, `rest`, `target`, `notes`, `equipment[]`, `video_url`, `sort_order` | Planned fields only — no performed-workout data. Access follows the routine. |
| `scheduled_sessions` | `user_id`, `date`, `start_time`, `name`, `category`, `duration_minutes`, `notes`, `source_routine_id`, `snapshot` | `source_routine_id` is provenance only and is cleared if the routine is deleted. |
| `workout_logs` | `user_id` (defaults to the caller), `session_id` (unique), `status`, `started_at`, `finished_at`, `unit`, `entries` | Strictly the member's own rows, active members only. `session_id` must be the caller's session and cannot be changed; deleted with the session. |
| `invitation_email_deliveries` | `invitation_id`, `status` (`preparing`/`accepted`/`failed`), `failure_code`, `provider_message_id` | Closed to API roles; written by admin actions with the secret key. |
| `member_feedback` | `user_id` (defaults to the caller), `kind`, `message`, `page_path` | Members may insert their own rows only (column grant + RLS), at most 10 per 24 h; nobody reads it through the API. |
| `social_profiles` | `user_id` (defaults to the caller), `username` (unique, lower-case), `display_name`, `bio`, `visibility` (`private` default / `public`), `use_identity_avatar`, `avatar_url` (trigger-filled) | Optional. Basic identity visible to active members; only the owner writes it. |
| `follows` | (`follower_id`, `followee_id`) key, `status` (`pending`/`accepted`), `accepted_at` | Status set by trigger from the followed profile's visibility; only the followed member approves; either side deletes. |
| `post_likes` | (`post_id`, `user_id`) key | Visible where the post is; members insert and delete only their own. [ADR 003](adr/003-quick-workouts-likes-comments.md). |
| `post_comments` | `post_id`, `author_id` (defaults to the caller), `body` (1–500) | Visible where the post is; deleted by their author or the post's author; not updatable; 100 a day. |
| `session_posts` | `author_id` (defaults to the caller), `caption`, `shows_duration`, `session_name`, `session_category`, `session_date`, `session_duration_minutes`, `session_id` | Snapshot filled by trigger from the author's own session and never updatable; `session_id` not granted to API roles. Visible per [ADR 002](adr/002-members-only-social-layer.md). |

Ownership columns are not updatable by members, so a row can never be reassigned. Exact shapes and
formats: [DATA_FORMAT.md](DATA_FORMAT.md).

### Snapshots

A scheduled session always holds its own copy of the workout:

- Scheduling a routine copies its items into `snapshot`, each with a new id and the id of the item
  it came from.
- Editing or deleting the routine never changes the session.
- Customising a session rewrites only that session’s snapshot; items keep their ids where they
  already belong to the snapshot.

Item ids are stable UUIDs, so a workout log refers to the snapshot item each set belongs to, and a
future exercise catalogue can too, without changing this model. “Last time” matches exercises by
name across the member's recent completed workouts.

## Code structure

```text
app/                         routes (see Routing)
proxy.ts                     session refresh + route protection
components/
  planner/                   WeekGrid, DayAgenda, WeekNav, SessionCard
  session/                   AddSessionForm, EditSessionForm, CustomizeForm, WorkoutItemsView
  library/                   LibraryHeader (view control), RoutineList, RoutineDetail,
                             CopyRoutineButton, SourceLabel, RoutineEditor, WorkoutItemEditor
  admin/                     InvitationForms
  auth/                      SignOutButton
  LogoLoader,                the spinning-logo loader; NavigationLoader shows it for client
  NavigationLoader           navigations to another path (root layout, not loading.js, so 404s
                             and redirects keep their status); pages stream sections with Suspense
  AppHeader, MobileMenu,     header with logo and Beta badge; phone menu (<details>);
  BrandLogo, ThemeToggle     light/dark switch (a `dark` class on <html>, set before first paint
                             by an inline script in app/layout.tsx; dark colours in globals.css)
lib/
  actions.ts                 planner and library server actions
  library/                   URL query contract, search and filters (pure), card summaries
  data/                      routines, sessions, export, schemas (Zod), mappers, server (memberData)
  auth/                      sign-in actions, invite check, session/viewer, redirects, route rules
  admin/                     admin guard, invitation functions and actions
  supabase/                  browser, server, proxy and secret-key clients; env validation
  seed/, legacy/             seed conversion, item id lock, one-time legacy import (not used at runtime)
  calendar-date.ts, week.ts  ISO weeks and dates (UTC arithmetic for stored dates)
supabase/
  migrations/                schema, RLS, functions
  tests/database/            pgTAP tests
  seed.sql                   GLOBAL routines, generated from data/templates/*.md
```

### Server actions

| Action | Does |
| --- | --- |
| `createScheduledSession` | Schedule a routine (snapshot) or create a blank session |
| `updateScheduledSession` | Change date, time, name, type, duration, notes |
| `customizeScheduledSession` | Replace one session’s workout items |
| `deleteScheduledSessionAction` | Delete one session |
| `upsertRoutineAction`, `deleteRoutineAction` | Create, edit, delete the member’s own routine |
| `copyRoutineAction` | Copy a GLOBAL routine into the member’s library; opens the copy with `?copied=1` |
| `signInWithProvider`, `signOut` | OAuth start (PKCE, account chooser) and sign-out |
| `inviteAction`, `revokeAction` | Admin only: invite; revoke a pending invitation or a member’s access |

Each starts from the verified member and passes input to the data layer, which validates it with Zod.
Saving a routine is one database call (`save_personal_routine()`, security invoker), so its items are
replaced in a single transaction. Copying uses the same call: `copyGlobalRoutine()` loads the
source with the member’s own client, requires it to be GLOBAL (anything else is “not found”), and
saves the content without item ids, so the copy gets new ids and a failed copy leaves nothing.

### Library list

`listLibraryRoutines()` makes **one** request: the member’s visible routines (GLOBAL and their
own) with each routine’s item names and equipment embedded, capped at 500 routines with a notice
if the cap is reached. Views, search and filters are pure functions (`lib/library/query.ts`) over
that result. The URL is the only state: `scope`, `q` (whitespace collapsed, at most 100
characters), `type`, `equipment`; invalid values fall back to defaults. The heading and view
control live in the `(list)` layout, which stays mounted across navigations so the view pill can
slide; its `loading.tsx` applies to `/library` only, so detail pages keep real 404s and redirects.

## Routing

| Route | Access | Purpose |
| --- | --- | --- |
| `/login` | Public | Sign in; invite-only and error messages |
| `/auth/callback` | Public | OAuth return: code exchange, then invitation check |
| `/api/health` | Public | `ok` / `unconfigured` / `unreachable`, plus schema `ok` / `behind` / `unknown` only |
| `/` | Public | Landing page, identical for every visitor |
| `/privacy`, `/terms`, `/whats-new` | Public | Information pages; members keep their header |
| `/home` | Member | Today, the week's counts, getting started, routines (each section streams) |
| `/profile` | Member | Identity, plan numbers, data download, appearance, time zone, About TrainGrid, sign out |
| `/week/[weekId]` | Member | Planner (`?day=` selects the mobile day); `/week/current` redirects to the member's today |
| `/week/[weekId]/add` | Member | Add session (`?routine=<id>`, legacy `?template=<slug>`) |
| `/session/[id]`, `/edit`, `/customize` | Member (owner) | Session detail and forms; 404 for anyone else |
| `/library`, `/library/new` | Member | Routine list (`?scope=global\|mine`, `q`, `type`, `equipment`); new personal routine |
| `/library/[routineId]`, `/edit` | Member | Routine detail (Schedule, Copy to My Library, `?copied=1` confirmation); editor for own routines only. Legacy slug URLs redirect |
| `/api/export` | Member | The member’s own data as JSON; 401 otherwise |
| `/admin/invitations` | Admin | Invitation management; 404 for everyone else |

Breakpoint `md`: week grid above, day agenda below.

## Planner layout rules

- Desktop: CSS grid, 8 columns, 24 hour rows, scrolls; initial view about 06:00.
- A card sits in its start-hour row only; duration is a label, not a height.
- Same-hour sessions stack; untimed sessions sit in the untimed lane.
- Mobile: one day at a time with a week strip and next/previous day.

## Migrations, seed and environments

- Migrations are applied locally by `npm run db:reset` and to production only by the owner with
  `npx supabase db push --remote` after a dry run. Nothing applies them automatically.
- `supabase/seed.sql` is generated by `npm run seed:generate` from `data/templates/*.md`; it is
  idempotent (fixed ids) and applied only with `--include-seed`. Item ids never move to a different
  exercise: optional `Key:` lines and the id lock `data/templates/seed-ids.json` enforce it
  ([CONTENT.md](CONTENT.md)).
- Development and tests use a local Supabase stack in Docker. Only Vercel Production has production
  credentials; preview deployments have none and sit behind Vercel Authentication.

Details: [SUPABASE_SETUP.md](SUPABASE_SETUP.md), `supabase/README.md`.

## Important tradeoffs

| Choice | Benefit | Cost |
| --- | --- | --- |
| Supabase for database and auth | One free service; RLS understands the signed-in user | Free-tier limits; vendor features |
| RLS plus application checks | A bug in one layer does not leak data | Some duplicated checks |
| Snapshots instead of live links | Past and planned sessions never change unexpectedly | Fixing a routine does not fix sessions already scheduled |
| Structured item fields | Ready for filtering and future logging | More form fields (kept compact under “More details”) |
| Invite links sent by hand | No email provider or cost | The admin passes on the link |
| Revoke keeps data | Reversible | Data of former members stays in the database |
| Forms, not drag-and-drop | Works on phones | Extra taps to move a session |
