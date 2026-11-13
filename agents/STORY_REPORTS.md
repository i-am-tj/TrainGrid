# Story completion reports

One entry per roadmap step, appended when its PR is merged. Newest last.

## Template

```
Story:
Branch:
PR:
Commit:
Schema impact:
RLS impact:
Secrets/config impact:
Tests:
Deployment impact:
Status:
```

## Reports

### Step 1 — Architecture records + ADR (story 32)

```
Story:                 32 — Update architecture documentation (ADR), plus agents/ records
Branch:                epic-1/01-architecture-adr
PR:                    https://github.com/i-am-tj/TrainGrid/pull/2
Commit:                f1a2666
Schema impact:         none
RLS impact:            none
Secrets/config impact: none
Tests:                 not applicable (documentation only); lint/unit/build not re-run
Deployment impact:     none
Status:                DONE — merged to main 2026-11-12 (03c331f)
```

### Step 2 — Database schema + migrations (stories 2, 3, 4, 5, 29)

```
Story:                 2 profiles, 3 routines, 4 workout items, 5 scheduled sessions,
                       29 migration management
Branch:                epic-1/02-schema-migrations
PR:                    https://github.com/i-am-tj/TrainGrid/pull/3
Commit:                351fc09
Schema impact:         New tables profiles, routines, workout_items, scheduled_sessions with
                       check constraints, indexes, updated_at triggers. One migration:
                       supabase/migrations/20261112000000_core_schema.sql
RLS impact:            RLS enabled on all four tables with no policies (closed by default).
                       anon has no privileges; members cannot update ownership columns.
                       Policies are step 3.
Secrets/config impact: None. Adds supabase/config.toml (local stack only) and the Supabase
                       CLI as a dev dependency. No environment variables yet.
Tests:                 Database 38/38 pass (local). Schema lint clean. Lint pass.
                       Unit 41/41 pass. Build pass. E2E not run (application code unchanged).
Deployment impact:     None. The app does not use the database yet and nothing has been
                       applied to any cloud project.
Status:                DONE — merged to main 2026-11-12 (3fd88bd)
```

### Step 3 — RLS policies + database tests (story 6, story 28 database part)

```
Story:                 6 Row Level Security everywhere; 28 security tests (database level)
Branch:                epic-1/03-rls-policies
PR:                    https://github.com/i-am-tj/TrainGrid/pull/4
Commit:                5950cd5
Schema impact:         One migration, supabase/migrations/20261112010000_rls_policies.sql:
                       function public.is_member() and 14 policies. No table changes.
RLS impact:            profiles: select/update own. routines: select GLOBAL (members) or own;
                       insert/update/delete own PERSONAL only. workout_items: follow the
                       parent routine. scheduled_sessions: select/insert/update/delete own.
                       INSERT and UPDATE use WITH CHECK. All policies target `authenticated`;
                       anon has none. Uninvited authenticated users see and write nothing.
Secrets/config impact: None.
Tests:                 Database 90/90 pass (38 schema + 52 RLS, local). Suite verified to fail
                       when RLS is disabled. Schema lint clean. Lint pass. Unit 41/41 pass.
                       Build pass. E2E not run (application code unchanged).
Deployment impact:     None. Nothing applied to any cloud project.
Status:                DONE — merged to main 2026-11-12 (2bf9e9f)
```

### Step 4 — Supabase SSR/Auth foundation (stories 1, 18, 19, 21)

```
Story:                 1 Supabase infrastructure; 18 environment variable contract;
                       19 repository secrets; 21 protect Supabase secrets (guards)
Branch:                epic-1/04-supabase-ssr
PR:                    https://github.com/i-am-tj/TrainGrid/pull/5
Commit:                2190622
Schema impact:         None.
RLS impact:            None. Verified through the app: an anonymous request is refused by
                       the database (42501) and a signed-in non-member reads zero rows.
Secrets/config impact: Adds .env.example (placeholders only). .env, .env.* and .vercel were
                       already ignored. New public variables NEXT_PUBLIC_SUPABASE_URL and
                       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. No secret key is read anywhere.
                       New dependencies: @supabase/supabase-js, @supabase/ssr, server-only.
Tests:                 Lint pass. Unit 47/47 pass (6 new). Database 90/90 pass. Build pass
                       with and without Supabase variables. Local Next.js → Supabase: health
                       route ok; cookie session read by the server client (temporary probe,
                       removed). E2E 14/14 pass (with the local Supabase stack configured).
                       Vercel → Supabase: PASS 2026-11-12 — /api/health on production
                       returns ok.
Deployment impact:     Adds a proxy that runs on every request and a public /api/health
                       route. With no Supabase variables in Vercel the site behaves as before.
Status:                DONE — merged to main 2026-11-12 (c717e40)
```

