# Epic 3 — TrainGrid product experience and frontend

Status: UI-01 ready for review; UI-02 must wait for review of UI-01.
Audit date: 2026-11-17. Reviewed-main base: `f3a0770` (PR #36).
Branch: `codex/epic-3-ui-01`. This document distinguishes implementation from future work.

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

Screenshots (actual static component captures): [desktop light](../docs/images/epic-3/landing-1440-light.png), [desktop dark](../docs/images/epic-3/landing-1440-dark.png), [mobile light](../docs/images/epic-3/landing-360-light.png), [mobile dark](../docs/images/epic-3/landing-360-dark.png). See harness limits above. OG artwork: [PNG](../public/marketing/og-preview.png) and editable SVG alongside it. Graphics use no stock assets, hotlinks, WebGL or added runtime dependencies; the OG PNG is approximately 60KB and is not loaded by the page.

Validation: lint, typecheck, 174 unit tests, 35 integration tests, 191 database tests, 14 component browser checks, secret scan and `next build --webpack` passed. All 119 app E2E tests passed in the final full run. Default Turbopack build failed in this environment while binding a PostCSS worker port; webpack production build succeeded with existing fonts and route configuration. No build configuration was changed to hide that limitation.

Regression-test corrections: wait for streamed library content before measuring bounds; click the noninteractive gutter for outside-click dismissal; accept the existing concrete-week redirect as well as the current-week alias. Added real-browser aria-current checks for Library/Planner. No application scheduling or menu behavior was changed by those corrections.

Deferred to Claude: coordinated public-root publication and shell selection; authenticated `/home` data and date preparation; post-login defaults; invitation delivery integration. Proposed dashboard and email contracts are explicitly labelled unimplemented in the handoff.

Remaining UI work: UI-02 login states/dashboard; UI-03 admin/email/planner/library/editor/session polish; UI-04 complete hydrated public-page, accessibility/contrast, zoom, motion and performance validation. New public component screenshots establish review evidence, not approved pixel-diff baselines. **Do not start UI-02 before UI-01 review. Do not merge automatically.**


### PR #37 review revisions

Creator label is now “Founder & Developer” (still configurable). The About card uses the supplied square portrait from `iamtj-me/public/static/images/tanuj-chakraborty-1x1.jpg`, copied unchanged to `public/marketing/tanuj-chakraborty.jpg`. Explicit dimensions reserve space; the below-fold local image is lazy-loaded without an image-service request. The footer reading/visual order is now author credit → TJ ring → Follow me/social links, horizontally on desktop and vertically on mobile. Verified destinations and ring hover/focus behavior are unchanged.

Revision validation: lint and typecheck passed; all 14 component UI checks and all 5 footer E2E tests passed, including portrait loading and desktop/mobile footer order. The four review screenshots were refreshed after waiting for the lazy-loaded image to decode.
