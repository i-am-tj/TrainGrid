# ADR 001 — Multi-user architecture on Supabase

- Status: Accepted (implementation in progress — Epic 1)
- Date: 2026-11-12

## Context

TrainGrid began as a single-user planner. Data lived in files in the repository
(`data/schedule.json`, `data/templates/*.md`), edits were made locally, and the Vercel deployment
was a read-only view of whatever had been pushed. There was no authentication.

The goal now is a small, private, multi-user application: a handful of invited friends, each with
their own schedule, using the hosted site directly. Vercel's filesystem is not writable at
runtime, so file-backed storage cannot support this.

Two constraints shape every choice:

1. **Zero cost.** Everything must stay inside free tiers for friends-only usage.
2. **Isolation must not depend on application code alone.** A bug in a page or server action must
   not be able to expose one person's data to another.

## Decision

| Concern | Choice |
| --- | --- |
| Hosting | Vercel Hobby, production at `https://train-grid.vercel.app` |
| Deployment | GitHub → Vercel Git integration; no separate pipeline |
| Database | Supabase PostgreSQL (Free plan) |
| Authentication | Supabase Auth with cookie-based SSR sessions |
| Sign-in providers | Google OAuth and GitHub OAuth |
| Authorization | Server-side checks in Next.js **and** PostgreSQL Row Level Security |
| Data access | `@supabase/supabase-js` and `@supabase/ssr`; SQL migrations in `supabase/migrations/`; no ORM |
| Secrets | Vercel environment variables; nothing secret in Git |
| File storage | None |

### Why Supabase

- One free service provides both the database and authentication, so there is a single identity
  (`auth.users.id`) that the database itself understands.
- Row Level Security can reference that identity directly (`auth.uid()`), which is what makes
  database-enforced isolation practical without writing a custom authorization layer.
- Google and GitHub sign-in are built in at no cost.
- The alternative of pairing a separate auth product with a separate database adds a second vendor
  and a second free-tier limit, and leaves the database unaware of who the caller is.

### Invite-only model

Signing in with Google or GitHub proves identity; it does not grant access.

- An `invitations` table records which email addresses may become members. It stores no
  credentials. Supabase Auth remains the only owner of identity.
- A person becomes a member when they are authenticated, the provider reports a verified email,
  that email (normalised) matches an invitation that has not been revoked. The invitation is then
  marked accepted and a `profiles` row is created.
- Anyone else who completes OAuth is shown a neutral "invite-only" message and has no access to
  any data.
- There is no sign-up form, no password login and no public registration.
- Admins are identified by a server-side environment variable, `TRAINGRID_ADMIN_USER_IDS`, never
  by anything the browser sends. Admins can create invitations, see their status and revoke unused
  ones. Invitation links are sent by hand; no email provider is added.

### Ownership model

```
auth.users.id
      │
      ▼
profiles.id
      ├── routines.owner_user_id        (PERSONAL routines)
      └── scheduled_sessions.user_id
```

- `profiles.id` is the Supabase Auth user id. There is no second user table.
- `routines` has a `scope` of `GLOBAL` (no owner) or `PERSONAL` (owned by one user); a database
  constraint keeps scope and owner consistent.
- `workout_items` belong to a routine and inherit its access rules.
- `scheduled_sessions` always carry a `user_id`.

### Scheduling is always a snapshot

Adding a routine to the calendar copies its complete workout definition into the scheduled
session. There is no mode in which a session follows its routine.

- Editing or deleting the source routine leaves scheduled sessions untouched.
- Editing a scheduled session changes only that occurrence.
- Duplicate Week copies snapshots.
- `source_routine_id` is optional provenance and never determines what a session contains.

### Workout items are structured, and describe the plan only

A workout item has explicit fields: `name`, `instruction` (the planned work, e.g. `4 × 5–6`),
`rest`, `target` (RPE, pace, zone, effort), `notes`, `equipment` (zero or more tags),
`video_url` and `sort_order`. The application does not parse rest or target out of free text.
Items inside a session snapshot use the same fields.

