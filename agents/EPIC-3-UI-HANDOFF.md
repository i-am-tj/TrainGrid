# Epic 3 UI → Claude integration handoff

Updated 2026-11-17. UI-01 is merged in PR #37 and UI-02 in PR #38. UI-03 implements invitations/email presentation and existing-screen refinements. **Dashboard and email-template exports below now exist; live delivery remains unimplemented.** Dashboard routing/data, root publication, OAuth changes and email delivery are not integrated.

## 1. Dashboard props and real-data requirements

Implemented: `components/dashboard/MemberDashboard.tsx` exports `MemberDashboard({ state: DashboardState })`, `WeeklyOverview({ week: DashboardWeek })`, `DashboardLoading()` and re-exports its types from `components/dashboard/types.ts`. No `/home` route or dashboard query is added. Exact display contract (arrays are readonly in the source):

```ts
type DashboardSession = {
  id: string; name: string;
  category: "running" | "strength" | "plyometrics" | "other";
  timeLabel: string | null; durationLabel: string | null;
  detail: string; href: string;
};
type DashboardDay = {
  date: string; weekdayLabel: string; dayLabel: string;
  plannedCount: number; isToday: boolean; isSelected: boolean; href: string;
};
type DashboardRoutine = {
  id: string; name: string; categoryLabel: string; detail: string;
  viewHref: string; scheduleHref: string;
};
type DashboardWeek = readonly [DashboardDay, DashboardDay, DashboardDay, DashboardDay, DashboardDay, DashboardDay, DashboardDay];
type DashboardData = {
  displayName: string | null; dateLabel: string;
  todaySessions: readonly DashboardSession[];
  week: DashboardWeek; // exactly seven, Monday–Sunday
  routines: readonly DashboardRoutine[]; // member's own PERSONAL routines only
  plannerHref: string; addSessionHref: string;
  myLibraryHref: string; sharedLibraryHref: string; createRoutineHref: string;
};
type DashboardState =
  | { status: "ready"; data: DashboardData }
  | { status: "loading" }
  | { status: "error"; message: string; retryHref: string };
```

Claude prepares member-scoped records and counts through the existing authorized data layer. Decide user-local date/timezone policy explicitly; avoid server/browser midnight mismatches. Sort sessions using existing semantics, retain untimed sessions and nullable durations, use snapshot workout details, and calculate **planned counts**, never completion/performance. No fake fallback when queries fail. Pass empty arrays only after a successful empty result. Fixture modules must not be imported by production pages.

## 2. Final `/` and `/home` responsibilities

Implemented UI-01 exports:

- `components/marketing/LandingPage.tsx`: `LandingPage({ creatorRole?: string })`; default “Founder & Developer”, approved local portrait.
- `components/marketing/PublicHeader.tsx`: public navigation, brand/Beta and existing theme/mobile components. No viewer or admin data.
- `components/marketing/metadata.ts`: `landingMetadata`, ready for public page only.
- Existing `components/footer/SiteFooter.tsx` remains shared; do not duplicate it inside main.

Current root requires membership and redirects to today's week. The proxy does not allow public `/`; changing only app/page.tsx will not publish it. Publication affects default OAuth landing behavior, so integration is deferred rather than making a partial route change.

Claude must coordinate these changes together:

1. Explicitly add only `/` to `isPublicPath`; keep all planner/library/session/admin/export routes guarded.
2. Replace root redirect with LandingPage and apply landingMetadata. Configure metadataBase from the verified deployment origin; set canonical only when known.
3. Select PublicHeader for the root in the shared layout/header composition; retain AppHeader and guards for member routes. Ensure no duplicate header/footer/main landmarks. Root should not query private planner data or embed it in metadata.
4. Implement `/home` as an authenticated page using requireMember/memberData and real prepared data passed into `MemberDashboard`. Do not render demo records to a member.
5. Replace member Planner links currently pointing at `/` with `/week/current`; update the signed-in login-page Planner link and brand destination deliberately. Public branding should link to `/`. Decide member Home navigation in UI-02 integration.
6. Retain private route no-store/session handling and data-layer/RLS checks. Do not relax middleware matching globally.