### Step 5 — Google OAuth + authentication UI (stories 7, 26)

```
Story:                 7 Google OAuth; 26 authentication UI
Branch:                epic-1/05-google-oauth
PR:                    https://github.com/i-am-tj/TrainGrid/pull/6
Commit:                450fad9
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: No new environment variables. The Google client secret is entered in
                       the Supabase dashboard only. Dashboard settings required: Email
                       provider disabled, Site URL, Redirect URL, Google provider enabled.
Tests:                 Lint pass. Unit 58/58 pass (11 new). E2E 19/19 pass (5 new: login
                       page, hand-off to Supabase, callback failure, generic errors, sign-out
                       with a real local session). Build pass with and without Supabase
                       variables. Database tests not re-run (no database change).
                       Google sign-in on production: NOT VERIFIED (needs the Google client
                       and this step deployed).
Deployment impact:     Adds /login and /auth/callback. /login is not linked from the app.
                       Signing in grants no access to anything yet.
Status:                DONE — merged to main 2026-11-12 (eb8c564). Google sign-in confirmed
                       on production by Tanuj 2026-11-12.
```

### Step 6 — GitHub OAuth + account handling (stories 8, 25)

```
Story:                 8 GitHub OAuth; 25 OAuth account handling
Branch:                epic-1/06-github-oauth
PR:                    https://github.com/i-am-tj/TrainGrid/pull/7
Commit:                c47ceb5
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: No new environment variables. The GitHub client secret is entered in
                       the Supabase dashboard only.
Tests:                 Lint pass. Unit 65/65 pass (7 new). E2E 21/21 pass (2 new: GitHub
                       hand-off, no-email failure). Build pass. Database tests not re-run
                       (no database change).
                       GitHub sign-in on production: NOT VERIFIED (needs the GitHub OAuth
                       App and this step deployed). No-email case: simulated only.
Deployment impact:     Adds a Continue with GitHub button to /login. Until the provider is
                       enabled in Supabase, clicking it ends on an error from Supabase.
Status:                DONE — merged to main 2026-11-12 (cb2bcee). GitHub sign-in confirmed
                       on production by Tanuj 2026-11-12. No-email case still simulated only.
```

### Step 7 — Invitation / allowlist model (stories 9, 10)

```
Story:                 9 enforce invite-only access; 10 invitation model
Branch:                epic-1/07-invitations
PR:                    https://github.com/i-am-tj/TrainGrid/pull/8
Commit:                e8197d4
Schema impact:         One migration, supabase/migrations/20261112020000_invitations.sql:
                       table invitations (normalised email, accepted/revoked timestamps, one
                       live invitation per email) and function accept_invitation().
RLS impact:            invitations: RLS enabled, no policies, no privileges for anon or
                       authenticated. accept_invitation() is SECURITY DEFINER, executable by
                       authenticated only, and is the only way a profiles row is created.
Secrets/config impact: No new production variables. Locally, SUPABASE_SECRET_KEY of the
                       local stack is used by one E2E helper (ignored .env.local).
                       Migrations applied to production and first invitation inserted by
                       Tanuj 2026-11-12 (supabase db push --remote; SQL editor).
Tests:                 Lint pass. Unit 69/69 pass (4 new). Database 121/121 pass (31 new).
                       E2E 23/23 pass. Build pass.
                       Callback refusing or admitting a real OAuth user on production:
                       NOT VERIFIED (needs migrations applied and this step deployed).
Deployment impact:     From this deploy, sign-in succeeds only for invited emails. Until
                       migrations are applied to production, every sign-in ends with the
                       generic error. The planner itself is unaffected.
Status:                MERGED to main 2026-11-12 (784b194). Confirmed on production by Tanuj
                       2026-11-12: invited Google and GitHub accounts admitted, uninvited
                       account refused. Status: DONE.
```

### Step 7b — Sign-out UX, account chooser, function region (follow-up to stories 7, 8, 26)

