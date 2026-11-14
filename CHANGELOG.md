# Changelog

All notable changes to TrainGrid. Versions follow [Semantic Versioning](https://semver.org/);
while TrainGrid is in beta, each epic is a minor release (`0.<epic>.0-beta`) and fixes between
epics are patch releases. How releases are made: [docs/RELEASING.md](docs/RELEASING.md).

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
- **Duplicate week** onto another week, with fresh copies of every session.
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

[0.2.1-beta]: https://github.com/i-am-tj/TrainGrid/releases/tag/v0.2.1-beta
[0.2.0-beta]: https://github.com/i-am-tj/TrainGrid/releases/tag/v0.2.0-beta
