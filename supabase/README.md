# supabase/

Database schema for TrainGrid, managed with the Supabase CLI (installed as a dev dependency).

| Path | Contents |
| --- | --- |
| `config.toml` | Local stack configuration. Storage, Realtime, Edge Functions and analytics are disabled; TrainGrid does not use them. |
| `migrations/` | Version-controlled schema: tables, constraints, indexes, triggers, RLS, privileges. |
| `tests/database/` | pgTAP tests, run against the local database. |

## Local workflow

Requires Docker.

```bash
npm run db:start   # start local Postgres and apply all migrations
npm run db:reset   # rebuild the local database from the migrations
npm run db:test    # run the pgTAP tests
npm run db:lint    # lint the schema
npm run db:stop    # stop the local stack
```

## Rules

- Every schema change is a new file in `migrations/`. Never edit a migration that has been merged.
- Every new table enables Row Level Security in the migration that creates it.
- Migrations contain no secrets, personal emails, user ids or private schedule data.
- Seed content for GLOBAL routines is handled separately from migrations.
- These commands only ever touch the local database. Applying migrations to production is a
  deliberate, separate step in the rollout.
