# Decisions

Last updated: 2026-11-12

Status values: **LOCKED** (approved in the epic), **APPROVED** (resolved by Tanuj, final for
Epic 1), **DEFERRED** (explicitly not in Epic 1), **PROPOSED** (agent recommendation, followed
unless Tanuj objects). There are no open decisions.

## Locked by the epic

| ID | Decision |
| --- | --- |
| L-01 | Hosting: Vercel Hobby, deployed by the GitHub → Vercel Git integration |
| L-02 | Authentication: Supabase Auth, Google and GitHub OAuth only |
| L-03 | Database: Supabase PostgreSQL, Free plan; all mutable production data lives there |
| L-04 | Authorization: server-side checks and Row Level Security, both mandatory |
| L-05 | Clients: `@supabase/supabase-js` + `@supabase/ssr`; no ORM; SQL migrations |
| L-06 | No Supabase Storage; YouTube references stay external URLs |
| L-07 | Invite-only; no public signup, no passwords |
| L-08 | Apple and ChatGPT sign-in deferred; no placeholder buttons |
| L-09 | No paid service of any kind |
| L-10 | Formal ADR lives at `docs/adr/001-multi-user-supabase-architecture.md` |

## Approved by Tanuj on 2026-11-12

### D-03 Scheduled sessions always snapshot — APPROVED

Scheduling a routine copies its complete workout definition into the scheduled session. There is
no "follows template" mode; this is the only scheduling behaviour.

- Editing the source routine does not change a scheduled session.
- Deleting the source routine does not delete a scheduled session.
- Editing a scheduled session affects only that occurrence.
- Duplicate Week copies the snapshots.
- `source_routine_id` is optional provenance only and never controls session contents. It is set
  to null when the routine is deleted.

### D-04 Workout item structure — APPROVED WITH MODIFICATION

Workout items use explicit structured fields. Nothing is parsed out of a generic details box at
runtime; there are no magic `Rest:` / `Target:` strings.

| Field | Meaning |
| --- | --- |
| `name` | Exercise, movement or workout step name |
| `instruction` | Planned work to perform, e.g. `4 × 5–6` |
| `rest` | Planned recovery instruction, e.g. `2–3 min` |
| `target` | Planned intensity: RPE, pace, HR zone, effort |
| `notes` | Optional coaching or context notes |
| `equipment` | Zero or more equipment tags |
| `video_url` | Optional YouTube/demo reference |
| `sort_order` | Position within the routine |

`instruction` replaces the epic's working name `prescription`. The editor gets one input per
field; Rest, Target, Notes, Equipment and Video may sit under a collapsible "More details"
section to keep it compact. The same field set is used for items inside a session snapshot.

Implementation note: the existing `data/templates/*.md` files are converted to these fields once,
by the seed tooling in step 11. That conversion is migration input handling, not application
behaviour; the running app never parses Markdown bodies.

### D-04A Planned definitions stay separate from performed logs — APPROVED

Routine workout items and session snapshots describe what the user plans to do. No performed
data (`actual_weight`, `actual_reps`, `actual_rpe`, `completed_sets`, or similar) is added to
them in Epic 1. The intended future chain is:

```
Routine → Routine Workout Item → Scheduled Session Snapshot
        → Performed Workout → Exercise Log → Set Logs
```

Performed-set data (weight, reps, RPE, set number, completed-at) will live in its own tables
referencing the scheduled session, so progressive-overload features can be added without
reshaping the routine or calendar model.

### D-04B Exercise identity — DEFERRED, designed for

No exercise catalogue in Epic 1. To keep the door open for a later `exercises` table and an
`exercise_id` on items:

- Workout items have stable UUID primary keys.
- Each item copied into a session snapshot gets its own stable UUID, and records the id of the
  routine item it came from.
- Nothing keys off an item's display name.

### D-05 Library behaviour during Epic 1 — APPROVED, with scope boundary

- The existing templates are seeded as GLOBAL routines: visible to members, read-only to them,
  managed as system content.
- The existing routine editor is kept and writes PERSONAL routines. A member can create, view,
  edit and delete their own.
- Not in Epic 1: polished Global / My Library navigation, advanced filtering, richer search,
  global-to-personal copy workflows, and any global-library management UI.

### D-06 Backup / export — APPROVED

- Export is kept and is scoped entirely to the signed-in user: their personal routines, those
  routines' workout items, and their scheduled sessions.
- Export never contains another user's data, invitation or admin data, Supabase Auth internals,
  or any secret. GLOBAL routines are not included; snapshots already carry the scheduled content.
- Hosted import is removed: no import UI and no import endpoint in Epic 1. It may return later
  with explicit handling of validation, ownership, conflicts, duplicates, schema versions and
  security.

## Proposed — will proceed unless objected to

