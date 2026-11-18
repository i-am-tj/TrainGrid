# Epic 3 — TrainGrid product experience and frontend

Status: UI-01–03 merged (PRs #37–39); UI-04 final frontend verification and handoff, based on reviewed main `4984124`.
Audit date: 2026-11-17. Reviewed-main base: `f3a0770` (PR #36).
Current branch: `codex/epic-3-ui-04`. Historical reports below retain their original bases. This document distinguishes implementation from future work.

## Scope and delivery sequence

Preserve the existing warm cream, charcoal and copper theme, functioning operations and approved library arrangement. Refine rather than replace. This product plans training; it does not log performance. No schema, API, OAuth, invitation authorization, persistence or email-service changes belong here.

| PR | Deliverables | Gate |
| --- | --- | --- |
| UI-01 | Audit, this specification, inventory, route contracts; additive primitives and navigation; reusable landing page and product compositions | Review and manual merge |
| UI-02 | Login states, typed member dashboard and fixture-only QA | Start from latest reviewed main after UI-01 review |
| UI-03 | Invitations and email preview/template; planner viewport; library, editor and session polish | Start from latest reviewed main |
| UI-04 | Motion, responsive/a11y/performance regression, final integration handoff | Start from latest reviewed main |

Never automatically merge. The repeated UI-01/UI-02/UI-03 entries in the brief are grouped into these four reviewable PRs. Backend-dependent screens are not complete merely because their presentation exists.

## Audit: source of truth

Installed versions: Next 16.4.6, React 19.2.8, Tailwind 4. Existing libraries are Supabase SSR/client, Zod and gray-matter. No icon, animation, dialog, toast or email framework is installed. Retain native elements and CSS; add no dependencies for decoration.

Read local Next guides under `node_modules/next/dist/docs/01-app/01-getting-started/`: `03-layouts-and-pages.md`, `05-server-and-client-components.md`, `14-metadata-and-og-images.md`. Pages are server components by default; client boundaries only for interactions; params/searchParams are promises; metadata exports stay server-side.

`agents/ARCHITECTURE.md` contains historical pre-Supabase architecture and an Epic 2 starting inventory. Its first section is **not** the current implementation. README, actual source, `docs/adr/001-multi-user-supabase-architecture.md`, and Epic 2 records take precedence for the current system. Preserve that history rather than rewriting it.

### Routes, layouts and authorization

| Route | Current rendering and contract | UI work |
| --- | --- | --- |
| `/` | `requireMember()`, then redirect to today's `/week/<ISO-week>?day=<1–7>` | Reusable landing ready; route publication deferred |
| `/login` | Dynamic server page; configuration/viewer/error branches; provider server-action forms | UI-02 presentation only |
| `/home` | Does not exist | UI-02 component presentation; Claude owns actual authenticated route/data integration |
| `/week/[weekId]` | `memberData()` before render; `current` alias; invalid week 404; streamed data after redirect/404 checks | UI-03 viewport layout |
| `/week/[weekId]/add` | Member-only; day/time/untimed/routine and legacy template inputs | Preserve all scheduling URLs and action fields |
| `/library` | `(list)/layout.tsx` retains heading/pill across navigation; filters remain outside results Suspense | Preserve query behavior and arrangement |
| `/library/new` | Own routine creation through structured editor | Presentation only |
| `/library/[routineId]` | Member-scoped; UUID or legacy slug; source labels; Schedule, Copy or Edit | Presentation only |
| `/library/[routineId]/edit` | Own PERSONAL routine only; other records 404 | Preserve access and action behavior |
| `/session/[id]` | Own snapshot; source provenance; missing/inaccessible records 404 | Presentation only |
| `/session/[id]/edit`, `/customize` | Own session; shared editor and server actions | Presentation only |
| `/admin/invitations` | `getAdminViewer()` then 404 for everyone else; missing secret-key availability branch | UI-03; retain both guard and actions |
| `/auth/callback` | Code exchange, verified-email/invitation acceptance, safe redirect | Claude only |
| `/api/export` | Member's own export | Preserve download; never treat as page navigation |
| `/api/health` | Public health response | No change |

The proxy refreshes cookies and blocks anonymous private requests. `lib/auth/routes.ts` exposes only `/login`, `/auth/callback`, `/api/health`. `/` is **not public**. Proxy session validation does not replace membership checks. Pages, actions and RLS remain authoritative.

`app/layout.tsx` is force-dynamic and shares AppHeader, main, SiteFooter, and NavigationLoader. It uses Geist, Geist Mono and Instrument Serif italic for TJ. The pre-paint script honors saved theme before system preference; ThemeToggle persists it. Preserve this implementation and theme-color values.

### Existing component inventory

| Area / files | Existing investment | Preserve / refine |
| --- | --- | --- |
| `AppHeader`, `BrandLogo` | Original grid mark, noninteractive Beta label, member/admin visibility | Retain logo and guards; add active member links |
| `MobileMenu` | Native details fallback; outside click, Escape with focus return, link/path close | Reuse; do not replace with a second interaction model |
| `ThemeToggle` | Saved/system theme, accessible label/pressed state, hydration placeholder | Keep behavior and colors |
| `footer/SiteFooter`, `SocialIcons` | X, GitHub, LinkedIn, Medium; central serif TJ ring; author/year | Preserve URLs, 300ms copper hover and three-column desktop concept |
| `NavigationLoader` | 150ms delay, 15s timeout, path-navigation overlay; skips exports and same-path searches | Preserve timing and event semantics |
| `LogoLoader`, `SectionLoader` | Brand spinner, live status, reduced-motion pulse, section space | Preserve approved behavior in UI-01; evaluate static reduced-motion state in UI-04 with tests |
| `library/LibraryHeader` | All / TrainGrid / Mine, single 225ms translating pill, immediate optimistic position, URL/back sync | Keep persistent layout, actual links, URL-driven current state |
| `library/RoutineList` | GET search, equipment control, category chips; outlined New routine in results toolbar; grouped rows | Keep placement, query keys and filtering; polish density/wrapping later |
| `RoutineDetail`, `SourceLabel`, `CopyRoutineButton` | Item/equipment summary; own/read-only distinction; schedule/copy pending and success | Retain ownership, copy and snapshot semantics |
| `RoutineEditor`, `WorkoutItemEditor` | Name/type/description, ordered structured fields, expanded details, equipment, YouTube validation | Preserve field names/parallel arrays, item identity, movement and delete confirmation |
| `planner/WeekNav`, `WeekGrid`, `SessionCard`, `DayAgenda` | 24h grid, seven days, untimed row, stacking, current week/day, mobile agenda | Retain all links and initial morning scroll |
| `planner/DuplicateWeekForm` | Destination counts, append warning, native confirmation, disabled empty source | Preserve action/payload and confirmation |
| `session/AddSessionForm`, `EditSessionForm`, `CustomizeForm`, `WorkoutItemsView` | Routine/blank input, optional time/duration, snapshot details, edit/delete/customize | Only visual refinement |
| `admin/InvitationForms` | useActionState, pending submit, reset on success, alert/status feedback, native revoke confirmation | Keep actions and actual result wording |
| `app/error.tsx`, `not-found.tsx` | Recovery and missing-page UI | Apply shared states later; do not turn failures into success |

### Invitations and email: actual state

The admin page streams the list after checking admin availability. Membership status comes from `invitationStatus`; revocation availability from `revokeKind` plus protected ids. Accepted/revoked history and admin protection are already modeled. The existing form creates the invitation record and explicitly says **no email is sent**. No delivery state exists. Do not repurpose Pending/Accepted/Revoked to mean delivery progress.

### Planner layout finding

WeekGrid already scrolls internally with `max-h-[calc(100vh-9rem)]`; it uses 56px minimum hour rows and a 52px untimed row. It scrolls to `UNTIMED + 6 * ROW` on week changes. Stacked sessions can increase row height. The root uses percentage minimum height, and navigation + duplicate form + footer are outside the grid's viewport calculation, so the footer can fall below a normal desktop viewport.

UI-03: use a 100dvh desktop flex shell and min-height:0 down through main/planner/content/grid wrappers, with the grid taking remaining space. Keep navigation, duplicate form and weekday headings usable. Do not set a universal body overflow:hidden. On short/zoomed layouts let document scrolling return via a content-safe minimum block size; validate with actual forms and wrapped headings. Keep 720px calendar minimum width and local overflow, 24 hours, multiple sessions/hour, untimed placement and current morning scroll. Mobile stays DayAgenda (currently below md).

## Design specification

### Identity and hierarchy

Premium, restrained, athletic through typography, alignment and a grid rhythm. Existing colors are fixed; no palette replacement. Use copper for a small emphasis, charcoal primary CTA, hairline surfaces, and category color only for meaning. One strong action per section; supporting actions outlined or textual. No neon, decorative gradients, oversized shadows, WebGL or glass panels. Public copy advertises only the six implemented planning capabilities.

### Tokens and sizing

| Token / convention | Light | Dark |
| --- | --- | --- |
| Background | `#f4f1ea` | `#12100e` |
| Foreground | `#1c1917` | `#f4efe8` |
| Card / surface | `#fffcf7` | `#1b1815` |
| Elevated | `#ffffff` | `#221e1a` |
| Muted body | `#57534e` | `#b6ada4` |
| Accent | `#9a4e24` | `#e0a37a` |
| Line | `#e7e0d4` | warm white at 12% |
| Hairline | warm black at 14% | warm white at 14% |
| Panel shadow | 2px/8px at 3.5% | 2px/8px at 12% black |

Keep existing inverted Tailwind stone/white and semantic tint mapping in dark mode. Existing aliases (`background`, `foreground`, `card`, `line`, `accent`, `hairline`) remain; additive `elevated` and `muted` aliases are available.

- Fonts: Geist for UI/body, Geist Mono for small dates/indices, Instrument Serif italic for TJ only.
- Hero 45–88px / 1.02; section 32–52px / 1.12; page 30–36px; card 16px; body 14–16px with 1.6–1.9 leading; metadata 12px. Tiny text only in explicitly illustrative product compositions.
- Spacing: Tailwind 4px base, chiefly 8/12/16/24/32/48/64px. Section spacing fluid 64–112px. No arbitrary universal fixed screen heights.
- Widths: app shell 80rem; public content 76rem; forms preserve current narrow content widths. Public gutters 16px at smallest widths.
- Controls: 8px radius, 40px minimum height, visible 2px focus with 2px offset. Small adjacent controls need adequate spacing; aim for 40px touch targets as polish proceeds.
- Cards: 16px panels; compact items may retain 6–8px corners. Hairline border; elevation only for hierarchy.
- Breakpoints: existing Tailwind sm=640, md=768, lg=1024, xl=1280. Preserve planner switch at md and header switch at sm.
- Motion: 160ms control, 240ms normal transition, up to 350ms entrance; easing `(0.2,0.65,0.3,1)`. Preserve approved library 225ms and footer 300ms timings. Reduced motion removes new entrance/hover transitions. Content must remain visible without animation or JavaScript.

### Reusable presentation API

Existing `lib/ui.ts` class exports remain the compatibility layer. Primary, secondary/outline, danger, ghost, icon button and text link variants must render native buttons/anchors with existing names and form bindings. Never wrap every action in a client component. Disabled buttons must be visibly disabled and noninteractive.

`components/ui/Presentation.tsx` adds PageHeading (eyebrow/title/children), EmptyState (title/children/action), InlineMessage (info/success/warning/error and children). A status message uses role=status; errors use role=alert. `NavLink` supplies path-aware aria-current for member navigation. Keep native confirmation dialogs until a replacement can preserve cancellation, accessible focus and destructive-action regression coverage. No toast infrastructure exists; use inline feedback. Do not add tooltip infrastructure for self-explanatory controls.

### Public landing presentation

`LandingPage({ creatorRole? })` has no member data, auth calls or data-fetching imports. Default role is “Founder & Developer”. Compose inside one main with PublicHeader and the existing SiteFooter. Root integration is deferred to Claude.

Sections: original brand and Beta; “Plan the week. Own the work.”; Log in `/login`; Explore features `#features`; weekly planner hero; six capability cards; mobile agenda, routine cards and workout detail; Browse → Plan → Open; Tanuj card using the supplied portrait; invite-only final CTA. Existing verified footer links/credit remain. External creator links use supplied portfolio/GitHub URLs; portrait supplied by Tanuj; no accomplishments or company history invented.

All product examples are visibly labelled as examples and are static, generic authored content. They represent real existing models: category, time, duration, equipment and structured workout instructions. They never read member records. Illustrative labels are not interactive mock controls. Hero/calendar, agenda, library and detail graphics are finished responsive HTML/CSS compositions in `ProductPreview.tsx`; feature drawings live in `public/marketing/features.svg`. The footer retains its CSS/serif TJ treatment; the About card uses the approved local portrait. The product benefits more from readable UI than an isometric/3D effect; no rendering dependencies needed.

`landingMetadata` is an unattached server-side metadata object, intended for the public root only. Social artwork is `/marketing/og-preview.png` (1200×630), static and free of member data. Claude must supply the verified deployment origin as metadataBase on publication; do not invent a canonical hostname.

### UI-02: login and dashboard (not implemented in UI-01)

Login: preserve provider IDs `google`/`github`, hidden next, `safeNextPath`, signInWithProvider, fixed error mapping and configuration/viewer branches. Provide provider icons, pending state and clear invitation copy. Cover anonymous, member, nonmember, signin/email/invite errors and unavailable auth. No password, public signup or extra providers.

Dashboard: training planning only. Welcome/date, today's sessions as primary feature, Monday–Sunday planned counts, personal routines and quick actions. Use prepared typed props; do not add database aggregation. Empty data must be honest; fixtures belong only to development/test composition, never production rendering. Proposed exact contract and Claude ownership are in EPIC-3-UI-HANDOFF.md; finalize actual exports in UI-02. Cover empty today/week/routines, multiple sessions, optional duration/time, loading/error, long names and narrow widths.

### UI-03: admin, email and existing screens (not implemented in UI-01)

Invitations: retain guard/404, missing-configuration state, form action/reset/pending, actual validation/success/error, pending/accepted/revoked labels and protected records. Improve hierarchy, email wrapping, date metadata and responsive rows/cards. Keep no-email-sent copy until actual integration.

Email: pure reusable renderer returning subject, preheader, responsive email-compatible HTML and text. Inputs recipient email/login URL; escape markup, validate URL, support clear invited-email instructions, Beta branding, primary Open TrainGrid and plain footer. Preview behind existing admin authorization. Sending/resending stays disabled or isolated as labelled design examples. Copy link/text may operate locally. Display membership and delivery separately. No persistence/provider/credentials.

Library: keep scope pill, URL search, equipment and category arrangement, toolbar position, source/copy/schedule actions. Polish row wrapping, detail spacing and empty panels.

Editors/sessions: retain all field names, structured values, ids, expanded details, equipment semantics, YouTube validation, order controls, pending/cancel/save/delete actions. No changes to snapshots, scheduling or duplicate-week behavior. Use same hierarchy, surfaces, focus and feedback.

### UI-04 acceptance and regression matrix

Test 320/360 phones, 768 portrait/1024 landscape tablet, 1024 laptop, 1440 desktop, short desktop (including 480px tall), light/dark, reduced motion, keyboard and browser zoom. Check document overflow (internal calendar overflow allowed), headings/landmarks, focus, contrast, touch targets, long names, wrapped errors, slow navigation, static asset dimensions and noncritical lazy loading. Product compositions use explicit sizing and no network artwork.

Run existing lint/typecheck/unit/db/integration/E2E/build suite, secret scan and new component checks. Do not label skipped database-dependent tests as passing. Add real visual baselines where useful after review; current component tests capture screenshots and assert layout/semantics, not pixel-diff approval. The standalone static harness cannot verify React-hydrated mobile/menu/theme behavior; the existing app E2E suite owns those behaviors. No production database operations are authorized.

## UI-01 implementation status

Implemented: additive tokens/class variants, three presentation primitives, active member navigation, reusable public shell and landing, six SVG icons, four product compositions, approved creator portrait, unattached public metadata, static QA harness and responsive test matrix. Existing footer design/theme/menu/library interactions are retained.

Not integrated: public `/` publication and public-shell selection. Existing root redirect remains intact. `/home`, login redesign, invitation/email, calendar and editor refinements await their scheduled PRs. Full workstream is not complete.

Verification and screenshots are recorded in the PR report. UI-02 remains gated on review.

### QA harness limits

The screenshot harness renders real components and compiled Tailwind CSS without hydration or next/font setup. Screenshots use system font fallbacks; final Geist/Instrument Serif typography and theme/menu hydration must be checked in the published Next composition. New component checks are independent of Supabase. Database, integration and app E2E suites mutate the same local stack and must run **sequentially** to avoid temporary test routines affecting seed/card-count assertions.

## UI-01 review report

Built: audit/specification, route/component inventory, Claude handoff, additive theme-compatible tokens and controls, PageHeading/EmptyState/InlineMessage, member active links, larger footer social touch targets, reusable public header/landing and original product graphics. Screens covered: public landing composition and existing member navigation/footer. No root publication, login/dashboard redesign or other PR's screens are claimed complete.

Screenshots (actual static component captures): [desktop light](../../docs/images/epic-3/landing-1440-light.png), [desktop dark](../../docs/images/epic-3/landing-1440-dark.png), [mobile light](../../docs/images/epic-3/landing-360-light.png), [mobile dark](../../docs/images/epic-3/landing-360-dark.png). See harness limits above. OG artwork: [PNG](../../public/marketing/og-preview.png) and editable SVG alongside it. Graphics use no stock assets, hotlinks, WebGL or added runtime dependencies; the OG PNG is approximately 60KB and is not loaded by the page.

Validation: lint, typecheck, 174 unit tests, 35 integration tests, 191 database tests, 14 component browser checks, secret scan and `next build --webpack` passed. All 119 app E2E tests passed in the final full run. Default Turbopack build failed in this environment while binding a PostCSS worker port; webpack production build succeeded with existing fonts and route configuration. No build configuration was changed to hide that limitation.

Regression-test corrections: wait for streamed library content before measuring bounds; click the noninteractive gutter for outside-click dismissal; accept the existing concrete-week redirect as well as the current-week alias. Added real-browser aria-current checks for Library/Planner. No application scheduling or menu behavior was changed by those corrections.

Deferred to Claude: coordinated public-root publication and shell selection; authenticated `/home` data and date preparation; post-login defaults; invitation delivery integration. Proposed dashboard and email contracts are explicitly labelled unimplemented in the handoff.

Remaining UI work: UI-02 login states/dashboard; UI-03 admin/email/planner/library/editor/session polish; UI-04 complete hydrated public-page, accessibility/contrast, zoom, motion and performance validation. New public component screenshots establish review evidence, not approved pixel-diff baselines. **Do not start UI-02 before UI-01 review. Do not merge automatically.**


### PR #37 review revisions

Creator label is now “Founder & Developer” (still configurable). The About card uses the supplied square portrait from `iamtj-me/public/static/images/tanuj-chakraborty-1x1.jpg`, copied unchanged to `public/marketing/tanuj-chakraborty.jpg`. Explicit dimensions reserve space; the below-fold local image is lazy-loaded without an image-service request. The footer reading/visual order is now author credit → TJ ring → Follow me/social links, horizontally on desktop and vertically on mobile. Verified destinations and ring hover/focus behavior are unchanged.

Revision validation: lint and typecheck passed; all 14 component UI checks and all 5 footer E2E tests passed, including portrait loading and desktop/mobile footer order. The four review screenshots were refreshed after waiting for the lazy-loaded image to decode.


## UI-02 — login and member dashboard presentation

Base: `47e2eb7` (merged PR #37). Branch: `codex/epic-3-ui-02`. Scope: production login presentation and typed reusable dashboard, with fixtures isolated to screenshot/development QA. No `/home` route, root publication, new data reads, auth/callback/default-next changes, endpoints, schema or delivery work.

### Login implementation

`LoginView` separates the visual shell from the existing server-page decisions. The page retains configuration checking, getViewer, fixed loginErrorMessage mapping, safeNextPath and the provider forms' action and hidden values. It renders the same branch precedence and existing messages/links. A small client ProviderSubmit reads useFormStatus and renders the pure ProviderButton, preserving accessible provider names while pending text says “Connecting to Google/GitHub…”. Pending disables the submitted button, with aria-busy and a reduced-motion-safe spinner. Provider icons are local SVG, including reuse of the existing GitHub mark. Both buttons use the outlined control variant; no competing dark primary buttons.

The shell uses existing brand/Beta, a welcome heading and invited-email instructions. On desktop a restrained seven-day brand illustration and three-step rhythm occupy a secondary panel; mobile prioritizes sign-in. Existing header/theme/footer remain shared. States: signed out; signed-in member; nonmember; generic sign-in error; verified-email error; invitation error; auth unavailable; submitting. Error text remains an alert and cannot be confused with success. Signed-in nonmembers' email remains hidden.

### Dashboard implementation

`MemberDashboard({ state })` and `types.ts` implement the handoff contract. It renders prepared display values only. No production page imports fixtures. No dashboard route is published until Claude integrates authorized real data.

- Welcome/date: prepared date label, optional displayName with neutral fallback, contextual copy and one primary weekly-planner link.
- Today's sessions: primary content area, category, optional time/duration, prepared workout summary, Open session and Add session. Untimed is explicit; absence of duration never produces a fake number.
- Week: Monday–Sunday seven-day tuple, calendar labels, prepared planned-session counts, selected outline/aria-current and today emphasis. Empty days use a dash with an explicit zero in the accessible label. Day links open planner dates; no misleading local selection or completion statistics.
- My routines: prepared personal cards, category/summary, View and Schedule, Browse My Library, Create routine. Long spaced and unbroken names wrap; short/empty lists remain usable.
- Quick actions: four real link slots for Add session, planner, TrainGrid library and Create routine, using the original SVG icon vocabulary.
- States: several sessions; empty today with other planned days; fully empty week; no personal routines; loading skeleton; recoverable error; very long session/routine/member names. Loading/error do not show empty-data claims. Actions are supplied local hrefs rather than placeholder callbacks.

The desktop layout places today beside week/shortcuts, then routines. Mobile flows as today → week → shortcuts → routines. Content widths use existing tokens and a fluid 76rem container. All action focus rings and semantic category tints remain consistent with the approved theme. New transitions are short and removed for reduced motion; loading skeletons are static.

### Preview and review evidence

The existing static QA harness now emits labelled dashboard/login fixtures into ignored `.next/ui-preview/`. It is not an auth-bypass route or a production user experience. The source of example data is only `tests/ui/fixtures/`; production components receive required typed props, never default demo content. The seven-day tuple enforces structure at compile time; Claude remains responsible for real data validation, timezone, ownership, ordering and planned-count preparation.

Screenshots are under `docs/images/epic-3/ui-02/`, including 360px and 1440px light/dark login, populated dashboard and empty dashboard. They render the real components with fallback fonts; actual app E2E verifies hydrated login behavior. Fixture screenshots use a labelled public shell solely for isolated presentation QA, not a claim that authenticated navigation has been wired to `/home`.

Validation complete: lint/typecheck; 174 unit tests; 191 local DB tests; 35 integration tests; 31 component browser tests (including every login/dashboard state in both themes across the viewport matrix); 123 app E2E tests; secret scan; production build using `next build --webpack`. DB-writing suites ran sequentially. No runtime dependencies or build settings changed. The final complete app E2E run passed all 123 tests without retries.

The existing admin test now scopes invitation success to its form-message paragraph, excluding streamed loader status. The blank-search test scopes its count to the visible result because React can briefly retain the old hidden result tree. The new login error check scopes alerts to main, excluding Next's route announcer. These corrections change test selectors only, not application behavior.

Deferred to Claude: authenticate and serve `/home`; prepare real per-member dashboard data/date/links; coordinate root publication and member navigation; configure post-login destination while preserving explicit safe next. Email remains UI-03 and unimplemented. UI-03/UI-04 retain their original scope.


### UI-02 review report

Screens covered: live `/login` and every existing auth presentation state; reusable member dashboard with welcome/date, today's sessions, weekly planned counts, personal routines and quick actions; empty-day/week/routine, long-name, loading and recoverable-error variants. Actual production login forms remain connected. Dashboard is presentation only and must not be reported as a connected member feature.

Review screenshots:

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Live login, light | [1440px](../../docs/images/epic-3/ui-02/login-live-1440-light.png) | [360px](../../docs/images/epic-3/ui-02/login-live-360-light.png) |
| Live login, dark | [1440px](../../docs/images/epic-3/ui-02/login-live-1440-dark.png) | [360px](../../docs/images/epic-3/ui-02/login-live-360-dark.png) |
| Dashboard example, light | [1440px](../../docs/images/epic-3/ui-02/dashboard-ready-1440-light.png) | [360px](../../docs/images/epic-3/ui-02/dashboard-ready-360-light.png) |
| Dashboard example, dark | [1440px](../../docs/images/epic-3/ui-02/dashboard-ready-1440-dark.png) | [360px](../../docs/images/epic-3/ui-02/dashboard-ready-360-dark.png) |
| Empty dashboard example, light | [1440px](../../docs/images/epic-3/ui-02/dashboard-empty-week-1440-light.png) | [360px](../../docs/images/epic-3/ui-02/dashboard-empty-week-360-light.png) |

`login-live-*` captures the hydrated Next app with real fonts and the development indicator excluded from the image. Other captures are labelled fixture compositions with fallback fonts. Both themes of empty/dashboard/login static examples are included in the same asset directory.

Claude dependencies: serve authenticated `/home`, prepare authorized real data (including dates/timezone, sorted sessions, seven days/counts and personal routines), supply safe working hrefs/retry behavior, coordinate root publication and post-login destination. See the updated exact contracts in EPIC-3-UI-HANDOFF.md. No API, schema, member policy, invitation semantics, scheduled persistence or production-data changes occurred.

Remaining UI work: UI-03 invitations/email preview and planner/library/editor/session polish; UI-04 final responsive/zoom/contrast, motion/performance and integration regression. Review and manual merge only; UI-03 is not started.

UI-02 review refinement: active member navigation uses the existing background highlight without the copper underline. Accessible aria-current and keyboard focus remain unchanged.


## UI-03 — invitations, email preview and existing application refinement

Base `fba6fc1` (merged PR #38), branch `codex/epic-3-ui-03`. The current warm theme and the background-only active navigation approved in review remain unchanged. No API, schema, authorization, callback, dashboard aggregation, email service, secrets or scheduled-session persistence changes belong to this PR.

### Invitations and email

The existing admin check/404 and missing-configuration branch still run before data or preview rendering. Heading, form, feedback and list now use shared hierarchy/surfaces. Recipient email wraps, creation dates stay UTC, and Pending/Accepted/Revoked and protected admin records still come from the same model helpers. Existing invitation creation/reset, validation feedback, pending button and native revoke confirmation are preserved. Membership and delivery are not conflated.

The email renderer in `lib/email/invitation.ts` returns subject, preheader, responsive table/inline-style HTML and plain text. Dynamic values are escaped, recipient syntax validated and non-absolute/unsafe/credential-bearing URLs rejected. Branding reuses the existing first-party PNG with an absolute URL. It introduces no email dependency or requests. The template identifies the invited address, explains verified Google/GitHub email matching, uses the Open TrainGrid CTA and states invite-only Beta.

The admin-only expandable preview mounts content only when opened. It has a distinct Preview recipient field, a sandboxed iframe, subject/preheader, plain-text alternative and truthful clipboard feedback/fallback. Editing it neither creates invitations nor sends email. A nested future-workflow preview demonstrates not-requested/preparing/provider-accepted/failure states with disabled send/resend controls; each is labelled Design preview. The existing action still returns “Invitation created.” and the page still says “No email is sent.”

### Planner viewport

The root body uses a minimum 100dvh; on desktop planner routes it has 100dvh height and a flex layout through main, page, streamed content, desktop wrapper and scrolling grid. Controls and footer are measured by normal layout, not subtracted as guessed pixel offsets. A definite zero-pixel flex basis prevents the intrinsic full-day content height from expanding the scroller. The grid has an 18rem readable minimum, so short windows and enlarged text cause document scrolling with the footer after content. No global overflow lock or overlay footer is used.

Preserved: all 24 hour rows and seven untimed cells; multiple sessions per hour; compareSessions ordering; original initial scroll `UNTIMED + 6 * ROW`; exact scheduling/navigation URLs and server actions. The calendar region is now named/focusable for keyboard scrolling and add links reveal on keyboard focus. Long session names wrap without overlapping other cards. Tablet keeps the 720px internal minimum width; phones retain DayAgenda and a readable vertically arranged day strip.

### Library, editor, session and feedback polish

The library's All/TrainGrid/Mine layout, single sliding pill, Search/equipment/category arrangement, query parameters, button hierarchy and New routine toolbar position remain intact. Changes are typography, readable row padding/wrapping, rounded panels and restrained hover. Routine detail and workout item panels use matching hierarchy and spacing.

Routine and session forms use shared panels and a small ActionSubmit component for real pending text/disabled state. All original form actions, hidden ids, parallel item fields, item ordering, equipment pressed states, optional fields, YouTube parsing, validation and native save/delete/cancel behavior are preserved. Duplicate Week is outlined beside the primary Add session navigation action; its destination counts/append warning/confirmation/payload are unchanged. Error and missing-page cards use consistent focus/spacing, and actual errors remain alerts rather than success states.

### Verification and review evidence

Meaningful new checks cover the pure email's content/security/HTML-text agreement; empty/pending/accepted/revoked/protected invitation presentation; copy success and invalid preview drafts; disabled hypothetical delivery actions; 24-hour link count; initial/internal scroll; footer bounds at ordinary and very short heights; same-hour card non-overlap; untimed placement; keyboard scrolling; a 720×450 CSS viewport equivalent to 2× browser zoom on a 1440×900 display; enlarged text; and structured routine/session fields with cancellation of destructive confirmations.

The isolated component harness adds invitation/empty/email fixtures under `tests/ui/fixtures/`, never production routes. Live app screenshots cover invitations/email preview, populated planner, library, routine detail/editor, session add/detail/edit/customize at 360 and 1440 widths, with both themes represented. Email markup has standalone narrow/desktop captures. All examples/records used for QA are local test data. Inbox-specific rendering is a future verification step; no actual message sending was tested or implemented.

Final validation passed: lint/typecheck; 184 unit tests (including 10 email content/security cases); 191 local database tests; 35 integration tests; 41 component browser tests; all 126 app E2E tests in the final full run without retries; secret scan; production build using `next build --webpack`. DB-writing suites ran sequentially. The admin regression now expects the explicit “Admin · Protected” label while retaining its no-revoke-control and immediate member-lockout assertions. UI-04 remains responsible for final cross-workstream responsive, accessibility/contrast, motion/performance and integration regression. Dashboard data/public-root/OAuth destination work remains with Claude; actual email delivery/retry persistence remains with Claude.


### UI-03 review report

Built: administrator invitations layout and feedback; protected/status/empty list presentation; reusable responsive HTML/plain-text invitation template; lazy guarded email preview, copy controls and disabled future-delivery examples; viewport-contained planner with footer; library/detail/editor/session/form/feedback refinement and real pending controls. Existing authorization/actions/field payloads/snapshot/week-copy logic are unchanged. No backend modules, APIs, schema, policies, email provider, secrets or production records were modified.

Review screenshots (live local test app, except standalone email):

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Invitations and preview | [1440px](../../docs/images/epic-3/ui-03/invitations-1440-light.png) | [360px](../../docs/images/epic-3/ui-03/invitations-360-light.png) |
| Populated planner | [1440px](../../docs/images/epic-3/ui-03/planner-1440-light.png) | [360px](../../docs/images/epic-3/ui-03/planner-360-light.png) |
| Library | [1440px](../../docs/images/epic-3/ui-03/library-1440-light.png) | [360px](../../docs/images/epic-3/ui-03/library-360-light.png) |
| Routine editor, dark | [1440px](../../docs/images/epic-3/ui-03/routine-editor-1440-dark.png) | [360px](../../docs/images/epic-3/ui-03/routine-editor-360-dark.png) |
| Planned session | [1440px](../../docs/images/epic-3/ui-03/session-1440-light.png) | [360px](../../docs/images/epic-3/ui-03/session-360-light.png) |
| Email markup | [1440px](../../docs/images/epic-3/ui-03/email-1440.png) | [360px](../../docs/images/epic-3/ui-03/email-360.png) |

Additional routine, add/edit/customize-session and dark-state captures are included in the same directory (28 total). Development indicators are excluded from app images. QA records are disposable local examples. All invitations/email component fixtures are kept under tests and ignored preview output, never exposed as application routes.

Deferred to Claude: actual sending/provider acceptance/failure/retry persistence; canonical origin and active-invitation validation for sending; selected-provider inbox-client verification; previously documented dashboard/root/post-login integration. No backend-dependent delivery feature is marked complete. Remaining frontend work is UI-04 final cross-workstream accessibility/contrast, responsive/zoom, motion/performance and integration regression. Manual review/merge only; UI-04 is not started.

## UI-04 — final polish and frontend handoff

Based on reviewed main `4984124` (merged UI-03 PR #39). Added skip-to-main access, static reduced-motion loaders, corrected heading structure, stronger existing text/control contrast roles, and enlarged-text reflow across navigation/footer/provider controls/library scopes. The approved theme, founder photo/role, footer order, background-only active tab and library sliding selection remain intact.

The component suite now covers 48 cases, with test-only axe checks across 19 presentation variants in both themes and narrow/desktop widths. Eight additional checks audit optimized live screens, keyboard/preview behavior, form-boundary contrast, network payload and layout stability. Public assets have explicit budgets; no production test engine or new runtime package is introduced.

The full validation matrix, measurements, desktop/mobile screenshot links, commands and honest audit limits are in [EPIC-3-UI-VERIFICATION.md](EPIC-3-UI-VERIFICATION.md). Final integration ownership is recorded in [EPIC-3-UI-HANDOFF.md](EPIC-3-UI-HANDOFF.md). Existing app operations remain connected; dashboard/home/root/OAuth destination and email sending/delivery work remains with Claude. Those backend-dependent features are not declared complete. Remaining frontend work is reviewer feedback and verification after Claude's integrations; no PR is merged automatically.
