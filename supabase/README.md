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

## Applying migrations to production

Run by the project owner, from a terminal, never by CI and never automatically on merge.

```bash
npx supabase login                          # once per machine; opens the browser
npx supabase link --project-ref <ref>       # once
npx supabase db push --remote --dry-run     # shows which migrations would be applied
npx supabase db push --remote               # applies them
```

`--remote` is required: without it the CLI targets the local stack and reports "Local database is
up to date" without touching production.

`<ref>` is the first part of the project URL (`https://<ref>.supabase.co`). If the database
password is asked for, type it at the prompt; it is not stored in the repository. `supabase link` writes only to
`supabase/.temp/`, which is ignored by Git.

Apply migrations before, or immediately after, merging a PR whose application code depends on
them.

### First member

The invitation list starts empty, and the admin page needs an existing member. Create the first
invitation once, in the Supabase dashboard's SQL editor, using the email of the Google or GitHub
account you sign in with (lower-case):

```sql
insert into public.invitations (email) values ('you@example.com');
```

Then sign in at `/login`. Later invitations are created from the admin page.

## Rules

- Every schema change is a new file in `migrations/`. Never edit a migration that has been merged.
- Every new table enables Row Level Security in the migration that creates it.
- Migrations contain no secrets, personal emails, user ids or private schedule data.
- Seed content for GLOBAL routines is handled separately from migrations.
- The `npm run db:*` commands only ever touch the local database. Production changes only through
  the explicit `supabase db push` above.