Routine items and snapshots record what a person plans to do. What they actually did — weights,
reps, RPE, completed sets — is deliberately absent and will be modelled later as separate
entities:

```
Routine → Routine Workout Item → Scheduled Session Snapshot
        → Performed Workout → Exercise Log → Set Logs
```

Keeping the two apart means progressive-overload features can be added without changing the
routine or calendar model.

There is no exercise catalogue yet. Items have stable UUIDs, snapshot items have their own UUIDs
and record which routine item they came from, and nothing depends on an item's display name, so a
shared `exercises` table can be introduced later.

### Library scope in this epic

The existing templates become GLOBAL routines: readable by every member, writable by none of
them. The existing editor is kept for PERSONAL routines, which a member can create, edit and
delete for themselves. Richer library navigation, search, copy-to-personal and global-library
management are left to later epics.

### Export, no import

A signed-in user can export their own personal routines, those routines' items and their
scheduled sessions. The export contains nothing belonging to anyone else and no invitation, auth
or infrastructure data. The hosted application has no import feature.

### Row Level Security strategy

RLS is enabled on every application table. Each private row is protected twice:

1. **Application layer.** The server determines the user from the Supabase session and never
   accepts a user id from the request.
2. **Database layer.** Policies restrict rows to `auth.uid()`:
   - `profiles`: a user reads and updates only their own row.
   - `routines` and `workout_items`: full access to one's own PERSONAL routines; GLOBAL routines
     are readable by members and not writable by them.
   - `scheduled_sessions`: select, insert, update and delete only where `user_id = auth.uid()`.
   - Insert and update policies use `WITH CHECK`, so a row cannot be assigned to someone else.
   - `invitations`: no access for ordinary members.

Normal reads and writes use the signed-in user's client with the publishable key, so RLS is always
in force. The secret key bypasses RLS; it is used only for server-side admin operations and local
one-off scripts, and is never sent to the browser.

### Environment and secrets

| Variable | Exposure |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public by design |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public by design; safety comes from Auth + RLS |
| `SUPABASE_SECRET_KEY` | Server only |
| `TRAINGRID_ADMIN_USER_IDS` | Server only |

Real values live in Vercel. The repository tracks only `.env.example` with placeholders.
Development and automated tests use a local Supabase stack, so nothing outside Vercel Production
can reach production data.

### Filesystem migration

- The app stops reading and writing `data/schedule.json`. A one-time local script can import an
  existing personal schedule for a named user id; personal data is never placed in migrations.
- `data/templates/*.md` remain in the repository as seed input for GLOBAL routines, preserving
  categories, ordering, notes, equipment tags and YouTube links. They are converted to structured
  items once, by seed tooling; the running application never reads them.
- The hosted read-only mode (`TRAINGRID_READONLY`, the published notice, "clone this repo to
  edit") is removed. Production is the application.

## Deferred

| Provider | Status | Reason |
| --- | --- | --- |
| Google | Supported | — |
| GitHub | Supported | — |
| Apple | Deferred | Requires a paid Apple Developer membership, which breaks the zero-cost requirement |
| ChatGPT | Deferred | Waiting for practical, general developer availability |

No placeholder buttons are shown for deferred providers. Also out of scope for this decision:
email/password login, object storage, an ORM, and any paid service.

## Consequences

- Schema and policy changes are reviewed as SQL migrations and tested against a local database.
- Cross-user access tests query the database directly as different users and are release
  blockers, alongside the UI tests.
- The library and calendar features in Epics 2–4 build on the ownership model above without
  further infrastructure.
- Free-tier limits apply: the Supabase Free plan pauses inactive projects and caps database size
  and auth email volume. These are acceptable for a small group and are revisited only if usage
  grows.
- A local Supabase stack (Docker) becomes a development prerequisite.
