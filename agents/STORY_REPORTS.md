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
Status:                MERGED to main 2026-11-12 (eb8c564); /login is live on production.
                       Google provider reported enabled by Tanuj; a completed production
                       sign-in has not yet been confirmed.
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
Status:                IN REVIEW — production GitHub sign-in pending
```

## Epic completion report

Filled in at step 15. Until then every line is unverified.
