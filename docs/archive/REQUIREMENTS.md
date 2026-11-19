# TrainGrid — Requirements

Status: current as of Epic 2 (global workout library), November 2026.
Later epics (global library, personal library, per-user calendar and scheduling improvements) will
extend this document when they ship.

## Product purpose

TrainGrid is a lightweight **training planner** for a small, invited group of friends. Each member
plans their own training week and looks up what to do in a session, without a paid subscription and
without duplicating Strava (running activity) or Hevy (strength logging).

It is a **planner and reference tool**, not a workout tracker.

## User goals

1. See the current training week at a glance (days × time slots).
2. Place training sessions on specific days and times.
3. Open a planned session and read what to perform.
4. Use a shared library of routines, and keep personal routines.
5. Check today’s plan on a phone while training.
6. Plan the week on a desktop or tablet.
7. Copy one week’s plan onto another week without a recurrence engine.
8. Keep my plan private to me.

## Domain terminology

Use these terms only.

| Term | Meaning |
| --- | --- |
| **Member** | An invited person who has signed in and been accepted. Only members can use TrainGrid. |
| **Admin** | A member listed in the server-side admin setting. Manages invitations. |
| **Invitation** | Permission for one email address to become a member. Pending, accepted, or revoked. |
| **Routine** | A reusable training session definition: name, type, description, ordered workout items. |
| **GLOBAL routine** | A routine in the shared TrainGrid library. Readable by every member, editable by none. |
| **PERSONAL routine** | A routine owned by one member. Only that member can see, edit or delete it. |
| **Workout item** | One planned step of a routine or session: name, instruction, rest, target, notes, equipment, video link. |
| **Scheduled session** | One entry on a member’s calendar: date, optional start time, name, type, optional duration, notes, and its own copy of the workout items (a snapshot). |
| **Snapshot** | The workout items stored inside a scheduled session. Copied from the routine when scheduled; never changed by later routine edits. |
| **Session type** | A filter label: `running`, `strength`, `plyometrics`, `other`. Distinct from equipment. |
| **Equipment** | Optional tags on a workout item (barbell, dumbbell, bodyweight, …). |
| **Week** | Monday–Sunday, identified by ISO week (`YYYY-Www`). |
| **Untimed session** | A scheduled session with a date but no start time. Only these belong in the untimed lane. |

## Functional requirements

### Access

- FR-A1. TrainGrid is **invite-only**. Only an admin can invite someone, by email address.
- FR-A2. People sign in with **Google** or **GitHub**. There is no email/password sign-in and no public sign-up.
- FR-A3. After sign-in, the person becomes a member only if the **verified email** from Google or GitHub matches an invitation that has not been revoked. Matching ignores letter case.
- FR-A4. Anyone else is signed out again and sees: “TrainGrid is currently invite-only. Ask the person who invited you to verify the email used for your account.” No reason is given.
- FR-A5. If the provider gives no usable verified email, sign-in is refused with an explanation.
- FR-A6. Every page except sign-in requires a member. Visitors who are not signed in are sent to the sign-in page and returned to the page they asked for afterwards.
- FR-A7. A member can sign out from any page.
- FR-A8. The admin page (`/admin/invitations`) lets an admin invite an email address, see each invitation’s status (Pending, Accepted, Revoked), revoke a pending invitation, and revoke an accepted member’s access. It does not send email; it shows the sign-in link to pass on.
- FR-A9. Revoking a member blocks their access on their next request. Their data is kept. Inviting the same email again restores access with the data. Admins cannot be revoked.
- FR-A10. People who are not admins never see the admin page; for them it does not exist.

### Privacy

- FR-X1. A member sees and changes only their own scheduled sessions and personal routines.
- FR-X2. This is enforced in the database (Row Level Security) as well as in the application.

### Planner

- FR-P1. The primary screen is a **7-day weekly planner** (Mon–Sun) with a time axis. Each day column shows weekday name and date.
- FR-P2. The member can navigate **previous week**, **next week**, and **this week**.
- FR-P3. The current day is visually distinguished.
- FR-P4. A session can be placed on a day **with** or **without** a start time.
- FR-P5. Multiple sessions may exist on the same day.
- FR-P6. Duration is optional metadata. It does not change card height.
- FR-P7. The member can **add**, **open**, **reschedule** (day/time), **edit name, type and notes**, and **delete** a scheduled session via forms. No drag-and-drop.
- FR-P8. Deleting a scheduled session does not affect any routine.
- FR-P9. Timed sessions use the hour grid. The grid includes all 24 hours and scrolls; the initial view is about 06:00–21:00.
- FR-P10. Start times are on **30-minute** steps. `HH:30` is shown in the `HH:00` row.
- FR-P11. The member can **Duplicate Week** (see below).

### Routines and library

