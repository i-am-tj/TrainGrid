# Roadmap

Last updated: 2026-11-12

## Epics

| Epic | Title | Status |
| --- | --- | --- |
| 1 | Secure invite-only multi-user cloud foundation | IN PROGRESS |
| 2 | Global workout library | Not started |
| 3 | Personal workout library | Not started |
| 4 | Per-user calendar and scheduling | Not started |

## Epic 1 — ordered PR steps

Each step is one branch and one reviewable PR. Story numbers refer to [BACKLOG.md](BACKLOG.md).

| # | Step | Branch | Stories | Needs from Tanuj | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Architecture records + ADR | `epic-1/01-architecture-adr` | 32 | — | DONE |
| 2 | Database schema + migrations | `epic-1/02-schema-migrations` | 2, 3, 4, 5, 29 | — | DONE |
| 3 | RLS policies + database tests | `epic-1/03-rls-policies` | 6, 28 (RLS part) | — | DONE |
| 4 | Supabase SSR/Auth foundation | `epic-1/04-supabase-ssr` | 1, 18, 19, 21 | — | DONE |
| 5 | Google OAuth | `epic-1/05-google-oauth` | 7, 26 | — | DONE |
| 6 | GitHub OAuth | `epic-1/06-github-oauth` | 8, 25 | — | DONE |
| 7 | Invitation / allowlist model | `epic-1/07-invitations` | 9, 10 | — | DONE |
| 7b | Sign-out UX, account chooser, function region | `epic-1/07b-signout-ux` | 26 (follow-up) | Confirm sign-out speed and the GitHub chooser on production | MERGED (production check to be confirmed) |
| 8 | Admin invitation flow | `epic-1/08-admin-invitations` | 11, 12, 27 | Add `SUPABASE_SECRET_KEY` and `TRAINGRID_ADMIN_USER_IDS` to Vercel Production; invite and revoke on production | MERGED (production check to be confirmed) |
| 9 | Route protection | `epic-1/09-route-protection` | 13 | Confirm on production that a signed-out browser is sent to `/login` | MERGED (production check to be confirmed) |
| 10 | User-scoped data layer + validation | `epic-1/10-data-layer` | 24 | Review and merge; apply the new migration to production before step 12 (`supabase db push --remote`) | IN REVIEW |
| 11 | Template migration foundation | `epic-1/11-template-seed` | 15 (templates) | — | TODO |
| 12 | Planner migration files → Supabase | `epic-1/12-planner-migration` | 14, 15, 16, 17 | — | TODO |
| 13 | Cross-user authorization tests | `epic-1/13-authz-tests` | 28 | — | TODO |
| 14 | Environment / secrets hardening | `epic-1/14-secrets-hardening` | 20, 22, 23 | Vercel env vars; GitHub security settings | TODO |
| 15 | Production rollout | `epic-1/15-rollout` | 30, 31 | Apply migrations to production; verify both OAuth flows live | TODO |
| 16 | Documentation closure | `epic-1/16-docs-closure` | 33 | — | TODO |

## Sequencing notes

- Steps 2 and 3 are deliberately ahead of any cloud setup: they run against a local Supabase
  stack (Docker), so the schema and RLS can be reviewed and tested before a production project
  exists.
- Steps 5 and 6 cannot be verified end to end by an agent. OAuth sign-in with a real Google or
  GitHub account is done by Tanuj; the agent implements the flow and the automated checks around it.
- The app stays deployable after every step. Until step 12 lands, production keeps serving the
  current read-only site; auth and the database are introduced alongside it, not in place of it.
- Production migrations are applied at step 7, not at rollout: from this step on the sign-in
  callback calls a database function, so production needs the schema. The tables hold no data and
  stay closed by RLS, so applying them early carries no exposure.
- Step 12 is the cut-over: the read-only mode and all filesystem persistence are removed in the
  same PR that makes the planner read and write the signed-in user's rows.