```
Story:                 Feedback from production use on 2026-11-12
Branch:                epic-1/07b-signout-ux
PR:                    https://github.com/i-am-tj/TrainGrid/pull/9
Commit:                3af6b63
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: Adds vercel.json pinning functions to syd1. No variables.
Tests:                 Lint pass. Unit 69/69 pass. E2E 23/23 pass. Build pass. Database
                       tests not re-run (no database change).
                       Sign-out speed on production and the GitHub account chooser:
                       NOT VERIFIED until deployed.
Deployment impact:     Functions move from iad1 to syd1. Header shows Sign out for signed-in
                       users. Providers show an account chooser on each sign-in.
Status:                DONE — merged to main 2026-11-12 (d91cf17). Confirmed on production
                       by Tanuj 2026-11-12: sign-out faster, GitHub asks for the account.
```

### Step 8 — Admin invitation flow (stories 11, 12, 27; completes 21)

```
Story:                 11 admin invitation management; 12 invitation delivery (manual link);
                       27 admin security; 21 protect Supabase secrets
Branch:                epic-1/08-admin-invitations
PR:                    https://github.com/i-am-tj/TrainGrid/pull/10
Commit:                cfc081b
Schema impact:         None.
RLS impact:            None. invitations stays closed to members; admin operations use the
                       secret key only after a server-side admin check.
Secrets/config impact: First use of SUPABASE_SECRET_KEY and TRAINGRID_ADMIN_USER_IDS. Both
                       must be added to Vercel Production. New dependency: zod.
Tests:                 Lint pass. Unit 82/82 pass (13 new). Database 121/121 pass.
                       E2E 27/27 pass (4 new: anonymous 404, member 404, non-member 404,
                       admin invite / duplicate / invalid / revoke). Build pass. Secret key
                       absent from the client bundle.
                       Not tested: invoking the server actions directly as a non-admin
                       (covered by the unit-tested guard and code structure only).
                       Production: admin page working (Tanuj, 2026-11-12).
Deployment impact:     Adds /admin/invitations and an Invitations header link for admins.
                       Without the two variables the page is a 404 for everyone.
Status:                DONE — merged to main 2026-11-12 (8598e0e). Admin page confirmed on
                       production by Tanuj 2026-11-12.
```

### Step 9 — Route protection (story 13)

```
Story:                 13 protect application routes
Branch:                epic-1/09-route-protection
PR:                    https://github.com/i-am-tj/TrainGrid/pull/11
Commit:                fd94884
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: None. A deployment without Supabase variables now serves only the
                       login page and the health check.
Tests:                 Lint pass. Unit 87/87 pass (5 new). Database 121/121 pass.
                       E2E 36/36 pass (9 new; the 14 planner tests now sign in as a member).
                       Build pass with and without Supabase variables. Unconfigured
                       deployment checked by hand: pages redirect, export 401.
                       Production: NOT VERIFIED.
Deployment impact:     The production site stops being public. Anonymous visitors are sent
                       to /login. Members see the existing file-backed, read-only planner
                       until step 12. The E2E suite now needs the local Supabase stack.
Status:                DONE — merged to main 2026-11-12 (7877baa). Production checked
                       2026-11-12 with signed-out requests: pages redirect to /login,
                       /api/export answers 401.
```

### Step 8b — Revoke accepted members (extends stories 11, 27)

```
Story:                 Requested by Tanuj 2026-11-12: admins can revoke an accepted member
                       (never an admin); data kept; re-inviting restores access
Branch:                epic-1/08b-revoke-members
PR:                    https://github.com/i-am-tj/TrainGrid/pull/13
Commit:                8f27095
Schema impact:         One migration, 20261112040000_revoke_members.sql: profiles.revoked_at;
                       drops invitations_not_accepted_and_revoked; is_member() excludes
                       revoked; accept_invitation() restores on re-invite; new
                       revoke_invitation() (service role only).
RLS impact:            Every own-row policy on routines, workout_items, scheduled_sessions and
                       profiles UPDATE now also requires active membership.
Secrets/config impact: None new. Revocation uses the existing secret key, admin-only.
Tests:                 Lint pass. Unit 119/119 (4 new). Database 174/174 (33 new; 2 old tests
                       rewritten for the new rule). Integration 23/23 (3 new). E2E 37/37 (1 new).
                       Build pass. Schema lint: one warning, from step 10 (D-61).
                       Production: NOT VERIFIED.
Deployment impact:     Migration applied to production by Tanuj 2026-11-12 (before merge;
                       inert for the code already deployed). Admin page gains a Revoke
                       access button for accepted non-admin members once merged.
Status:                DONE — merged to main 2026-11-12 (29bf41d). Revoke and restore
                       verified locally (database, integration, E2E); not exercised on
                       production with real accounts.
```

### Step 10 — User-scoped data layer + validation (story 24)