| ID | Decision | Reason |
| --- | --- | --- |
| D-01 | Membership is "a `profiles` row exists". The row is created only by a `security definer` database function that checks the caller's verified email against a valid invitation and marks it accepted. Every RLS policy on user data requires membership as well as ownership. | An OAuth user who is not invited can obtain a Supabase session but can read or write nothing, even by calling the database API directly. Invite enforcement does not depend on application code. |
| D-02 | DEFERRED. Blocking uninvited sign-ups at the auth layer with a Supabase "before user created" hook was considered and not built in step 7. | It is tidiness, not security: an uninvited person can get an `auth.users` row but D-01 gives them no access, and the callback signs them out. Revisit if stray auth users become a nuisance. |
| D-07 | `invitations` has RLS enabled and no policies for members. Admin server actions check the caller against `TRAINGRID_ADMIN_USER_IDS` and then use the secret key. This is the only use of the secret key in the app. | The database cannot see an environment variable, so admin rights cannot be expressed as a policy without adding a role table. Denying everyone at the database and gating on the server is the smallest secure design. |
| D-08 | Invitation delivery uses the manual fallback: the admin page records the email and shows a sign-in link to send by hand. | Supabase's built-in invite email creates an email-link identity, which conflicts with OAuth-only sign-in. |
| D-09 | Development and automated tests run against a local Supabase stack (Supabase CLI + Docker). Only Vercel Production holds production Supabase values; Preview gets none. | One free cloud project, and no path from a laptop or preview build to production data. |
| D-10 | Zod for server-side validation of every mutation. | No validation library exists in the project today. |
| D-11 | Routine, workout item and session ids are UUIDs. Seeded GLOBAL routines also keep their old slug in a `slug` column. | Matches the epic's model; slugs keep the seed idempotent. |
| D-12 | `scheduled_sessions` keeps `duration_minutes` and `notes` in addition to the epic's columns, and stores a real `date` instead of `weekId` + `day`. | Both fields exist in the current planner and must be preserved; week and weekday are derived from the date. |
| D-13 | Next.js 16 `proxy.ts` refreshes the auth session and redirects anonymous visitors; every server data function still authenticates on its own. | Route protection alone is explicitly not sufficient. |
| D-14 | These records live in `agents/` and are committed. The older `.agent/` folder stays untracked and untouched. | Records should be reviewable alongside the PRs they describe. |
| D-15 | `snapshot` is a versioned JSON document: `{ "version": 1, "items": [ { id, source_item_id, name, instruction, rest, target, notes, equipment, video_url } ] }`, with array order as display order. Its shape is validated by Zod on every write and by a database check that it is an object with an `items` array. | Follows from D-03, D-04 and D-04B; the version field lets the shape evolve. |
| D-17 | Tables enable RLS in the migration that creates them, with no policies, so they are closed until step 3 opens them. Privileges are granted explicitly: `anon` gets nothing; members cannot update ownership or identity columns (`user_id`, `owner_user_id`, `scope`, `routine_id`, `id`) and cannot insert or delete `profiles`. | A table is never exposed between two PRs, and a row cannot be reassigned even if a policy is later written too loosely. |
| D-18 | Database tests are pgTAP files in `supabase/tests/database/`, run with `npm run db:test`. Step 3 adds RLS tests there too, alongside the signed-in-client tests. | Runs inside the database with no extra dependency; constraints and policies are tested where they live. |
| D-19 | Categories, scope and equipment are `text` with check constraints, not Postgres enums. | Adding a value later is a one-line constraint change instead of an enum migration. |
| D-20 | Generated TypeScript database types are produced when the data layer first consumes them (step 10), via `npm run db:types`. | Nothing uses them yet, and the generator's raw output is not worth reviewing early. |
| D-21 | Membership is checked by `public.is_member()`, a `security invoker` function, and is required for reading GLOBAL routines and for every insert. An authenticated user without a profile sees nothing at all. | Implements D-01 without a privileged function; the caller can only ever see their own profile row. |
| D-22 | A scheduled session may only name a `source_routine_id` the caller can see. | Stops one member probing for, or attaching to, another member's personal routine. |
| D-23 | GLOBAL routines have no write policy for any API role; they are managed with the service role only. | Epic 2 owns global-library management; until then no member path can change shared content. |
| D-24 | Local `.env.local` points at the local Supabase stack. Production values are entered only in Vercel (Production). | Applies D-09: a laptop never holds production configuration. Supersedes the earlier note that the cloud URL and key go in `.env.local`. |
| D-25 | The production project was created with the GitHub integration not connected, "Automatically expose new tables" off and "Enable automatic RLS" on. | Migrations are applied deliberately at rollout and grant access explicitly; automatic RLS is a safety net. |
| D-26 | Until Supabase is configured for a deployment, the session proxy passes requests through and the app behaves as before. Route protection (step 9) will fail closed instead. | Keeps production working between PRs; nothing is protected by the proxy yet. |
| D-27 | `GET /api/health` is public and returns only `ok`, `unconfigured` or `unreachable`. | Lets the Vercel → Supabase connection be verified without exposing configuration. |
| D-28 | The Supabase env reader throws if a secret or service-role key is put in the public key variable. | Turns the most damaging misconfiguration into an immediate failure. |
| D-29 | Real Google and GitHub sign-in is verified on production only. Local development and automated tests use throwaway users in the local stack; OAuth providers are not configured locally and no local address is added to the production project. | Applies D-09 and D-24. Deviates from the epic's "test the local flow" task for OAuth specifically; everything around the provider hop is tested locally. |
| D-30 | The Email provider is disabled in the production project. | Supabase enables email sign-up by default, which would allow public registration through the API regardless of the UI. |
| D-31 | OAuth is started by a server action and completed by `/auth/callback` with PKCE. After sign-in the user is only ever redirected to a same-site path; `/login` and `/auth/*` are never redirect targets. | No client-side auth code, and no open redirect through the `next` parameter. |
| D-32 | `/login` exists from step 5 but is not linked from the app, and signing in grants nothing until the invitation model (step 7) and the cut-over (step 12). | Lets production OAuth be verified early. An authenticated user without a profile can read and write nothing (RLS). |
| D-33 | No custom account linking. Supabase's built-in behaviour is relied on: identities with the same verified email resolve to one user; different emails are different users. | The epic forbids a custom linking system unless Supabase does it safely, which it does for verified emails only. |
| D-34 | A provider account without a usable verified email is refused with a specific, fixed explanation; all other failures stay generic. The callback recognises this case from the error Supabase returns. | The person can fix it themselves, and invite validation is never bypassed. The exact Supabase error text is matched loosely on the word "email" and has not been reproduced with a real email-less GitHub account. |
| D-35 | `accept_invitation()` takes no arguments and derives everything from the caller's own identity. It reads the email from `auth.users`, requires it to be confirmed and to belong to a Google or GitHub identity of that user, and matches it case-insensitively. | Nothing in a request can influence who gets accepted, and an email/password identity can never satisfy an invitation even if the Email provider were re-enabled by mistake. |
| D-36 | The callback grants access only on an explicit `member` result. Any other result, or any error calling the function, signs the user out and shows a fixed message. | Fails closed. |
| D-37 | An accepted invitation cannot be revoked, and removing an existing member is not part of Epic 1. | The epic asks only for revoking unused invitations and excludes user management. |
| D-38 | Production migrations are applied by Tanuj from a terminal with `supabase db push`, starting at step 7. The first invitation is inserted once in the dashboard SQL editor. | The callback needs the schema in production; the admin page (step 8) needs an existing member to bootstrap. No personal email goes into a migration. |
| D-39 | E2E tests make a local user a member by inserting a profile with the local stack's secret key, guarded to local URLs only. The real provisioning path is covered by the database tests. | `accept_invitation()` needs a Google or GitHub identity, which cannot be created through local sign-up. |
| D-40 | Vercel functions run in `syd1` (`vercel.json`). | The production Supabase project is in `ap-southeast-2` (Sydney); functions were running in `iad1` (US East), so every Supabase call crossed the Pacific. Measured before the change: `/api/health`, one Supabase call, took about 1.2 s. |
| D-41 | OAuth requests carry `prompt=select_account`, so the provider shows an account chooser on every sign-in. | Signing out of TrainGrid does not sign out of Google or GitHub; without this GitHub silently reused the last account. |
| D-42 | A Sign out button is in the header on every page for any signed-in user, with an immediate pending state. | Feedback from Tanuj on 2026-11-12: sign-out was only reachable from `/login` and gave no feedback while it worked. |
| D-43 | OPEN. Google's consent screen says "continue to <project>.supabase.co". | It names the domain of the OAuth redirect. Showing TrainGrid there needs either a Supabase custom domain (paid, so excluded) or switching Google to its own sign-in button with an ID-token hand-off (free, more code). Awaiting Tanuj's choice. |
| D-44 | Non-admins get a 404 from `/admin/invitations` and from its server actions, the same as a page that does not exist. An admin must also be a member. | Does not reveal that an admin area exists, and a listed id without a profile gets nothing. |
| D-45 | The admin check lives inside each invitation function (`listInvitations`, `createInvitation`, `revokeInvitation`), before the secret-key client is created, not only in the page. | A server action can be invoked without rendering the page; authorization must not depend on the route. |
| D-46 | The header shows an Invitations link to admins. It is display only. | Convenience; the page and actions re-check. |
| D-16 | GLOBAL routines are seeded by a local script using the secret key, run by hand per environment; the seed content is generic and is not a schema migration. | D-05 excludes a management UI; the epic keeps seed data separate from migrations. |
