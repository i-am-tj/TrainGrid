# Decisions

Last updated: 2026-11-18

The decisions that still shape TrainGrid, one line each, grouped by area. IDs are kept so older
records and commits still resolve. The full history (every proposal, its reasoning, and the
superseded or one-off decisions left out here) is in
[archive/DECISIONS-2026.md](archive/DECISIONS-2026.md).

## Platform

| ID | Decision |
| --- | --- |
| L-01, D-40 | Vercel (Hobby), deployed from `main` by the Git integration; functions in `syd1`. |
| L-02, L-08 | Supabase Auth with Google and GitHub OAuth only. Apple and ChatGPT deferred; no placeholder buttons. |
| L-03, L-05 | Supabase PostgreSQL (Sydney). `supabase-js` + `@supabase/ssr`, no ORM, SQL migrations. |
| L-06, L-09 | No Supabase Storage (video links stay external) and no paid service. |
| E3-I07 | Email through Resend over `fetch` (no SDK), with an idempotency key per attempt. |
| D-09, D-24, D-78 | Development and tests use a local Supabase stack. Only Vercel Production holds production values; Preview has none and is behind Vercel Authentication. |

## Access and security

| ID | Decision |
| --- | --- |
| L-07, D-01, D-35 | Invite-only, no passwords. Membership is a non-revoked `profiles` row, created only by `accept_invitation()` from the caller's verified Google/GitHub email. |
| L-04, D-21, D-59 | Server checks **and** Row Level Security on every table; member data needs ownership and active membership (`is_member()`). |
| D-47, D-48, D-51 | Routes are private by default (`lib/auth/routes.ts`). Every page, action and the export route calls `requireMember()`; data functions run as the member and are narrowed by user id. |
| D-07, D-44, D-45 | Admins are `TRAINGRID_ADMIN_USER_IDS`. Admin pages 404 for everyone else, and each admin function checks again before using the secret key (its only use). |
| D-58 | Admins can revoke a member's access; their data is kept. |
| D-31, E3-I03 | OAuth with PKCE; after sign-in only same-site paths are followed, defaulting to `/home`. |
| E3-I10 | Links in emails use `TRAINGRID_SITE_URL`, never the request's Host header. |

## Product

| ID | Decision |
| --- | --- |
| D-03, D-15 | Scheduling copies the routine into the session (a versioned snapshot); later edits never rewrite a session. |
| D-04A | TrainGrid plans training; it does not log performance (Strava and Hevy do that). |
| D-06, D-56 | Members export their own data (`traingrid-export` v2). There is no hosted import. |
| D-12, D-54, D-55 | Sessions store a calendar `date` (no time zone) and an optional start time on the hour or half hour. |
| E2-D01, E2-D03 | The library shows All / TrainGrid / Mine. Shared routines are seeded from `data/templates/` and read-only; members copy them to edit. |
| E3-I01, E3-I02 | `/` is the public landing page for everyone; route groups choose the shell (marketing, app, info). |
| E3-I05, V1-08 | “Today” is the member's device time zone (the `tg_tz` cookie), for home, the planner and the profile; see V1-08 for the first request. |
| E3-I09 | Email status is worded truthfully (“accepted by provider”, never “delivered”). |
| E3-I12, E3-I13 | Loaders say when loading is slow and retry once; `/home` streams each section on its own. |
| E3-I14 | “Welcome” on a member's first visit after accepting the invitation, “Welcome back” after that. |
| V1-01 | No browser-native dialogs: every interruption is the themed `Modal` on `<dialog>`. |
| V1-02 | Feedback is stored insert-only for the member (10 per 24 h) and emailed to the owner as “TrainGrid Feedback”. |
| V1-03 | Getting started on `/home`: three steps derived from the member's own data, hideable per device. |
| V1-04, V1-07 | `/privacy`, `/terms` and `/whats-new` are public. Visitors find them in the header's navigation (which replaced Features and About, 2026-11-19); members on `/profile`. The footer carries only the credit, monogram and social links. |
| V1-05, V1-06 | Installable (manifest and icons); server errors are logged without personal data, with optional webhook alerts. |
| V1-07 | **Profile** (`/profile`, 2026-11-18): identity, plan numbers, data download, appearance (light, dark or device), time zone, sign out, and About TrainGrid. The header shows the member's initials; the phone menu has a Profile row. |
| V1-08 | **First-request time zone** (2026-11-18): the server stamps the day it rendered on `<html data-today>`. When the device's day differs (no cookie yet, or a stale one after travel), the pre-paint script saves the zone and loads the page once more (`/week/current` again if it was a redirect), at most once per day and zone. The planner's today highlight comes from the server's today, never the render-time clock. |
| V1-10 | **Invite requests** (2026-11-19): visitors can request an invite from `/login` (the landing page links to `/login?request=invite`, which opens the dialog). Stored in `invite_requests` through `request_invite()`, a security-definer function executable by the service role only, called once by the public server action with the secret key; `anon` still executes no function. Limits in the database: one pending request per address, 3 per network per hour (daily-rotating HMAC of the IP), 50 a day. The visitor's answer never reveals whether an address is invited. Only the owner is emailed; nothing is sent to the visitor. Admins invite or dismiss on Invitations; an invitation marks the request invited (trigger). Deleted after 180 days. Details: [docs/SECURITY.md](../docs/SECURITY.md#invite-requests). |
| V1-09 | Duplicate week is removed from the planner (2026-11-18): the planner offers only controls that are available on every screen. |

## Engineering

| ID | Decision |
| --- | --- |
| D-10, D-19 | Zod validates every mutation; categories and equipment are checked `text`, not enums. |
| D-17, D-18, D-57 | New tables enable RLS with explicit grants. pgTAP for the database, integration tests as real local users, Playwright for journeys. |
| D-20 | `lib/database.types.ts` is generated (`npm run db:types`) after each migration. |
| D-16, D-62–D-64 | `supabase/seed.sql` is generated from the templates with stable UUIDs; a test fails if it is stale. |
| D-74, D-75 | `npm run test:all` runs every check; `npm run scan:secrets` guards the repository. CI runs on every PR ([docs/CI.md](../docs/CI.md)). |
| D-38 | Production migrations are applied by the owner, before or with the deploy that needs them. |