```
Story:                 24 input validation (and the data layer the planner will use)
Branch:                epic-1/10-data-layer
PR:                    https://github.com/i-am-tj/TrainGrid/pull/12
Commit:                f9f6b8f
Schema impact:         One migration, 20261112030000_save_personal_routine.sql: function
                       save_personal_routine() (security invoker). No table changes.
                       Generated types added in lib/database.types.ts.
RLS impact:            None changed. The new function runs under the caller's RLS.
Secrets/config impact: None. New script: test:integration (local stack only).
Tests:                 Lint pass. Unit 115/115 pass (28 new). Database 141/141 pass (20 new).
                       Integration 20/20 pass (new): CRUD, snapshots, Duplicate Week, export,
                       and every cross-user case, both through the data functions and by
                       direct queries. With RLS disabled on scheduled_sessions, 3 fail, as
                       expected. E2E 36/36 pass. Build pass. Secret key absent from bundle.
Deployment impact:     None visible. Nothing in the app calls the data layer until step 12.
                       Migration applied to production by Tanuj 2026-11-12
                       (supabase db push --remote).
Status:                DONE — merged to main 2026-11-12 (e8f5396)
```

### Step 11 — Template migration foundation (story 15, templates part)

```
Story:                 15 migrate away from runtime files (templates → GLOBAL routines)
Branch:                epic-1/11-template-seed
PR:                    https://github.com/i-am-tj/TrainGrid/pull/14
Commit:                8d3cc79
Schema impact:         None. Adds supabase/seed.sql (generated): 18 GLOBAL routines, 96 items.
RLS impact:            None. Seeded routines are GLOBAL: readable by members, writable by none.
Secrets/config impact: None. New dev dependency tsx; new script seed:generate.
Tests:                 Lint pass. Unit 148/148 (29 new: converter, every template, seed
                       freshness). Database 186/186 (12 new; 3 older files scoped to their
                       own fixtures because GLOBAL routines now exist locally). Integration
                       23/23. E2E 37/37. Build pass. Seed applied twice more locally: same
                       96 item ids.
                       Production seed: applied by Tanuj 2026-11-12
                       (supabase db push --remote --include-seed); counted in step 15: 18 routines, 96 items.
Deployment impact:     None visible: the app still reads data/templates until step 12.
                       Seed applied to production before merge; inert until step 12.
Status:                DONE — merged to main 2026-11-12 (02a32eb). Production seeded.
```

### Step 12 — Planner migration files → Supabase (stories 14, 15, 16, 17)

```
Story:                 14 remove read-only mode; 15 no runtime files; 16 legacy data import;
                       17 preserve planner functionality
Branch:                epic-1/12-planner-migration
PR:                    https://github.com/i-am-tj/TrainGrid/pull/15
Commit:                14c51b3
Schema impact:         None.
RLS impact:            None. All reads and writes now go through the member's own client.
Secrets/config impact: None new. TRAINGRID_READONLY and TRAINGRID_DATA_DIR no longer exist.
                       New script import:legacy (local; secret key from the environment).
Tests:                 Lint pass. Type-check pass. Unit 131/131 (148 before: 25 tests of
                       deleted file-era code removed, 8 legacy-import tests added). Database
                       186/186. Integration 26/26 (3 new: legacy slug lookup). E2E 43/43,
                       twice (suite rewritten for the database; 3 new: legacy links, legacy
                       link needs sign-in, non-existent week refused). Build pass. Secret
                       key absent from bundle. No runtime fs access. Schema lint: 1 known
                       warning (D-61).
Review fixes:          Legacy slug links restored (D-71); non-existent weeks refused (D-72);
                       misleading category casts replaced by one documented helper.
Production deps:       Verified 2026-11-12 (read-only CLI): all 5 migrations applied; seed
                       recorded as applied and up to date. Seeded row counts not inspected.
                       Production app behaviour: confirmed working by Tanuj 2026-11-12.
Deployment impact:     The cut-over. Members' planner and library read and write Supabase.
                       The published/read-only notice, import and the file-backed code are
                       gone. Migrations and seed are already on production.
Status:                DONE — merged to main 2026-11-12 (d8dddb4); production UI confirmed
                       by Tanuj.
```

### Step 13 — Cross-user authorization tests (story 28)

