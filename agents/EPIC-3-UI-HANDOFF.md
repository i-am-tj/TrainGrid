# Epic 3 UI → Claude integration handoff

Updated 2026-11-17. UI-01 only. **Proposed contracts below are not existing exports unless explicitly marked implemented.** No dashboard/email/backend feature is complete in this PR.

## 1. Dashboard props and real-data requirements

UI-02 will finalize/export types alongside `MemberDashboard`; no component or `/home` route exists in UI-01. Proposed presentation contract:

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
type DashboardData = {
  displayName: string | null; dateLabel: string;
  todaySessions: DashboardSession[];
  week: DashboardDay[]; // exactly seven, Monday–Sunday
  routines: DashboardRoutine[]; // member's own PERSONAL routines only
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

- `components/marketing/LandingPage.tsx`: `LandingPage({ creatorRole?: string })`; default supplied role label.
- `components/marketing/PublicHeader.tsx`: public navigation, brand/Beta and existing theme/mobile components. No viewer or admin data.
- `components/marketing/metadata.ts`: `landingMetadata`, ready for public page only.
- Existing `components/footer/SiteFooter.tsx` remains shared; do not duplicate it inside main.

Current root requires membership and redirects to today's week. The proxy does not allow public `/`; changing only app/page.tsx will not publish it. Publication affects default OAuth landing behavior, so integration is deferred rather than making a partial route change.

Claude must coordinate these changes together:

1. Explicitly add only `/` to `isPublicPath`; keep all planner/library/session/admin/export routes guarded.
2. Replace root redirect with LandingPage and apply landingMetadata. Configure metadataBase from the verified deployment origin; set canonical only when known.
3. Select PublicHeader for the root in the shared layout/header composition; retain AppHeader and guards for member routes. Ensure no duplicate header/footer/main landmarks. Root should not query private planner data or embed it in metadata.
4. Implement `/home` as an authenticated page using requireMember/memberData and real prepared data passed into UI-02's dashboard. Do not render demo records to a member.
5. Replace member Planner links currently pointing at `/` with `/week/current`; update the signed-in login-page Planner link and brand destination deliberately. Public branding should link to `/`. Decide member Home navigation in UI-02 integration.
6. Retain private route no-store/session handling and data-layer/RLS checks. Do not relax middleware matching globally.

UI-01 static preview is a build/test artifact in `.next/ui-preview`, **not a public application route or auth bypass**. Run `npm run test:ui` to regenerate component screenshots. PublicHeader interactive behavior requires hydration when wired into Next; static harness checks only rendered/native behavior.

## 3. Post-login redirect integration

Unchanged: `safeNextPath` fallback `/`, callback construction, callback processing and OAuth server actions. Claude owns new default `/home` (if product-approved), preserving explicitly requested safe next paths including query parameters. Preserve external-origin rejection and auth-loop protection. Review signout destination separately rather than inferring a new behavior. Do not leave the login page's “Go to the planner” link pointing at a newly public marketing page.

## 4. Invitation email template inputs

UI-03 proposed pure contract, not yet implemented:

```ts
type InvitationEmailInput = { recipientEmail: string; loginUrl: string };
type InvitationEmail = {
  subject: string; preheader: string; html: string; text: string;
};
```

Use the administrator's existing trusted-origin construction for loginUrl. Template must escape recipient values, reject unsafe URL schemes, use email-compatible table/inline CSS, and include both text and HTML. Logo must work without scripts or relative email image paths; settle trusted absolute asset origin or an approved embedded branding treatment during UI-03. Do not include member records or email addresses in public preview assets. No tokenized invitation semantics are implied: existing access is matched to verified email.

## 5. Email sending integration contract

Keep existing inviteAction creating/restoring membership invitation records. A successful record mutation means “Invitation created”, not “Email sent”. Actual delivery orchestration, provider choice, credentials, retries and persistence belong to Claude. UI-03 should consume prepared status and authorized callbacks/actions, with no provider SDK.

Create/resend must authenticate admin on server and respect current protected records. Return field/action feedback without exposing provider diagnostics or secrets. Separate invitation creation success from email failure so admins can copy a link after a failed send without repeating the membership mutation.

## 6. Delivery state expectations

Proposed separate presentation union: `not_requested | preparing | accepted | failed`. Before integration, render only truthful not-requested copy and clearly labelled disabled preview controls. Membership remains Pending/Accepted/Revoked from existing model.

- preparing: show busy state and prevent duplicate submit.
- accepted: provider accepted request; say exactly that. Do not claim recipient delivery.
- failed: show recoverable message and authorized resend/copy paths.
- delivered: expose only if later supported by verified delivery events; not part of current UI promise.

The admin preview must not manufacture status transitions or call a fake send. Resend must not silently change membership status. Claude owns persisted state, race prevention, delivery events and retry rules.

## 7. Remaining presentation and dependency ownership

| Capability | UI status at UI-01 | Claude responsibility |
| --- | --- | --- |
| Landing and public shell | Implemented, reusable, not routed | Coordinate root publication/metadata/shell/navigation |
| Dashboard | Proposed contract only; UI-02 pending review gate | Member route, data preparation, timezone, default login destination |
| Login | Existing presentation unchanged; UI-02 planned | Preserve/integrate auth behavior; no provider redesign requested |
| Invitations | Existing functional page retained; UI-03 planned | Keep admin policy and membership semantics |
| Invitation email | Proposed contract only; UI-03 planned | Sending, retries, persisted delivery state and secrets |
| Planner/library/editor/session | Existing operations retained; visual refinements UI-03 | No data/persistence changes required by UI scope |

## 8. Integration tests Claude must add/update

- Anonymous `/` is 200 and contains marketing only; no session/routine names, member ids/emails or private metadata. Missing auth configuration must not prevent public rendering.
- `/home`, week, library, session and export remain protected; nonmembers/revoked users cannot access them; admin page remains indistinguishable 404 to unauthorized viewers.
- Default OAuth destination and explicit safe `next` work; malicious external next and callback loops stay rejected. Login member Planner link reaches real planner after root publication.
- Dashboard ownership/isolation with two users; correct Monday–Sunday counts including zero, multiple/untimed sessions, timezone boundaries, missing duration, long names, empty own routines, recoverable failures. Fixture-free production rendering.
- Public and member shell selection, keyboard navigation, mobile outside-click/Escape/focus return, theme hydration, active indicators and root anchor links.
- Invite success does not claim email delivery; failed sending leaves created membership invitation usable; accepted provider request is not labelled delivered; admin-only sending/retrying; duplicate-submit handling; protected-admin revocation unchanged.
- Email escaping, unsafe URL refusal, subject/preheader/text equivalence, invited-address copy, actual branding URL and responsive email-client rendering.
- Run existing RLS, integration, auth, admin and journey tests after wiring, plus UI-02/UI-03 component states and final UI-04 viewport/zoom matrix.

Do not mark these integrations complete before real authorized data and service behavior are exercised. UI-02 must not begin until UI-01 review.
