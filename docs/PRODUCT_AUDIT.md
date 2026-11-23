# TrainGrid product audit

**23 November 2026 · Current checkout `29e07ed` · Decision: keep access limited.**

TrainGrid is most convincing at the handoff between planning a week and doing the work. A member can choose a concrete workout, adapt one occurrence and take that plan onto the gym floor. The personal benefit exists even if nobody else joins. The weakest handoff is also the most important one. In the local app I could create and copy a routine, but saving it to the calendar failed. Even on a compatible database, the Library’s promise to schedule onto “any week” leads to a form exposing only seven dates.

**The next product improvement should be a reliable Library → chosen date → saved session journey.** First prove it works against the release database schema. Then let the member choose the actual date while keeping the routine selected. Success means the member can point to the right workout on the right day after reloading. Adding another discovery surface would leave that problem intact.

## Status

*Updated 24 November 2026. The audit below is kept as written on 23 November; this section records what has happened since.*

| Finding | Status | Pull request |
|---|---|---|
| F1. Planner failed on a database behind the build | Done. `npm run release:check` and `/api/health` report a schema behind the build. Production migrations applied and verified. | [#69](https://github.com/i-am-tj/TrainGrid/pull/69) |
| F2. “Any week” narrowed to the current week | Done. One date field for adding and moving a session, any date. | [#72](https://github.com/i-am-tj/TrainGrid/pull/72) |
| F3. Quick workout lost its Resume entry point | Done. Resume follows the workout log; empty plans can start. | [#68](https://github.com/i-am-tj/TrainGrid/pull/68), [#73](https://github.com/i-am-tj/TrainGrid/pull/73) |
| F4. Delete warning understated the loss | Done. The dialog names the workout log and says posts stay. | [#68](https://github.com/i-am-tj/TrainGrid/pull/68) |
| F5. Download could misrepresent history | Done. Export format v6: origin, posted totals, paging, unavailable sections disclosed. | [#70](https://github.com/i-am-tj/TrainGrid/pull/70) |
| F6. Entry copy understated a public audience | Done. The session page no longer says “followers”. | [#68](https://github.com/i-am-tj/TrainGrid/pull/68) |
| F7. Invite retention depended on traffic | Done. Daily pg_cron purge, live in production. | [#71](https://github.com/i-am-tj/TrainGrid/pull/71) |
| F8. Admin could not tell unavailable from empty | Done. The queue shows an error with retry. | [#71](https://github.com/i-am-tj/TrainGrid/pull/71) |
| F9. Guidance counted as exercise work | Done. Running plans are Warm-up, Main, Cooldown; seed live in production. | [#75](https://github.com/i-am-tj/TrainGrid/pull/75), [#76](https://github.com/i-am-tj/TrainGrid/pull/76) |
| F10–F13. Strengths | Kept unchanged, as recommended. | — |
| F14. Home asked a beginner to learn the data model | Done. One first-session invitation in Today; Quick actions removed. | [#81](https://github.com/i-am-tj/TrainGrid/pull/81) |
| F15. Filters crowded out results on phones | Done. Equipment and type behind Filters with an active count. Not measured: time to choose a routine. | [#80](https://github.com/i-am-tj/TrainGrid/pull/80) |
| F16. Social actions competed with finishing | Partly done. Done is the primary finish action. Not done: trialling People under Feed. | [#77](https://github.com/i-am-tj/TrainGrid/pull/77) |
| F17. Gesture paging on Landing | Done. Native scrolling; section links kept. | [#79](https://github.com/i-am-tj/TrainGrid/pull/79) |
| F18. Quick start could leave a partial workout | Done. Start and finish are single transactions, safe to retry. Migration live in production. | [#74](https://github.com/i-am-tj/TrainGrid/pull/74) |
| F19. Operational polish cost | Deferred, as recommended. | — |
| F20. Deletion request hard to make after revocation | Done. Profile links to Privacy’s deletion section, which names an email that works after access ends when `TRAINGRID_CONTACT_EMAIL` is set. | [#71](https://github.com/i-am-tj/TrainGrid/pull/71) |

Still open from section C: the three evidence steps under *Acceptance and evidence* (a release smoke on a release-matched backend, the planning study with invited testers, and adoption measurement), which need real members rather than code.

## Evidence and limits

I audited the checked-out branch `claude/beautiful-bohr-knjcn5`, which matched its locally recorded origin tip and was newer than locally recorded main. This is an assessment of that source and its configured local environment. Production deployment state was unverified.

| Evidence | What was checked |
|---|---|
| Live | Started this checkout with Next dev. Used Chromium at 1440 × 900 and 390 × 844, plus a Library reflow check at 320 px. Read the rendered screens, clicked controls, and inspected fresh captures of Landing, Home and Library. Used disposable local members through the repository’s fixture helper. |
| Live successes | Signed-out Home led to Login. The invite-request URL opened the form and Escape dismissed it. Created a one-item personal routine, copied Easy Run, saw copy confirmation and both versions in Library, opened the quick-workout menu, dismissed onboarding, opened Feedback, downloaded a v5 JSON export and signed out to Login. |
| Live failures | Both a seeded and a personal routine failed to reach the saved week. The personal routine produced “Could not save the session.” Home rendered its week failure state, the weekly planner rendered an error, and People, Feed and social settings rendered their unavailable state. Local read checks confirmed a missing session column and social tables. |
| Code and tests | Read route groups, components, server actions, data mappers, SQL migrations and policies, release instructions, ADRs and test assertions. Ran the unit suite: **348 passed across 35 files**. Ran axe WCAG A/AA checks on the main region of Home, Library and Profile at phone width with no reported violations in the rendered states. |
| Untested | Provider OAuth acceptance, actual invitation/feedback email delivery, the admin’s live approval workflow, successful planner saves, a live multi-member social exchange, and gym-floor offline recovery. The database, integration and browser suites contain relevant scenarios. Their assertions are cited as specifications, not fresh pass results. No production load test, physical-phone or screen-reader session, behavioral analytics, interviews or retention data. |

**Evidence labels below:** **Live** means directly observed. **Source** means the current implementation or schema establishes the behavior. **Inference** means the predicted user impact or failure frequency needs validation. Severity indicates downside or, for strengths, the cost of losing the behavior. S/M/L are relative implementation sizes for one maintainer.

## A. Product scorecard

Scores use 5 for a mixed experience with material gaps, 7 for a dependable design with identifiable weaknesses, and 9 for an unusually complete, demonstrated outcome. These are judgments, not measured satisfaction or benchmarks.

| Area | /10 | Evidence and interpretation |
|---|---:|---|
| Product value and differentiation | 8 | The example week, 18 seeded routines, independent session copies and phone player serve one recurring job. Users can combine runs, lifts and untimed work. Demand, willingness to switch and market uniqueness remain unmeasured. |
| Feature completeness | 6 | The source spans scheduling, customization, execution, export and optional sharing. The tested environment stopped at the calendar write. Cross-week scheduling from Library and free-form resume from session detail are incomplete even in source. |
| User experience | 6 | Copy success says what happened and where to edit. First-time Home repeats three ways into closely related work. Moving a session asks for an ISO week string and errors can replace the form. |
| Visual design | 8 | Desktop Landing pairs the product claim with a legible example week. The warm background, dark primary buttons and restrained accent carry into Home and Library. At phone width the Library controls occupy most of the first screen before the choices they filter. |
| Mobile experience | 7 | Today appears above onboarding on the observed phone Home. Library fit at 320 and 390 px. The source switches to a day agenda, large workout controls and a safe-area-aware action bar. Sustained logging on a device remains unverified. |
| Accessibility | 7 | Named native dialogs, a skip link, visible focus treatments, reduced-motion handling and Escape dismissal support keyboard use. The three main-region axe checks are encouraging. They exclude the shell, assistive-technology usability and unavailable workout/social content. |
| Performance | 6 | Home streamed independent sections and Library remained usable during a planner failure. The weekly query fetches full snapshots for overview presentation, and slow sections can trigger a full refresh. No field latency, Core Web Vitals or production-cost measurements justify a higher or lower speed rating. |
| Privacy and trust | 6 | Membership checks, database row policies, private social defaults and explicit post previews are strong. Export fidelity, retention wording and the session deletion warning undermine otherwise clear ownership promises. |
| Maintainability | 7 | Versioned snapshots, transactional routine saves, migration tests and distinct action/data layers support change. A new column broke an older core journey locally. Several newer workout decisions have yet to propagate into export, session-detail controls and release verification. |

## Journeys and product fit

| Journey | Experience and consequence |
|---|---|
| Public → Login → membership | The desktop hero answers “what would I do here?” with a mixed week and “Plan the week. Train with it.” Login explains the invited email and offers Google/GitHub. The request dialog identifies the human reviewer and makes name/note optional. The callback exchanges the OAuth code then calls `accept_invitation`. A fixture supplied the authenticated identity for this review. Manual admission is a reasonable beta constraint. |
| First visit → Home | Onboarding lives on Home. A dismissible, data-driven checklist coexists with today, week, quick actions and My routines. Today appears first on the phone. On a fresh account the black primary action starts an unscheduled workout and the checklist asks for a personal routine even if a shared routine already meets the need. A member who scheduled a shared routine has achieved value. |
| Discover → create/copy → schedule | Library exposes scope, text search, equipment and type, a short summary and direct Schedule. A global routine can be scheduled directly. Copy is needed only to edit the reusable template. Copying Easy Run increased the visible list from 18 to 19 and returned the new Mine detail. Personal creation saved successfully. Schedule preserved the chosen routine, offered 23–29 November only, then failed locally on Add. |
| Week → manage a session | Source provides previous/next week, Today, timed and untimed sessions, a desktop grid and a phone day strip. Detail distinguishes Edit (calendar details) from Customize content (this occurrence). Editing the original routine leaves the occurrence intact. Changing weeks from Edit requires knowing the week code. Session deletion also destroys an attached workout log. |
| Perform → finish | Source routes planned and quick activity to the same focused player. It supports local draft saves, retry, rest and prior performance. Empty snapshots become free-form workouts there. Home offers a direct workout link, while Session detail suppresses Start/Resume for empty snapshots. A finished workout offers Edit sets, Done and the most prominent action, Post about it. |
| Profile → follow → post → feed | Source starts an optional social identity as private, with identity photo off. Members can search People, request to follow private profiles, approve/remove followers, post a session preview and read paged updates. Public-to-members posts can be read by other signed-in members visiting the profile. Likes and comments follow post visibility. Setup preserves a return path to the composer. Locally each social entry point reached the migration fallback, including the setup link advertised on Profile. |
| Invitations → feedback → account | The admin queue supports invite, dismiss, delivery status and revocation. Feedback opens from the member shell and tells members it includes their name and page. Storage precedes best-effort email. Profile groups appearance, device time zone, export and sign-out. Local download and sign-out worked. Account deletion runs through owner contact in Privacy. Leaving the social layer is a separate user action. A revoked member may need a contact channel outside the member shell. |

## B. Findings register

### Verified defects and inconsistencies

| ID and finding | Evidence | User impact | Severity | Recommendation | Decision | Effort | Confidence |
|---|---|---|---|---|---|---|---|
| F1. A healthy local service could not plan a session | **Live + source.** `/api/health` returned OK. Home showed a retry, Week failed, and Add failed. `lib/data/sessions.ts` requires `scheduled_sessions.origin` in its read and insert-return columns. Local API reported that column missing. `app/api/health/route.ts` checks Auth reachability. `docs/RELEASING.md` already asks the owner to apply migrations before/with deploy. | The first meaningful task fails. Retrying cannot install a missing migration. Social fallback linked to a planner that also failed. Production exposure is unknown. | Critical in tested environment | Gate rollout on the expected migration version plus a disposable member scheduling, reloading, starting and finishing a session on a release-matched stack. Retain the cheap public liveness check. | Improve | S | High |
| F2. “Any week” narrows to the current week | **Live + source.** `LibraryHeader` promises any week. `RoutineDetail` and `RoutineList` target `/week/current/add`. `AddSessionForm` hides weekId and offers seven dates. `EditSessionForm` exposes YYYY-Www. `e2e/journeys.spec.ts` expects a page error for an impossible week. | Planning for next Monday requires restarting from that week’s planner or scheduling and moving it. A correctable input error interrupts editing. | High | Use one labeled date control for Add and Edit. Preserve selected routine, notes and time. Show date errors beside the field. Verify Sunday → next Monday and December → January. | Improve | M | High |
| F3. A quick workout can lose its Resume entry point | **Source.** `lib/data/workouts.ts:startQuickWorkout` starts with an empty session snapshot. Added exercises live in the log. In `app/(app)/session/[id]/page.tsx`, WorkoutCallout returns early on empty items before rendering Resume. The focused route explicitly supports free-form. | Opening the session from the calendar during an interrupted workout gives no Resume button. Today’s Home link can mask the defect. | High | Base Resume on log status. Allow Start for valid empty plans that the player can handle. Check the phone path Home → quick start → leave → calendar → session → resume with the same sets. | Improve | S | High |
| F4. The delete warning understates the loss | **Source.** `components/session/EditSessionForm.tsx` asks to remove a session “from the week” and reassures about its routine. The workout log FK cascades in `20261120020000_workout_logs.sql`. The post FK in `20261122000000_social.sql` retains the post and clears the session link. | One confirmation can erase performed sets and notes while a previously published summary survives. | High | Show the consequences for the specific session before confirming. Name the workout log, session and independent post explicitly when relevant. Offer moving the date to members trying to tidy their calendar. | Improve | S | High |
| F5. A valid download can misrepresent history | **Live + source.** `/api/export` returned v5. `lib/data/export.ts` omits origin from its session select. `sessionFromRow` maps missing origin to planned. `exportSocialData` omits published set/volume fields and caps lists. Core list reads have no pagination. Local `supabase/config.toml` caps API results at 1,000. A missing social schema becomes empty social arrays. | A quick workout exports as planned. Large histories can be silently truncated. A valid JSON file can look complete even where a section was unavailable. | High | Include origin and posted totals, page every collection with a stable order, disclose unavailable sections and describe export scope precisely. Verify with mixed sessions, optional summaries and more than one API page. | Improve | M | High |
| F6. Entry copy understates a public profile’s audience | **Source.** Session detail says Post update shares “with your followers.” `components/social/PostComposer.tsx` correctly tells public-profile authors that any signed-in member visiting their profile can see it. SQL `private.can_view_content` supports that wider audience. | A member can enter publishing with a narrower expectation. The preview corrects this before posting. | Medium | Use the composer’s audience wording at the entry point, or say “Review who can see this before posting.” Preserve explicit publication. | Improve | S | High |
| F7. Invite retention depends on future traffic | **Source.** Privacy says requests are deleted 180 days after submission. The cleanup in `20261120000000_invite_requests.sql` runs inside a subsequent valid request. No scheduled purge appeared in the checkout. | In a quiet invite-only service, past applicants’ details can outlive the stated period. External cleanup was unverified. | Medium | Confirm the deployed retention job. If absent, run a small scheduled deletion and verify it with zero new requests. Align the notice with the actual interval. | Improve | S | High |
| F8. Admin cannot distinguish unavailable from empty | **Source.** `lib/admin/invite-requests.ts` returns an empty array on list failure and zero on count failure. `components/admin/InviteRequests.tsx` displays “No requests waiting.” | The sole reviewer may miss applicants while the queue appears clear. | Medium | Represent unknown separately. Display an inline retry on the admin page and omit an unknown badge count. | Improve | S | High |
| F9. Some guidance is counted as exercise work | **Live + source.** Easy Run detail showed five items including Recovery (“None beyond staying easy”) and Progression (advice for future runs). `data/templates/easy-run.md` is the source. The focused route maps every item through `planExercise`, which defaults running steps to a completion tick. | The runner is asked to log completion of advice. Workout totals can convey more performed work than the plan intended. | Medium | Curate the seeded running plans first. Keep actionable stages in the player and put progression guidance in description/notes. Preserve already scheduled copies. | Simplify | S | High |

### Verified strengths and design trade-offs

| ID and finding | Evidence | User impact | Severity | Recommendation | Decision | Effort | Confidence |
|---|---|---|---|---|---|---|---|
| F10. A routine, its scheduled copy and its workout log have distinct lifetimes | **Source + live copy.** `lib/data/sessions.ts`, `lib/data/mappers.ts`, routine detail and `e2e/journeys.spec.ts` exercise independent edits. The copy confirmation names the editable copy. | Users can reuse a template and change Tuesday alone without silently changing another day. | High | Preserve the snapshot contract, provenance and Schedule-without-copy behavior. | Keep | S | High |
| F11. Private training has a complete place in the product | **Source.** Separate social identity, private defaults, optional photo, explicit post preview, bounded post fields and row policies in the social migrations. Own-plan reads use member identity. `supabase/tests/database/12_social.test.sql` and `13_reactions_and_quick_workouts.test.sql` specify visibility and reactions. | Starting a training plan requires no audience. Sharing one result need not expose exercises, private notes or the full week. | High | Preserve opt-in identity, field selection, policy enforcement and ability to leave social independently. | Keep | S | High |
| F12. Mobile and desktop solve different calendar tasks | **Live + source.** Today precedes onboarding on phone Home. `WeekGrid` and `DayAgenda` implement week overview and day execution. Timed/untimed and Today/selected have distinct treatments. | A runner can check today one-handed while a desktop user can compare the full week. | Medium | Preserve these layouts, untimed sessions and device-local “today.” Verify with a populated week on both layouts at release. | Keep | S | High |
| F13. Failures are often contained | **Live + source.** Home still showed routines and onboarding when its weekly query failed. Feedback writes before email. `components/workout/hooks.ts` writes local progress and retries server saves. `components/ui/Modal.tsx` provides native dialog behavior. | A failed subsection need not erase unrelated work. Visible save/retry status matters in a gym. | High | Preserve independent sections, local draft recovery, pending controls and the existing native dialog. Exercise offline/reconnect on a device before promising recovery. | Keep | S | High |

### Inferences and risks to validate

| ID and finding | Evidence | User impact | Severity | Recommendation | Decision | Effort | Confidence |
|---|---|---|---|---|---|---|---|
| F14. Home asks a beginner to learn the data model too early | **Inference from live Home and `lib/onboarding/model.ts`.** Add appears in Today, checklist and Quick actions. Planning from a routine satisfies two checklist milestones. Owning a copy is a separate mandatory milestone. | Someone who wants to repeat a seeded routine sees an unfinished setup task despite already achieving the outcome. No abandonment rate was measured. | Medium | Give a fresh member one invitation to schedule a first session. Make copy/create contextual to Library and collapse repeated shortcuts. Keep dismissal. | Simplify | M | Medium |
| F15. Discovery controls crowd out discovery on phones | **Inference from 390 px Library capture.** Scope, search, equipment, submit, five type choices and New routine precede result one. 320 px reflow worked. | The first visible result is low on the screen even with only 18 seeded choices. Filters still serve members with specific equipment. | Medium | Keep search and scope visible. Try collapsing equipment/type behind Filters with active count and clear action. Compare time to select a suitable routine with and without a constraint. | Simplify | S | Medium |
| F16. Social actions compete with finishing | **Source and inference.** Feed and People both occupy the member header. `WorkoutSummary` styles Post about it as the dominant action beside Done and Edit sets. | Sharing is easy, but the natural end for a private user is visually secondary. Actual sharing demand is unknown. | Medium | Make Done the primary finish action. Keep posting one tap away. Test moving People under Feed while retaining a direct pending-request entry. | Simplify | S | Medium |
| F17. Gesture paging adds effort to reading Landing | **Source and inference.** `LandingScroll` intercepts vertical wheel gestures and animates to the next section over 1.25 seconds. It honors reduced motion and allows slow touch drags. | Fine scrolling through a tall section can be harder than expected. No device-latency or abandonment claim follows from the code. | Low | Remove custom wheel/swipe paging and keep section anchor links plus native scrolling. | Remove | S | Medium |
| F18. Quick start can leave a partial workout | **Source and inference.** `startQuickWorkout` inserts the session before starting its log. Finishing and recording a quick workout’s name/duration are also separate updates in `lib/workouts/actions.ts`. | A partial failure or retry can leave an empty session, duplicate quick session or completed workout with its fallback name. Frequency is unknown. | Medium | Make each user operation atomic or recoverable with the same request ID. Test a failed second write and retry. Keep a single session/log model. | Improve | M | High |
| F19. Operational polish carries a recurring cost | **Source and inference.** `SlowSectionWatcher` polls every 500 ms and can refresh a slow page. Home shares week data across sections but `listSessionsForWeek` fetches snapshots. The focused route reads entries from up to 40 prior logs for “last time.” | Large histories and poor connections could affect free-tier reads or perceived speed. No bottleneck was measured. | Low | Time a warm Home, week and player open with realistic entries and a slow connection. Optimize the measured payload or retry first. | Defer | S | Medium |
| F20. A deletion request can become hard to make after revocation | **Source and inference.** Privacy directs requests to configured email or member Feedback. The observed Profile offered no contact email. Feedback requires active membership. | A former member in a deployment without public contact could lose the in-product route to request deletion while their records remain. | Medium | Publish a monitored, signed-out contact route on Privacy and link to account deletion instructions from Profile. Keep manual fulfillment during beta. | Improve | S | High |

## Major feature decisions

| Feature | Disposition | Benefit and trade-off |
|---|---|---|
| Landing, brand, public product preview | **Keep** hero and example week. **Remove** gesture paging. | The actual plan communicates value at a glance. Losing the cinematic transitions buys direct reading control. |
| Login, invite requests, reviewer tools, email delivery and revocation | **Keep** manual admission. **Improve** queue failures and retention. | Matches one operator’s capacity. Broader access will require evidence that requests can be reviewed and supported promptly. |
| Home, onboarding, release banner and shortcuts | **Simplify** first visit. **Relocate** release emphasis to Profile/What’s new after acknowledgement. | Gives today and planning priority. Releases remain discoverable, with less repeated promotion. |
| Routine discovery, global seed, personal creation, editing and copy | **Keep** one library with scope and direct schedule. **Improve** phone filters and seed instructions. | Reuse is valuable without mandatory cloning. Progressive disclosure costs a tap for frequent filter users. |
| Week/day views, timed/untimed sessions, reschedule, delete and customize | **Keep** responsive views and occurrence semantics. **Improve** date selection and destructive confirmation. | A small date change can serve both planners and editors without introducing another calendar system. |
| Planned workout, quick workout, rest, prior sets and summary | **Keep** the shared player, local saves and rest controls. **Improve** resume/partial-write behavior. **Relocate** sharing to secondary emphasis. | One model covers planned and spontaneous training. Correct recovery costs more engineering time than another summary card. |
| Social profile, visibility, discovery, follows and requests | **Keep** optional identity and explicit controls. **Relocate** discovery under Feed on a trial basis. | Reduces navigation weight while preserving request management. Watch whether members can still find a training partner. |
| Session posts, Feed, likes and comments | **Keep** existing session-linked posts. **Defer** expansion of reactions and conversation. | Small groups can acknowledge work. Moderation and discovery costs grow with audience size, while evidence of planner benefit is limited. |
| Profile, sign-out, device theme/time zone, install shortcuts | **Keep** device-local preferences, Home launch and local sign-out. **Improve** account-deletion contact. | Low support burden and easy return on a phone. Installing the manifest does not establish that a cold start works offline. |
| Export, privacy, terms, feedback and release notes | **Improve** export completeness and retention language. **Keep** contextual feedback and public notices. | These provide a practical relationship with a sole maintainer. Owner-assisted requests are proportionate while a reliable public channel exists. |
| Duplicate week | **Defer** exposing existing `lib/data/sessions.ts:duplicateWeek`. Its callers in this checkout are integration tests. | A promising shortcut for repeat plans. Blindly appending into an occupied week or copying a quick workout without its logged exercises would surprise users. This is a data-layer capability, not a shipped member action. |

## C. Prioritized roadmap

**Fix now — before inviting a broader cohort.** The maintainer should clear F1 on a release-matched stack, then F3/F4 and F5. Pair F6 with the deletion copy change. Verify the 180-day job and a signed-out contact for F7/F20, and distinguish admin queue failure from zero pending (F8). Protecting a saved workout, an export or a privacy choice outweighs the polish of a new screen. A manual release smoke using disposable data is sufficient at current scale.

**Improve next — next small beta iteration.** Deliver F2 first. Use the same date interaction for creating and moving a session. Next, trim non-actionable seeded steps (F9) and test the first-session prompt (F14). Fix the quick-workout retry path (F18) before promoting quick start further. Trial phone filters and summary hierarchy (F15/F16) one at a time. Native landing scroll (F17) is inexpensive housekeeping.

**Build later.** If observed members repeatedly recreate the same week, prototype a previewed “Copy planned sessions to next week” action using the existing data layer. Show the destination and existing sessions, exclude completed quick logs from the copy, and make repeated submission safe. If the study shows one repeated routine dominates, a small “schedule again” action costs less. Build only the action that matches observed behavior.

**Do not build.** Defer public profiles, algorithmic ranking, more reaction types, leaderboards, generalized chat, AI-generated plans and a separate native client. None addresses the observed failure to put an existing workout on the intended date. Each adds content, infrastructure, platform or privacy obligations for a single maintainer.

**Keep unchanged.** Preserve immutable scheduled snapshots, schedule-without-copy, private plans and explicit posting, time-optional sessions, the phone agenda/desktop grid split, and immediate local workout drafts. There is no evidence that a visual redesign, database replacement or new client framework would resolve the audited problems.

### Relative prioritization under uncertain reach

No observed cohort counts were available. To apply the Product Manager skill’s RICE framework without inventing usage, the table compares **one eligible member per month for each task**. This is a normalized scenario, not an estimate that the cohorts have equal actual size. Impact, confidence and person-months are planning judgments for a proposed scope. Score = reach × impact × confidence / effort. Replace unit reach with unique eligible members per month when known. Severity and data-loss risk override arithmetic for release gates.

| Candidate | Eligible monthly cohort (normalized reach = 1) | Impact | Confidence | Effort, person-months | Score | Reason |
|---|---|---:|---:|---:|---:|---|
| Release-matched planner smoke | Members attempting to plan on a mismatched release | 3 | 95% | 0.10 | 28.5 | Local hard stop, existing fixture tooling, small release step. |
| Resume from detail | Members returning to an unfinished empty-snapshot session | 2 | 95% | 0.08 | 23.8 | A route condition hides a working player. |
| Accurate delete confirmation | Members deleting a logged session | 2 | 95% | 0.10 | 19.0 | Prevents an irreversible misunderstanding with a small change. |
| Choose any date from Library | Members scheduling or moving across weeks | 2 | 90% | 0.35 | 5.1 | Directly serves the core job. Add and Edit need consistent behavior. |
| Complete export | Members downloading affected histories | 2 | 90% | 0.40 | 4.5 | Multiple collections and a versioned contract need boundary tests. |
| Simplify first visit | New members reaching Home | 1 | 60% | 0.20 | 3.0 | Repetition is visible, conversion impact unknown. |
| Preview a copied week | Members repeatedly rebuilding similar weeks | 1 | 40% | 0.60 | 0.7 | Existing copy primitive helps. Demand, collisions and quick-session semantics remain open. |

### Acceptance and evidence for the next decision

1. **Release gate, maintainer, before expanding invitations.** On a release-matched backend, one new member schedules a global routine, reloads Home/Week, starts, leaves, resumes and finishes on phone. Verify a quick workout through calendar detail, and export both. A deliberately mismatched staging schema should fail the release check even when Auth is healthy.
2. **Planning outcome, PM/maintainer, next beta iteration.** Ask invited testers to schedule Easy Run for next week, move it to another date, and change only that occurrence. Record task completion without help, wrong-date saves, abandonment point and time to find the saved session. Include a Sunday/week-boundary case and a keyboard-only attempt. Compare the current flow with the proposed date interaction.
3. **Adoption evidence, owner, following two training weeks.** With consent, measure the share of newly activated members who save a first session, and the share of those planners who return to execute or reschedule it within seven days. Count people once per cohort and report the denominator. Ask what they used before and whether planning the next week was worth returning for. A small observed pilot suffices without introducing third-party analytics.

## D. Product manager verdict

**Three biggest strengths**

1. A concrete, recurring job ties the calendar, reusable routines and focused workout together.
2. Independent occurrence snapshots let members adapt training while protecting their templates and other days.
3. Training is private by default and useful alone. The social preview and explicit audience controls let sharing be a deliberate choice.

**Five biggest weaknesses**

1. The release can appear healthy while the core planner fails against its configured database.
2. Library discovery hands off to a current-week-only form. Moving a session exposes a technical week identifier.
3. Workout history has weak points at high-stakes moments: resume from a session, deletion confirmation and quick-workout partial writes.
4. Export fidelity and retention wording fall short of the product’s promises about control over personal data.
5. Home and the workout finish put overlapping planning, quick-start and social actions in competition. Their relative value to actual members is untested.

**Remove or simplify:** remove landing gesture interception, collapse duplicate first-visit actions, reduce filter prominence on phones, remove coaching notes from loggable run steps and make posting secondary to Done. Keep the existing feed available to members who choose it.

**Leave untouched:** the snapshot contract, direct scheduling of shared routines, private-by-default planning, optional session sharing, untimed sessions and the two responsive planner views.

**Single most important improvement:** let a member choose a routine and a date, save once, and reliably find that session on their calendar. A passing release smoke and a date picker that works across weeks are the technical and interaction criteria for that same outcome.

**Broader adoption:** hold expansion. The observed environment failed the planner journey, and independent source findings affect recovery, deletion and export even on a migrated stack. Reassess after those release checks pass and a small cohort can plan and return to train without coaching. Production reliability, user demand, invitation throughput and repeat use are still open questions.
