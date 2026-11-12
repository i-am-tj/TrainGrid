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
| `SUPABASE_SECRET_KEY` | Server only | Secret key (`sb_secret_…`); bypasses RLS. Used only by the admin invitation page. |
| `TRAINGRID_ADMIN_USER_IDS` | Server only | Comma-separated Supabase user ids (UUIDs) of admins. |

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
| GitHub provider | Enabled, with the client ID and secret below | Sign-in |

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

### GitHub OAuth App

In GitHub → Settings → Developer settings → OAuth Apps → New OAuth App:

- Application name: TrainGrid
- Homepage URL: `https://train-grid.vercel.app`
- Authorization callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
  (Supabase shows the exact value on the GitHub provider page)

Leave "Enable Device Flow" off. Generate a client secret, then copy the client ID and secret into
Supabase → Authentication → Providers → GitHub and enable the provider. As with Google, the
secret lives only in the Supabase dashboard.

Create an **OAuth App**, not a GitHub App.

### Accounts and email

- Eligibility is decided by the verified email the provider reports. Supabase asks GitHub for the
  account's primary verified email; a GitHub profile's "public email" setting does not matter.
- If a provider account has no usable verified email, sign-in is refused with an explanation and
  no session is created. Invite validation is never skipped.
- When the same person signs in with Google and later with GitHub using the same verified email,
  Supabase links both sign-in methods to one user, so they see the same TrainGrid data. Accounts
  with different emails are separate users. TrainGrid adds no account-linking logic of its own.

### Invite-only access

Signing in proves identity; it does not grant access. After the code exchange, `/auth/callback`
calls the database function `accept_invitation()`, which:

1. reads the caller's own email from Supabase Auth;
2. requires that email to be confirmed and to come from a Google or GitHub identity;
3. looks for an invitation with that email (case-insensitive) that has not been revoked;
4. on a match, creates the member's `profiles` row and marks the invitation accepted.

Anyone else is signed out again immediately and sees a fixed message. Because every table's
access rules require a `profiles` row, a person who is not invited cannot read or write anything
even by calling the database API directly.

The `invitations` table is not readable or writable by members. See
[`supabase/README.md`](../supabase/README.md) for creating the first invitation.

### Managing invitations

`/admin/invitations` lets an admin invite an email address, see each invitation's status
(Pending, Accepted, Revoked) and revoke a pending one. No email is sent: the page shows the
sign-in link to pass on by hand.

- An admin is a member whose Supabase user id is listed in `TRAINGRID_ADMIN_USER_IDS`. The list
  is read on the server only; nothing the browser sends is consulted.
- The page and both of its server actions check this themselves. Anyone else, signed in or not,
  gets a 404.
- This is the only place the secret key is used, and only after the admin check has passed. The
  module that reads it is marked `server-only`, so it cannot be bundled for the browser.
- Only a pending invitation can be revoked. Removing an existing member is not supported.

To enable it in production, add in Vercel (Production only):

- `SUPABASE_SECRET_KEY` — type **Secret**; from Supabase → Project Settings → API Keys
- `TRAINGRID_ADMIN_USER_IDS` — your user id from Supabase → Authentication → Users

Then redeploy.

### Sign-in flow

```
/login ── Continue with Google / GitHub ──▶ Supabase ──▶ provider
                                                  │
/auth/callback?code=… ◀── Supabase ◀──────────────┘
      │ exchanges the one-time code for a session cookie
      │ checks the invitation; refuses and signs out if there is none
      ▼
the page the user originally asked for (same-site paths only)
```

Any failure returns to `/login` with one of three fixed messages: a generic one, the invite-only
notice, or an explanation that no verified email was available. Provider error details are never shown.

## How the app talks to Supabase

| File | Used from | Notes |
| --- | --- | --- |
| `lib/supabase/client.ts` | Client Components | Browser client, publishable key |
| `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | One client per request, reads the session from cookies; marked `server-only` |
| `lib/supabase/proxy.ts` + `proxy.ts` | Every request | Refreshes the session cookie; marks responses that set auth cookies as uncacheable |
| `lib/supabase/env.ts` | All of the above | Reads and validates the public configuration |
| `lib/auth/actions.ts` | `/login` | Server actions that start OAuth sign-in and sign out |
| `app/auth/callback/route.ts` | OAuth return | Exchanges the one-time code for a session |
| `lib/supabase/admin.ts` | Admin invitation functions only | Secret-key client; bypasses RLS; `server-only` |

The browser, server and proxy clients use the publishable key and the signed-in user's session, so every query is
subject to Row Level Security. The proxy only keeps sessions fresh; it does not protect routes.
