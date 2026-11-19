# TrainGrid — Epic 2: Global Workout Library

**Status:** PROPOSED — ready for agent planning; not approved as implemented  
**Baseline:** Epic 1 complete on `main` (13 November 2026)  
**Repository:** `i-am-tj/TrainGrid`  
**Suggested repository location:** `agents/EPIC-2.md`  
**Owner:** Product decisions — Tanuj; implementation — coding agent  
**Priority:** Deliver a useful, discoverable, trustworthy shared library without compromising member isolation or scheduling snapshots.

---

## 1. Goal

Turn the 18 existing read-only GLOBAL routines into a **first-class shared training library**. Members must be able to quickly find a suitable routine, understand its equipment and planned work, schedule an independent snapshot, or create an editable PERSONAL copy.

**One-sentence success criterion:** An invited member can discover a TrainGrid routine on a phone, assess its contents, and schedule or copy it in a few clear steps — while the original remains unchanged.

Epic 1 already delivered authentication, invitations, Supabase persistence, RLS, 18 GLOBAL routines / 96 workout items, UUID-based routine pages, personal routine CRUD, and snapshot-based scheduling. **Do not rebuild any of those foundations.**

## 2. Non-negotiable product and architecture constraints

1. Keep **Vercel Hobby + Supabase Free**, no paid services or new infrastructure.
2. Keep **Next.js App Router, TypeScript, Tailwind, Zod, Supabase SSR and SQL migrations**. No ORM or search service.
3. All library pages and actions require an active member; all database queries run as that member under RLS. Never accept an owner/user ID from request input.
4. GLOBAL routines are shared and **read-only to ordinary members**. PERSONAL routines remain owned by one member only.
5. Scheduled sessions are **immutable-from-source snapshots**: changes to a source routine never affect scheduled sessions, and deleting a source never deletes them.
6. Workout items remain structured: `name`, `instruction`, `rest`, `target`, `notes`, `equipment`, `video_url`, `sort_order`. Do not introduce magic Markdown parsing at runtime.
7. Preserve existing URL compatibility (`/library/lower-a`, `/library/lower-a/edit`, `?template=lower-a`). Existing UUID URLs remain canonical.
8. Preserve all existing routine and item IDs, the deterministic seed generator, and all 18/96 initial records. No destructive reseeding.
9. No runtime filesystem access or credential exposure. Use the existing `lib/data/*` boundary and authorization pattern.
10. Keep TrainGrid a **planner**, not a replacement for Strava or Hevy.

## 3. Scope

### In scope — Epic 2

- Dedicated **TrainGrid / Mine / All** library views within `/library`. Keep `All` as the default to avoid changing existing navigation semantics; `TrainGrid` displays GLOBAL only; `Mine` displays PERSONAL only. This is basic view separation, not the full personal-library redesign planned for Epic 3.
- Search across routine **name, description, and workout item names**; case-insensitive, whitespace-normalized. No external indexing or AI search.
- Filters for existing **session category** and **equipment tags** aggregated from workout items. No fabricated metadata. Support a clear-all action and a predictable alphabetical sort.
- Shareable, validated URL state: e.g. `/library?scope=global&type=strength&equipment=barbell&q=lower`. Keep current `?type=` links working. Unknown or malformed query values fail safely to documented defaults; do not crash or leak diagnostics.
- Better GLOBAL routine cards: name, category, short description, workout-item count, relevant equipment tags where present, and obvious **View** / **Schedule** actions. Do not invent durations, difficulty levels, muscle groups, or progress metrics.
- Clear GLOBAL routine detail: formatted structured items, source label `TrainGrid library · read-only`, accessible YouTube links when present, and obvious **Schedule** and **Copy to My Library** actions. Do not expose Edit/Delete for GLOBAL routines.
- **Copy to My Library:** create an independent PERSONAL routine with all current structured items, using fresh UUIDs and the existing transactional personal-routine save path. The source GLOBAL routine must never change. Open the new personal routine after success.
- Preserve the existing scheduling path from both list and detail. Scheduling must use the existing snapshot logic and must not link future edits to the GLOBAL routine.
- Responsive mobile usability, keyboard and screen-reader support, meaningful empty/loading/error states, and automated regression tests.
- Documentation, a content-curation workflow for adding new shared templates through the existing generator, and an Epic 2 completion report.