- FR-L1. The library lists every GLOBAL routine and the member’s own PERSONAL routines. It has three views: **All** (default), **TrainGrid** (GLOBAL only) and **Mine** (own only). Every card says, in text, whether it is **TrainGrid** or **Mine**.
- FR-L2. GLOBAL routines are read-only to members: they can be opened and scheduled, not edited or deleted.
- FR-L3. A member can **create**, **view**, **edit** and **delete** their own PERSONAL routines.
- FR-L4. A routine has a name, type, optional description, and ordered workout items.
- FR-L5. A workout item has a name and, optionally, an instruction, rest, target, notes, equipment tags and a YouTube link. These are separate fields; text such as “Rest: 2 min” typed into notes stays in notes.
- FR-L6. Old library links that named a shared routine by slug (for example `/library/lower-a`) still open that routine.
- FR-L7. The library can be searched and filtered. Search matches every word, ignoring case, in a routine's name, description or exercise names. Filters: session type, and one equipment tag (a routine matches if any item uses it). All of these combine, and live in the URL (`scope`, `q`, `type`, `equipment`), so refresh, back and shared links keep them. Invalid values fall back to the default. A search with no results says what was searched and offers **Clear filters**.
- FR-L8. Each card shows the routine's item count and the equipment its items use. Equipment is shown only when the content names it.
- FR-L9. A member can **copy** a GLOBAL routine to their own library. The copy keeps the exact name, type, description and ordered items, is PERSONAL and owned by the member, and has new ids. The original is unchanged. Copying another member's routine, or one's own, is refused.
- FR-L10. A routine can be scheduled from its card or its detail page. **Schedule** opens the add-session form with the routine selected.
- FR-L11. Shared routines are maintained as Markdown templates. An item's id never starts to mean a different exercise (see `docs/CONTENT.md`).

### Scheduling and snapshots

- FR-S1. Adding a session can start from a routine (GLOBAL or the member’s own) or be blank.
- FR-S2. Scheduling a routine **copies** its workout items into the session. Later edits to the routine, or deleting it, never change the scheduled session.
- FR-S3. The session remembers which routine it was copied from, for reference only.
- FR-S4. Customising a session’s workout changes that session only.
- FR-S5. A blank session has its own name, type and workout items.

### Session detail

- FR-D1. Session detail shows the name, type, day, time, optional duration, optional notes, where it was copied from, and its workout items.
- FR-D2. From detail, the member can edit placement, name, type, notes and duration, customise the workout, or delete the session.

### Duplicate Week

- FR-W1. Duplicate Week copies every session of the week shown onto a destination week the member chooses.
- FR-W2. The destination must be a different, existing ISO week.
- FR-W3. Each copy is a new session with its own copy of the workout, on the same weekday and time.
- FR-W4. Copies are independent of the originals.
- FR-W5. Existing sessions in the destination week are kept; copies are added alongside them, after a confirmation.

### Data and export

- FR-E1. All data is stored in the cloud database; nothing is written to the server’s files.
- FR-E2. A member can **export** their own personal routines and scheduled sessions as JSON. The export contains nothing about other members, invitations or accounts.
- FR-E3. There is no import feature.

## Non-functional requirements

- NFR-1. **Zero running cost** for a small group: Vercel Hobby, Supabase Free, Google and GitHub sign-in. No paid services.
- NFR-2. **Security:** secrets never in Git or the browser; every mutation validated on the server; isolation enforced in the database.
- NFR-3. Desktop: full week grid. Phone: single-day agenda; no horizontal scrolling.
- NFR-4. Mobile: today’s plan reachable in one or two taps.
- NFR-5. Fast to load for a small dataset.
- NFR-6. TypeScript throughout application code.

## Explicit non-goals

Do not implement:

- GPS, distance, heart-rate, pace, or activity tracking
- Weight/rep logging, set completion, PRs (routine items describe the **plan** only; see ADR 001)
- Workout or rest timers
- Exercise history or training analytics
- Calories, readiness, recovery scores, or nutrition
- Garmin, Apple Health, Strava, or Hevy integration
- Social features, feeds, following, comments
- Public registration, email/password sign-in
- Apple or ChatGPT sign-in (deferred; see the README)
- Subscriptions, payments, notifications
- File uploads or cloud file storage
- AI-generated training plans
- Drag-and-drop calendar, recurring rules (RRULE), periodization models
- Print or ICS export

## Assumptions

- A small group of invited friends; one or a few admins.
- Week starts **Monday**.
- Dates are calendar dates; the planner uses the browser’s local time to decide “today”.
- Hour rows and 30-minute start times. No 15-minute grid.
- Rest days are an untimed session or simply an empty day.

## Guiding question

> Does this feature help a member plan or view their training?

If not, it is out of scope.
