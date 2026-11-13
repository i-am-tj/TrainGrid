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
| A1 | Anonymous visitor cannot reach the planner | E2E | PASS 2026-11-12 (E2E, local) — every private page redirects, export answers 401, unconfigured deployment fails closed; production checked 2026-11-12 with signed-out requests: / and /library redirect to /login, /api/export answers 401 |
| A2 | Invited Google user gets in | Manual, production | PASS 2026-11-12 (Tanuj, production), with the invite gate in place |
| A3 | Invited GitHub user gets in | Manual, production | PASS 2026-11-12 (Tanuj, production), with the invite gate in place |
| A4 | Non-invited OAuth user is denied with the friendly message | Database + E2E (local) + manual | PASS 2026-11-12 (database: refused, no profile; E2E: message shown, sign-out works). Callback refusal on production: PASS 2026-11-12 (Tanuj, production) |
| A5 | Sign-out removes access | E2E | PASS 2026-11-12 (E2E, local) — session cookies cleared and the planner then redirects to login |
| A6 | GitHub account with no usable verified email fails safely | E2E + manual | PASS 2026-11-12 (E2E, local, simulated callback error); real account not tested |

### User isolation

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| I1 | A sees only A's schedule; B sees only B's | RLS + E2E | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); E2E PASS 2026-11-12 (forged Duplicate Week included) |
| I2 | A cannot read B's session | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); app with forged form input PASS 2026-11-12 (E2E) |
| I3 | A cannot update B's session | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); app with forged form input PASS 2026-11-12 (E2E) |
| I4 | A cannot delete B's session | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); app with forged form input PASS 2026-11-12 (E2E) |
| I5 | A cannot insert a session owned by B | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); app with forged form input PASS 2026-11-12 (E2E) |
| I6 | A cannot read, update or delete B's personal routine | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); app with forged form input PASS 2026-11-12 (E2E) |
| I7 | A cannot insert a routine owned by B, or a GLOBAL routine | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); app with forged form input PASS 2026-11-12 (E2E) |
| I8 | A cannot duplicate B's week | RLS + E2E | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); E2E PASS 2026-11-12 (forged Duplicate Week included) |
| I9 | Members can read GLOBAL routines and cannot change them | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local); app with forged form input PASS 2026-11-12 (E2E) |
| I10 | Authenticated but uninvited user reads and writes nothing | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |
| I11 | Anonymous key reads and writes nothing | RLS | PASS 2026-11-12 (database, local); PASS 2026-11-12 (integration, local) |

### Admin

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| M1 | Admin can create and revoke an invitation | E2E | PASS 2026-11-12 (E2E, local); admin page working on production (Tanuj) |
| M2 | Member cannot create an invitation (action and direct query) | Integration + RLS | PASS 2026-11-12: direct query refused (database); the real invite and revoke server actions, captured from an admin and replayed by a member, change nothing (E2E). The test was confirmed to fail with the admin check removed |
| M3 | Anonymous user cannot create an invitation | Integration | PASS 2026-11-12: direct query refused (database); the real invite and revoke server actions, captured from an admin and replayed by an anonymous visitor, change nothing (E2E). The test was confirmed to fail with the admin check removed |
| M4 | Member cannot open `/admin` | E2E | PASS 2026-11-12 (E2E, local) — 404, no admin link |

### Story 28 traceability

| Epic requirement | Covered by |
| --- | --- |
| Anonymous visitor cannot access planner | A1 |
| Invited Google / GitHub user can access | A2, A3 |
| Non-invited OAuth user is denied | A4 |
| Sign-out removes access | A5 |
| A sees A's schedule; B sees B's | I1 |
| A cannot read / update / delete B's session | I2, I3, I4 |
| A cannot read / update / delete B's personal routine | I6 |
| A cannot duplicate B's week | I8 |
| RLS itself blocks cross-user access (direct authenticated queries) | I1–I11 at database and integration level, including with the app's own filters bypassed |
| Admin can create invite | M1 |
| Member / anonymous cannot create invite | M2, M3 |
| Member cannot access `/admin` | M4 |