UI-01 static preview is a build/test artifact in `.next/ui-preview`, **not a public application route or auth bypass**. Run `npm run test:ui` to regenerate component screenshots. PublicHeader interactive behavior requires hydration when wired into Next; static harness checks only rendered/native behavior.

## 3. Post-login redirect integration

Unchanged: `safeNextPath` fallback `/`, callback construction, callback processing and OAuth server actions. Claude owns new default `/home` (if product-approved), preserving explicitly requested safe next paths including query parameters. Preserve external-origin rejection and auth-loop protection. Review signout destination separately rather than inferring a new behavior. Do not leave the login page's “Go to the planner” link pointing at a newly public marketing page.

## 4. Invitation email template inputs

Implemented in `lib/email/invitation.ts`: `renderInvitationEmail(input): InvitationEmail`. This pure function never sends or stores anything:

```ts
type InvitationEmailInput = { recipientEmail: string; loginUrl: string };
type InvitationEmail = {
  subject: string; preheader: string; html: string; text: string;
};
```

Use the administrator's existing trusted-origin construction for loginUrl. Template must escape recipient values, reject unsafe URL schemes, use email-compatible table/inline CSS, and include both text and HTML. The template derives its absolute first-party PNG logo URL from loginUrl.origin (`/brand/traingrid-logo-google-120.png`). No SVG, script, remote font or external stylesheet is needed. Do not include member records or email addresses in public preview assets. No tokenized invitation semantics are implied: existing access is matched to verified email.

## 5. Email sending integration contract

Keep existing inviteAction creating/restoring membership invitation records. A successful record mutation means “Invitation created”, not “Email sent”. Actual delivery orchestration, provider choice, credentials, retries and persistence belong to Claude. UI-03 should consume prepared status and authorized callbacks/actions, with no provider SDK.

Create/resend must authenticate admin on server and respect current protected records. Return field/action feedback without exposing provider diagnostics or secrets. Separate invitation creation success from email failure so admins can copy a link after a failed send without repeating the membership mutation.

## 6. Delivery state expectations

Exported preview-only union `EmailDeliveryPreviewState` in `components/admin/EmailWorkflowPreview.tsx`: `not_requested | preparing | accepted | failed`. Before integration, render only truthful not-requested copy and clearly labelled disabled preview controls. Membership remains Pending/Accepted/Revoked from existing model.

- preparing: show busy state and prevent duplicate submit.
- accepted: provider accepted request; say exactly that. Do not claim recipient delivery.
- failed: show recoverable message and authorized resend/copy paths.
- delivered: expose only if later supported by verified delivery events; not part of current UI promise.

The admin preview must not manufacture status transitions or call a fake send. Resend must not silently change membership status. Claude owns persisted state, race prevention, delivery events and retry rules.

## 7. Remaining presentation and dependency ownership

| Capability | UI status at UI-01 | Claude responsibility |
| --- | --- | --- |
| Landing and public shell | Implemented, reusable, not routed | Coordinate root publication/metadata/shell/navigation |
| Dashboard | All requested presentational states implemented; fixture QA only; no `/home` route/data loader | Member route, data preparation, timezone, default login destination |
| Login | Redesigned production `/login`, all existing branches and real form pending UI | Preserve/integrate auth behavior; no provider redesign requested |
| Invitations | Redesigned guarded page, existing actions and protected records preserved | Keep admin policy and membership semantics |
| Invitation email | HTML/text renderer, guarded lazy preview, local copy controls; future delivery controls disabled | Sending, retries, persisted delivery state and secrets |
| Planner/library/editor/session | Viewport containment, shared panels, structured controls, pending/feedback refinements implemented | No data/persistence changes required by UI scope |

## 8. Integration tests Claude must add/update