```
Story:                 28 security tests (application level, completing the matrix)
Branch:                epic-1/13-authz-tests
PR:                    https://github.com/i-am-tj/TrainGrid/pull/16
Commit:                300243e
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: None. New scripts: typecheck, test:all.
Tests:                 New e2e/authorization.spec.ts, 10 tests: member A forging B's ids into
                       their own edit, customise, delete, routine save and routine delete
                       forms; ownership fields injected into add-session and new-routine
                       forms; forged Duplicate Week; B's pages returning 404; an admin's
                       invite and revoke requests replayed by a member and an anonymous
                       visitor. Every outcome checked in the database. Mutation check:
                       with the admin check removed, the replay test fails.
                       test:all: lint, typecheck, unit 131/131, database 186/186,
                       integration 26/26, E2E 53/53, build all pass.
Deployment impact:     None. Tests and scripts only.
Status:                DONE — merged to main 2026-11-12 (93e3322)
```

### Step 14 — Environment / secrets hardening (stories 20, 22, 23; completes 19)

```
Story:                 20 secrets in Vercel; 22 dev/prod separation; 23 GitHub security
Branch:                epic-1/14-secrets-hardening
PR:                    https://github.com/i-am-tj/TrainGrid/pull/17
Commit:                b7b5255
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: No new variables. New docs/SECURITY.md: credential inventory, dev/prod
                       separation, release checks, GitHub and Vercel checklists, incident steps.
Findings:              Git history: no credentials in 56 commits on all branches; only
                       .env.example ever tracked. GitHub: dependency graph, Dependabot alerts,
                       Dependabot security updates, secret scanning and push protection all
                       DISABLED. Dependencies: next 16.3.3 had a critical advisory (features
                       unused) plus highs. Vercel previews: behind Vercel Authentication.
Changes:               scripts/scan-secrets.ts (npm run scan:secrets); next 16.4.6,
                       eslint-config-next 16.4.6, vitest 4.1.12, transitive updates.
                       Production deps: 0 vulnerabilities; 8 moderate lint-only remain (D-77).
Tests:                 test:all on the new versions: lint, typecheck, unit 131/131, database
                       186/186, integration 26/26, E2E 53/53, build all pass. Scanner verified
                       on planted values.
Deployment impact:     Next.js minor upgrade shipped; production checked after deploy:
                       /api/health ok, signed-out / redirects to /login.
Owner actions:         GitHub (read back via API 2026-11-12): dependency graph, Dependabot
                       alerts, Dependabot security updates, secret scanning, push protection
                       all enabled; 0 open Dependabot or secret-scanning alerts. Vercel
                       variables Production-only, secret key type Secret, previews protected:
                       confirmed by Tanuj.
Status:                DONE — merged to main 2026-11-12 (ce1cc73)
```

### Step 15 — Production rollout (stories 30, 31)

```
Story:                 30 Vercel production configuration; 31 free-tier constraint
Branch:                epic-1/15-rollout
PR:                    https://github.com/i-am-tj/TrainGrid/pull/18
Commit:                32472e1
Schema impact:         One migration, 20261112050000_lock_down_definer_functions.sql: revokes
                       API access to Supabase's rls_auto_enable() where it exists.
RLS impact:            None to policies. New database test 07: no SECURITY DEFINER function
                       callable by anon; only accept_invitation by authenticated.
Secrets/config impact: None.
Production checks:     Read-only (D-81): schema, RLS, grants, seed, snapshots, auth providers,
                       signed-out routes, served JavaScript, security advisor. See P1–P8 in
                       agents/TEST_PLAN.md. One advisor finding fixed by the migration above.
Tests:                 test:all pass: lint, typecheck, unit 131/131, database 189/189 (3 new),
                       integration 26/26, E2E 53/53, build. Secret scans clean (files and
                       history). npm audit --omit=dev: 0. New test shown to fail against a
                       simulated exposed function and pass after the migration.
Deployment impact:     Migration applied to production by Tanuj 2026-11-13. Read back: 6/6
                       migrations match; rls_auto_enable() no longer executable by anon or
                       authenticated; advisor down to the 2 accepted warnings (D-80).
                       Vercel plan confirmed Hobby by Tanuj.
Status:                DONE — merged to main 2026-11-13 (e3ec8d0)
```

### Step 16 — Documentation closure (story 33)

