# Architecture

Last updated: 2026-11-12

## 1. Current state (inspected on `main` at `ff3f838`)

Next.js 16.3 App Router, React 19, Tailwind 4, Vitest, Playwright. No database, no auth, no
validation library. Dependencies beyond the framework: `gray-matter`, `react-markdown`.

### Filesystem persistence paths

| Module | What it does |
| --- | --- |
| `lib/paths.ts` | Resolves `data/` (or `TRAINGRID_DATA_DIR`), `data/templates/`, `data/schedule.json` |
| `lib/fs-utils.ts` | `writeAtomic` — temp file then rename |
| `lib/schedule.ts` | Reads and rewrites the whole `schedule.json`; `upsertSession`, `deleteSession`, `sessionsForWeek`, `getSession` |
| `lib/templates.ts` | Reads, writes and deletes `data/templates/*.md` (front matter + Markdown body) |

### Server actions and routes

All mutations are in `lib/actions.ts` and take `FormData`:

| Action | Writes |
| --- | --- |
| `createScheduledSession` | schedule |
| `updateScheduledSession` | schedule |
| `customizeScheduledSession` | schedule (writes `bodySnapshot`) |
| `deleteScheduledSessionAction` | schedule |
| `duplicateWeekAction` | schedule |
| `upsertTemplateAction` | template file |
| `deleteTemplateAction` | template file + schedule (snapshots sessions that used it) |
| `importBackupAction` | replaces all templates and the whole schedule |
| `exportBackupPayload` | read only |

One API route: `GET /api/export` returns the full backup as JSON, with no access control.

Validation is hand-written and partial. Session ids from forms are not validated; ownership does
not exist as a concept.

### Read-only / published mode

`lib/runtime.ts` `isPublishedReadonly()` is true on Vercel or when `TRAINGRID_READONLY=true`.
It is consulted in 14 places:

- `lib/actions.ts` (`assertWritable`, `importBackupAction`)
- Pages: `week/[weekId]`, `week/[weekId]/add`, `session/[id]`, `session/[id]/edit`,
  `session/[id]/customize`, `library`, `library/new`, `library/[templateId]/edit`
- Components: `AppHeader`, `PublishedNotice`, `library/TemplateList`, `library/TemplateDetail`

`PublishedNotice` also carries the "clone this repo" copy that story 14 removes.

### Data structures

- `SessionTemplate { id (slug), name, type, description, body (Markdown) }`
- `ScheduledSession { id, name, type, weekId, day 1–7, time | null, durationMinutes | null,
  notes, templateId | null, bodySnapshot | null }`
- `WorkoutItem { id, title, body, equipment[], videoUrl | null }`, parsed from `## ` sections of
  the body; `Equipment:` and `Video:` lines carry the metadata.
- Categories: running, strength, plyometrics, other. Eleven equipment types.
- A session with `templateId` and no `bodySnapshot` renders the template's current body.

### Tests

- Vitest, `lib/**/*.test.ts`: backup, domain, duplicate-week, resolve-session, runtime, week,
  workout-items, youtube. Pure functions only; no persistence tests.
- Playwright, `e2e/planner.spec.ts` and `e2e/journeys.spec.ts`: run against `next dev` with
  `TRAINGRID_DATA_DIR` pointed at a scratch folder that `resetData()` wipes.

## 2. Target state after Epic 1

```
GitHub ──push──▶ Vercel (Next.js 16)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Supabase Auth           Supabase Postgres
  Google, GitHub          profiles, invitations, routines,
  cookie sessions         workout_items, scheduled_sessions
                                │
                          Row Level Security
```

### Request path

1. `proxy.ts` refreshes the session cookie and redirects anonymous requests to `/login`.
2. Every server component and server action builds a per-request Supabase server client from the
   cookies and asks Supabase who the user is. No user id is ever read from the request body.
3. Queries run as that user with the publishable key, so RLS applies to all normal CRUD.
4. The secret key is used only in the admin invitation actions and in local one-off scripts.

### Tables

| Table | Ownership column | Notes |
| --- | --- | --- |
| `profiles` | `id` = `auth.users.id` | Existence of the row means "is a member" |
| `invitations` | — | No member access at all; admin operations only |
| `routines` | `owner_user_id` (null when `scope = 'GLOBAL'`) | Check constraint ties scope to ownership |
| `workout_items` | via `routine_id` | `name, instruction, rest, target, notes, equipment[], video_url, sort_order`; policies follow the parent routine |
| `scheduled_sessions` | `user_id` (not null) | `date, start_time, name, category, duration_minutes, notes, source_routine_id, snapshot jsonb` |

Implemented in `supabase/migrations/20261112000000_core_schema.sql` (step 2) with policies in
`20261112010000_rls_policies.sql` (step 3), except `invitations`, which arrives in step 7.

Rules fixed by the approved decisions (see [DECISIONS.md](DECISIONS.md)):

- Every scheduled session is a snapshot. `source_routine_id` is provenance only and becomes null
  when the routine is deleted (`on delete set null`).
- `snapshot` is `{ version: 1, items: [...] }`. Each item has its own UUID, the id of the routine
  item it was copied from, and the same structured fields as `workout_items`.
- No performed-workout data anywhere in these tables. Future logging tables will reference
  `scheduled_sessions`.
- No exercise catalogue; nothing keys off an item's name.
- GLOBAL routines are seeded from `data/templates/*.md` by a one-time local conversion. The app
  itself never parses Markdown bodies or `Rest:` / `Target:` lines.

### What changes in the code

| Today | After Epic 1 |
| --- | --- |
| `lib/schedule.ts`, `lib/templates.ts`, `lib/fs-utils.ts`, `lib/paths.ts` | Replaced by a user-scoped data layer over Supabase |
| `lib/runtime.ts`, `PublishedNotice` read-only branch | Removed |
| `lib/actions.ts` hand-written parsing | Zod schemas; every action authenticates first |
| `GET /api/export` open to anyone | Authenticated; the signed-in user's personal routines, items and sessions only |
| `importBackupAction`, import UI in `ImportExport` | Removed |
| `resolve-session.ts` template-or-snapshot resolution | Removed; a session's content is its snapshot |
| `WorkoutItemEditor` title + details box | One input per structured field, optional ones under "More details" |
| Library edits any template | GLOBAL routines read-only; editor creates and edits the user's PERSONAL routines |
| `data/templates/*.md` read at runtime | Kept in the repo as seed input for GLOBAL routines |
| `data/schedule.json` | No longer read or written by the app |
| Playwright against a scratch data folder | Playwright against local Supabase with seeded test users |

Pure logic in `week.ts`, `duplicate-week.ts` and `youtube.ts` is kept. The Markdown parsing in
`workout-items.ts` moves out of the app and into the seed tooling.
