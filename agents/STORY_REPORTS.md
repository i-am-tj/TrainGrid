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
Status:                IN REVIEW — D-03, D-04, D-04A, D-04B, D-05, D-06 resolved 2026-11-12 and
                       recorded; PR open, not merged
```

### Step 2 — Database schema + migrations (stories 2, 3, 4, 5, 29)

```
Story:                 2 profiles, 3 routines, 4 workout items, 5 scheduled sessions,
                       29 migration management
Branch:                epic-1/02-schema-migrations (stacked on epic-1/01-architecture-adr)
PR:                    not opened yet
Commit:                not committed yet
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
Status:                IN REVIEW
```

## Epic completion report

Filled in at step 15. Until then every line is unverified.