```
Story:                 33 update existing documentation
Branch:                epic-1/16-docs-closure
PR:                    https://github.com/i-am-tj/TrainGrid/pull/19
Commit:                9b77393
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: None.
Docs:                  README rewritten (invite-only app, providers table with Apple and ChatGPT
                       deferred, how it runs, local development with Docker, scripts, structure);
                       screenshots regenerated. REQUIREMENTS, TECHNICAL_DESIGN, DATA_FORMAT,
                       TEST_PLAN, TEST_RESULTS rewritten. UX_SPEC updated (sign-in, header,
                       routines, snapshots, editor, admin). MVP_CHECKLIST marked historical.
                       docs/README index and ADR status updated. Nothing from Epics 2–4
                       described as shipped. 40 relative links checked, none broken.
Tests:                 test:all pass: lint, typecheck, unit 131, database 189, integration 26,
                       E2E 53, build. Secret scans clean. npm audit --omit=dev: 0.
Deployment impact:     None (documentation and images only).
Status:                IN REVIEW
```

## Epic completion report

Written 2026-11-12 at step 15; finalised 2026-11-13 at step 16. Evidence: agents/TEST_PLAN.md
(A, I, M, R, S, P rows).

```
Infrastructure
  Vercel Hobby: PASS — production on Vercel; Hobby plan confirmed by Tanuj
  Supabase Free: PASS — organisation shown as FREE at project creation

OAuth
  Google: PASS — signed in on production (Tanuj)
  GitHub: PASS — signed in on production (Tanuj)
  Public signup blocked: PASS — only Google and GitHub enabled; no email, phone or
                         anonymous sign-in; an OAuth account without an invitation gets
                         nothing (D-82)

Invite-only Access
  Admin invitation: PASS — invite, view, revoke, revoke accepted member (production + E2E)
  Invited user access: PASS — production (Tanuj)
  Non-invited access: BLOCKED — production (Tanuj) + database + E2E

Data Isolation
  User A → User A: PASS
  User A → User B: BLOCKED — database, integration, and forged requests to the app
  User B → User A: BLOCKED — database, integration, E2E

RLS
  Profiles: PASS
  Personal routines: PASS
  Scheduled sessions: PASS

Secrets
  Git repository clean: PASS — full history scan; GitHub secret scanning and push
                        protection enabled, 0 alerts
  Vercel environment configured: PASS — four variables, Production only, secret typed
                                 Secret (Tanuj)
  Service secret absent from browser: PASS — local build and production JavaScript

Validation
  Lint: PASS
  Unit: PASS (131)
  Integration: PASS (26)
  RLS: PASS (189 database tests, including 52 RLS and 33 revocation)
  E2E: PASS (53)
  Build: PASS
  Production smoke: PASS — signed-out checks (P5, P6) and member UI (Tanuj)

Cost
  Vercel Hobby: $0
  Supabase Free: $0
  Google OAuth: $0
  GitHub OAuth: $0
  Additional paid services: NONE
```

Release blockers: none of the epic's release-blocker conditions is true.

Supabase security advisor (2026-11-13): 2 warnings, both accepted (D-80).
Documentation (story 33): updated in step 16 and merged with this report.

All 33 stories delivered; every acceptance criterion met; no release blocker present.

EPIC 1 COMPLETE — SECURE INVITE-ONLY MULTI-USER CLOUD FOUNDATION LIVE


---

# Epic 2 — Global workout library

### Step 01 — Audit and plan

```
Story:                 Planning for E2-01 … E2-06 (no story delivered)
Branch:                epic-2/01-audit-and-plan
PR:                    https://github.com/i-am-tj/TrainGrid/pull/21
Commit:                56fee82
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: None.
Changes:               agents/EPIC-2.md (provided by Tanuj) committed. Epic 2 sections appended
                       to ROADMAP, BACKLOG, DECISIONS, ARCHITECTURE, TEST_PLAN and this file.
                       Epic 1 records untouched.
Findings:              Positional seed item ids (E2-D11); unbounded list read (E2-D07); video
                       link accessibility; no library loading state; no templates with videos.
Tests:                 None run for this step (records only; no application change).
Deployment impact:     None.
Approval:              Plan and decisions E2-D01 … E2-D15 approved by Tanuj on 2026-11-13.
Status:                DONE — merged to main 2026-11-13
```

### Step 02 — Library scope (E2-01)

```
Story:                 E2-01 switch between library scopes
Branch:                epic-2/02-library-scope
PR:                    https://github.com/i-am-tj/TrainGrid/pull/23
Commit:                7ec720b
Schema impact:         None.
RLS impact:            None. Views filter what the member's own RLS-governed query returns.
Secrets/config impact: None.
Changes:               lib/library/query.ts: validated URL state (scope, type), canonical links,
                       scope filtering and empty-state selection (pure). Library list: All /
                       TrainGrid / Mine tabs, TrainGrid and Mine labels on every card, result
                       count, distinct empty states, "All types" category chip, New routine
                       placement by view. Library list page and its loading state moved into the
                       app/library/(list) route group (E2-D16).
Tests:                 test:all pass: lint, typecheck, unit 148 (17 new), database 189,
                       integration 26, E2E 65 (11 new), build. Secret scan clean. The new tests
                       were shown to fail with the Mine filter broken (2 E2E, 2 unit).
Found and fixed:       A library-wide loading boundary made detail pages stream, so another
                       member's routine returned 200 instead of 404 and legacy slug redirects
                       broke; caught by existing authorization and legacy-link tests.
Deployment impact:     UI only. No migration, no seed change.
Status:                DONE — merged to main 2026-11-13
```

