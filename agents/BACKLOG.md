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
| 9 | Enforce invite-only access | 7 | Agent | IN REVIEW (production check pending) |
| 10 | Invitation model | 7 | Agent | IN REVIEW |
| 11 | Admin invitation management | 8 | Agent | TODO |
| 12 | Invitation email delivery | 8 | Agent | TODO |
| 13 | Protect application routes | 9 | Agent | TODO |
| 14 | Remove hosted read-only architecture | 12 | Agent | TODO |
| 15 | Migrate away from runtime files | 11, 12 | Agent | TODO |
| 16 | Migrate existing personal data safely | 12 | Agent | TODO |
| 17 | Preserve planner functionality | 12 | Agent | TODO |
| 18 | Environment variable contract | 4 | Agent | DONE |
| 19 | Secure GitHub repository secrets | 4 | Agent | DONE |
| 20 | Store production secrets in Vercel | 14 | Tanuj | TODO |
| 21 | Protect Supabase secrets | 4 | Agent | IN PROGRESS (guards in place; secret key first used in step 8) |
| 22 | Separate development and production | 14 | Agent + Tanuj | TODO |
| 23 | GitHub security hardening | 14 | Tanuj | TODO |
| 24 | Input validation | 10 | Agent | TODO |
| 25 | OAuth account handling | 6 | Agent | DONE |
| 26 | Authentication UI | 5 | Agent | DONE |
| 27 | Admin security | 8 | Agent | TODO |
| 28 | Security tests | 3, 13 | Agent | IN PROGRESS (database part in review) |
| 29 | Supabase migration management | 2 | Agent | DONE |
| 30 | Vercel production configuration | 15 | Tanuj + Agent | TODO |
| 31 | Free-tier constraint | 15 | Agent | TODO |
| 32 | Architecture documentation (ADR) | 1 | Agent | DONE |
| 33 | Update existing documentation | 16 | Agent | TODO |

## Work that only Tanuj can do

An agent will not create accounts, generate OAuth credentials, or type secrets into consoles.
Each item gets step-by-step instructions in the PR that needs it.

| When | Action |
| --- | --- |
| Step 4 | Supabase Free project created 2026-11-12 (done). Project URL and publishable key added to Vercel Production 2026-11-12 (done). `/api/health` on production is checked after the step 4 PR is merged |
| Step 5 | In Supabase Authentication: disable the Email provider, set Site URL and the `/auth/callback` Redirect URL. Create the Google OAuth client and enable the Google provider (see `docs/SUPABASE_SETUP.md`). After the step 5 PR is merged, sign in at `/login` on production |
| Step 6 | Create the GitHub OAuth App and enable the GitHub provider in Supabase (see `docs/SUPABASE_SETUP.md`). After the step 6 PR is merged, sign in with GitHub at `/login` on production |
| Step 7 | Apply migrations to production (`supabase link`, `supabase db push`); insert your own invitation in the SQL editor; after the step 7 PR is merged, sign in again (see `supabase/README.md`) |
| Step 8 | Sign in once, copy your Supabase user UUID into `TRAINGRID_ADMIN_USER_IDS` |
| Step 14 | Add environment variables in Vercel; review GitHub secret scanning, push protection, Dependabot |
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
