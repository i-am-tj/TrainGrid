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
Status:                IN REVIEW
```

## Epic completion report

Filled in at step 15. Until then every line is unverified.