### Not in scope

- A browser-based **admin GLOBAL create/edit/delete dashboard**. For now GLOBAL content stays version-controlled and seed-managed. Admin editing would expand privileged secret-key usage beyond invitations, raise seed-versus-database conflict rules, and needs an explicit design/security decision. Document it as a possible follow-on, **do not implement it by assumption**.
- Comprehensive **PERSONAL library** management redesign (Epic 3). Preserve existing personal routine editing and deletion.
- Planner week-grid, rescheduling, recurrence or Duplicate Week redesign (Epic 4). Only reuse existing scheduling routes.
- Performed workouts, weights/reps/RPE logs, exercise catalogue, progress charts, recommendations, or training-plan generation.
- Supabase Storage, file upload, embedded video playback, video metadata fetching, new OAuth providers, public registration, email notifications, ratings, favorites or social features.
- New global metadata schema (`difficulty`, `duration`, `muscle_group`) unless a separately approved need emerges. Use only currently stored facts.

## 4. User stories and acceptance criteria

### E2-01 — Switch between library scopes
**As a member**, I can select `All`, `TrainGrid`, or `Mine`, and always know whether a routine is shared or personal.

**Acceptance:**
- `/library` still includes GLOBAL and my PERSONAL routines; no other member's routines appear.
- `scope=global` shows GLOBAL only; `scope=mine` shows my PERSONAL only.
- The active view is visible and accessible; switching scopes preserves applicable search/filter values or clears incompatible ones predictably.
- Empty `Mine` view suggests **New routine**; GLOBAL view never suggests the member can edit shared content.
- Anonymous/unaccepted/revoked users receive no library content, including through direct API calls.

### E2-02 — Find and filter routines
**As a member**, I can find routines by name, description, exercise name, category, and equipment without scrolling every routine.

**Acceptance:**
- Case-insensitive search; trim and normalize whitespace; blank search behaves as no query.
- Category values remain `running`, `strength`, `plyometrics`, `other`; equipment values come from the existing defined tag set.
- Equipment filter matches routines with at least one item carrying the selected tag; a routine with no equipment remains visible when no equipment filter is applied.
- Combined filters act as AND; results are deterministic and alphabetically sorted within the current presentation.
- A zero-result state explains that nothing matched and offers **Clear filters**; it does not falsely claim the library is empty.
- Queries are bounded and validated. Filter state can be bookmarked and survives refresh/back navigation.
- With only 18 GLOBAL routines, use a simple efficient implementation; avoid external search, premature indexes or N+1 database requests.

### E2-03 — Assess shared routine content
**As a member**, I can open a GLOBAL routine and understand what I would perform before scheduling.

**Acceptance:**
- Clearly display name, category, description, ordered workout items, instruction, optional rest/target/notes/equipment and optional valid YouTube references.
- Advisory items such as `Progression` or `Recovery` remain readable; do not silently drop content or manufacture sets and reps.
- Only show metadata that exists. No Edit/Delete controls for GLOBAL routines; direct global edit URLs remain non-editable.
- Detail and back navigation work on phone and desktop. Legacy slug links still resolve under member authorization.
- External video links are safe, labelled and open in a separate tab as appropriate; no new tracking or embedding required.

### E2-04 — Copy a GLOBAL routine to a PERSONAL routine
**As a member**, I can make my own editable copy of a shared routine.

