# Supabase setup

TrainGrid uses Supabase for authentication and its PostgreSQL database. This page covers the
local development stack, the production project, and how the two are kept apart.

See [ADR 001](adr/001-multi-user-supabase-architecture.md) for why, and
[`supabase/README.md`](../supabase/README.md) for migrations and database tests.

## Environments

| Environment | Supabase | Where the values live |
| --- | --- | --- |
| Local development and tests | Local stack in Docker | `.env.local` (ignored by Git) |
| Vercel Production | The TrainGrid Supabase project (Free plan) | Vercel environment variables, Production only |
| Vercel Preview | None | Not configured, so previews cannot reach production data |

A laptop or a preview build never holds production values.

## Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Publishable key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Server only | Secret key (`sb_secret_…`); bypasses RLS. Not used until the admin invitation flow. |
| `TRAINGRID_ADMIN_USER_IDS` | Server only | Comma-separated admin user ids. Not used until the admin invitation flow. |

The two public values are sent to the browser on purpose. Data is protected by Supabase Auth and
Row Level Security, not by hiding the publishable key. The app refuses to start its Supabase
clients if a secret key is placed in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

`.env.example` lists every variable with placeholders. Real values are never committed.

## Local development

Requires Docker.

```bash
npm run supabase:start    # database, auth and API on http://127.0.0.1:54321
npm run supabase:status   # prints the local URL and keys
cp .env.example .env.local
```

Put the local publishable key from `supabase:status` into `.env.local`, then:

```bash
npm run dev
```

`npm run supabase:stop` stops the stack. The keys printed by the local stack are fixed
development defaults; they grant nothing outside your machine.

To confirm the app can reach Supabase, open `/api/health`. It returns `{"supabase":"ok"}` when
the connection works, `unconfigured` when the variables are missing, and `unreachable` otherwise.

## Production project

Created in the Supabase dashboard with these choices:

| Setting | Value | Reason |
| --- | --- | --- |
| Plan | Free | Zero-cost requirement |
| GitHub integration | Not connected | Migrations are applied deliberately at rollout, not on push |
| Enable Data API | On | The Supabase client uses it |
| Automatically expose new tables | Off | Migrations grant access explicitly per table and role |
| Enable automatic RLS | On | Safety net; migrations already enable RLS on every table |

The database password is kept in a password manager. It is needed only to apply migrations and
never goes into the repository, Vercel, or chat.

### Connecting Vercel

In Vercel → the TrainGrid project → Settings → Environment Variables, add for the **Production**
environment only:

- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase → Project Settings → API
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable key from the same page

Redeploy, then open `https://train-grid.vercel.app/api/health`. `{"supabase":"ok"}` confirms the
deployment reaches the project.

Until these are set, the deployed site behaves exactly as before: the session proxy passes
requests through untouched.

## Authentication settings in the production project

These are set once in the Supabase dashboard, under Authentication.

| Setting | Value | Reason |
| --- | --- | --- |
| Email provider | Disabled | No password or email-link sign-in; without this, anyone could register through the API |
| Site URL | `https://train-grid.vercel.app` | Default destination after sign-in |
| Redirect URLs | `https://train-grid.vercel.app/auth/callback` | The only place Supabase may send an authorization code |
| Google provider | Enabled, with the client ID and secret below | Sign-in |

Local addresses are not added to the production project. Local development uses the local stack.

### Google OAuth client

In Google Cloud Console (APIs & Services):

1. Configure the OAuth consent screen: user type **External**, app name TrainGrid, your email as
   support and developer contact. Only the default scopes are needed: `openid`, `email`,
   `profile`.
2. Publish the app ("In production"). With only those scopes no Google review is required. While
   it is left in "Testing", only accounts you list as test users can sign in.
3. Create credentials → OAuth client ID → **Web application**.
   - Authorized JavaScript origins: `https://train-grid.vercel.app`
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
     (Supabase shows the exact value on the Google provider page)
4. Copy the client ID and client secret into Supabase → Authentication → Providers → Google, and
   enable the provider.

The Google client secret lives only in the Supabase dashboard. It never goes into the repository
or Vercel.

### Sign-in flow

```
/login ── Continue with Google ──▶ Supabase ──▶ Google
                                                  │
/auth/callback?code=… ◀── Supabase ◀──────────────┘
      │ exchanges the one-time code for a session cookie
      ▼
the page the user originally asked for (same-site paths only)
```

Any failure returns to `/login` with one generic message. Provider error details are never shown.

## How the app talks to Supabase

| File | Used from | Notes |
| --- | --- | --- |
| `lib/supabase/client.ts` | Client Components | Browser client, publishable key |
| `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | One client per request, reads the session from cookies; marked `server-only` |
| `lib/supabase/proxy.ts` + `proxy.ts` | Every request | Refreshes the session cookie; marks responses that set auth cookies as uncacheable |
| `lib/supabase/env.ts` | All of the above | Reads and validates the public configuration |
| `lib/auth/actions.ts` | `/login` | Server actions that start OAuth sign-in and sign out |
| `app/auth/callback/route.ts` | OAuth return | Exchanges the one-time code for a session |

All three clients use the publishable key and the signed-in user's session, so every query is
subject to Row Level Security. The proxy only keeps sessions fresh; it does not protect routes.
