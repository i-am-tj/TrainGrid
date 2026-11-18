# Epic 3 UI-04 — frontend verification

Date: 2026-11-17. Branch `codex/epic-3-ui-04`, based on reviewed main `4984124` (merged UI-03 PR #39). This is frontend review evidence, not certification of backend integrations.

## Changes

- Native keyboard skip link and focusable main landmark in the app and isolated preview shell.
- Static loader under reduced motion; normal motion and the approved sliding library pill remain.
- Existing darker text roles for secondary labels, stronger form boundaries and readable placeholders. No theme-variable changes.
- Header/footer, provider buttons, long headings and library scopes reflow with enlarged text. The provider spinner uses the existing icon slot to avoid adding width.
- Corrected nested headings in mobile hero and delivery examples. Founder identity, supplied portrait, footer order and background-only active navigation are preserved.
- Test-only axe engine, asset budgets and optimized-app network/layout checks. No runtime dependency or WebGL added.

## Coverage and commands

Local Supabase is required for existing app and production audit tests. DB-writing regression suites should run sequentially. Example fixtures remain in tests and ignored build output; no new public preview route exists.

| Check | Result / scope |
| --- | --- |
| `npm run lint`, `npm run typecheck` | Pass |
| `npm test` | 184 unit tests |
| `npm run db:test` | 191 local DB tests |
| `npm run test:integration` | 35 integration tests |
| `npm run test:e2e` | 126 app browser tests |
| `npm run build -- --webpack` | Optimized build passes |
| `npm run test:ui` | 48 component browser tests |
| `npm run test:assets` | 8 local public assets, 482,158 bytes total; 1 MiB budget |
| `npm run test:audit` | 8 optimized-app checks; build first |
| `npm run scan:secrets` | No credentials found |

The installed Next version's default Turbopack build encountered a worker port-binding restriction in this environment during earlier work. The recorded production build uses Next's supported webpack option. `test:all` retains the project's default build command and now includes component, asset and production audits; the table records the individual executed checks.

Component checks cover 19 landing/dashboard/login/invitation/email variants at 320 and 1440px in both themes, plus the existing 360px, tablet portrait/landscape, 1024px laptop, 1440px desktop and short-window matrix. Dashboard long names, missing routines, empty day/week, loading and recoverable errors are distinct. Standalone email is light-only by design. Auth unavailable/submitting/refusal/error cases are isolated fixtures; working provider handoff remains covered by app tests.

Live optimized-app audits cover login/errors, planner, library, routine detail/editor, add/detail/edit/customize session and guarded invitations/invalid email preview, in light/dark modes. Member pages are audited at 360 and 1440px, with 200% text overflow checks. Login checks include 320px and a 320×256 CSS viewport equivalent to 400% zoom on a 1280px-wide display. Existing planner regressions cover 24-hour links, timed/untimed stacking, morning scroll, internal scrolling/footer at ordinary and short heights and a 720×450 viewport equivalent to 200% zoom on 1440×900. These are CSS viewport and text-scaling checks, not a claim that native browser zoom or every browser engine was tested.

Keyboard checks cover skip-to-main, active navigation semantics, visible focus, admin native disclosure/recipient tab order, planner scrolling and the existing mobile Escape/outside-click behavior. Reduced-motion variants remove entrance/transitions/spinning; normal entrance remains short and the CTA stays operable during animation.

## Accessibility and measurement limits

The test-only local axe engine runs WCAG 2 A/AA, 2.1 AA, 2.2 AA and app best-practice tags without disabling failing rules. Standalone email excludes app-landmark best practices. No violations were reported in the audited states. Axe reports contrast incompletes for decorative background images/underlines; reports retain these and component checks separately verify computed foreground against the underlying opaque surface at ≥4.5:1. This solid-color check does not simulate every overlapping decorative pixel. Visible form boundaries are separately checked at ≥3:1. Automated checks do not replace screen-reader, browser-engine or human visual review.

The production login's local cold-page measurement recorded CLS 0, about 142 KB encoded JavaScript (including script preloads), and zero external origins. The regression budget is 350 KB encoded JavaScript and CLS <0.1. This is one local Chromium measurement, not field Core Web Vitals, a throttled performance score or a guarantee for future routes. Audit JSON includes resource-level evidence under `.next/ui-audit/`; rebuilds replace this ignored output. No axe script is included in application chunks. The email logo is requested only after opening the guarded preview, and preview editing issues no POST/send requests.

## Review screenshots

Final optimized-app captures use real Next fonts and disposable local data. Static landing/dashboard captures are labelled examples with fallback fonts, never production member records.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Planner, light | [1440px](../docs/images/epic-3/ui-04/planner-1440-light.png) | [360px](../docs/images/epic-3/ui-04/planner-360-light.png) |
| Planner, dark | [1440px](../docs/images/epic-3/ui-04/planner-1440-dark.png) | [360px](../docs/images/epic-3/ui-04/planner-360-dark.png) |
| Library, light | [1440px](../docs/images/epic-3/ui-04/library-1440-light.png) | [360px](../docs/images/epic-3/ui-04/library-360-light.png) |
| Landing example, light | [1440px](../docs/images/epic-3/landing-1440-light.png) | [360px](../docs/images/epic-3/landing-360-light.png) |
| Dashboard example, dark | [1440px](../docs/images/epic-3/ui-02/dashboard-ready-1440-dark.png) | [360px](../docs/images/epic-3/ui-02/dashboard-ready-360-dark.png) |

The UI-03 directory also contains refreshed invitation, routine/editor and session screenshots from the final app regression run.

## Completion boundary

UI-01–04 presentation and specified regression coverage are implemented for review. Public root publication, authenticated `/home`/member data, post-login redirect coordination and actual email sending/delivery/retry remain unimplemented Claude responsibilities. Inbox-client rendering awaits the selected provider. See EPIC-3-UI-HANDOFF.md sections 1–8 and its final boundary table. No production data operations, schema, new endpoints, authorization or OAuth redesign occurred. Manual review and merge only.

## Follow-up — routine confirmation and empty-state alignment

After integration PR #41 merged, based on reviewed main `a28f834`: routine deletion now opens a themed native HTML modal rather than `window.confirm`. Cancel receives initial focus; Escape/Cancel dismiss and return focus to the trigger; background content is inert. The existing delete server action, hidden routine id, authorization and preservation of scheduled workout snapshots are unchanged. Submission shows Deleting… and prevents repeated submission or dismissal while pending. Other existing confirmation flows are outside this change.

The dashboard's empty-routine actions now share a centered cross-axis alignment, matching text size and minimum control height, and wrap into centered rows on narrow screens.

Verification: lint/typecheck/secret scan pass; 49 component browser tests pass (including desktop center alignment and phone wrapping); 32 affected app regressions pass plus the focused modal test in light/dark at 320/1440px. The latter verifies initial focus, Tab/Shift+Tab between actions, background focus exclusion, Escape/Cancel focus restoration, viewport fit, no native JavaScript prompt, and zero axe violations. Actual deletion, ownership protection and scheduled-copy preservation are covered by the updated existing regressions. Native dialogs allow browser-chrome focus; checks cover intra-dialog Tab order and background inertness.

The empty-routine actions use a 24px horizontal gap and 12px vertical gap when wrapped. Regression checks verify these distances and alignment in both themes.

| Fix | Desktop light | Desktop dark | Mobile light | Mobile dark |
| --- | --- | --- | --- | --- |
| Delete modal | [1440px](../docs/images/epic-3/enhancements/delete-routine-1440-light.png) | [1440px](../docs/images/epic-3/enhancements/delete-routine-1440-dark.png) | [320px](../docs/images/epic-3/enhancements/delete-routine-320-light.png) | [320px](../docs/images/epic-3/enhancements/delete-routine-320-dark.png) |
| Routine actions | [1440px](../docs/images/epic-3/enhancements/empty-routines-1440-light.png) | [1440px](../docs/images/epic-3/enhancements/empty-routines-1440-dark.png) | [320px](../docs/images/epic-3/enhancements/empty-routines-320-light.png) | [320px](../docs/images/epic-3/enhancements/empty-routines-320-dark.png) |

Modal captures use the live local app; action captures show the isolated component empty state.

## Follow-up — landing/home loaders, sign-out and creator card

Based on reviewed main `dd82d4f` after PR #42: `/home` now uses the existing branded SectionLoader as its route fallback, and the public landing group has the same fallback. Existing cross-route logo progress remains in place. The public landing page remains static and has no artificial delay: loading indicators appear only while navigation/rendering is pending. No auth or data-fetching logic changes.

The sign-out form retains its existing action and local-session semantics. Its real `useFormStatus` pending state shows the large logo and visible “Signing you out...” text in a body portal, so closing the mobile menu cannot hide the progress indicator. The submitting control is disabled, and progress disappears when the action finishes/navigation lands. Reduced-motion users see a static logo.

The creator card now has a full-width “Behind TrainGrid” heading and divider, with the supplied portrait on the left and vertically centered name/role/details/links on the right. “Made with intention” and the split tinted photo panel were removed. Flexible wrapping stacks the photo above the details on phones and at enlarged text sizes without squeezing names into a narrow column. Founder role, original photo, verified links and theme are preserved.

Validation covers both themes; 320/768/1440px creator alignment; 200% text reflow; semantic heading order/axe; delayed `/` and `/home` navigation; and real sign-out pending state at 360/1440px including reduced motion. Existing header Escape/outside-click and auth/home/member-isolation tests are retained. Route fallbacks add no artificial loading timers or auth redesign. Component captures use the isolated preview; sign-out captures use the real local app.

Final checks pass: 50 component browser tests, 38 affected app browser tests, lint/typecheck, secret scan and optimized `next build --webpack`. The existing delayed-navigation test now installs its interception before page loading/prefetch and waits for header hydration, so the pending state is observed reliably.

| Screen | Desktop light | Desktop dark | Phone light | Phone dark |
| --- | --- | --- | --- | --- |
| Creator card | [1440px](../docs/images/epic-3/loaders-creator/creator-1440-light.png) | [1440px](../docs/images/epic-3/loaders-creator/creator-1440-dark.png) | [320px](../docs/images/epic-3/loaders-creator/creator-320-light.png) | [320px](../docs/images/epic-3/loaders-creator/creator-320-dark.png) |
| Signing out | [1440px](../docs/images/epic-3/loaders-creator/signout-1440-light.png) | [1440px](../docs/images/epic-3/loaders-creator/signout-1440-dark.png) | [360px](../docs/images/epic-3/loaders-creator/signout-360-light.png) | [360px](../docs/images/epic-3/loaders-creator/signout-360-dark.png) |

## Follow-up — invitation/access revoke confirmation

Based on reviewed main `75edd79` after PR #45: pending-invitation and accepted-member revoke controls open a native modal styled like routine deletion. Each modal names the recipient. Accepted access warns that access ends immediately while routines/sessions remain and can be restored by inviting the address again. Pending invitation copy remains distinct.

Cancel receives initial focus; Escape/Cancel close and restore focus without submitting. While the existing action runs, confirm shows “Revoking…” and both cancellation and repeated confirmation are disabled. A returned action result closes the modal; existing full-width row success/error feedback is retained. Actual failures remain errors and the action can be reopened. Compact row buttons remain compact; modal buttons use the same standard size as routine deletion. Existing admin guards, protected records, server action, hidden id, persistence and email behavior are unchanged.

Validation: 25 affected app regressions pass across invitation administration, mock email controls, forged-action authorization, both revoke variants, error recovery and routine deletion. The focused modal tests verify actual light/dark theme selection, 320/1440px fit and long-email wrapping, keyboard/background focus exclusion, cancellation, real pending/disabled/Escape behavior, and zero axe violations. Existing lockout/protected-admin checks pass. Forged-id test setup now waits for hydration before editing hidden inputs so React cannot restore the original id before submission.

| Modal | Desktop light | Desktop dark | Phone light | Phone dark |
| --- | --- | --- | --- | --- |
| Revoke access | [1440px](../docs/images/epic-3/revoke-modal/access-1440-light.png) | [1440px](../docs/images/epic-3/revoke-modal/access-1440-dark.png) | [320px](../docs/images/epic-3/revoke-modal/access-320-light.png) | [320px](../docs/images/epic-3/revoke-modal/access-320-dark.png) |
| Revoke invitation | [1440px](../docs/images/epic-3/revoke-modal/invitation-1440-light.png) | [1440px](../docs/images/epic-3/revoke-modal/invitation-1440-dark.png) | [320px](../docs/images/epic-3/revoke-modal/invitation-320-light.png) | [320px](../docs/images/epic-3/revoke-modal/invitation-320-dark.png) |

Captures are from the local application using disposable test recipients. No production data or backend modules changed.

Final static checks, secret scan and optimized `next build --webpack` pass for this follow-up. No new backend integration is required.


## 2026-11-18 — secondary actions and mobile Home

Based on reviewed main `d39b048` after PR #51. The P1/P2 follow-up makes these focused UI changes:

- **Download:** Export leaves primary navigation. A native Account disclosure holds “Download my data” on desktop; a nested Account disclosure uses the existing mobile menu. Escape closes the inner disclosure first, outside clicks close it, and navigation closes it. The same `/api/export` URL, attachment response, authorization and payload are retained.
- **Planner:** a secondary Week actions trigger replaces the always-visible duplication panel. Its native dialog is the confirmation step: source count, next-week default, available destinations, existing counts and append warning are visible before submitting the unchanged action. Empty-source confirmation stays disabled, Escape/Cancel restore focus, and real pending submission prevents repeat confirmation/dismissal. No week-copy or snapshot persistence changes.
- **Mobile Home:** tighter page/greeting spacing, a shorter release notice and smaller intro padding bring today forward. Getting-started follows today on narrow layouts and remains above the two-column desktop grid. Its progress, dismissal cookie and server reads stay intact. Dark accent badges use the existing dark ink role for contrast.
- **Public access:** the hero links to an invitation explanation. Invited visitors are told to use their invited address with Google/GitHub; uninvited visitors can ask their sharer to arrange an invitation or contact the creator through his verified portfolio. No request form, waitlist or public registration is introduced.

Regression checks cover the actual signed-in download and member-only data, independent copied snapshot ids, append behavior, empty weeks, keyboard/Escape/outside clicks, 320/360/768/1440px layout, both themes, mobile session visibility before onboarding and actionable public access copy. Account and week-dialog screenshots use local test members, never production records. Root ESLint/TypeScript/Git ignores exclude nested `.claude/worktrees` checkouts so generated files from other local repositories do not enter root checks. Loader timing tests explicitly exclude speculative prefetch and warm the shell before their timed local DB lock; product retry behavior is unchanged.

| Screen | Desktop light | Desktop dark | Phone light | Phone dark |
| --- | --- | --- | --- | --- |
| Account download | [1440px](../docs/images/epic-3/secondary-actions/account-1440-light.png) | [1440px](../docs/images/epic-3/secondary-actions/account-1440-dark.png) | [360px](../docs/images/epic-3/secondary-actions/account-360-light.png) | [360px](../docs/images/epic-3/secondary-actions/account-360-dark.png) |
| Planner, collapsed actions | [1440px](../docs/images/epic-3/secondary-actions/planner-1440-light.png) | [1440px](../docs/images/epic-3/secondary-actions/planner-1440-dark.png) | [360px](../docs/images/epic-3/secondary-actions/planner-360-light.png) | [360px](../docs/images/epic-3/secondary-actions/planner-360-dark.png) |
| Duplicate dialog | [1440px](../docs/images/epic-3/secondary-actions/duplicate-1440-light.png) | [1440px](../docs/images/epic-3/secondary-actions/duplicate-1440-dark.png) | [360px](../docs/images/epic-3/secondary-actions/duplicate-360-light.png) | [360px](../docs/images/epic-3/secondary-actions/duplicate-360-dark.png) |
| Home | [1440px](../docs/images/epic-3/secondary-actions/home-1440-light.png) | [1440px](../docs/images/epic-3/secondary-actions/home-1440-dark.png) | [360px](../docs/images/epic-3/secondary-actions/home-360-light.png) | [360px](../docs/images/epic-3/secondary-actions/home-360-dark.png) |
| Invitation guidance | [1440px](../docs/images/epic-3/secondary-actions/access-1440-light.png) | [1440px](../docs/images/epic-3/secondary-actions/access-1440-dark.png) | [360px](../docs/images/epic-3/secondary-actions/access-360-light.png) | [360px](../docs/images/epic-3/secondary-actions/access-360-dark.png) |

Final verification passes: **256 unit tests, 50 component checks and all 174 app browser tests**. The full browser run uses `E2E_SERVER=build npm run test:e2e` against the optimized local `next build --webpack` output. Lint, typecheck and secret scan pass. CSS checks accept equivalent optimized units (`1turn`/`360deg`, zero pixels/percent), and the mobile feedback check targets its own disclosure. App header layering keeps Account above calendar controls; the real planner download is covered.

No new backend integration is required. No merge, manual deployment or production-data operation is part of this work.
