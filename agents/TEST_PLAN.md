# Epic 1 test plan

Last updated: 2026-11-12. Results are recorded in [STORY_REPORTS.md](STORY_REPORTS.md).
The product-level plan in `docs/TEST_PLAN.md` is updated in step 16.

## Layers

| Layer | Tool | Runs against | Introduced in step |
| --- | --- | --- | --- |
| Lint | `npm run lint` | — | exists |
| Unit | Vitest (`npm test`) | pure functions, Zod schemas | exists; extended in 10 |
| Database schema | pgTAP (`npm run db:test`) | local Postgres (Docker) | 2 |
| RLS / integration | pgTAP + Vitest, separate project | local Supabase (Docker), real signed-in clients | 3 |
| E2E | Playwright | `next dev` + local Supabase, seeded users | 12, 13 |
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
| A1 | Anonymous visitor cannot reach the planner | E2E | — |
| A2 | Invited Google user gets in | Manual, production | — |
| A3 | Invited GitHub user gets in | Manual, production | — |
| A4 | Non-invited OAuth user is denied with the friendly message | E2E (local) + manual | — |
| A5 | Sign-out removes access | E2E | PASS 2026-11-12 (E2E, local) — session cookies cleared; planner access re-checked in step 9 |
| A6 | GitHub account with no usable verified email fails safely | E2E + manual | PASS 2026-11-12 (E2E, local, simulated callback error); real account not tested |

### User isolation

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| I1 | A sees only A's schedule; B sees only B's | RLS + E2E | PASS 2026-11-12 (database, local); E2E pending |
| I2 | A cannot read B's session | RLS | PASS 2026-11-12 (database, local) |
| I3 | A cannot update B's session | RLS | PASS 2026-11-12 (database, local) |
| I4 | A cannot delete B's session | RLS | PASS 2026-11-12 (database, local) |
| I5 | A cannot insert a session owned by B | RLS | PASS 2026-11-12 (database, local) |
| I6 | A cannot read, update or delete B's personal routine | RLS | PASS 2026-11-12 (database, local) |
| I7 | A cannot insert a routine owned by B, or a GLOBAL routine | RLS | PASS 2026-11-12 (database, local) |
| I8 | A cannot duplicate B's week | RLS + E2E | PASS 2026-11-12 (database, local); E2E pending |
| I9 | Members can read GLOBAL routines and cannot change them | RLS | PASS 2026-11-12 (database, local) |
| I10 | Authenticated but uninvited user reads and writes nothing | RLS | PASS 2026-11-12 (database, local) |
| I11 | Anonymous key reads and writes nothing | RLS | PASS 2026-11-12 (database, local) |

### Admin

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| M1 | Admin can create and revoke an invitation | E2E | — |
| M2 | Member cannot create an invitation (action and direct query) | Integration + RLS | — |
| M3 | Anonymous user cannot create an invitation | Integration | — |
| M4 | Member cannot open `/admin` | E2E | — |

### Secrets and platform

| # | Check | How | Result |
| --- | --- | --- | --- |
| S1 | Secret key absent from client bundles | search `.next/static` after build | — |
| S2 | No credentials in Git history | secret scan of full history | — |
| S3 | `.env.example` contains placeholders only | review | PASS 2026-11-12 |
| S4 | RLS enabled on every table in `public`, each with policies, all scoped to `authenticated` | Database | PASS 2026-11-12 (local, 4 tables; re-checked as tables are added) |
| S5 | No filesystem writes in production code paths | search for `fs` writes outside `scripts/` | — |

### Approved model decisions

| # | Check | Layer | Result |
| --- | --- | --- | --- |
| D1 | Scheduling a routine stores a full snapshot; no session renders from its routine (D-03) | Integration + E2E | — |
| D2 | Editing the source routine leaves the scheduled session unchanged (D-03) | E2E | — |
| D3 | Deleting the source routine keeps the session and nulls `source_routine_id` (D-03) | Database schema | PASS 2026-11-12 (local) |
| D4 | Editing one scheduled session does not change its duplicates or the routine (D-03) | E2E | — |
| D5 | Duplicate Week copies snapshots with new session and item ids (D-03, D-04B) | Unit + E2E | — |
| D6 | Items save and load through structured fields; text such as `Rest: 2 min` typed into notes stays in notes (D-04) | Unit + E2E | — |
| D7 | Schema has no performed-workout columns (D-04A) | Database schema | PASS 2026-11-12 (local) |
| D8 | Seeded GLOBAL routines preserve order, equipment and video links of every template file (D-04, D-05) | Seed unit test | — |
| D9 | Member can create, edit and delete a PERSONAL routine and cannot edit a GLOBAL one (D-05) | RLS + E2E | — |
| D10 | Export contains only the signed-in user's routines, items and sessions; no GLOBAL routines, invitations or auth data (D-06) | Integration | — |
| D11 | Export requires authentication (D-06) | Integration | — |
| D12 | No import UI and no import endpoint or action exists (D-06) | E2E + code search | — |

### Planner regression

The existing Playwright journeys (schedule, reschedule, delete, untimed and timed sessions,
several sessions per day, Duplicate Week, session detail, mobile and desktop layouts) are ported
to run as a signed-in user and must pass unchanged in behaviour.
