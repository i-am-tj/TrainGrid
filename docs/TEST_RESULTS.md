# Test results

## Epic 2 — global workout library (13 Nov 2026)

Local run of `npm run test:all` on the release branch (`epic-2/08-release-docs`), against the local
Supabase stack. Per-check results are in `agents/TEST_PLAN.md` (G1–G11).

| Suite | Result |
| --- | --- |
| ESLint, TypeScript (`npm run typecheck`) | Pass |
| Unit — Vitest (`npm test`) | **174 passed** (19 files) |
| Database — pgTAP (`npm run db:test`) | **191 passed** (7 files) |
| Integration — Vitest (`npm run test:integration`) | **35 passed** |
| End to end — Playwright (`npm run test:e2e`) | **103 passed** |
| Production build (`npm run build`) | Pass |
| Secret scan, files and full Git history (`npm run scan:secrets`) | No credentials found |
| Browser bundle (`.next/static`) | No secret key, `sb_secret_` or `service_role` |
| Production dependency audit (`npm audit --omit=dev`) | 0 vulnerabilities |
| Local and production schema (read-only comparison) | Same migrations, policies, columns, grants and function code; shared routines and items identical (18 / 96) |

Every count is at or above Epic 1's (131 / 189 / 26 / 53). Nothing was removed.

What Epic 2 added:
- views
- search and filters (including malformed URLs, refresh and back)
- the single bounded list request
- card summaries
- read-only detail with labelled video links
- scheduling from the library, with snapshot independence for GLOBAL and copied routines
- copy to My Library (exact content, new ids, refused sources, atomic, one copy per double click)
- the header and phone menu
- seed item id stability
- phone and desktop layout and keyboard checks

Security regression checks:
- no migration changed during Epic 2
- the secret key is used only for admin invitations, as before
- no runtime file access
- a forged source id sent to the real copy action is refused

### Production smoke test (owner, after the release PR is merged)

Signed in on production. Tick each line; record the date in `agents/TEST_PLAN.md` (G11).

- [ ] `/library` shows 18 routines in **TrainGrid**. Search “lower” and filter Strength + Barbell;
      the URL keeps the filters on refresh and back.
- [ ] Open Lower A: readable, no Edit; `/library/lower-a` redirects to it; `/library/lower-a/edit`
      shows no editor.
- [ ] **Copy to My Library** on Lower A → lands on the copy with the confirmation → Edit the copy's
      name → Lower A itself is unchanged.
- [ ] Schedule Lower A and the copy; open both sessions; edit the copy again; both sessions keep
      their workout.
- [ ] A second invited member (for example the phone account, once its own) sees the TrainGrid
      routines but **not** the first member's copy, in All or Mine.
- [ ] Signed out, `/library` redirects to sign-in. The admin invitation page still lists and revokes
      invitations.
- [ ] On a phone: the menu button opens the links; library controls stack without sideways
      scrolling.
- [ ] Supabase: still 18 GLOBAL routines and 96 items; the security advisor shows only the two
      accepted warnings (D-80); no seed was applied for this release.

---

## Epic 1 — foundation

Date: 13 Nov 2026 (Epic 1, documentation closure). Local run of `npm run test:all` against the local
Supabase stack; production checks from 12 Nov 2026. Per-check results and history are in
`agents/TEST_PLAN.md`.

## Summary

| Suite | Result |
| --- | --- |
| ESLint, TypeScript (`npm run typecheck`) | Pass |
| Unit — Vitest (`npm test`) | **131 passed** (16 files) |
| Database — pgTAP (`npm run db:test`) | **189 passed** (7 files) |
| Integration — Vitest (`npm run test:integration`) | **26 passed** |
| End to end — Playwright (`npm run test:e2e`) | **53 passed** |
| Production build (`npm run build`) | Pass |
| Secret scan, files and full Git history (`npm run scan:secrets`) | No credentials found |
| Production dependency audit (`npm audit --omit=dev`) | 0 vulnerabilities |

## What was tested

### Database (pgTAP, as the real API roles)

- Constraints: GLOBAL/PERSONAL ownership, slugs only on GLOBAL, item fields, equipment, video links,
  snapshot shape, sort order, durations.
- Row Level Security on every table: members see only their own rows; GLOBAL routines readable and
  not writable; anonymous and uninvited users read and write nothing; ownership cannot be changed.
- Invitations: normalised emails, one live invitation per email, `accept_invitation()` accepts only
  a confirmed Google or GitHub email with a live invitation, refused attempts consume nothing.
- Revocation: a revoked member can reach nothing, including their own data; data is kept; a new
  invitation restores access; admins are protected.
- `save_personal_routine()`: atomic, stable item ids, cannot touch other routines.
- Seed: 18 routines and 96 items, fields filled, order kept, no metadata left in text.
- Function exposure: no `SECURITY DEFINER` function callable by anonymous visitors.

### Integration (real signed-in users through the API)

Routine and session CRUD, snapshots unaffected by routine edits and deletion, customising one
occurrence, Duplicate Week with new ids, export scope, legacy slug lookup, revocation, and every
cross-user case — through the data layer and by direct queries that bypass the app’s own filters.

### End to end (Playwright, fresh member per test)

- Sign-in page, OAuth hand-off (PKCE, account chooser, same-site callback), fixed error messages,
  invite-only notice, sign-out.
- Route protection for every private page and the export; unconfigured deployments fail closed.
- Planner journeys: personal and shared routines on the calendar, timed and untimed sessions,
  several per day, reschedule, refuse non-existent weeks, Duplicate Week, mobile layout.
- Library: shared routines read-only, personal routine lifecycle, structured fields, legacy links.
- Admin: invite, duplicate and invalid refused, revoke pending, revoke accepted member, 404 for
  non-admins.
- Forged requests: another member’s ids swapped into real forms, injected ownership fields, and an
  admin’s captured requests replayed by a member and an anonymous visitor — all refused, checked in
  the database.

### Production (12 Nov 2026)

- Read-only database checks: schema matches, RLS on every table, no anonymous grants, seed present,
  every snapshot valid.
- Auth: only Google and GitHub sign-in enabled.
- Signed-out requests: private pages redirect to sign-in, export 401.
- JavaScript served to browsers: no secret key, admin list or private key.
- Google and GitHub sign-in, invite acceptance and refusal, the admin page, revocation and the
  planner checked by the project owner.

## Confirmed able to fail

Tests were run against deliberately broken versions to show they detect real problems:

| Break | Detected by |
| --- | --- |
| RLS disabled on `scheduled_sessions` | Database and integration isolation tests |
| Admin check removed from invitation creation | Replayed-admin-request E2E test |
| An exposed `SECURITY DEFINER` function | Function-exposure database tests |
| A planted secret key and database password | `scan:secrets` |

## Known limitations

- Real Google and GitHub sign-in cannot be automated; it is verified manually on production.
- The case of a GitHub account without a verified email is tested with a simulated provider error.
- Only Chromium is used in Playwright.
- Screen-reader and contrast audits were not run with dedicated tooling.
- Eight moderate advisories remain in the lint toolchain (`typescript-eslint`); no patched release
  exists yet. They do not affect the application.
- Next.js logs “The destination stream closed early” during some E2E downloads; tests pass.
