# Test plan

Current as of Epic 2, November 2026. The full security matrix, with a result for every check, is
in `agents/TEST_PLAN.md`; this page explains the strategy.

## Strategy

Behaviour is tested at the lowest layer that can prove it, and security is tested at every layer,
because each layer is meant to hold even if another one fails.

| Layer | Tool | Runs against | What it covers |
| --- | --- | --- | --- |
| Unit | Vitest (`npm test`) | Pure functions | ISO weeks and dates, Zod schemas, snapshot copying, route rules, redirects, invite results, admin list parsing, seed conversion of every template, legacy import |
| Database | pgTAP (`npm run db:test`) | Local Postgres, as the `anon` and `authenticated` roles | Constraints, Row Level Security for every table, invitations and `accept_invitation()`, member revocation, `save_personal_routine()`, seeded content, which functions the API can call |
| Integration | Vitest (`npm run test:integration`) | Local Supabase API, real signed-in users | The data layer end to end: routine and session CRUD, snapshots, Duplicate Week, export scope, every cross-user case both through the data layer and by direct queries |
| End to end | Playwright (`npm run test:e2e`) | `next dev` + local Supabase, a fresh member per test | Planner journeys, library, sign-in pages, route protection, admin page, revocation, and forged requests to the real server actions |
| Static | ESLint, TypeScript, `npm run scan:secrets` | Source and Git history | Lint, types, credentials in files or history |
| Production | Read-only checks and manual sign-in | `train-grid.vercel.app` | Schema and RLS state, auth providers, signed-out routes, shipped JavaScript; Google and GitHub sign-in by the owner |

`npm run test:all` runs lint, typecheck, unit, database, integration, E2E and build in order. It
needs Docker and the local Supabase stack (`npm run supabase:start`) with its keys in `.env.local`;
tests that need the stack skip themselves without it.

Test users exist only in the local stack. Helpers refuse to create users or use the secret key
against anything but a local URL.

## Coverage map

1. **Access** — sign-in page offers only Google and GitHub; the OAuth hand-off carries PKCE and a
   same-site callback; failures show fixed messages; uninvited and unverified users are refused in
   the database; sign-out removes access. Real Google and GitHub sign-in is checked manually on
   production.
2. **Route protection** — every private page redirects anonymous visitors, the export answers 401,
   a deployment without Supabase settings fails closed, signed-in non-members are turned away.
3. **Isolation** — member A cannot read, change, delete, duplicate or plant data for member B:
   in the database (RLS), through the data layer, and with forged form input to the app.
4. **Admin** — invite, duplicate refused, invalid refused, revoke pending, revoke accepted member;
   non-admins get 404; admin requests replayed by a member or an anonymous visitor change nothing.
5. **Planner** — seven days, week navigation, timed and untimed sessions, several per day,
   reschedule, delete, Duplicate Week, mobile layout without horizontal scrolling.
6. **Library** — GLOBAL routines read-only, personal routine create/edit/delete, structured fields,
   legacy slug links; All / TrainGrid / Mine views; search and filters (every-word match, item
   names, equipment, combined, malformed URLs, refresh and back); one bounded list request; card
   summaries; Schedule from card and detail; copy to My Library (exact content, new ids, source
   unchanged, other members' and own routines refused, atomic, no double copy); phone and desktop
   layout, keyboard use.
7. **Snapshots** — scheduling copies; editing or deleting the routine never changes a session;
   customising one session changes only that session.
8. **Validation** — dates, times, weeks, durations, names, equipment, YouTube links and item counts
   are rejected on the server when invalid.
9. **Export** — contains only the member’s own data; there is no import.
10. **Seed** — every template converts with nothing lost; the seed file and the item id lock match
    the templates; re-seeding is idempotent; an item id never moves to a different exercise.
11. **Secrets** — no credentials in files or Git history; the secret key is absent from browser
    bundles.

Several suites were confirmed able to fail: with RLS disabled, with the admin check removed, and
against a simulated exposed function, the relevant tests failed.

## Out of scope for automation

- Real Google and GitHub sign-in (needs real accounts; checked manually on production)
- Exhaustive screen-reader pass and visual regression screenshots
- Browsers other than Chromium
- Load and free-tier quota testing
