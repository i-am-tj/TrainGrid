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
