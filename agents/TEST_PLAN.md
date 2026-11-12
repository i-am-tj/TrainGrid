# Epic 1 test plan

Last updated: 2026-11-12. Results are recorded in [STORY_REPORTS.md](STORY_REPORTS.md).
The product-level plan in `docs/TEST_PLAN.md` is updated in step 16.

## Layers

| Layer | Tool | Runs against | Introduced in step |
| --- | --- | --- | --- |
| Lint | `npm run lint` | — | exists |
| Unit | Vitest (`npm test`) | pure functions, Zod schemas | exists; extended in 10 |
| Database schema | pgTAP (`npm run db:test`) | local Postgres (Docker) | 2 |
| RLS | pgTAP | local Postgres, as `anon` / `authenticated` roles | 3 |
| Integration | Vitest (`npm run test:integration`) | local Supabase API, real signed-in users | 10 |
| E2E | Playwright | `next dev` + local Supabase, seeded users (required from step 9: planner tests sign in as a member) | 5, 8, 9, 12, 13 |
| Build | `npm run build` | — | exists |
| Production smoke | manual, by Tanuj | `https://train-grid.vercel.app` | 15 |

Test identities — User A, User B, Admin — exist only in the local Supabase stack and are created
by the test setup. They are never created in the production project.

RLS is proven at two levels. The pgTAP suite (step 3) runs each query as the `anon` or
`authenticated` database role with a user's JWT subject set, which is how the Supabase API
executes requests, so it tests the policies directly. Step 13 repeats the cross-user checks through
the real API with signed-in clients and the publishable key.

The suite was confirmed able to fail: with RLS switched off on `scheduled_sessions` in a scratch
database, nine RLS assertions and the S4 check failed.

Real Google and GitHub sign-in cannot be automated without real accounts. Those two checks are
manual, on production, and are recorded with date and outcome.

## Release-blocking matrix

### Authentication

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| A1 | Anonymous visitor cannot reach the planner | E2E | PASS 2026-11-12 (E2E, local) — every private page redirects, export answers 401, unconfigured deployment fails closed; production pending |
| A2 | Invited Google user gets in | Manual, production | PASS 2026-11-12 (Tanuj, production), with the invite gate in place |
| A3 | Invited GitHub user gets in | Manual, production | PASS 2026-11-12 (Tanuj, production), with the invite gate in place |
| A4 | Non-invited OAuth user is denied with the friendly message | Database + E2E (local) + manual | PASS 2026-11-12 (database: refused, no profile; E2E: message shown, sign-out works). Callback refusal on production: PASS 2026-11-12 (Tanuj, production) |
| A5 | Sign-out removes access | E2E | PASS 2026-11-12 (E2E, local) — session cookies cleared and the planner then redirects to login |
| A6 | GitHub account with no usable verified email fails safely | E2E + manual | PASS 2026-11-12 (E2E, local, simulated callback error); real account not tested |

### User isolation

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| I1 | A sees only A's schedule; B sees only B's | RLS + E2E | PASS 2026-11-12 (database, local); E2E pending; PASS 2026-11-12 (integration, local) |
| I2 | A cannot read B's session | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I3 | A cannot update B's session | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I4 | A cannot delete B's session | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I5 | A cannot insert a session owned by B | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I6 | A cannot read, update or delete B's personal routine | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I7 | A cannot insert a routine owned by B, or a GLOBAL routine | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I8 | A cannot duplicate B's week | RLS + E2E | PASS 2026-11-12 (database, local); E2E pending; PASS 2026-11-12 (integration, local) |
| I9 | Members can read GLOBAL routines and cannot change them | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I10 | Authenticated but uninvited user reads and writes nothing | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I11 | Anonymous key reads and writes nothing | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |

### Admin

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| M1 | Admin can create and revoke an invitation | E2E | PASS 2026-11-12 (E2E, local); admin page working on production (Tanuj) |
| M2 | Member cannot create an invitation (action and direct query) | Integration + RLS | Direct query: PASS 2026-11-12 (database, local). Guard: PASS (unit); page returns 404 (E2E). The action was not invoked directly as a member |
| M3 | Anonymous user cannot create an invitation | Integration | Direct query: PASS 2026-11-12 (database, local). Guard: PASS (unit); page returns 404 (E2E). The action was not invoked directly while anonymous |
| M4 | Member cannot open `/admin` | E2E | PASS 2026-11-12 (E2E, local) — 404, no admin link |