**Acceptance:**
- A member-only server action loads the source via the caller's RLS-governed client and verifies **source scope is GLOBAL**. Do not trust a browser-supplied scope, owner, items or user ID.
- Copy exact structured content (name, category, description, item fields and order). New routine has `scope=PERSONAL`, `owner_user_id=caller`, `slug=null`, and **fresh routine and item UUIDs**.
- Reuse `savePersonalRoutine()` / `save_personal_routine()` so the routine and items are stored in **one transaction**. A failed copy leaves no partial routine.
- The GLOBAL source and previously scheduled sessions remain unchanged. Source provenance is not confused with ownership; no new provenance column is necessary for this epic.
- Redirect to the new routine's detail page, with an Edit option and clear success feedback. Prevent accidental double-clicks while pending; intentional repeated copies may produce separate routines.
- A guessed PERSONAL routine ID belonging to another user, an invalid ID, or a non-member cannot be used as the source. No elevated/secret-key client in this flow.
- Add unit, integration and E2E tests, including a direct cross-user attack attempt and transaction failure behavior.

### E2-05 — Schedule directly from the library
**As a member**, I can schedule a GLOBAL routine from its list card or detail view.

**Acceptance:**
- Existing `/week/current/add?routine=<uuid>` route works from both entry points; on the add form the chosen routine is preselected.
- The existing date/time behavior and user ownership remain unchanged.
- The resulting scheduled session contains a full independent snapshot with new item IDs. Editing the GLOBAL routine later (through seed maintenance) cannot change that session; deleting the routine does not destroy the session.
- Legacy `/week/current/add?template=lower-a` still works.
- Do not add duplicate scheduling implementations or a new calendar system.

### E2-06 — Maintain shared content safely
**As the maintainer**, I can add or revise GLOBAL source templates without making environments drift.

**Acceptance:**
- `data/templates/*.md` remains the canonical editorial source for seed-managed GLOBAL content; `npm run seed:generate` produces `supabase/seed.sql` deterministically.
- The existing freshness test fails when Markdown and generated SQL differ.
- Document how to add/modify a routine, verify generated IDs and item ordering, test locally, review SQL effects, and intentionally deploy to production. **`db push` without an explicit seed action must not be described as applying `seed.sql`.**
- Never run `db reset` on production. Never delete a GLOBAL routine merely because its source file is absent unless a separately reviewed retirement procedure exists.
- Seed refreshes must not touch PERSONAL routines, scheduled sessions or any member's data; note that existing scheduled snapshots are intentionally unchanged.
- No new sample links or equipment claims without verifying the content. No production seed execution is needed unless shared content actually changed in this epic.

## 5. UX and information architecture

### Entry points

- `Library` in the existing member header → `/library`.
- Scope controls at the top: **All | TrainGrid | Mine**.
- Search box; category selector; equipment selector; clear-filters control.
- Results show content count and meaningful empty state; actions are explicitly labelled.
- Existing `New routine` entry remains available for PERSONAL content, prominently in `Mine` and accessible in `All`.
- Details: **Schedule** is primary; **Copy to My Library** is secondary for GLOBAL. PERSONAL detail retains Edit.

### Responsive layout

- Phone: single-column result cards, readable labels, stacked controls, no horizontal scrolling, touch-friendly targets.
- Desktop: compact cards/list and filters without a complete redesign of the application.
- Keyboard: logical tab order, labelled search and filters, visible focus, no hover-only actions.
- No flashy visual system, large dashboard, modal-heavy workflow, or mandatory design dependency. Respect TrainGrid's existing components and Tailwind conventions.

### URL contract

```
/library
/library?scope=global
/library?scope=mine
/library?scope=global&q=lower&type=strength&equipment=barbell
/library/<routine-uuid>
/library/<legacy-global-slug>    # existing redirect retained
/week/current/add?routine=<routine-uuid>
```

The query parameter names above are the proposed public contract; document any necessary differences during the planning step before implementing. Preserve existing `?type=` URLs.

## 6. Data and security design

