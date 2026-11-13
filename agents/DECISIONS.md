# Decisions

Last updated: 2026-11-12

Status values: **LOCKED** (approved in the epic), **APPROVED** (resolved by Tanuj, final for
Epic 1), **DEFERRED** (explicitly not in Epic 1), **PROPOSED** (agent recommendation, followed
unless Tanuj objects). There are no open decisions.

## Locked by the epic

| ID | Decision |
| --- | --- |
| L-01 | Hosting: Vercel Hobby, deployed by the GitHub → Vercel Git integration |
| L-02 | Authentication: Supabase Auth, Google and GitHub OAuth only |
| L-03 | Database: Supabase PostgreSQL, Free plan; all mutable production data lives there |
| L-04 | Authorization: server-side checks and Row Level Security, both mandatory |
| L-05 | Clients: `@supabase/supabase-js` + `@supabase/ssr`; no ORM; SQL migrations |
| L-06 | No Supabase Storage; YouTube references stay external URLs |
| L-07 | Invite-only; no public signup, no passwords |
| L-08 | Apple and ChatGPT sign-in deferred; no placeholder buttons |
| L-09 | No paid service of any kind |
| L-10 | Formal ADR lives at `docs/adr/001-multi-user-supabase-architecture.md` |

## Approved by Tanuj on 2026-11-12

### D-03 Scheduled sessions always snapshot — APPROVED

Scheduling a routine copies its complete workout definition into the scheduled session. There is
no "follows template" mode; this is the only scheduling behaviour.

- Editing the source routine does not change a scheduled session.
- Deleting the source routine does not delete a scheduled session.
- Editing a scheduled session affects only that occurrence.
- Duplicate Week copies the snapshots.
- `source_routine_id` is optional provenance only and never controls session contents. It is set
  to null when the routine is deleted.

### D-04 Workout item structure — APPROVED WITH MODIFICATION

Workout items use explicit structured fields. Nothing is parsed out of a generic details box at
runtime; there are no magic `Rest:` / `Target:` strings.

| Field | Meaning |
| --- | --- |
| `name` | Exercise, movement or workout step name |
| `instruction` | Planned work to perform, e.g. `4 × 5–6` |
| `rest` | Planned recovery instruction, e.g. `2–3 min` |
| `target` | Planned intensity: RPE, pace, HR zone, effort |
| `notes` | Optional coaching or context notes |
| `equipment` | Zero or more equipment tags |
| `video_url` | Optional YouTube/demo reference |
| `sort_order` | Position within the routine |

`instruction` replaces the epic's working name `prescription`. The editor gets one input per
field; Rest, Target, Notes, Equipment and Video may sit under a collapsible "More details"
section to keep it compact. The same field set is used for items inside a session snapshot.

Implementation note: the existing `data/templates/*.md` files are converted to these fields once,
by the seed tooling in step 11. That conversion is migration input handling, not application
behaviour; the running app never parses Markdown bodies.

### D-04A Planned definitions stay separate from performed logs — APPROVED

Routine workout items and session snapshots describe what the user plans to do. No performed
data (`actual_weight`, `actual_reps`, `actual_rpe`, `completed_sets`, or similar) is added to
them in Epic 1. The intended future chain is:

```
Routine → Routine Workout Item → Scheduled Session Snapshot
        → Performed Workout → Exercise Log → Set Logs
```

Performed-set data (weight, reps, RPE, set number, completed-at) will live in its own tables
referencing the scheduled session, so progressive-overload features can be added without
reshaping the routine or calendar model.

### D-04B Exercise identity — DEFERRED, designed for

No exercise catalogue in Epic 1. To keep the door open for a later `exercises` table and an
`exercise_id` on items:

- Workout items have stable UUID primary keys.
- Each item copied into a session snapshot gets its own stable UUID, and records the id of the
  routine item it came from.
- Nothing keys off an item's display name.

### D-05 Library behaviour during Epic 1 — APPROVED, with scope boundary

- The existing templates are seeded as GLOBAL routines: visible to members, read-only to them,
  managed as system content.
- The existing routine editor is kept and writes PERSONAL routines. A member can create, view,
  edit and delete their own.
- Not in Epic 1: polished Global / My Library navigation, advanced filtering, richer search,
  global-to-personal copy workflows, and any global-library management UI.

### D-06 Backup / export — APPROVED