### Step 03 — Search and filters (E2-02)

```
Story:                 E2-02 find and filter routines (search, category, equipment)
Branch:                epic-2/03-search-filters
PR:                    https://github.com/i-am-tj/TrainGrid/pull/24
Commit:                cc452de
Schema impact:         None.
RLS impact:            None. One read of what the member's RLS already allows, narrowed to
                       GLOBAL plus their own user id.
Secrets/config impact: None.
Changes:               lib/data/routines.ts: listLibraryRoutines() — one query with embedded
                       item names and equipment, capped at 500 routines, reports truncation
                       (E2-D07). lib/library/query.ts: q and equipment in the URL contract,
                       search normalisation, every-word matching over name, description and
                       exercise names, equipment aggregation, AND of all filters, name sort
                       (E2-D18). Library list: search form (GET, labelled, works without
                       JavaScript), equipment select, category chips and view tabs that keep
                       the other filters, Clear filters, "No … matching …" zero-result message,
                       cap notice.
Tests:                 test:all pass: lint, typecheck, unit 158 (10 new), database 189,
                       integration 29 (3 new), E2E 76 (11 new), build. Secret scan clean.
                       Mutation checks: "any word" search failed 1 unit and 1 E2E; removing the
                       equipment filter failed 2 unit and 1 E2E.
Found and fixed:       Test expectations initially assumed some words were unique to one
                       routine ("bulgarian", "back squat"); the seeded data has them in two.
                       The tests now use phrases checked against the templates.
Deployment impact:     UI only. No migration, no seed change.
Status:                DONE — merged to main 2026-11-13
```

### Step 04 — GLOBAL cards and detail, scheduling (E2-03, E2-05; Step 06 folded in)

```
Stories:               E2-03 assess shared routine content; E2-05 schedule from the library
Branch:                epic-2/04-global-details
PR:                    https://github.com/i-am-tj/TrainGrid/pull/25
Commit:                eb4962e
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: None.
Changes:               lib/library/summary.ts: equipment aggregation (shared with the list
                       read), item count text, "6 items · Barbell, Bench" summary that names
                       equipment only when the content does. Cards: that summary under the
                       description; Schedule stays beside the text on phones. Detail:
                       TrainGrid/Mine label, summary line, Schedule as the primary action
                       (labelled with the routine name), Edit only on own routines, header
                       stacks on phones. Video links: named "Watch demo of <item> on YouTube
                       (opens in a new tab)" for screen readers, and the stored URL is parsed
                       again before rendering (E2-D15). SourceLabel moved to its own component.
Tests:                 test:all pass: lint, typecheck, unit 161 (3 new), database 189,
                       integration 30 (1 new), E2E 84 (8 new), build. Secret scan clean.
                       Mutation checks: Edit shown on GLOBAL detail failed 2 E2E; equipment not
                       de-duplicated failed 1 unit and 1 E2E. Phone (360 px) and desktop
                       screenshots of list and detail checked.
Found and fixed:       The longer card text pushed Schedule onto its own row on phones; the
                       button now stays beside the text and the text wraps.
Deployment impact:     UI only. No migration, no seed change.
Status:                DONE — merged to main 2026-11-13
```

### Step 04a — Library UI refinement (requested by Tanuj)