- Anonymous `/` is 200 and contains marketing only; no session/routine names, member ids/emails or private metadata. Missing auth configuration must not prevent public rendering.
- `/home`, week, library, session and export remain protected; nonmembers/revoked users cannot access them; admin page remains indistinguishable 404 to unauthorized viewers.
- Default OAuth destination and explicit safe `next` work; malicious external next and callback loops stay rejected. Login member Planner link reaches real planner after root publication.
- Dashboard ownership/isolation with two users; correct Monday–Sunday counts including zero, multiple/untimed sessions, timezone boundaries, missing duration, long names, empty own routines, recoverable failures. Fixture-free production rendering.
- Public and member shell selection, keyboard navigation, mobile outside-click/Escape/focus return, theme hydration, active indicators and root anchor links.
- Invite success does not claim email delivery; failed sending leaves created membership invitation usable; accepted provider request is not labelled delivered; admin-only sending/retrying; duplicate-submit handling; protected-admin revocation unchanged.
- Email escaping, unsafe URL refusal, subject/preheader/text equivalence, invited-address copy, actual branding URL and responsive email-client rendering.
- Run existing RLS, integration, auth, admin and journey tests after wiring, plus UI-02/UI-03 component states and final UI-04 viewport/zoom matrix.

Do not mark these integrations complete before real authorized data and service behavior are exercised. UI-01 review is satisfied (PR #37 merged). UI-02 review is satisfied (PR #38 merged). UI-03 is prepared for its own manual review; UI-04 remains future work.


## UI-02 integration details

- `LoginView` receives `configured`, minimal `LoginViewer`, the existing mapped `error` string/null, and `providerForms: ReactNode`. `app/login/page.tsx` still reads config/viewer, awaits searchParams, sanitizes next and binds signInWithProvider. `ProviderSubmit` uses useFormStatus inside each original provider form; `ProviderButton` is its pure visual component. No OAuth/callback/sign-out/default redirect changes were made.
- Login branches preserve unavailable → nonmember → member → anonymous precedence; mapped errors stay a separate `p[role=alert]`. Nonmembers' email is never printed. Existing member Planner link remains `/` until coordinated root publication. Preserve it in existing auth tests and update deliberately when root semantics change.
- Dashboard session category uses existing `SessionType`; null time is “No set time”, null duration is omitted. `detail` is a prepared brief summary of the snapshot, not a live source-routine query. All hrefs are supplied by Claude's integration layer and must be validated, local application URLs derived from authorized ids/dates.
- Supply the member's own routine selection, already ordered/capped (recommended up to three). Supply today's sessions, already sorted; do not silently drop sessions to fit the card layout. `week` is a seven-element readonly tuple in Monday–Sunday order; count values must be nonnegative integers. `isSelected` controls aria-current=date and outline, `isToday` marks the date; day links open the corresponding real planner date. The component performs no date arithmetic, queries, completion calculations or user aggregation.
- Use status=loading during real loading, status=error on failure with a safe user-facing message and a working retryHref, and status=ready only after a successful data read. Never substitute empty arrays for failure. Null displayName uses a neutral greeting. `dateLabel` is supplied, so server and client cannot disagree about today.
- `tests/ui/fixtures/dashboard.ts` and `tests/ui/fixtures/login.tsx` are the only UI-02 example data sources. `scripts/build-ui-preview.tsx` renders them to ignored `.next/ui-preview/*.html` as explicitly labelled examples. They are not Next routes and must never be imported into production pages/components. No preview bypass or seed member data exists in the application.
- `npm run test:ui` checks all seven dashboard states and eight login states at 320/360/768/1024/1440 widths and short height in both themes. New `e2e/login-ui.spec.ts` verifies live login layout, next values, keyboard provider order and an intercepted real Server Action's pending state. Existing auth tests still own real Supabase provider handoff, fixed errors, member/nonmember and sign-out coverage.

Remaining backend integration tests in section 8 still apply. Static screenshot harness uses fallback fonts and has no hydration; live Next/E2E checks cover actual login controls. Fixture retry/session/routine links are examples, not production records. UI-02 does not change the public-root handoff or introduce authentication behavior.


## UI-03 implemented contracts and remaining delivery work

### Email renderer

`renderInvitationEmail({ recipientEmail, loginUrl })` returns `{ subject, preheader, html, text }`. The recipient is trimmed and validated; invalid recipients throw. loginUrl must be an absolute HTTP(S) URL without embedded credentials; other schemes and relative URLs throw. The caller must supply the trusted application login URL, based on the configured deployment origin when actual sending is integrated. The renderer does not authorize recipients, create invitations or verify delivery. Pass the canonical invited address from the existing invitation record.

The HTML escapes dynamic values, uses presentation tables/inline CSS, a 600px maximum-width fluid layout, a narrow-screen spacing override and an Outlook table fallback. The logo is the existing first-party PNG at the login URL's origin. The HTML has its own warm light email palette, isolated from the app theme. The CTA and text alternative carry the same URL and invited-email instruction. No HTML is inferred from user markup. Subject and preheader are deterministic. Preview rendering has been checked in Chromium at mobile/desktop widths; provider-specific inbox rendering and verified delivery are not claimed.

### Guarded admin preview

`InvitationEmailPreview({ loginUrl: string })` is mounted only inside the existing administrator-guarded `/admin/invitations` page. Expanding it lazy-mounts an example recipient field and a sandboxed iframe; changing the field only prepares a preview. Invalid drafts hide the iframe and show validation feedback. No new public/email route exists. `Copy invitation text` and `Copy sign-in link` use the local clipboard and report actual copy failure with a manual-selection fallback. The preview does not change membership or call an email service.

`EmailWorkflowPreview({ state })` always renders “Design preview” and disabled send/resend controls. These are deliberately hypothetical examples, not real delivery records. Do not use this component as a live status view without introducing a separate connected adapter and removing preview-only wording under reviewed integration. A future live component needs prepared delivery state and authorized server actions/callbacks, with duplicate-request protection and persisted errors owned by Claude.

- `not_requested`: no send request; existing Invite still means membership invitation creation only.
- `preparing`: busy and noninteractive while preparing a real send.
- `accepted`: provider accepted the request; it is **not** proof of recipient delivery.
- `failed`: sending failed while membership invitation may remain usable; allow authorized retry and local copy.

No fake send timers, provider calls, secrets, delivery fields or retries are implemented. Current actual success text remains “Invitation created.”, and the page still explicitly says “No email is sent.” Membership Pending/Accepted/Revoked continues to come only from the existing invitation model. Guards, protected-admin rules and revocation confirmation/action are unchanged.

### Other UI changes and integration expectations

`InvitationListView({ invitations: InvitationListItem[] })` is a presentation-only list. Server page preparation continues using invitationStatus/revokeKind/protected ids. Its action slot is the existing RevokeForm; no new authorization decision lives in the view. Mobile cards and desktop columns share one semantic list. Empty and protected-record states are explicit.

The planner uses the actual header/control/footer sizes in normal flex flow with 100dvh. A definite `0px` flex basis is intentional through the planner containers: changing it to `0%` can restore intrinsic 24-hour height. The 18rem minimum calendar viewport protects a readable set of rows and lets short/zoomed documents grow; it is not a fixed calendar height. There is no body overflow lock. Twenty-four hours, untimed/timed stacking, links and morning-scroll code are preserved. Responsive day agenda and the library's URL filters/sliding scope pill retain their original behavior. `ActionSubmit` adds real form-pending visuals without moving actions, field payloads or native confirmations.

Claude needs no new backend integration for the viewport or existing editor refinements. Dashboard/root responsibilities from UI-01/UI-02 remain open and unchanged. Add actual provider/invitation orchestration tests listed in section 8 when integrating delivery, including recipient validation, trusted logo/login origin, HTML/text parity, safe failure/retry messaging, and membership success combined with email failure. Check the final email in the selected provider's supported inbox clients before claiming delivery integration complete.