Every layer runs with one command: `npm run test:all` (needs Docker and the local Supabase stack).

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
| S2 | No credentials in Git history | secret scan of full history | PASS 2026-11-12 (`npm run scan:secrets -- --history`: 56 commits, all branches, nothing found; scanner verified on a planted key) |
| S3 | `.env.example` contains placeholders only | review | PASS 2026-11-12 |
| S4 | RLS enabled on every table in `public`; member-facing tables have policies scoped to `authenticated`; `invitations` has none | Database | PASS 2026-11-12 (local, 5 tables) |
| S5 | No filesystem writes in production code paths | search for `fs` writes outside `scripts/` | PASS 2026-11-12 (no fs reads or writes in app/, components/, lib/ outside seed tooling and tests) |
| S6 | No known vulnerabilities in production dependencies | `npm audit --omit=dev` | PASS 2026-11-12 (after D-76) |
| S7 | Preview deployments cannot reach production data | Signed-out requests to a preview; Vercel settings review | Previews protected by Vercel Authentication: PASS 2026-11-12. Variables Production-only: confirmed by Tanuj 2026-11-12 |

### Production verification (step 15, 2026-11-12)

| # | Check | How | Result |
| --- | --- | --- | --- |
| P1 | Production schema matches the repository | `supabase migration list --remote` | PASS (6 of 6, 2026-11-13) |
| P2 | RLS on every table; policies only for `authenticated`; no anon table privileges | read-only query | PASS (5 tables, 14 policies, 0 anon grants) |
| P3 | Seed present; no personal routine has a slug; every session has a valid snapshot | read-only query | PASS (18 routines, 96 items; 0; 0 invalid) |
| P4 | Only Google and GitHub sign-in; no email, phone or anonymous sign-in | public auth settings endpoint | PASS |
| P5 | Signed-out requests: private pages redirect, export 401, callback fails safely, login shows only the two providers | HTTP requests | PASS |
| P6 | No secret key, admin list or private key in the JavaScript served to browsers | download and scan all 9 chunks | PASS |
| P7 | Supabase security advisor | `supabase db advisors --remote` | PASS 2026-11-13: the exposed function fixed and confirmed; 2 accepted warnings remain (D-80) |
| P8 | Members use the planner and library on production | Tanuj | PASS (step 12) |

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


---

# Epic 2 test plan — Global workout library

Reference baseline at Epic 1 closure: 131 unit, 189 database, 26 integration, 53 E2E (54 with the
pending footer test). These are reference counts, not pass criteria; any unexplained reduction is
investigated (spec §8.9).

| # | Check (spec §8) | Layer | Step | Result |
| --- | --- | --- | --- | --- |
| G1 | Every GLOBAL routine readable by an active member, not editable or deletable by any ordinary member, invisible to anonymous, uninvited and revoked identities | Database (exists: I9–I11, R2) + E2E per view | 02 | — |
| G2 | `Mine` and `All` show only the member's own PERSONAL routines; A can neither read nor copy B's | Integration + E2E | 02, 05 | — |
| G3 | Search and filters: partial, case-insensitive, whitespace, blank, zero results, item-name matches, equipment aggregation, combined filters (AND), malformed URL values, refresh and back | Unit + integration + E2E | 03 | — |
| G4 | A copy is owned by the caller, has new routine and item ids, the same ordered content; the source is unchanged; a failed save leaves nothing | Database + integration + E2E | 05 | — |
| G5 | Scheduling a GLOBAL routine and a copied routine both produce independent snapshots; later source edits change neither | Integration + E2E | 04, 05 | — |
| G6 | Legacy UUID and slug links (`/library/lower-a`, `/edit`, `?template=`) still resolve safely | E2E (exists) | 04 | — |
| G7 | Keyboard use, labels, visible focus; phone and desktop layouts without overflow | E2E + screenshots | 02–04, 08 | — |
| G8 | No unexpected migrations, no new secret-key use, no secrets in bundles, no runtime file access | Code search + bundle scan + `scan:secrets` | each step, 08 | — |
| G9 | Full suite passes: lint, typecheck, unit, database, integration, E2E, build, secret scan | `npm run test:all`, `npm run scan:secrets` | each step | — |
| G10 | Seed ids are stable: existing item ids keep their exercise; generation is deterministic | Unit (seed) | 07 | — |
| G11 | Production smoke test (spec §8): filter, read-only detail, legacy link, copy and edit, schedule both, second member isolation, signed-out and revoked denied, seed counts and advisories unchanged | Manual, production | 08 | — |
