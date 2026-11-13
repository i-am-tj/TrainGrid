# Epic 1 backlog

Last updated: 2026-11-12. Step numbers refer to [ROADMAP.md](ROADMAP.md).

| Story | Title | Step | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | Introduce Supabase cloud infrastructure | 4 | Tanuj (project) + Agent (clients) | DONE |
| 2 | User/profile model | 2 | Agent | DONE |
| 3 | Routine data model | 2 | Agent | DONE |
| 4 | Workout items | 2 | Agent | DONE |
| 5 | Scheduled sessions | 2 | Agent | DONE |
| 6 | Row Level Security everywhere | 3 | Agent | DONE |
| 7 | Google OAuth | 5 | Tanuj (credentials) + Agent (flow) | DONE |
| 8 | GitHub OAuth | 6 | Tanuj (credentials) + Agent (flow) | DONE |
| 9 | Enforce invite-only access | 7 | Agent | DONE |
| 10 | Invitation model | 7 | Agent | DONE |
| 11 | Admin invitation management | 8, 8b | Agent | DONE (invite and revoke checked on production; revoking an accepted member verified locally only) |
| 12 | Invitation email delivery | 8 | Agent | DONE (manual link, per D-08) |
| 13 | Protect application routes | 9 | Agent | DONE |
| 14 | Remove hosted read-only architecture | 12 | Agent | DONE |
| 15 | Migrate away from runtime files | 11, 12 | Agent | DONE (no runtime file reads or writes after step 12) |
| 16 | Migrate existing personal data safely | 12 | Agent | DONE (script ready; production schedule.json was empty, nothing to import) |
| 17 | Preserve planner functionality | 12 | Agent | DONE |
| 18 | Environment variable contract | 4 | Agent | DONE |
| 19 | Secure GitHub repository secrets | 4, 14 | Agent | DONE (history scan clean in step 14) |
| 20 | Store production secrets in Vercel | 14 | Tanuj | DONE |
| 21 | Protect Supabase secrets | 4, 8, 15 | Agent | DONE (secret key used only in `lib/supabase/admin.ts`; absent from local and production bundles) |
| 22 | Separate development and production | 14 | Agent + Tanuj | DONE |
| 23 | GitHub security hardening | 14 | Tanuj | DONE |
| 24 | Input validation | 10, 12 | Agent | DONE (data layer); every action uses it from step 12 |
| 25 | OAuth account handling | 6 | Agent | DONE |
| 26 | Authentication UI | 5 | Agent | DONE |
| 27 | Admin security | 8 | Agent | DONE |
| 28 | Security tests | 3, 10, 13, 15 | Agent | DONE (all automated checks pass; A2–A4 confirmed manually on production) |
| 29 | Supabase migration management | 2 | Agent | DONE |
| 30 | Vercel production configuration | 15 | Tanuj + Agent | DONE |
| 31 | Free-tier constraint | 15 | Agent | DONE |
| 32 | Architecture documentation (ADR) | 1 | Agent | DONE |
| 33 | Update existing documentation | 16 | Agent | DONE (with this step's merge) |

## Work that only Tanuj can do

An agent will not create accounts, generate OAuth credentials, or type secrets into consoles.
Each item gets step-by-step instructions in the PR that needs it.

| When | Action |
| --- | --- |
| Step 4 | Supabase Free project created 2026-11-12 (done). Project URL and publishable key added to Vercel Production 2026-11-12 (done). `/api/health` on production is checked after the step 4 PR is merged |
| Step 5 | In Supabase Authentication: disable the Email provider, set Site URL and the `/auth/callback` Redirect URL. Create the Google OAuth client and enable the Google provider (see `docs/SUPABASE_SETUP.md`). After the step 5 PR is merged, sign in at `/login` on production |
| Step 6 | Create the GitHub OAuth App and enable the GitHub provider in Supabase (see `docs/SUPABASE_SETUP.md`). After the step 6 PR is merged, sign in with GitHub at `/login` on production |
| Step 7 | Apply migrations to production (`supabase link`, `supabase db push`); insert your own invitation in the SQL editor; after the step 7 PR is merged, sign in again (see `supabase/README.md`) |
| Step 8 | In Vercel Production add `SUPABASE_SECRET_KEY` (type Secret) and `TRAINGRID_ADMIN_USER_IDS` (your user id from Supabase → Authentication → Users); redeploy; after the step 8 PR is merged, invite and revoke a test address at `/admin/invitations` |
| Step 14 | Enable dependency graph, Dependabot alerts and security updates, secret scanning and push protection in GitHub; confirm the four Vercel variables are Production-only and the secret key is type Secret (checklist in docs/SECURITY.md) |
| Step 15 | Apply migrations to production; sign in on `train-grid.vercel.app` with Google and with GitHub |

## Findings from the repository inspection that affect scope

- `data/schedule.json` on `main` contains no sessions, so story 16 has nothing to migrate today.
  The script is still written so that a local schedule can be imported if one exists.
- Scheduled sessions can currently be live-linked to a template (`bodySnapshot: null`).
  Resolved by D-03: always snapshot. Delivered in steps 2 (schema) and 12 (planner).
- Workout items are stored as Markdown sections with one free-text body. Resolved by D-04:
  explicit `name, instruction, rest, target, notes, equipment, video_url, sort_order` fields, no
  runtime parsing. Schema in step 2; one-time conversion of the template files in step 11; the
  editor gets structured inputs in step 12.
- The library is fully editable today. Resolved by D-05: templates become read-only GLOBAL
  routines, the editor writes PERSONAL routines. Steps 11 and 12.
- Backup import replaces all templates and the whole schedule. Resolved by D-06: import is
  removed, export is scoped to the signed-in user. Step 12.

## Explicitly out of Epic 1 (from the decision resolution)

- Performed-workout data of any kind (D-04A)
- An exercise catalogue or `exercise_id` (D-04B)
- Global / My Library navigation, filtering, search, copy-to-personal, global management UI (D-05)
- Hosted import (D-06)
- All 18 files in `data/templates/` are generic training content with equipment tags; they are the
  seed input for GLOBAL routines.


---

# Epic 2 backlog — Global workout library

Last updated: 2026-11-13. Specification: [EPIC-2.md](EPIC-2.md). Story ids are prefixed `E2-` so Epic 1's
story numbers 1–33 above stay unchanged.

| Story | Title | Step | Owner | Status |
| --- | --- | --- | --- | --- |
| E2-01 | Switch between library scopes (All / TrainGrid / Mine) | 02; presentation refined in 04a | Agent | DONE |
| E2-02 | Find and filter routines (search, category, equipment) | 03 | Agent | DONE |
| E2-03 | Assess shared routine content (cards and detail) | 04 | Agent | DONE |
| E2-04 | Copy a GLOBAL routine to a PERSONAL routine | 05 | Agent | TODO |
| E2-05 | Schedule directly from the library | 04 (06 folded in, E2-D12) | Agent | DONE |
| E2-06 | Maintain shared content safely | 07 | Agent + Tanuj | TODO (rule E2-D11 approved) |
| E2-R | Release: docs, regression, production smoke test | 08 | Agent + Tanuj | TODO |

## What already exists (reuse, do not rebuild)

| Need | Already in place | Gap for Epic 2 |
| --- | --- | --- |
| Member-only reads under RLS | `memberData()`, `requireMember()`, RLS on routines/items (Epic 1) | None |
| GLOBAL read-only to members | RLS + E2E + forged-request tests (Epic 1) | None; extend tests to new views |
| List of visible routines | `listRoutines()`: one query, routine columns only | Needs item names, equipment and item count for search, filters and cards (03/04) |
| Routine detail with items | `getRoutine()` + `RoutineDetail` + `WorkoutItemsView` | Copy action; video link label; item count |
| Category filter | `?type=` links in `RoutineList` | Becomes part of the validated query contract (02/03) |
| "Mine" marker | `isOwn` on `RoutineSummary`, "Mine" badge | Scope views (02) |
| Atomic personal save | `savePersonalRoutine()` → `save_personal_routine()` (one transaction) | Copy uses it as-is (05) |
| Scheduling from the library | `/week/current/add?routine=<uuid>` from list and detail; legacy `?template=<slug>` | CTA polish and regression tests only (04) |
| Legacy slug URLs | `findGlobalRoutineIdBySlug()` redirects | Regression tests only |
| Seed pipeline | `npm run seed:generate`, freshness test, idempotent `seed.sql` | Item-id stability rule and workflow docs (07) |

## Findings from the Epic 2 audit that affect scope

- **Seed item ids are positional.** `routine-item:<slug>:<index>` means inserting or reordering items
  in a template gives existing ids to different exercises. Existing ids must be preserved (spec §2.8),
  so Step 07 needs a rule before any content edit. See E2-D11 (approval needed).
- **No templates have video links today.** The video path in detail views is exercised only by
  personal routines and tests; no content claims are added (spec E2-06).
- **The video link is not fully accessible.** It reads "▶ Watch demo" with no item name and no
  new-tab notice. Fixed in Step 04: it now names the item, YouTube and the new tab to screen
  readers, and the stored link is re-validated before it is rendered.
- **`listRoutines()` has no row bound.** Fine for 18 GLOBAL routines, but a member's personal
  routines are unbounded. Step 03 adds an explicit cap (E2-D07). Done: the library list now
  uses `listLibraryRoutines()`, capped at 500 with a visible notice.
- **There is no loading state for the library.** Step 02 adds `app/library/loading.tsx`.
- **`agents/EPIC-1.md`** is in an open PR (#20) and not yet on `main`. Unrelated to Epic 2.