### Member revocation (step 8b)

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| R1 | Admin revokes an accepted member; their next request is refused (page and export) | E2E | PASS 2026-11-12 (local) |
| R2 | A revoked member cannot read, add, change or delete anything, including their own rows | Database + integration | PASS 2026-11-12 (local) |
| R3 | A revoked member's data is kept unchanged | Database + integration | PASS 2026-11-12 (local) |
| R4 | Signing in again does not restore access; a new invitation does, with the data | Database | PASS 2026-11-12 (local) |
| R5 | An admin cannot be revoked; the admin's row offers no revoke action | Database + integration + E2E | PASS 2026-11-12 (local) |
| R6 | Members and anon cannot call `revoke_invitation()`; a revoked member cannot un-revoke themselves | Database + integration | PASS 2026-11-12 (local) |

### Secrets and platform

| # | Check | How | Result |
| --- | --- | --- | --- |
| S1 | Secret key absent from client bundles | search `.next/static` after build | PASS 2026-11-12 (local build: neither the key value nor its variable name appears) |
| S2 | No credentials in Git history | secret scan of full history | — |
| S3 | `.env.example` contains placeholders only | review | PASS 2026-11-12 |
| S4 | RLS enabled on every table in `public`; member-facing tables have policies scoped to `authenticated`; `invitations` has none | Database | PASS 2026-11-12 (local, 5 tables) |
| S5 | No filesystem writes in production code paths | search for `fs` writes outside `scripts/` | PASS 2026-11-12 (no fs reads or writes in app/, components/, lib/ outside seed tooling and tests) |

### Approved model decisions

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| D1 | Scheduling a routine stores a full snapshot; no session renders from its routine (D-03) | Integration + E2E | PASS 2026-11-12 (integration, local) |
| D2 | Editing the source routine leaves the scheduled session unchanged (D-03) | E2E | PASS 2026-11-12 (integration, local); E2E PASS 2026-11-12 |
| D3 | Deleting the source routine keeps the session and nulls `source_routine_id` (D-03) | Database schema | PASS 2026-11-12 (database and integration, local) |
| D4 | Editing one scheduled session does not change its duplicates or the routine (D-03) | E2E | PASS 2026-11-12 (integration, local); E2E PASS 2026-11-12 |
| D5 | Duplicate Week copies snapshots with new session and item ids (D-03, D-04B) | Unit + E2E | PASS 2026-11-12 (unit and integration, local); E2E PASS 2026-11-12 |
| D6 | Items save and load through structured fields; text such as `Rest: 2 min` typed into notes stays in notes (D-04) | Unit + E2E | PASS 2026-11-12 (unit and integration, local); E2E PASS 2026-11-12 |
| D7 | Schema has no performed-workout columns (D-04A) | Database schema | PASS 2026-11-12 (local) |
| D8 | Seeded GLOBAL routines preserve order, equipment and video links of every template file (D-04, D-05) | Seed unit test + database | PASS 2026-11-12 (unit: all 18 files; database: 18 routines, 96 items, re-seeding idempotent). No template has a video link today |
| D9 | Member can create, edit and delete a PERSONAL routine and cannot edit a GLOBAL one (D-05) | RLS + E2E | PASS 2026-11-12 (integration, local); E2E PASS 2026-11-12 |
| D10 | Export contains only the signed-in user's routines, items and sessions; no GLOBAL routines, invitations or auth data (D-06) | Integration | PASS 2026-11-12 (integration, local) |
| D11 | Export requires authentication (D-06) | Integration | PASS 2026-11-12 (E2E, local, step 9: export answers 401 when not a member) |
| D12 | No import UI and no import endpoint or action exists (D-06) | E2E + code search | PASS 2026-11-12 (E2E: no import control; code: import action removed) |

### Planner regression

The Playwright journeys (schedule, reschedule, delete, untimed and timed sessions, several
sessions per day, Duplicate Week, session detail, mobile and desktop layouts) run as a fresh
signed-in member against the local database. PASS 2026-11-12 (step 12: 40/40, run twice).
Changed on purpose: live-linked templates (D-03), hosted import (D-06) and "Replace template"
(D-65) are gone, and their tests were replaced by the snapshot, export and isolation tests.
