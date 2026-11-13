# Roadmap

Last updated: 2026-11-12

## Epics

| Epic | Title | Status |
| --- | --- | --- |
| 1 | Secure invite-only multi-user cloud foundation | DONE (2026-11-13) |
| 2 | Global workout library | IN PROGRESS — plan approved 2026-11-13 |
| 3 | Personal workout library | Not started |
| 4 | Per-user calendar and scheduling | Not started |

## Epic 2 — ordered PR steps

Specification: [EPIC-2.md](EPIC-2.md). Stories E2-01 … E2-06 are in [BACKLOG.md](BACKLOG.md); decisions
E2-D01 … in [DECISIONS.md](DECISIONS.md). Each step: one branch from current `main`, one PR, merged
before a dependent step starts. No step changes production configuration or runs production SQL.

| # | Step | Branch | Stories | Depends on | Needs from Tanuj | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Audit and plan | `epic-2/01-audit-and-plan` | — | — | — | DONE |
| 02 | Library scope (All / TrainGrid / Mine) | `epic-2/02-library-scope` | E2-01 | 01 | — | DONE |
| 03 | Search and filters | `epic-2/03-search-filters` | E2-02 | 02 | — | DONE |
| 04 | GLOBAL cards and detail, scheduling CTAs | `epic-2/04-global-details` | E2-03, E2-05 | 03 | — | DONE |
| 04a | Library UI refinement (requested by Tanuj) | `epic-2/04a-library-ui-polish` | E2-01 (presentation) | 04 | — | DONE |
| 04b | Phone header menu (requested by Tanuj) | `epic-2/04b-mobile-nav-menu` | — (header) | 04a | Review and merge | IN REVIEW |
| 05 | Copy to My Library | `epic-2/05-copy-to-personal` | E2-04 | 04 | — | TODO |
| 06 | Scheduling links | `epic-2/06-scheduling-links` | E2-05 | — | — | FOLDED into 04 (E2-D12, approved) |
| 07 | Content workflow | `epic-2/07-content-workflow` | E2-06 | 01 (independent of 02–05) | — | TODO |
| 08 | Release and docs | `epic-2/08-release-docs` | all | 02–07 | Production smoke test (signed in) | TODO |

### Sequencing notes

- 02 → 03 → 04 → 05 is a chain: each builds on the previous step's list data and components.
- 07 touches only seed tooling and docs, so it can run in parallel with 02–05 once E2-D11 is decided.
- 05 (copy, the only new write path) and 08 (release) stay isolated review points, as the spec requires.
- No database migration is expected (E2-D13). If one turns out to be needed, it is raised as a
  decision before it is written.
- Nothing in Epic 2 requires a production seed run unless shared content changes in 07.

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
| 7b | Sign-out UX, account chooser, function region | `epic-1/07b-signout-ux` | 26 (follow-up) | — | DONE |
| 8 | Admin invitation flow | `epic-1/08-admin-invitations` | 11, 12, 27 | — | DONE |
| 9 | Route protection | `epic-1/09-route-protection` | 13 | — | DONE |
| 8b | Revoke accepted members (keep data) | `epic-1/08b-revoke-members` | 11, 27 (extension) | — | DONE (revoke and restore verified locally; not exercised on production) |
| 10 | User-scoped data layer + validation | `epic-1/10-data-layer` | 24 | — | DONE |
| 11 | Template migration foundation | `epic-1/11-template-seed` | 15 (templates) | — | DONE |
| 12 | Planner migration files → Supabase | `epic-1/12-planner-migration` | 14, 15, 16, 17 | — | DONE |
| 13 | Cross-user authorization tests | `epic-1/13-authz-tests` | 28 | — | DONE |
| 14 | Environment / secrets hardening | `epic-1/14-secrets-hardening` | 20, 22, 23 | — | DONE |
| 15 | Production rollout | `epic-1/15-rollout` | 30, 31 | — | DONE |
| 16 | Documentation closure | `epic-1/16-docs-closure` | 33 | Merge | DONE (with this step's merge) |

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