- Export is kept and is scoped entirely to the signed-in user: their personal routines, those
  routines' workout items, and their scheduled sessions.
- Export never contains another user's data, invitation or admin data, Supabase Auth internals,
  or any secret. GLOBAL routines are not included; snapshots already carry the scheduled content.
- Hosted import is removed: no import UI and no import endpoint in Epic 1. It may return later
  with explicit handling of validation, ownership, conflicts, duplicates, schema versions and
  security.

## Proposed — will proceed unless objected to

| ID | Decision | Reason |
| --- | --- | --- |
| D-01 | Membership is "a `profiles` row exists". The row is created only by a `security definer` database function that checks the caller's verified email against a valid invitation and marks it accepted. Every RLS policy on user data requires membership as well as ownership. | An OAuth user who is not invited can obtain a Supabase session but can read or write nothing, even by calling the database API directly. Invite enforcement does not depend on application code. |
| D-02 | DEFERRED. Blocking uninvited sign-ups at the auth layer with a Supabase "before user created" hook was considered and not built in step 7. | It is tidiness, not security: an uninvited person can get an `auth.users` row but D-01 gives them no access, and the callback signs them out. Revisit if stray auth users become a nuisance. |
| D-07 | `invitations` has RLS enabled and no policies for members. Admin server actions check the caller against `TRAINGRID_ADMIN_USER_IDS` and then use the secret key. This is the only use of the secret key in the app. | The database cannot see an environment variable, so admin rights cannot be expressed as a policy without adding a role table. Denying everyone at the database and gating on the server is the smallest secure design. |
| D-08 | Invitation delivery uses the manual fallback: the admin page records the email and shows a sign-in link to send by hand. | Supabase's built-in invite email creates an email-link identity, which conflicts with OAuth-only sign-in. |
| D-09 | Development and automated tests run against a local Supabase stack (Supabase CLI + Docker). Only Vercel Production holds production Supabase values; Preview gets none. | One free cloud project, and no path from a laptop or preview build to production data. |
| D-10 | Zod for server-side validation of every mutation. | No validation library exists in the project today. |
| D-11 | Routine, workout item and session ids are UUIDs. Seeded GLOBAL routines also keep their old slug in a `slug` column. | Matches the epic's model; slugs keep the seed idempotent. |
| D-12 | `scheduled_sessions` keeps `duration_minutes` and `notes` in addition to the epic's columns, and stores a real `date` instead of `weekId` + `day`. | Both fields exist in the current planner and must be preserved; week and weekday are derived from the date. |
| D-13 | Next.js 16 `proxy.ts` refreshes the auth session and redirects anonymous visitors; every server data function still authenticates on its own. | Route protection alone is explicitly not sufficient. |
| D-14 | These records live in `agents/` and are committed. The older `.agent/` folder stays untracked and untouched. | Records should be reviewable alongside the PRs they describe. |
| D-15 | `snapshot` is a versioned JSON document: `{ "version": 1, "items": [ { id, source_item_id, name, instruction, rest, target, notes, equipment, video_url } ] }`, with array order as display order. Its shape is validated by Zod on every write and by a database check that it is an object with an `items` array. | Follows from D-03, D-04 and D-04B; the version field lets the shape evolve. |
| D-62 | Seeded routines and items get deterministic version-5 UUIDs derived from the template slug and item position. | Re-seeding updates the same rows in every environment, and item ids stay stable for snapshot provenance (D-04B). |
| D-63 | Template conversion rules: `Rest:` → rest; `Target:` and `Intensity:` → target; `Equipment:` → tags; `Video:` → YouTube URL; the first paragraph → instruction; later paragraphs → notes. Applied once by seed tooling, never by the app. | Matches every existing template; a unit test checks each file and that no metadata line is left in instructions or notes. |
| D-64 | `supabase/seed.sql` must equal the generator's output; a unit test fails if a template changes without `npm run seed:generate`. | Prevents the seed and the templates drifting apart. |
| D-17 | Tables enable RLS in the migration that creates them, with no policies, so they are closed until step 3 opens them. Privileges are granted explicitly: `anon` gets nothing; members cannot update ownership or identity columns (`user_id`, `owner_user_id`, `scope`, `routine_id`, `id`) and cannot insert or delete `profiles`. | A table is never exposed between two PRs, and a row cannot be reassigned even if a policy is later written too loosely. |
| D-18 | Database tests are pgTAP files in `supabase/tests/database/`, run with `npm run db:test`. Step 3 adds RLS tests there too, alongside the signed-in-client tests. | Runs inside the database with no extra dependency; constraints and policies are tested where they live. |
| D-19 | Categories, scope and equipment are `text` with check constraints, not Postgres enums. | Adding a value later is a one-line constraint change instead of an enum migration. |
| D-20 | Generated TypeScript database types live in `lib/database.types.ts`, regenerated with `npm run db:types` after each migration. First generated in step 10. | Nothing uses them yet, and the generator's raw output is not worth reviewing early. |
| D-21 | Membership is checked by `public.is_member()`, a `security invoker` function, and is required for reading GLOBAL routines and for every insert. An authenticated user without a profile sees nothing at all. | Implements D-01 without a privileged function; the caller can only ever see their own profile row. |
| D-22 | A scheduled session may only name a `source_routine_id` the caller can see. | Stops one member probing for, or attaching to, another member's personal routine. |
| D-23 | GLOBAL routines have no write policy for any API role; they are managed with the service role only. | Epic 2 owns global-library management; until then no member path can change shared content. |
| D-24 | Local `.env.local` points at the local Supabase stack. Production values are entered only in Vercel (Production). | Applies D-09: a laptop never holds production configuration. Supersedes the earlier note that the cloud URL and key go in `.env.local`. |
| D-25 | The production project was created with the GitHub integration not connected, "Automatically expose new tables" off and "Enable automatic RLS" on. | Migrations are applied deliberately at rollout and grant access explicitly; automatic RLS is a safety net. |
| D-26 | SUPERSEDED by D-47 at step 9. Until then: when Supabase was not configured, the session proxy passed requests through. | Keeps production working between PRs; nothing is protected by the proxy yet. |
| D-27 | `GET /api/health` is public and returns only `ok`, `unconfigured` or `unreachable`. | Lets the Vercel → Supabase connection be verified without exposing configuration. |
| D-28 | The Supabase env reader throws if a secret or service-role key is put in the public key variable. | Turns the most damaging misconfiguration into an immediate failure. |
| D-29 | Real Google and GitHub sign-in is verified on production only. Local development and automated tests use throwaway users in the local stack; OAuth providers are not configured locally and no local address is added to the production project. | Applies D-09 and D-24. Deviates from the epic's "test the local flow" task for OAuth specifically; everything around the provider hop is tested locally. |
| D-30 | The Email provider is disabled in the production project. | Supabase enables email sign-up by default, which would allow public registration through the API regardless of the UI. |
| D-31 | OAuth is started by a server action and completed by `/auth/callback` with PKCE. After sign-in the user is only ever redirected to a same-site path; `/login` and `/auth/*` are never redirect targets. | No client-side auth code, and no open redirect through the `next` parameter. |
| D-32 | `/login` exists from step 5 but is not linked from the app, and signing in grants nothing until the invitation model (step 7) and the cut-over (step 12). | Lets production OAuth be verified early. An authenticated user without a profile can read and write nothing (RLS). |
| D-33 | No custom account linking. Supabase's built-in behaviour is relied on: identities with the same verified email resolve to one user; different emails are different users. | The epic forbids a custom linking system unless Supabase does it safely, which it does for verified emails only. |
| D-34 | A provider account without a usable verified email is refused with a specific, fixed explanation; all other failures stay generic. The callback recognises this case from the error Supabase returns. | The person can fix it themselves, and invite validation is never bypassed. The exact Supabase error text is matched loosely on the word "email" and has not been reproduced with a real email-less GitHub account. |
| D-35 | `accept_invitation()` takes no arguments and derives everything from the caller's own identity. It reads the email from `auth.users`, requires it to be confirmed and to belong to a Google or GitHub identity of that user, and matches it case-insensitively. | Nothing in a request can influence who gets accepted, and an email/password identity can never satisfy an invitation even if the Email provider were re-enabled by mistake. |
| D-36 | The callback grants access only on an explicit `member` result. Any other result, or any error calling the function, signs the user out and shows a fixed message. | Fails closed. |
| D-37 | SUPERSEDED by D-58 on 2026-11-12. Originally: an accepted invitation could not be revoked and removing a member was out of scope. | The epic asks only for revoking unused invitations and excludes user management. |
| D-38 | Production migrations are applied by Tanuj from a terminal with `supabase db push`, starting at step 7. The first invitation is inserted once in the dashboard SQL editor. | The callback needs the schema in production; the admin page (step 8) needs an existing member to bootstrap. No personal email goes into a migration. |
| D-39 | E2E tests make a local user a member by inserting a profile with the local stack's secret key, guarded to local URLs only. The real provisioning path is covered by the database tests. | `accept_invitation()` needs a Google or GitHub identity, which cannot be created through local sign-up. |
| D-40 | Vercel functions run in `syd1` (`vercel.json`). | The production Supabase project is in `ap-southeast-2` (Sydney); functions were running in `iad1` (US East), so every Supabase call crossed the Pacific. Measured before the change: `/api/health`, one Supabase call, took about 1.2 s. |
| D-41 | OAuth requests carry `prompt=select_account`, so the provider shows an account chooser on every sign-in. | Signing out of TrainGrid does not sign out of Google or GitHub; without this GitHub silently reused the last account. |
| D-42 | A Sign out button is in the header on every page for any signed-in user, with an immediate pending state. | Feedback from Tanuj on 2026-11-12: sign-out was only reachable from `/login` and gave no feedback while it worked. |
| D-43 | OPEN. Google's consent screen says "continue to <project>.supabase.co". | It names the domain of the OAuth redirect. Showing TrainGrid there needs either a Supabase custom domain (paid, so excluded) or switching Google to its own sign-in button with an ID-token hand-off (free, more code). Awaiting Tanuj's choice. |
| D-44 | Non-admins get a 404 from `/admin/invitations` and from its server actions, the same as a page that does not exist. An admin must also be a member. | Does not reveal that an admin area exists, and a listed id without a profile gets nothing. |
| D-45 | The admin check lives inside each invitation function (`listInvitations`, `createInvitation`, `revokeInvitation`), before the secret-key client is created, not only in the page. | A server action can be invoked without rendering the page; authorization must not depend on the route. |
| D-46 | The header shows an Invitations link to admins. It is display only. | Convenience; the page and actions re-check. |
| D-47 | Routes are private by default. Only `/login`, `/auth/callback` and `/api/health` are public. The proxy redirects anonymous page requests to `/login?next=…` and answers `401` on API routes. It fails closed: with Supabase unconfigured, or a session that cannot be verified, private routes are not served. | A new route cannot be exposed by forgetting to protect it. Preview deployments, which have no Supabase variables, show only the login page. |
| D-48 | Every private page, every server action and the export route calls `requireMember()` (or checks the viewer) itself. The proxy checks only that a session exists; membership is checked in the app and again by RLS. | The epic requires that protection does not rest on route middleware alone. |
| D-49 | The site stops being publicly readable at step 9, before the planner moves to the database at step 12. In between, members see the existing file-backed planner, still read-only on Vercel, including the old "published" notice. | Chosen by Tanuj on 2026-11-12 when offered the alternative of protecting routes at the cut-over. |
| D-50 | The header wraps on narrow screens, and navigation links are shown to members only. | A signed-in admin's header overflowed a phone-width screen; caught by the existing mobile E2E test once tests ran signed in. |
| D-51 | Data functions take the caller's own Supabase client and the user id from the verified session (`memberData()` provides both). Every query is also narrowed by that user id. | Two independent layers: the app's own filter and RLS. Integration tests show each one holds when the other is bypassed. |
| D-52 | Saving a personal routine is one database call, `save_personal_routine()`, a `security invoker` function that replaces the routine's items in a single transaction. Ownership is always the caller; it is not a parameter. | Avoids half-saved routines without adding privileges: RLS applies inside the function exactly as outside it. |
| D-53 | Item ids are kept across edits only when the incoming id already belongs to the same routine or the same session snapshot; anything else gets a new id. Copies (scheduling, Duplicate Week) always get new ids and record the source item. | D-04B stable ids, without letting a client move or overwrite someone else's item. |
| D-54 | Dates are stored as calendar dates and converted to ISO week and weekday in UTC (`lib/calendar-date.ts`). | Results must not depend on the server's time zone; functions now run in Sydney. |
| D-55 | Start times are restricted to the hour and half hour, as the current planner offers. | Preserves current behaviour; can be relaxed later. |
| D-56 | The export format becomes `traingrid-export` version 2: personal routines with items, and sessions with their snapshots. Version 1 (file-backed) is retired with the cut-over. | Matches the new data model and D-06's scope. |
| D-57 | Integration tests (`npm run test:integration`) run the data layer against the local stack as real signed-in users. Test users are created through the auth admin API and deleted afterwards; helpers refuse non-local URLs. | The epic asks for proof through direct authenticated queries, not only the UI. |
| D-58 | Admins can revoke an accepted member's access. Chosen by Tanuj on 2026-11-12 ("keep data, block access", built before step 11). The member's profile is marked `revoked_at`; their data is kept and hidden from everyone; a new invitation for the same email restores access with the data. Admins cannot be revoked. Permanent deletion is not offered. | Revoking access is an admin decision. Keeping data makes it reversible. |
| D-59 | Membership now means "a profile that is not revoked". Every RLS policy on member data requires active membership as well as ownership. | Before, ownership implied membership because only members could create rows; a revoked member still owns rows. |
| D-60 | `revoke_invitation()` does the revocation in one transaction and is executable by the service role only. The admin action passes the admin list (plus the caller) as protected ids, because the database cannot read the environment variable. | Atomic, and admin protection is enforced in the database as well as the page. |
| D-61 | Known: `supabase db lint` warns about an implicit text-to-`uuid[]` conversion in `save_personal_routine()` (`v_kept uuid[] := '{}'`). Harmless at runtime and covered by tests. Not fixed in place because the migration is applied to production (2026-11-12); fix with the next migration that replaces that function. | Merged or applied migrations are never edited. |
| D-65 | "Replace template" on the session edit form is removed. A session is a snapshot of its routine (D-03); its source cannot be swapped after scheduling. To use a different routine, schedule it and delete the old session. | `source_routine_id` is provenance only and not updatable by members. |
| D-66 | Deleting a routine clears its sessions' link (`on delete set null`), so the session page shows one message for both a one-off session and one whose routine was deleted. | Caught by E2E: the earlier "routine was deleted" message could never appear. |
| D-67 | Library URLs use routine UUIDs (`/library/<uuid>`). Old slug links are kept working by D-71. | Routines are database rows now; slugs exist only for seeded GLOBAL routines. |
| D-68 | The library marks the member's own routines "Mine" and shows GLOBAL ones as "TrainGrid library · read-only"; the add-session picker groups them. No further Global/My Library navigation (D-05). | Minimum needed to tell editable from shared without designing Epic 2–3. |
| D-69 | Item text is shown as plain text with line breaks; Markdown rendering and `react-markdown` are removed. | Items are structured fields now (D-04); nothing produces Markdown. |
| D-70 | `data/schedule.json` and `data/schedule.example.json` are deleted. `npm run import:legacy` imports any old schedule file for a named member, locally, with the secret key, dry run by default. | Story 16. The committed schedule was empty, so there was nothing to migrate. |
| D-71 | Legacy links keep working through one lookup, `findGlobalRoutineIdBySlug()`: `/library/<slug>` and `/library/<slug>/edit` redirect to the GLOBAL routine's UUID page (read-only), and `/week/…/add?template=<slug>` preselects it. The lookup is restricted to `scope = 'GLOBAL'`, runs as the caller under RLS, and validates the slug format first. Unknown slugs still 404. | Requested in the step 12 review. PERSONAL routines can never have a slug (database constraint), so nothing private can be reached by name; non-members resolve nothing. |
| D-72 | Saving a session requires a week that actually exists (`isRealWeekId`), not just a well-formed id. | Found in the step 12 review: `2026-W60` was accepted and silently moved the session to another date. |
| D-73 | App-level authorization is tested by forging input to the real server actions: swapping another member's ids into a member's own forms, adding ownership fields, and replaying an admin's captured invite and revoke requests as a member and as an anonymous visitor. Outcomes are checked in the database as the service role. | The epic asks for proof beyond the UI; this attacks the app the way a crafted request would, without test-only endpoints. |
| D-74 | `npm run test:all` runs lint, typecheck, unit, database, integration, E2E and build in order. `npm run typecheck` generates Next route types first. | One repeatable gate for the release checklist. |
| D-75 | `npm run scan:secrets` (working tree) and `-- --history` (every commit, all branches) scan for credentials and print matches redacted. Verified to catch a planted local key and a database URL with a password. | A repeatable local check (S2) that does not depend on GitHub settings. |
| D-76 | Next.js upgraded 16.3.3 → 16.4.6 (critical advisories in `next/og` and `use cache`, neither used here); vitest 4.1.11 → 4.1.12 and transitive `source-map-js`, `brace-expansion`, `vite` updated. Production dependencies: 0 vulnerabilities. | Patch the production dependency rather than rely on the features being unused. |
| D-77 | Accepted for now: 8 moderate advisories in the lint toolchain (`typescript-eslint` ≤ 8.72.2 via `eslint-config-next`). No patched release exists; npm's suggested fix (Next 15 config) is wrong. | Dev-only, runs on our own code. Revisit when Dependabot reports a fix. |
| D-78 | Vercel Preview deployments are protected by Vercel Authentication (checked 2026-11-12: every path redirects to Vercel sign-in) and carry no Supabase variables. | Previews cannot expose or reach production data. |
| D-79 | npm 10.9.4 failed on this lockfile with "Cannot read properties of null (reading 'edgesOut')"; the dependency updates were made with npm 11.21.2 via `npx`. The lockfile stays at version 3. | Known npm 10 arborist bug; npm 11 resolves it. |
| D-80 | Supabase advisor warnings reviewed 2026-11-12. Fixed: `rls_auto_enable()` (installed by the "Enable automatic RLS" option) was callable by anon and authenticated through the API; migration `20261112050000` revokes it. Accepted: `accept_invitation()` callable by authenticated (by design, D-35); leaked-password protection off (password sign-in is disabled). | A database test now asserts no SECURITY DEFINER function is callable by anon and only `accept_invitation` by authenticated; it was shown to fail against a simulated exposed function. |
| D-81 | Production verification uses only read-only means: `supabase db query --remote --read-only` returning structure and counts (no names, emails or schedule content), `supabase db advisors`, the public auth settings endpoint with the publishable key, signed-out HTTP requests, and a scan of the JavaScript the site serves. | Verifies production without changing it or reading personal data. |
| D-82 | Supabase Auth keeps `disable_signup = false`: OAuth must be able to create an invited friend's account on first sign-in. Email, phone and anonymous sign-in are disabled, so an auth account can only come from Google or GitHub, and it grants nothing without an invitation. | Satisfies "public signup is impossible" at the TrainGrid level; blocking at the auth layer stays deferred (D-02). |
| D-83 | Documentation closure: README, REQUIREMENTS, TECHNICAL_DESIGN, DATA_FORMAT, TEST_PLAN and TEST_RESULTS are rewritten for the current app; UX_SPEC is updated section by section (layout and time rules unchanged); MVP_CHECKLIST is kept as a dated historical record with a note; the ADR context keeps its description of the old design as history. README screenshots are regenerated from the app as a local test member. Nothing from Epics 2–4 is described as shipped. | Story 33. Rewriting history would lose the record of the MVP; screenshots must not show the removed published mode. |
| D-84 | Epic specifications are stored verbatim as `agents/EPIC-<n>.md`. | Requested by Tanuj on 2026-11-13; keeps the source of truth next to the records that track it. |
| D-85 | `scan:secrets` env-assignment rule matches within one line only (`[ \t]` instead of `\s`). | Found when saving EPIC-1.md: an empty `SUPABASE_SECRET_KEY=` placeholder matched the following line as its value. A real assignment is still caught. |
| D-16 | REVISED at step 11: GLOBAL routines are seeded from a generated, committed `supabase/seed.sql`, applied locally by `db reset` and on production by `supabase db push --remote --include-seed`. It is generic content and not a schema migration. No secret key and no extra script are needed to apply it. | D-05 excludes a management UI; the epic keeps seed data separate from migrations. |