- Begin with `lib/data/routines.ts`, `lib/data/model.ts`, `lib/data/schemas.ts`, `app/library/*`, `components/library/*`, and existing server actions. **Audit before adding new abstractions.**
- Reuse `memberData()` / `requireMember()` and the verified session's user ID. All reads are done with that member's Supabase client; RLS is the authority.
- For list searches that include item names or equipment, fetch the necessary fields efficiently (one bounded query/join or similarly small query set). Do not issue one workout-items query per result.
- Keep all user-facing search/filters as **read-only operations**. No privileged database access or production schema migration should be necessary.
- For copy-to-personal, use server-side validation, load source from DB, enforce `scope=GLOBAL`, and invoke the existing atomic save function under the member's identity. Do not add a service-key exception to RLS.
- The GLOBAL library remains readable only to active members. An OAuth identity without accepted membership sees nothing; a revoked member sees nothing.
- Cross-user guesses and forged parameters must return a safe 404/denial and never reveal whether another member's routine exists.
- Do not loosen GLOBAL write policies, GRANT privileges or admin protections.
- Preserve source snapshots and the versioned `snapshot` document contract.

## 7. Ordered implementation plan — one branch and PR per step

Every branch starts from current `main`; commit a reviewable PR and merge before beginning a dependent step. An agent must not treat passing local tests as permission to change production configuration or run production SQL.

| Step | Branch | Deliverable | Validation |
| --- | --- | --- | --- |
| **01** | `epic-2/01-audit-and-plan` | Inspect actual library/data/seed code; create `agents/EPIC-2.md`, Epic 2 roadmap/backlog/test plan and any explicit decisions. Preserve Epic 1 evidence. | Scope and security review; no app behavior change. |
| **02** | `epic-2/02-library-scope` | `All / TrainGrid / Mine` view controls, shareable scope state, accurate empty states; retain existing personal CRUD and `?type` links. | Unit + E2E navigation/isolation tests; mobile screenshot. |
| **03** | `epic-2/03-search-filters` | Search by name/description/item names; category and equipment filters; clear state; stable URLs; bounded efficient data reads. | Search/filter unit + integration + E2E, including malformed URLs and combined filters. |
| **04** | `epic-2/04-global-details` | Better GLOBAL cards/details, ordered structured instructions, equipment and optional video links; honest display for advisory content. | Accessibility checks, responsive screenshots, legacy-link tests. |
| **05** | `epic-2/05-copy-to-personal` | Secure one-transaction GLOBAL → PERSONAL copy action, new IDs, editable result and feedback. | Authz database/integration/E2E; failure and copied-content tests. |
| **06** | `epic-2/06-scheduling-links` | Refined Schedule CTAs from global list/details using existing add form; snapshot/slug regression checks. | Integration + E2E source/snapshot isolation. |
| **07** | `epic-2/07-content-workflow` | Content-curation and safe seed workflow docs, seed/drift verification; content corrections only if justified and reviewed. | Idempotency/drift tests; explicit production-data impact report. |
| **08** | `epic-2/08-release-docs` | Final accessibility, privacy/security regression, README and `docs/` updates, screenshots, story reports and production smoke-test checklist. | `npm run test:all`, `npm run scan:secrets`, responsive test, signed-in production smoke test. |

The agent may propose combining **adjacent low-risk steps** to avoid unnecessary PR overhead, but must explain why and preserve isolated review points for the **copy/security** step and the **release** step. No need to create a separate database migration unless the design review demonstrates a concrete requirement.

## 8. Test and release matrix

### Automated (local Supabase + CI as available)

1. Every GLOBAL routine readable by an active member, editable/deletable by no ordinary member, and inaccessible to anonymous/unaccepted/revoked identities.
2. Only a member's own PERSONAL routines appear in `Mine` or `All`; member A can neither read nor copy member B's PERSONAL routine.
3. Search/facet behavior: exact/partial case-insensitive terms, whitespace, empty/zero-result, item-name matches, equipment aggregation, combined filters, invalid URL params and back/refresh state.
4. New PERSONAL copy is owned by the caller; IDs and ordered items are independent; source unchanged; save failure is atomic.
5. Scheduling GLOBAL and copied PERSONAL routines both produce independent snapshots; editing any source afterwards does not change any scheduled session.
6. Legacy UUID and slug links continue to resolve safely.
7. Keyboard usability, labels/focus, phone-width and desktop layouts; no overflow.
8. No unexpected migrations, no new service-role use, no secrets in client bundles, no runtime file access.
9. Run the full existing suite, not just newly introduced tests: lint, type-check, unit, database, integration, E2E, production build, and secret scan. Investigate any unexplained reduction in tests.

