# Changelog

All notable changes to TrainGrid. Versions follow [Semantic Versioning](https://semver.org/):
new features are minor releases, fixes are patches. Before 1.0, each epic was a `0.x.0-beta`
release. How releases are made: [docs/RELEASING.md](docs/RELEASING.md). Members see the same notes
in the app at `/whats-new`.

## [Unreleased]

### Safer workout history

- **Resume from the session page**: a workout you started and left, including a quick workout
  from Home, now always shows **Resume workout** on its session page, with the sets you logged.
  A session with nothing planned can be started there too, and you add exercises as you go.
- **Deleting a session says what goes with it**: TrainGrid’s own dialog (no more browser pop-up)
  names the workout you logged in it, which is deleted with the session, says that posts about it
  stay up, and suggests changing the date if it is only on the wrong day.
- **Who sees a post**: the session page no longer says a post goes only to your followers; the
  post screen shows exactly who can read it before you post.
- **Running plans you can follow step by step**: Easy, Long, Recovery, Tempo, Speed and VO2max
  runs now have three steps, Warm-up, Main and Cooldown, instead of also asking you to tick off
  “Recovery” and “Progression”. That advice is now in Main’s notes (“Next time: …”), and the
  walk or jog between repetitions is Main’s rest. Sessions you already scheduled keep the steps
  they were copied with.
- **One workout, two devices**: if you log sets on one device while the same workout is open on
  another, the second device no longer overwrites the first. It asks which version to keep, and
  a phone that reopens a workout with sets it never saved asks the same before replacing newer
  ones. A save that reached TrainGrid when your phone lost its signal is still recognised as its
  own.
- **No half-started workouts**: if the connection drops just as you tap **Start a workout**,
  trying again opens the workout that started instead of making a second one, and a failed start
  leaves nothing behind. Finishing a quick workout saves it and its name together, so it is never
  left as “Quick lift”.

### A complete data download

- **Nothing left out**: **Download my data** now includes every session, workout, routine, post,
  comment and like however many you have, instead of stopping at the first thousand of a kind.
- **Quick workouts stay quick**: workouts you started from Home are marked as quick in the file
  (they used to look planned), and each post includes the workout totals it showed.
- **Honest about gaps**: if a part of your data can’t be read (for example social, before it is
  available), the file says so (`complete: false`) instead of listing it as empty. The export
  format is now version 6 (docs/DATA_FORMAT.md).

### Your data, your call

- **Delete my account** on your profile explains how to have your account and everything in it
  deleted, including when you can no longer sign in.
- Invite requests are now deleted on schedule, 180 days after they are made, even when nobody
  else asks for an invite. Needs migration `20261124000000_invite_request_retention`.

### Plan any day

- **Pick the actual date**: adding a session, including **Schedule** from the Library, now has a
  date field that works for any week, with **Today**, **Tomorrow** and **Next Monday** one tap
  away and the chosen day spelled out (“Monday 30 November 2026 · next week”). The routine you
  picked stays selected.
- **Move a session the same way**: Edit uses the same date field instead of a week code, so
  moving Thursday’s run to next Tuesday, or into January, is one choice.
- A missing date is explained beside the field, and the rest of the form keeps what you typed.

### Start now, share it, cheer each other on

- **Start a workout from Home**: no planning needed. Pick Lift, Run, Plyo or Other and you’re
  straight into the workout screen. **Add exercise** as you go (weight and reps, reps, or a tick per
  set, with an optional rest timer), log your sets as usual, then **name it** when you finish. It’s
  saved as today’s session, so it shows on Home and in the planner. Discarding it leaves nothing
  behind.
- **Discard a started workout from anywhere**: a workout in progress now has **Discard workout** on
  Home’s session card and on the session page (and an empty quick workout offers it on its own
  screen), always with a confirmation. A planned session stays, ready to start again.
- **Post about it**: one tap on the finish screen takes you to the post screen (its main button,
  **Done**, takes you back to Home). If the session has a
  finished workout you can also share the **time trained**, **sets done** and **volume lifted**,
  each only if you tick it. Exercises and individual sets are never shared, and nothing is posted
  unless you post it.
- **Likes and comments**: like any post you can see and join the conversation on its page. Delete
  your own comments, and any comment on your own posts. Only people who can see a post can see or
  add its likes and comments. Your data download now includes the comments you wrote and the posts
  you liked. Needs migration `20261123000000_quick_workouts_likes_comments`.

### Train together

- **Your social profile**: choose a username, a display name and a short bio, and show your Google
  or GitHub picture or your initials. It starts **private**; switch to **public to members** when
  you like. Public always means signed-in TrainGrid members, never the open internet, and your
  email address is never shown. Set it up from **Profile → Social profile**.
- **Follow people**: find members by username or name on **People**. Follow a public profile at
  once, or send a request to a private one. Approve or decline requests (the People link shows how
  many are waiting), cancel your own, unfollow, or remove a follower, who then loses access at
  once. Followers and following lists respect privacy.
- **Post a session update**: **Post update** on any of your sessions (or **Feed → Post an update**)
  shares a caption with the session’s name, type and date, and its duration only if you tick it.
  You see exactly what will be shared first. Start times, notes, exercises and logged sets are
  never shared, and posting never marks a session as done. Edit the caption or delete a post any
  time; a post keeps its summary even if you later change or delete the session.
- **Your feed**: `/feed` shows your posts and those of the people you follow, newest first, twenty
  at a time. Your data download now includes your social profile, connections and posts. Needs
  migration `20261122000000_social`; until it is applied, social pages say they aren’t available
  yet instead of failing, and the rest of TrainGrid (including the data download) works as usual.

### Live workouts

- **Take TrainGrid to the gym**: **Start workout** on today’s session (on Home or the session
  page) and work through it one exercise at a time, on a screen made for a phone in one hand.
- **One tap per set**: weight and reps start from the plan, your previous set and what you did
  **last time**; adjust with − and + if you need to, then **Log set**. Bodyweight work logs reps;
  runs and distances get a tick per set.
- **Rest timer**: starts on its own from the session’s rest, buzzes and chimes when it’s time,
  with +15, −15 and Skip.
- **Never lose a set**: the screen stays on, and every set is kept on your phone at once and saved
  to TrainGrid as soon as there’s signal. Leave and **Resume** any time.
- **Finish strong**: a summary of your time, sets, volume and every exercise, with a note on how
  it felt. Done sessions get a tick on Home, the session page and the planner, and your data
  download now includes your workouts. Needs migration `20261120020000_workout_logs`.

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
- If invite requests can’t be loaded, the Invitations page says so, with **Try again**, instead
  of showing “No requests waiting”; the header badge shows no count rather than zero.
- The Invitations page warns while `TRAINGRID_CONTACT_EMAIL` is not set.

### Profile

- **Your profile**: tap your initials in the header (or **Profile** in the phone menu) to see your
  plan in numbers, download your data, choose light, dark or your device’s appearance, check the
  time zone TrainGrid uses for “today”, and sign out.
- **About TrainGrid** now lives on your profile: What’s new, the privacy notice and the terms.

### Landing page

- **Four calm screens**: the opening, the essentials, the product up close, and a closing screen
  that pairs the note from the founder with how to get in. Each fills the screen, and the page
  scrolls the way every other page does.
- **A cleaner header**: What’s new, Privacy and Terms sit in the navigation, and **Log in** is a
  compact button that stays in view on phones. The footer is a single, quiet row.
- **Log in buttons that belong**: the label and arrow sit together, at one height and shape, and
  the closing “Log in to TrainGrid” follows the sentence it answers.
- **A note from the founder** lines up with the rest of the page and reads as a note.

### Planner and home

- **A simpler first visit**: instead of a three-step checklist, a new member’s Home invites them
  to plan a first session, in Today’s empty space: **Choose a routine** or plan their own. It steps
  aside once any session is planned. Quick actions are gone, since every one of them is already
  on the page.
- **Today is right from the first page**: just after midnight, or straight after travelling,
  TrainGrid no longer shows yesterday on the first page you open. The planner’s highlighted day
  always matches home.
- The planner keeps today marked on phones even when it is the day you are looking at.
- On phones, home puts today’s sessions first and keeps the header compact.
- Duplicate week is gone from the planner, keeping it to what you can do on every screen.
- **Untimed sessions stay in view**: on a computer, the planner pins sessions with no start time
  under the day headings, so they are on screen however far you scroll the hours, and it opens
  earlier than 06:00 when a session this week starts before then. A list too long to pin without
  covering the hours (a short or landscape window) scrolls with them instead, and the planner
  opens on it.
- **Faster with a keyboard**: in the computer planner, Tab goes from the calendar to each planned
  session and then on, instead of through every empty hour. To add a session at a time, use the
  arrow keys to choose a day and hour, Enter to open it, and Escape to go back to the calendar.

### Library

- **Routines first on phones**: search stays at the top of the Library, and the equipment and type
  filters fold behind a **Filters** button that shows how many are on, so the first routine is
  higher on the screen. Tablets and computers still show every filter.

### For maintainers

- `agents/` trimmed to the roadmap and the decisions in force; finished epic records moved to
  `agents/archive/`, Epic 2-era requirements and UX spec to `docs/archive/`.
- Tests save their documentation screenshots only with `UI_SHOTS=1`, through one helper
  (`tests/helpers/doc-images.ts`), so `npm run test:ui` and the E2E suite no longer rewrite
  committed images under `docs/images`.
- **Schema gate**: `npm run release:check` reads a Supabase project's Data API schema (secret key)
  and fails, listing what is missing, when a migration this build needs has not been applied.
  `/api/health` now reports `"schema":"ok" | "behind" | "unknown"` and answers `503` when the
  schema is behind, so a healthy Auth service no longer hides a broken planner. The expected
  schema is `lib/release/schema-manifest.json`; CI fails if it does not match the migrations.
  The release journey (schedule a routine across weeks, reload, start, resume, finish, quick
  workout, export) runs as an integration test. See docs/RELEASING.md.
- The six running plans lost their advisory items (12 items: `seed-ids.json` records them as
  removed; Cooldown keeps its id with `Key: 3`). Applied to production by running
  `supabase/seed.sql` in the SQL Editor; scheduled sessions are untouched.
- docs/CONTENT.md: `supabase db push --include-seed` only records a changed seed's hash and does not
  run it, so an updated seed is now run by hand in the SQL Editor, then checked. Also: run seed and
  migration commands from an up-to-date `main`, and never accept the CLI's suggested
  `migration repair --status reverted` when it only means the checkout is behind.
- Starting and finishing a workout are now one database call each (`start_quick_workout()`,
  `finish_workout()`, security invoker). Needs migration `20261125000000_atomic_quick_workouts`
  **before** this build deploys: without it, `/api/health` reports the schema as behind and
  Start a workout and Finish fail.
- Workout saves and finishes carry the version the device last saw (`updated_at`) and a random
  device id (`workout_logs.saved_by`), and are refused rather than applied over another device's
  newer save. Needs migration `20261126000000_workout_save_conflicts` **before** this build
  deploys; the previous build keeps working with it.

## [1.0.0] — 2026-11-18

TrainGrid 1.0: the first release for early-access members. A home that knows your day, a warmer
first visit, a direct line for feedback, and TrainGrid on your phone’s home screen.

### Home

- The schema gate (`npm run release:check` and `/api/health`) also compares the project's applied
  migrations with the build's, through `release_applied_migrations()` (secret key only). A
  migration that only changes a function body or a trigger no longer passes unnoticed: on
  25 November 2026 production reported `schema: ok` while two migrations from #86 were missing.
  Needs migration `20261127000000_release_migration_history` on production **before** this
  merges; the live build ignores it.
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