---

# Epic 2 decisions

All Epic 2 decisions below were approved by Tanuj on 2026-11-13 ("Approve all"), together with the
Step 01 plan.

| ID | Decision | Status | Reason |
| --- | --- | --- | --- |
| E2-D01 | `/library` defaults to **All**; `scope=global` (TrainGrid) and `scope=mine` add explicit views. | APPROVED (spec default) | Keeps Epic 1 behaviour and links. |
| E2-D02 | Search and filters use existing routine and item fields only; no new metadata or search service. | APPROVED (spec default) | Zero cost; honest content. |
| E2-D03 | GLOBAL authoring stays seed- and code-review-managed. No admin editing UI; no wider secret-key use. | APPROVED (spec default) | Keeps the privileged surface to invitations only. |
| E2-D04 | Copy runs as the member through `save_personal_routine()`; copies get new UUIDs and no slug. | APPROVED (spec default) | One transaction, no RLS exception. |
| E2-D05 | Scheduling and snapshot rules are unchanged. | APPROVED (spec default) | Epic 1 D-03. |
| E2-D06 | Epic 3 may redesign `Mine`; Epic 2 keeps existing personal CRUD working. | APPROVED (spec default) | Scope boundary. |
| E2-D07 | Library list data: **one** query of visible routines with an embedded selection of item `name` and `equipment` (no N+1), capped at 500 routines (GLOBAL first); search and filters run in a pure, unit-tested TypeScript function on that result. If the cap is ever reached, the page says so rather than hiding it. | APPROVED | 18 GLOBAL routines and a friends-only group make SQL full-text search unnecessary; a pure function is easy to test; the cap makes the read bounded. |
| E2-D08 | Equipment filter is **single-select** in Epic 2 (`equipment=barbell`): a routine matches if any item has that tag. Multi-select is deferred. | APPROVED | Matches the spec's URL example and keeps the UI simple on phones. |
| E2-D09 | Query contract: `scope` = `all` (default, omitted) / `global` / `mine`; `q` = free text, trimmed, whitespace collapsed, max 100 characters; `type` = category; `equipment` = equipment id. Unknown or malformed values fall back silently to the default for that parameter only. Filters are a plain GET form, so they work without JavaScript and survive refresh and back. Switching scope keeps `q`, `type` and `equipment`. | APPROVED | The spec's proposed names, made precise; no client-state library. |
| E2-D10 | A copy keeps the source's exact name (the "Mine" badge distinguishes it). After copying, the member lands on the new routine with a one-time confirmation (`?copied=1`, shown only for their own routine). | APPROVED | The spec asks for exact content and clear feedback; a query flag needs no cookies or new state. |
| E2-D11 | **Seed item identity.** Item ids are `uuidV5(routine-item:<slug>:<index>)`, so inserting or reordering items reassigns existing ids to different exercises. Proposed rule for Step 07: existing ids never move. Items may be edited in place or appended at the end. Inserting, reordering or removing items requires an optional explicit `key` per item (new items only), and a check that fails the freshness test if an existing id's exercise name changes position. Removing a whole routine stays a separate, reviewed retirement procedure. | APPROVED | Spec §2.8 requires preserved ids; Epic 1 D-04B made item ids the future exercise identity; snapshots record `source_item_id`. |
| E2-D12 | Fold Step 06 (scheduling links) into Step 04. The Schedule actions already exist on list and detail with the existing add form; 06 would only polish them and add regression tests. Step 05 (copy) and Step 08 (release) stay separate. | APPROVED | Spec §7 allows combining adjacent low-risk steps if explained. |
| E2-D13 | No database migration is planned for Epic 2. If one becomes necessary, it is raised as a decision before it is written. | APPROVED | Reads use existing RLS; copy uses the existing RPC. |
| E2-D14 | Library gets a `loading.tsx` skeleton; errors use the existing error page; empty and zero-result states are distinct ("nothing matched — Clear filters" vs "no routines yet"). | APPROVED | Spec E2-02 and §4. |
| E2-D15 | Video links get an accessible name with the item name and "(opens in a new tab)", keep `rel="noopener noreferrer"`, and no embedding. | APPROVED | Spec E2-03. |
| E2-D16 | The library's `loading.tsx` lives in a route group, `app/library/(list)/`, so it applies to `/library` only. | Found in Step 02: a loading boundary makes every nested route stream, after which `notFound()` and redirects can no longer set the HTTP status; another member's routine returned 200 instead of 404. Caught by existing authorization tests. | APPROVED (implementation detail within E2-D14) |
| E2-D17 | Library list presentation in Step 02: every card carries a text label, **TrainGrid** or **Mine**; a result count sits above the list; the category chip for "no filter" is **All types** (the view tabs already have **All**); **New routine** is prominent in Mine, at the bottom in All, and absent in TrainGrid. | E2-01 asks that members always know what is shared or personal, and that the TrainGrid view never suggests editing. Two adjacent "All" buttons were confusing in screenshots. | APPROVED (within E2-01 scope) |
| E2-D18 | Search details in Step 03: the search text is normalised (control characters removed, spaces collapsed, trimmed) and cut to 100 characters; **every word** must appear, ignoring case, in the routine's name, description or any exercise name; results sort by name. The search is a plain GET form, so it works without JavaScript; an unchosen equipment select still sends `equipment=`, which parses as "any". | Spec E2-02 asks for partial, case-insensitive matching including exercise names; "every word" narrows as you type more, which "any word" does not. A GET form keeps the URL the single source of state (refresh, back, share). | APPROVED (within E2-02 scope) |
| E2-D19 | Library UI refinement (requested by Tanuj, 2026-11-13), superseding the presentation parts of E2-D17. **View control:** All / TrainGrid / Mine is a centred segmented control: a rounded, neutral container with one light pill that slides (CSS transform, 225 ms, ease-out; none with `prefers-reduced-motion`); no black fill. It stays plain links with URL state and `aria-current`. The heading and control live in `app/library/(list)/layout.tsx` as a client component, because a layout stays mounted across navigations, so the pill element survives and can animate; a click moves the pill immediately, and any URL change (including back/forward) hands it back to the URL. **New routine:** one outlined button with a plus icon in the results toolbar (count and Clear filters on the left, New routine on the right), in every view; it always creates a PERSONAL routine. The bottom-of-page button and the second one in the empty Mine state are removed. **Unchanged:** search field, equipment select, black Search button, category chips with the black selected chip, all filtering logic. | Too many black surfaces competed (Search, selected category, selected view, New routine). Black is now kept for the Search action and the selected category only. | APPROVED (Tanuj's brief) |
| E2-D20 | Header brand (requested by Tanuj, 2026-11-13, shipped with 04a): the TrainGrid mark (`components/BrandLogo.tsx`, decorative, `aria-hidden`) sits inside the home link before the name, and a neutral outlined **Beta** badge (plain text, outside the link) sits right after it. On phones narrower than the header needs, the nav wraps to a second row (Tanuj chose this over hiding the name or the logo). Brand files are in `public/brand/`; the 120 × 120 PNG is for Google Auth Platform → Branding, uploaded by the owner (`docs/BRANDING.md`). | The app is in beta; a logo gives the consent screen and header a recognisable mark. | APPROVED |
| E2-D21 | Phone header menu (requested by Tanuj, 2026-11-13), replacing the wrapping nav of E2-D20 on phones. Below `sm` the header shows the brand, Beta and a menu button; the button opens Planner, Library, Export, Invitations (admins) and Sign out as a vertical list overlaying the top of the page. It is a `<details>` element, so it opens without JavaScript; `components/MobileMenu.tsx` also closes it after navigating, on Escape (focus returns to the button), on a click outside, and after a link click (Export downloads without navigating). From `sm` up the inline nav is unchanged. Both are drawn from one list in `AppHeader`, so they cannot drift apart. Signed-out pages show no button. | A wrapped second row of links took space on every page on phones. | APPROVED |
| E2-D22 | **Canonical email rule for linked identities** (security bug 2026-11-13; third design after review; not part of the Epic 2 step order). Supabase Auth links OAuth identities by verified email and issues sessions per user, so RLS gave any linked identity full member access. Rejected: (a) a check in `accept_invitation()`, advisory and bypassed through REST; (b) per-identity approval in an access token hook, because the hook receives no identity id and `raw_user_meta_data.sub` is user-editable and last-writer-wins; both reproduced. Decision: `profiles.canonical_email` (the accepted invitation address; members cannot change it). `account_status()`/`is_member()` require a live profile, **every** identity on the canonical email, **at least one Google/GitHub identity on it** (zero identities, or email-only, is locked), and the token's `session_id` present in `auth.sessions`. Reading one's own profile also requires a usable (or revoked) account. Otherwise the whole account is locked for every session. `accept_invitation()` refuses accounts with an identity on another address. The Sign-in methods page uses Supabase Auth's account API to remove stray identities (`unlinkIdentity()`, Manual Linking on only during supervised cleanup) and to sign out other devices. The cleanup is not atomic: sign out others while still locked, remove the last stray identity, sign out others again, verify (docs/SECURITY.md). Different-address linking is deferred. Production prerequisites: Email provider off, Secure email change on. Migration needed (exception to E2-D13); owner deploys. | Needs no attribution: decided only by account state users cannot edit, and enforced in RLS on every query, so it covers direct REST access and earlier tokens. | APPROVED (Tanuj, 2026-11-13) |