**Epic 1 reference baseline:** 131 unit, 189 database, 26 integration, 53 E2E tests at Epic 1 closure. These are reference counts only; they must not be hard-coded as future pass criteria.

### Production smoke test (manual, after reviewed merge)

- Invited Google/GitHub member can open `/library` and filter/search the 18 shared routines.
- GLOBAL detail is readable but not editable; legacy `/library/lower-a` redirects correctly.
- Copy Lower A to PERSONAL, edit the copy; verify original remains unchanged.
- Schedule the GLOBAL and the copy; verify independent sessions.
- A second invited member sees GLOBAL content but not the first member's PERSONAL copy.
- Signed-out and revoked accounts cannot open library content; admin invitation behavior remains intact.
- Production seed counts and security advisories remain as expected; no unreviewed production seed changes.

## 9. Definition of done

Epic 2 is **DONE** only when all in-scope stories have been demonstrated; every PR is reviewed/merged; automated suites pass; cross-user tests pass; a phone-width flow and desktop flow are visually checked; production smoke tests pass; and current docs, backlog, roadmap and `agents/STORY_REPORTS.md` record the implementation accurately.

No story is done solely because a UI control is present. It must work for a real member with correct authorization, persistence and failure handling.

## 10. Decisions and escalation rules

**Default decisions proposed for this epic:**

- **E2-D01:** `/library` defaults to **All**, retaining Epic 1 behavior; explicit `scope=global` and `scope=mine` views are added.
- **E2-D02:** Search/filter uses existing routine/item fields, not new categories or external search infrastructure.
- **E2-D03:** GLOBAL authoring remains **seed/code-review managed**. Do not build an admin edit interface or broaden the secret-key usage in Epic 2 without explicit approval.
- **E2-D04:** Copy-to-personal happens under the ordinary member's identity using the existing atomic personal-save RPC. Copies have new UUIDs and no shared slug.
- **E2-D05:** All existing scheduling/snapshot rules remain unchanged.
- **E2-D06:** Epic 3 may subsequently improve `Mine` navigation/editing; Epic 2 must leave its existing CRUD behavior working.

Raise a documented decision rather than silently changing architecture if the implementation appears to need privileged GLOBAL writes, additional columns/migrations, new paid services, or a redesign of scheduling snapshots.

## 11. Instructions to the coding agent

1. **Read before coding:** `README.md`, `agents/ROADMAP.md`, `agents/BACKLOG.md`, `agents/DECISIONS.md`, `agents/ARCHITECTURE.md`, `agents/TEST_PLAN.md`, `docs/REQUIREMENTS.md`, `docs/UX_SPEC.md`, `docs/TECHNICAL_DESIGN.md`, `docs/DATA_FORMAT.md`, and actual library/data source files. Treat the current code and migrations as authoritative; reconcile contradictions openly.
2. Put this spec at `agents/EPIC-2.md`. Extend the working records for Epic 2 without overwriting Epic 1's completion history or renumbering its stories.
3. Start at **Step 01** only. Report an architecture inventory, the precise changes proposed for each later step, dependencies, tests, and any decisions requiring approval. Do not build all steps in one unreviewed PR.
4. At each step, report changed files, security/schema impact, tests executed, screenshots where applicable, blockers, and whether the PR is ready to commit/merge.
5. Never read production secrets, run production migrations/seeds, or alter GitHub/Vercel/Supabase project settings without the maintainer's direct action. Prefer local Supabase test fixtures and deterministic tests.
6. Maintain zero-cost architecture, clear member-only access, existing naming conventions, and the planned-vs-performed-data boundary.

**Start now with `epic-2/01-audit-and-plan`. Do not implement Step 02 until Step 01 has a reviewed plan.**