```
Story:                 E2-01 presentation (no behaviour change to search, filters or data)
Branch:                epic-2/04a-library-ui-polish (from epic-2/04-global-details)
PR:                    https://github.com/i-am-tj/TrainGrid/pull/26
Commit:                7d3096b
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: None.
Changes:               components/library/LibraryHeader.tsx (client): heading, intro and the
                       centred All / TrainGrid / Mine segmented control with one sliding pill.
                       app/library/(list)/layout.tsx hosts it so it stays mounted across
                       navigations. Page and loading skeleton now render only the body.
                       RoutineList: old view tabs removed; toolbar holds the count, Clear
                       filters and an outlined "+ New routine" in every view; bottom and
                       empty-state New routine buttons removed (E2-D19). Search and category
                       controls untouched.
                       Header (E2-D20): TrainGrid mark beside the name and an outlined Beta
                       badge; logo files and a 120 × 120 PNG for Google branding in
                       public/brand/, upload steps in docs/BRANDING.md. On phones the nav now
                       wraps to a second row (Tanuj's choice).
                       Header check: lint, typecheck and 53 E2E (header, footer, auth,
                       protection, library) pass; 2 new header tests (desktop and phone).
Tests:                 test:all: lint, typecheck, unit 161, database 189, integration 30, build
                       pass; E2E 93 (9 new) pass on rerun — in the first full run one journey
                       test (session page with a video) timed out once under load; it passed
                       3/3 alone, 10/10 with its file and in a full E2E rerun. Secret scan clean.
                       Mutation checks: remounting the pill on each change failed the
                       "same element slides" test; dropping the reduced-motion rule failed the
                       reduced-motion test. Phone (360 px) and desktop screenshots checked.
Found and fixed:       The pill stayed on the clicked tab after Back returned to the URL it was
                       clicked from; any URL change now clears the pending click.
Deployment impact:     UI only. No migration, no seed change.
Status:                DONE — merged to main 2026-11-13
```

### Step 04b — Phone header menu (requested by Tanuj)

```
Story:                 Header presentation (E2-D21); no data or behaviour change elsewhere
Branch:                epic-2/04b-mobile-nav-menu
PR:                    https://github.com/i-am-tj/TrainGrid/pull/27
Commit:                94de022
Schema impact:         None.
RLS impact:            None.
Secrets/config impact: None.
Changes:               components/MobileMenu.tsx (client, <details>): menu button with
                       hamburger/close icon and "Open menu"/"Close menu" labels; vertical
                       list under the header; closes on navigation, Escape, outside click and
                       link click. AppHeader: one list of entries drawn inline from sm up and
                       in the menu on phones; header is the positioning context.
Tests:                 Lint and typecheck pass. 3 new header tests (phone menu opens as a
                       vertical list and closes after navigating; keyboard, Escape and outside
                       click; desktop stays inline). Every E2E file passes after two test
                       updates: the routine-item helper now looks for <details> inside main
                       (the header menu is also a <details>, which broke 4 tests), and the
                       admin phone-header test opens the menu before checking its links.
                       Phone screenshots, menu closed and open, checked. Full suite not run
                       (header-only change, per Tanuj).
Deployment impact:     UI only.
Status:                IN REVIEW
```

### Fix — Linked-identity gate (bug report, independent of the step order)

```
Report:                Routines "created by someone else" visible in Mine (production).
Branch:                fix/linked-identity-invite-gate
PR:                    https://github.com/i-am-tj/TrainGrid/pull/28
Commit:                43123cc
Finding:               Not a cross-user leak. The rows' owner was the viewer's own user id
                       (RLS and "Mine" were correct). A Google sign-in for an address the
                       admin had just invited as a separate person was linked by Supabase
                       Auth onto the existing member, because the member's GitHub identity
                       has the same email. That session created the routines as the member.
                       Evidence from read-only production queries; no emails recorded here.
Schema impact:         Migration 20261113000000_linked_identity_gate.sql: new
                       invitation_email_conflict() (service_role only); accept_invitation()
                       gains the linked_identity refusal. Not applied to production.
RLS impact:            None.
Secrets/config impact: None.
Changes:               Admin invite refuses addresses already linked to another user's
                       sign-in; callback refuses linked_identity with a fixed /login message;
                       docs/SECURITY.md section and incident record (E2-D22).
Tests:                 test:all pass: lint, typecheck, unit 161, database 203 (14 new),
                       integration 30, E2E 97 (2 new), build. Secret scan clean. Mutation
                       checks: removing the sign-in refusal failed 4 database tests; skipping
                       the invite-time check failed the new admin E2E.
Also fixed:            Phone menu race from Step 04b, found when the merged header tests
                       ran here: an outside tap or Escape right after opening could arrive
                       before React saw the native toggle, so the menu stayed open (about 1
                       run in 3 under repeats). MobileMenu now closes the <details> element
                       itself; header tests 40/40 with --repeat-each=8.
Owner actions:         Apply the migration to production (dry run first). Then revoke the
                       pending invitation for the linked address, sign out the member's
                       sessions, remove the linked Google identity if it is not the member's,
                       and delete the three duplicate routines if unwanted.
Status:                IN REVIEW
```

