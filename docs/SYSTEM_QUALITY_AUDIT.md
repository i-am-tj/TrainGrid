# TrainGrid system quality audit

**24 November 2026 · CONDITIONAL GO for the reviewed fixes.** The local system admitted, isolated, revoked and restored synthetic members, persisted training data, sent mock notifications and completed the release journey on a freshly migrated database. Main still contains the defects below until the owner reviews and merges the corresponding PRs. GitHub currently permits changes to main without a required passing check. The release owner should verify provider admission, release controls and recovery before approving a production release.

**Baseline** `2547e5ce2d76cc416576ba7470c0716f448d155d`. A fresh fetch and a later GitHub lookup agreed. Main CI and CodeQL passed. Candidate changes were exercised together in a clean checkout, with commit-specific PR runs as independent evidence. No release tag, merge or deployment was requested from a provider. Each audit branch carries the same Vercel preview exclusion. [Main CI](https://github.com/i-am-tj/TrainGrid/actions/runs/45262605823) · [Main CodeQL](https://github.com/i-am-tj/TrainGrid/actions/runs/45262605985) · [Vercel branch configuration](https://vercel.com/docs/project-configuration/git-configuration)

## Scorecard and coverage

“Pass” means the listed checks ran successfully. “Conditional” indicates a defect on main or an outstanding release dependency. Risk scores are prioritization judgments on a 1–5 scale for impact and likelihood. They do not estimate incident frequency.

| Component | Assessment | Risk | Evidence and boundary |
| --- | --- | ---: | --- |
| Authentication, membership, admin | Conditional | 5 × 3 | Both provider handoffs checked PKCE parameters. Callback errors, member logout, anonymous API 401, nonmember refusal, admin-only operations, immediate revocation and re-invitation ran locally. The database tests exercised synthetic identity records. Real provider consent and hosted identity linking need owner verification. |
| Database and ownership | Pass locally | 5 × 3 | 17 migrations replayed with the seed. All 14 public tables had RLS enabled, with 37 policies. Only `accept_invitation` among public definer functions was executable by the authenticated role. 495 pgTAP assertions covered grants, ownership, constraints, trigger locks, membership, retention and preservation of training data across revocation. Generated types matched byte for byte and the API manifest matched exactly. |
| Library, dashboard, planner, workout, export | Conditional on #90 | 4 × 3 | Create/copy/edit/delete routines, customize and reschedule independent snapshots, duplicate a week, resume a workout, handle empty states and export own data. Real API tests use separate members. Browser tests cover device zones, travel and the year boundary. The new large-week regression runs through the actual Data API cap. |
| Social and feedback | Pass locally | 4 × 3 | Private/public profiles, follows and approvals, posting, comments, likes, visibility after revocation and feedback persistence. In the concurrent feedback test, two submissions competed for the last daily allowance and one succeeded. |
| Invitations and mail | Pass with mock provider | 4 × 3 | Delivery attempts bind a recipient and idempotency key. Duplicate/in-flight requests, provider acceptance, outage, rate limiting, retry and revoked invites have asserted outcomes. Owner feedback and invite-request mail ran through loopback. Actual delivery and sender DNS remain unverified. |
| Frontend and accessibility | Pass for tested combinations | 3 × 3 | Chromium component and production-build tests cover keyboard flow, focus return, reflow, enlarged text, reduced motion, both themes, hydration and loading/error states. Eight Firefox/WebKit cases cover login controls, member logout, routine CRUD and phone agenda. No physical-device, assistive-technology or pixel-by-pixel certification. |
| Performance and observability | Conditional on #88 and #92 | 3 × 3 | Local response-time samples, asset/script budgets, a Lighthouse lab run, a timed database hold and route-level failure recovery. Structured reports exposed a resolved path on main. Field Web Vitals, operational alert routing and sustained hosted load remain unverified. |
| CI, deployments and recovery | Conditional | 5 × 3 | Three main CI jobs, CodeQL, least-privilege CI token, separate tag release workflow and two workflow files checked with actionlint. Required checks are absent. The production health probe returned HTTP 200 with `supabase=ok` and `schema=ok`. A readiness monitor should check both fields because the handler also returns 200 when Auth is up and schema status is unknown. |

## Environment and test strategy

The audit used Node 22.23.5, a clean lockfile install, Next.js 16.4.6, React 19.2.8, TypeScript 5.9.3, Supabase CLI 3.1.0, PostgreSQL 17, Vitest 4.1.12, Playwright 1.62.1 and axe-core 4.13.0. A separately named local project served the API and database on ports 56321 and 56322. Test credentials came from that project's CLI. The workspace's existing environment file was excluded. Production interaction consisted of one anonymous GET to its documented health endpoint. No production credential, account, migration, seed, mail send or stress run was used. [Project context](../.agents/qa-project-context.md)

| Installed skills selected | Application |
| --- | --- |
| qa-project-context, test-strategy, risk-based-testing | Mapped architecture, owners, write paths and environment dependencies. Prioritized access decisions, persisted data and failure recovery. |
| security-testing, database-testing, api-testing | Static boundary review, dependency and redacted secret scans, two-role and multi-user tests, effective SQL privilege checks, migration replay, manifest comparison and HTTP status checks. |
| email-testing, playwright-automation, accessibility-testing | Local provider simulation, production-build user journeys, three browser engines, axe, keyboard, theme, viewport and motion assertions. |
| performance-testing, coverage-analysis | Bounded loopback concurrency, browser payload and layout measurements, Lighthouse, and a V8 unit report with an explicit denominator. |
| ci-cd-integration, release-readiness | Compared local and hosted runs, validated workflows, inspected main protection, identified operator gates and checked remediation PRs. |

Real PostgREST integration tests and the exact schema manifest supply contract evidence. The project is a responsive web application. Native app and third-party consumer contract suites would exercise different systems.

## Verified findings and remediation

| Severity and component | Evidence and root cause | Impact, remediation and regression |
| --- | --- | --- |
| High · auth return path · `lib/auth/redirect.ts` | A local unit regression passed a path containing parent-directory resolution. The validator accepted the initial input and returned a normalized path with two leading slashes. The harmless test case produced a value the callback's URL constructor could not resolve. | The validator's same-site guarantee could be lost on the second URL resolution. Recheck the normalized pathname. The regression checks fallback and preservation of a valid normalized route/query. 13/14 before, 14/14 after. No external callback test was performed. [PR #89](https://github.com/i-am-tj/TrainGrid/pull/89) |
| Medium · reporting privacy · `lib/observability/alerts.ts`, `instrumentation.ts` | Serializing a report and its webhook message for a synthetic profile included its handle in both. Removing the query left dynamic path segments intact. Baseline browser logs also contained synthetic routine IDs on expected action failures. | Logs and optional external alert recipients could receive member handles and object identifiers. Emit the framework route template. A regression checks both serialized destinations. Existing provider-managed access logs have separate retention and redaction settings. [PR #88](https://github.com/i-am-tj/TrainGrid/pull/88) |
| Medium · calendar completeness · `lib/data/sessions.ts` | For a synthetic week with 1,001 sessions, list, count and duplicate each returned 1,000. The copied names also missed a session. Each reader issued one capped query. | Displayed totals and destination weeks could silently omit data. Reuse stable pagination with a unique final ordering column, then insert copies in one statement. The real-stack regression checks distinct IDs, totals and destination content. [PR #90](https://github.com/i-am-tj/TrainGrid/pull/90) |
| High · local fixture safety · `e2e/social.capture.ts` | The setup issued a service-role deletion for every nonempty username. A read-only count on the disposable stack matched all 13 existing social profiles. No destructive baseline reproduction was needed. | An ordinary screenshot refresh could erase every existing local social profile. Refuse populated directories before seeding, use a checked local client and clean up only users created by the run. A sentinel test checks preservation. Both themes and both capture journeys passed on a fresh stack. [PR #91](https://github.com/i-am-tj/TrainGrid/pull/91) |
| Medium · latency-test isolation · `e2e/loaders.spec.ts`, test clients | The slow-section test targeted the fixed container `supabase_db_traingrid` while the app used a differently named project. The expected loader never appeared. Some local guards accepted any suffix after a local URL prefix. | One baseline test briefly held a nine-second table lock in the existing **local development** database. It released automatically. The harness now checks the configured project's published gateway port before locking, rejects nonlocal browser backends and validates local CLI origins. The named-stack latency assertions and origin unit tests exercise these boundaries. [PR #91](https://github.com/i-am-tj/TrainGrid/pull/91) |
| Low · documentation image side effects · `e2e/ui-04.audit.ts` | Running the standard optimized-app audit without requesting screenshots changed eight tracked planner/library PNGs in the disposable checkout. The suite called Playwright screenshot directly. | A release check dirtied documentation files and could replace approved images. Use the existing `UI_SHOTS` opt-in. Compare the eight file hashes around the ordinary audit. [PR #91](https://github.com/i-am-tj/TrainGrid/pull/91) |
| Medium · health monitoring · `app/api/health/route.ts` | Four simultaneous cold GET calls caused four schema reads in a mocked route test. Only completed results populated the per-instance cache. | Concurrent probes repeated privileged OpenAPI reads. Share the pending promise, retry failed reads and expire successful reads after five minutes. The regression checks one read per wave, recovery, expiry and independent Auth checks. [PR #92](https://github.com/i-am-tj/TrainGrid/pull/92) |
| Medium · coverage enforcement · `.github/workflows/ci.yml` | Inspecting the workflow and main run showed that CI omitted the 51-case component suite, eight-case production audit, static asset budget and the documented dependency release check. | Regressions in these areas could pass CI. Run the existing checks in the existing jobs, preserve failure evidence and verify the jobs on the PR. [PR #93](https://github.com/i-am-tj/TrainGrid/pull/93) |
| High · merge control · GitHub settings | The branch API returned `protected=false` and the effective rules endpoint returned an empty array. Vercel is configured to deploy main on merge according to the release runbook. | A writer can advance main without passing CI. Owner action is required to enforce PR review and passing checks. Re-read both settings and verify the merge UI blocks an unready PR. No repository setting was changed. |
| Low · security documentation · `docs/TECHNICAL_DESIGN.md`, `docs/SECURITY.md` | The design described admin invitation management as the only use of the secret. Code also uses it for the public invite-request RPC and health schema check. The dependency section still listed the minimatch advisory resolved by #87. | Updated both documents in the audit report PR. Recheck server-only key consumers and the advisory registry when those paths or the lockfile change. |

## Architecture, operations and residual risks

- App Router pages, Server Actions and route handlers share a server-side member lookup backed by verified claims and an active profile. The proxy protects private navigation and refreshes cookies. Admin operations additionally check the server-side ID allowlist. Session clients operate under RLS. The public invite-request action has its own constrained privileged RPC. Source review covered framework origin checks and redirect handling. Hosted proxy header trust and custom-origin settings need operator verification.
- Routine saves and quick-workout operations have transactional database coverage. Session snapshots survive later routine edits/deletion. Revoked members lose access and an explicit fresh invitation can restore their retained records. The API manifest detects missing public columns/functions. A stale policy or a changed function body with the same signature requires separate verification. Review migration history alongside the role tests.
- Cross-device workout progress and paged reads remain concurrency boundaries. Distinct edits to a whole workout document can overwrite one another. Offset-based export and large-week reads span multiple HTTP transactions. The 1,001-row fix proves completeness for stable data. Two additional real-stack probes at exactly 500 and 1,000 rows also passed. A point-in-time snapshot under simultaneous edits needs separate design and tests. Production frequency is unknown.
- Database lint reported one warning for the untyped empty-array initializer assigned to `uuid[]` in `save_personal_routine`. Routine create/edit/delete tests passed. No corrective migration was justified by a demonstrated runtime failure. Review the initializer the next time the function changes.
- The runtime dependency list is small. `gray-matter` appears only in seed tooling. Moving it to development dependencies would require verifying the deployment and operator seed workflow. No package was removed. The resolved ESLint 9 package emitted an upstream deprecation warning on install.
- Email provider acceptance is observable. Inbox placement and a timeout after provider acceptance are ambiguous. A later explicit send creates a new delivery attempt. The mock cannot establish provider-side exactly-once delivery across different attempts.
- Static Vercel configuration declares Sydney. The code caps assets, caches schema reads per instance, and throttles repeated alert messages per instance. Hosted region placement, billing headroom, connection limits, RPO/RTO and production alert receipt need owner evidence. A local timing sample cannot establish a sustainable free-tier capacity.

## Before and after

The retained log contains runner summaries, the failing boundary assertions and all twelve endpoint/concurrency measurements. [Sanitized execution log](audit-evidence/local-results.txt)

| Executed check | Baseline main | Verification |
| --- | --- | --- |
| Install, ESLint, TypeScript, production build | Clean install from lockfile. All passed. | Production build and type generation passed for the combined code. GitHub checks each independent PR on Node 22. |
| Unit | 368 passed, 39 files | 372 passed, 41 files across the combined changes. Focused failures demonstrated the redirect and health regressions before their fixes. |
| Database | Exact schema, 495 assertions across 16 SQL files, 102 real API tests | Replayed all migrations and seed on an empty local database. 495 pgTAP and 103 integration tests passed. Generated public types matched the repository. First pgTAP invocation from an unshared temporary path found zero files and failed. Supplying the identical SQL files from the Docker-shared checkout ran the full suite. |
| Chromium E2E | 211 passed, four failed, zero retries | 216 passed, zero retries in 4.4 minutes on the combined privacy, redirect, calendar and harness changes. The later health-cache change passed its route regression and 10/10 final optimized-build protection/HTTP smoke cases. |
| Component, responsive and optimized-build audit | 51/51 component cases and 8/8 audit cases passed | 51/51 component cases and 8/8 optimized-app cases passed again. The final audit produced 42 axe reports with zero violations and 49 incomplete rule instances across color contrast, duplicate ARIA IDs and links within text. Eight documentation PNG hashes were unchanged. |
| Firefox and WebKit | Four targeted cases in each engine, 8/8 passed | Login choices, member sign-out, routine create/edit/delete and mobile agenda against the baseline production build. |
| Screenshot fixture | Unscoped delete established by source and read-only predicate count | Populated stack refused capture. First clean-stack run found a deadlock during parallel cleanup of related accounts. Serial cleanup passed all four capture cases. |
| Supply chain and workflows | No advisories in full npm audit. Redacted repository scan found no matches in 658 files. Asset check counted 11 files, 511,657 bytes under 1 MiB. | Production-only npm audit also returned zero. actionlint 1.7.7 validated CI and Release. The new workflow runs the asset check, production dependency scan, component suite and production browser audit. |

**First-run failures.** Two library assertions saw a temporary shared integration fixture (`IT Global Lower`) while running on the same database. The snapshot showed three matching routines where the seed contains two. One slow-section assertion waited on the wrong container, as described above. A library search loader was missed once under concurrent work. It passed on the isolated rerun with the original assertion. Its cause remains unverified. CI uses one retry, so inspect the Playwright summary for retries when reviewing any green job.

**Unit coverage denominator.** Vitest V8 included `lib/**/*.ts`, excluding tests and generated database types. Combined unit execution covered 1,115/1,978 lines (56.37%) and 1,032/1,809 branches (57.04%). Redirect line coverage was 96.55%, mail transport 100% and reporting 100%. The member session and calendar data modules had 0% lines in the unit-only report. Actual database and browser tests exercised them in separate processes. No merged browser/SQL/TypeScript percentage was calculated.

**Local performance.** In a bounded baseline run of 20 requests per endpoint at concurrency four, health returned 20 HTTP 200s (p50/p95 55/2,076 ms), login returned 20 HTTP 200s (83/408 ms), and unauthenticated export returned 20 HTTP 401s (19/38 ms). This run overlapped browser work and included a cold health cache. The optimized login audit recorded 193,605 encoded JavaScript bytes, zero layout shift and zero external request origins. Lighthouse 13.6.0 on local login reported performance 71/100, LCP 1.7 s, CLS 0 and total blocking time 2.0 s under the concurrent lab workload. These measurements describe the run conditions. Production p75 LCP, INP, CLS and database latency remain **Not Verified**.

The final optimized build served 576 bounded loopback reads, 48 per endpoint at each of 1, 4, 8 and 16 concurrent clients. All responses had the expected status. At concurrency 16, p95 was 19.4 ms for health, 61.4 ms for login and 6.9 ms for anonymous export. This short warm-server sample covers public reads. It does not predict member throughput or show the size of a production improvement.

Three final Lighthouse simulated-mobile trials scored 99, 92 and 93. LCP was 1.25, 3.31 and 3.16 seconds, CLS was zero in all three, and total blocking time ranged from 86 to 97 ms. Each final report warned that page loading exceeded its collection window. Treat these results as diagnostic. A repeatable field or controlled-device measurement is still needed before setting a release threshold.

**Example visual evidence.** The 360 px dark planner displays the synthetic Tuesday session in the day agenda. The automated assertions also exercised wide layouts, light theme and keyboard use. [Captured planner screenshot](images/system-quality-audit/planner-360-dark.png)

## Reproducing the checks

Use a clean checkout in a directory shared with Docker. Give the disposable project its own `project_id` and unused ports in `supabase/config.toml`. Use a shell without inherited provider credentials. The audit's temporary project used the 5632x range in place of 5432x. Confirm its API URL before running tests. On baseline main, the slow-loader test hardcodes a database container. Use the harness fix before running that test in a named project. Keep the existing development stack and hosted projects outside the test run.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run scan:secrets
npm audit
npm run test:assets

npm run supabase:start
# Only in the new checkout. Creates a private file containing local fixture settings.
(umask 077 && scripts/ci-supabase-env.sh > .env.local)
npm run release:check -- --exact
npm run db:test
npm run db:lint
npm run test:integration
npm run build
E2E_SERVER=build npm run test:e2e
npm run test:ui
npm run test:audit
```

Run the large-week regression with `npm run test:integration -- tests/integration/data-layer.test.ts -t 'past the Data API row cap'`. The health route test uses mocked upstream responses and asserts call counts. The reporting test uses a synthetic profile path and checks both the log payload and outgoing alert text. Inspect only synthetic artifacts. The SQL suite must report its file and assertion counts, and the integration suite must report executed tests. The first steps of an empty-environment run can pass while database-dependent tests skip.

## Release conditions and manual checks

| Status | Owner validation |
| --- | --- |
| **Open · main protection** | Repository owner should require a PR, review and the intended CI status checks on main. Confirm the effective rules through GitHub and the merge UI. If the owner accepts an exception, record who may release and how they verify CI before merging. |
| **Not Verified · hosted OAuth and proxy** | In an isolated preview with its own Supabase project, verify both providers with designated accounts, including cancellation, an uninvited address, membership acceptance, sign-out, revocation in another browser and re-invitation. Check the exact callback allowlist, HTTPS origin, cookie settings, refresh behavior, identity-linking policy and email confirmation. Inspect settings without copying keys or tokens. |
| **Not Verified · real mail** | With an approved test sender and recipient, validate sender DNS, provider acceptance and delivery in the test inbox. Check reply-to, failure handling and visibility in admin. Keep staging recipients, webhook destinations and credentials separate from production. Do not infer inbox receipt from an accepted request. |
| **Partially verified · hosted schema** | Public health reported connectivity and matching public schema shape. In the release window, the owner should compare migration history to the 17 migration files and verify private trigger/policy changes in a release-matched isolated database. Inspect role grants and security advisors with authorized access. The audit PRs introduce no migrations. |
| **Not Verified · Vercel and free-tier capacity** | Check Development/Preview/Production project separation, region, admin allowlist, function limits, database connections, quota usage and billing notifications. Inspect names, scopes and provider dashboards without exporting values. Compare a representative week of request counts and latency to the actual plan. |
| **Not Verified · backups, rollback, monitoring** | Restore a backup into a separate recovery project, verify migration history and the owner/count invariants with synthetic fixtures, then record measured recovery time and data-loss window. Rehearse selecting the prior compatible app deployment. Trigger a synthetic server error in staging and confirm route-template-only reporting, routing, suppression and recovery. Inspect provider access-log retention separately. |
| **Not Verified · real-device accessibility** | On a phone, use VoiceOver/Safari or TalkBack/Chrome to sign in, edit a routine, schedule and finish a workout, recover from a validation error, and sign out. Check announced status, focus restoration, large text, reduced motion and offline/poor-network recovery. Review automated “incomplete” items manually. |
| **Not Verified · sustained load** | Establish user-volume and latency objectives, then exercise an isolated environment with representative data, cold starts and realistic concurrent members. Compare field p75 Web Vitals and p95 endpoint latency with those objectives. The audit performed no production load test. |

All six remediation PR heads passed their GitHub checks. The CI change also executed its added browser and asset gates successfully. [Expanded CI run](https://github.com/i-am-tj/TrainGrid/actions/runs/45265816877)

Review the six remediation PRs independently. Before release, verify the candidate merge SHA with the combined checks, review owner-controlled gates, and record the release decision. Reverting any of these application/test changes requires no database rollback. Reverting a privacy or redirect fix would reintroduce its finding. [Release runbook](RELEASING.md) · [Database audit and migration caveats](DATABASE_AUDIT.md)
