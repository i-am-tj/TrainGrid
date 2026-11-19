# Changelog

All notable changes to TrainGrid. Versions follow [Semantic Versioning](https://semver.org/):
new features are minor releases, fixes are patches. Before 1.0, each epic was a `0.x.0-beta`
release. How releases are made: [docs/RELEASING.md](docs/RELEASING.md). Members see the same notes
in the app at `/whats-new`.

## [Unreleased]

### Request an invite

- **No invitation yet? Ask for one**: on the sign-in page (and from “No invitation yet?” and
  “Request an invite” on the landing page), leave your email, and if you like your name and a
  note. Every request is reviewed personally; if you are invited, the invitation arrives at that
  address and you sign in as usual.

### For admins

- **Requests on the Invitations page**: new requests arrive by email from “TrainGrid Requests”
  (reply to answer the person), and wait on Invitations → Requests, where **Invite and email**
  invites them in one click and **Dismiss** declines quietly. Optional setting:
  `TRAINGRID_INVITE_REQUESTS_TO` (falls back to `TRAINGRID_FEEDBACK_TO`). Needs migration
  `20261120000000_invite_requests`.
- **A count to review**: the Invitations link shows how many requests are waiting, on every page
  and in the phone menu.
- **History at a glance**: a request from someone whose access or invitation was revoked is
  marked as such; inviting them restores their data.

### Profile

- **Your profile**: tap your initials in the header (or **Profile** in the phone menu) to see your
  plan in numbers, download your data, choose light, dark or your device’s appearance, check the
  time zone TrainGrid uses for “today”, and sign out.
- **About TrainGrid** now lives on your profile: What’s new, the privacy notice and the terms.

### Landing page

- **Four calm screens**: the opening, the essentials, the product up close, and a closing screen
  that pairs the note from the founder with how to get in. Each fills the screen as you page
  through.
- **A cleaner header**: What’s new, Privacy and Terms sit in the navigation, and **Log in** is a
  compact button that stays in view on phones. The footer is a single, quiet row.
- **Log in buttons that belong**: the label and arrow sit together, at one height and shape, and
  the closing “Log in to TrainGrid” follows the sentence it answers.
- **A note from the founder** lines up with the rest of the page and reads as a note.

### Planner and home

- **Today is right from the first page**: just after midnight, or straight after travelling,
  TrainGrid no longer shows yesterday on the first page you open. The planner’s highlighted day
  always matches home.
- The planner keeps today marked on phones even when it is the day you are looking at.
- On phones, home puts today’s sessions first and keeps the header compact.
- Duplicate week is gone from the planner, keeping it to what you can do on every screen.

### For maintainers

- `agents/` trimmed to the roadmap and the decisions in force; finished epic records moved to
  `agents/archive/`, Epic 2-era requirements and UX spec to `docs/archive/`.
- `e2e/secondary-actions.spec.ts` saves screenshots only with `UI_SHOTS=1`, so test runs no longer
  rewrite `docs/images`.

## [1.0.0] — 2026-11-18

TrainGrid 1.0: the first release for early-access members. A home that knows your day, a warmer
first visit, a direct line for feedback, and TrainGrid on your phone’s home screen.

### Home

- **Your day at a glance**: today’s planned sessions in order, this week’s planned counts from
  Monday to Sunday, quick actions, and your most recent routines. Signing in now lands here.
- **Loads section by section**: the greeting, titles and shortcuts appear at once; today, the week
  and your routines each fill in behind their own loader, and if one can’t load, only that
  section says so.
- **Welcome, then welcome back**: your first visit after accepting an invitation greets you with
  “Welcome”; from then on, “Welcome back”.
- **Getting started**: three steps for new members (plan a session, make a routine your own,
  schedule a routine) that tick themselves off as you go and step aside when you’re done.
- **Today means your today**: home and the planner use your device’s time zone, so the day no
  longer changes mid-morning in Australia.
- Smoother details: links sweep an underline in on hover, and shortcut arrows take the accent
  colour.

### Planner and loading

- **Loaders say where you’re going**: “Loading your calendar…”, “Loading your home…”.
- **Slow moments are explained**: after five seconds a loader says it is taking longer than usual
  and quietly tries again once; after twenty it suggests checking your connection.

### Getting help and staying in the loop

- **Feedback** in the header: choose Idea, Problem or Praise and write a few words. It goes
  straight to the person who builds TrainGrid.
- **What’s new** (`/whats-new`): every release, newest first.
- **Privacy notice and terms** (`/privacy`, `/terms`): plain-language, readable before signing in,
  and linked from a new footer row and the sign-in page.

### On your phone

- **Install TrainGrid** to your home screen: it opens like an app, with its own icon and shortcuts
  to the planner and the library.
- Shared TrainGrid links now show a proper preview card.

### For admins

- **Invitation emails**: tick *Email the invitation* when inviting, or send and resend from the
  list. The status says “accepted by provider”, never “delivered”, and a failed send leaves the
  invitation valid. Compact row actions, with messages across the full row.
- Every confirmation is a themed dialog; nothing uses the browser’s own pop-ups.
- Member feedback can be emailed to you (`TRAINGRID_FEEDBACK_TO`); it arrives from **TrainGrid
  Feedback**, and replying answers the member directly.

### Look and feel

- A public **landing page** at `/` for everyone, with its own header; the planner lives at
  `/week/current` and the header gains **Home**.
- “Beta” is now **Early access**.

### For maintainers

- **Database**: migrations `20261117000000_invitation_email_deliveries.sql` and
  `20261118000000_member_feedback.sql` (apply before or with the deploy).
- **New optional settings**: `TRAINGRID_FEEDBACK_TO`, `TRAINGRID_CONTACT_EMAIL`,
  `TRAINGRID_ALERT_WEBHOOK_URL` (see `docs/SUPABASE_SETUP.md`).
- **CI on every pull request**: lint, types, unit, database, integration and end-to-end tests,
  with E2E against a production build (`docs/CI.md`).
- **Error reports**: one data-free log line per server error, and optional throttled Slack/Discord
  alerts; `/api/health` for uptime monitors.
- **Email setup**: `TRAINGRID_EMAIL_FROM` accepts `Name<address>`; `docs/EMAIL_SETUP.md` follows
  Resend’s current DNS records.
- **Docs**: a member guide (`docs/GUIDE.md`), an admin guide (`docs/ADMIN.md`), a new README, and
  screenshots generated from the app with `npm run screenshots`.
- Install icons are generated with `npm run icons:generate`.

## [0.2.1-beta] — 2026-11-14

Faster-feeling navigation, with loading feedback everywhere.

- **Loaders**: the TrainGrid logo, turning clockwise, shows while a page loads, and inside a
  section while its data loads (the planner's week, library results, the invitation list); the
  rest of the page stays on screen. It waits 150 ms before appearing, so quick navigations do not
  flash, and pulses gently instead of spinning if your device asks for reduced motion.
- **Far fewer background requests**: lists no longer prefetch every link in view. On the planner
  that cut background requests from 106 to 8 per page view; on the library from 32 to 4.
- **Library search without a page reload**: searching and filtering now update the results in
  place, keeping the search form and view control.
- **One fewer database query per page**: who you are is looked up once per request, not twice.

Measured from Mumbai without throttling, a request to production takes about 0.3–0.5 s; most of
that is the network path to the Sydney region where the app and its database run. DevTools'
"3G" throttling adds about 2 s to every request on its own.

## [0.2.0-beta] — 2026-11-13

The first public release: the secure invite-only foundation (Epic 1) and the global workout
library (Epic 2). Live at https://train-grid.vercel.app for invited members.

### Planner (Epic 1)

- A Monday–Sunday week grid on desktop and a one-day agenda on phones, with week navigation.
- Timed and untimed sessions, several per day; add, edit, reschedule and delete.
- Scheduling **copies** a routine into the session, so later routine changes never rewrite a
  planned or past session. Customise one session without touching the routine.
- **Export** your own routines and sessions as JSON.

### Library (Epics 1 and 2)

- 18 shared **TrainGrid** routines (runs, lifts, plyometrics, warm-ups, cooldowns), read-only for
  everyone, and your own **personal** routines with structured workout items: instruction, rest,
  target, notes, equipment tags and YouTube demo links.
- Three views, **All / TrainGrid / Mine**, with a sliding view control.
- **Search** by name, description or exercise; filter by type and equipment. Every state is a
  shareable URL; a search with no results says what was searched and offers Clear filters.
- Cards show the item count and the equipment used; **Schedule** straight from a card or a routine.
- **Copy to My Library**: an editable copy of any TrainGrid routine; the original is unchanged.
- Old links such as `/library/lower-a` still work.

### Access and security (Epic 1)

- Sign in with **Google** or **GitHub**. Only invited email addresses become members; there is no
  public sign-up.
- An **admin page** to invite people, see who joined and revoke access (their data is kept).
- Every member's data is private, enforced by Supabase Row Level Security and checked again in
  the app; attacks on the real server actions across members are part of the test suite.
- Secrets never reach the browser; secret scanning covers files and Git history.
- Known limitation, documented in [docs/SECURITY.md](https://github.com/i-am-tj/TrainGrid/blob/main/docs/SECURITY.md): Supabase links sign-ins that share a
  verified email, so each member should sign in with their invited address.

### Look and feel

- Header with the TrainGrid logo and a **Beta** badge; a menu button on phones.
- **Light and dark mode**, following your device until you choose; no flash on load.
- Footer modelled on iamtj.dev, with the "TJ" ring that warms to copper on hover.

### For maintainers

- Shared routines are Markdown templates; `npm run seed:generate` builds an idempotent seed and an
  item id lock, so an item id never starts to mean a different exercise
  ([docs/CONTENT.md](https://github.com/i-am-tj/TrainGrid/blob/main/docs/CONTENT.md)).
- Tests at every layer: unit 174, database (pgTAP) 191, integration 35, end-to-end 111.
- Runs at zero cost on Vercel Hobby and Supabase Free.

[1.0.0]: https://github.com/i-am-tj/TrainGrid/releases/tag/v1.0.0
[0.2.1-beta]: https://github.com/i-am-tj/TrainGrid/releases/tag/v0.2.1-beta
[0.2.0-beta]: https://github.com/i-am-tj/TrainGrid/releases/tag/v0.2.0-beta
