# TrainGrid — Requirements

## Product purpose

TrainGrid is a lightweight personal **training planner**. It exists so one person can plan a training week and look up what to do in a session — without a paid subscription and without duplicating Strava (running activity) or Hevy (strength logging).

It is a **planner and reference tool**, not a workout tracker.

## User goals

1. See the current training week at a glance (days × time slots).
2. Place training sessions on specific days and times.
3. Open a planned session and read what to perform.
4. Keep a reusable library of session templates.
5. Check today’s plan on a phone while training.
6. Plan the week on a desktop or tablet.
7. Copy one week’s plan onto another week without a recurrence engine.

## Domain terminology

Use these terms only. Do not introduce synonyms in product or implementation docs.

| Term | Meaning |
| --- | --- |
| **Session template** | A reusable definition of a training session: `id`, `name`, `type`, and Markdown body. Stored as a file in the library. |
| **Scheduled session** | A session placed on a particular week, day, and optional start time. Always has its own `id` and `name`. May link to a session template for workout text, or hold a body snapshot / ad-hoc body. |
| **Workout item** | A piece of instructional content inside a session template or scheduled-session body. Markdown `##` section plus optional equipment tags and an optional YouTube URL. |
| **Session type** | A filter label: `running`, `strength`, `plyometrics`, `other`. Distinct from equipment. |
| **Equipment** | Optional tags on a workout item (barbell, dumbbell, bodyweight, …). Not a session category. |
| **Week** | Monday–Sunday, identified by ISO week (`YYYY-Www`). |
| **Time slot** | One hour row on the planner (`00:00`–`23:00`). |
| **Untimed session** | A scheduled session with a day but **no start time**. Only these belong in the untimed lane. |

## Functional requirements

### Planner

- FR-P1. The primary screen is a **7-day weekly planner** (Mon–Sun) with a time axis. Each day column shows weekday name and date.
- FR-P2. The user can navigate **previous week**, **next week**, and **this week** (the ISO week that contains today).
- FR-P3. The current day is visually distinguished.
- FR-P4. A session can be placed on a day **with** or **without** a start time.
- FR-P5. Multiple sessions may exist on the same day (different times, same time, or mixed timed/untimed).
- FR-P6. Duration is **optional metadata**. It is never required. It does **not** change card height or span hour rows.
- FR-P7. The user can **add**, **open**, **reschedule** (day/time), **edit notes and name**, and **delete** a scheduled session via forms. No drag-and-drop.
- FR-P8. Deleting a scheduled session does **not** delete the session template.
- FR-P9. Opening a scheduled session shows the workout content to perform.
- FR-P10. Timed sessions use the hour grid. The grid includes **all 24 hours** and **scrolls**; the initial viewport is approximately 06:00–21:00. Sessions before 06:00 or after 21:00 are **not** moved to the untimed lane.
- FR-P11. Start times may be on **30-minute** steps (`07:00`, `07:30`). A time of `HH:30` is shown in the `HH:00` hour row.
- FR-P12. The user can **Duplicate Week**: copy all scheduled sessions from the currently viewed week onto a different destination week (see Duplicate Week).

### Session templates / library

- FR-L1. The user can **create**, **read**, **update**, and **delete** session templates.
- FR-L2. Each session template has: `id`, `name`, `type`, and a Markdown body (workout items as Markdown).
- FR-L3. Adding a scheduled session can start from an existing session template (from the planner or from the library via Schedule).
- FR-L4. The user can create an **ad-hoc** scheduled session without a session template. That session stores its own `name`, `type`, and Markdown body.
- FR-L5. Editing a **session template** updates workout **body** (and template `name` / `type` in the library) for scheduled sessions that still **live-link** that template’s body. It does **not** rewrite `name` or placement on existing scheduled sessions.
- FR-L6. Customizing workout content on one scheduled session **snapshots** that session’s body so later template edits do not overwrite it.
- FR-L7. Library listing can be filtered by session type. Nested folder trees are not required.
- FR-L8. Workout-item create/update/delete is done by editing the Markdown body of the session template (or of a snapshotted/ad-hoc scheduled session). There is no separate exercise schema or item table.

### Session detail

- FR-D1. Session detail shows: scheduled session `name`, session type, day, time, optional duration, optional notes, live-link vs snapshot banner, and rendered workout Markdown.
- FR-D2. From detail, the user can change placement (day/time), name, notes, duration, customize content, or delete the scheduled session.
- FR-D3. From detail, the user can open the source session template if the body is still live-linked.

### Duplicate Week

- FR-W1. Duplicate Week copies every scheduled session on a **source week** (the week currently shown) onto a **destination week** the user chooses.
- FR-W2. Destination must be a **different** ISO week from the source.
- FR-W3. Each copy is a **new scheduled session** (new `id`). Day-of-week, start time, duration, notes, name, type, `templateId`, and `bodySnapshot` are copied as they are. Dates shift by the week offset (Monday maps to Monday of the destination week, and so on).
- FR-W4. Copies are **independent**: editing or deleting a copy does not change the source week’s sessions. Live-linked copies still reference the same session template.
- FR-W5. If the destination week already has scheduled sessions, copies are **appended**. Existing destination sessions are not deleted, merged, or replaced. Confirm before appending when the destination is not empty.

### Persistence

- FR-S1. Runtime data is stored as local files: Markdown session templates plus one JSON schedule. This assumes a **local writable** Next.js process, not a read-only hosted bundle.
- FR-S2. No account, login, multi-user support, database, or cloud sync.
- FR-S3. There is no separate import/export feature in MVP. Backup is copying or committing the `data/` folder.

## Non-functional requirements

- NFR-1. Single-user, low-maintenance. No database server.
- NFR-2. Desktop: full week grid. Do not squeeze seven hour-columns onto a phone.
- NFR-3. Mobile: today’s plan reachable in one or two taps from launch.
- NFR-4. Session templates should be human-editable in a text editor (Markdown) on the machine running the app.
- NFR-5. Fast to load; planner is a small local dataset.
- NFR-6. TypeScript throughout application code.

## Explicit non-goals

Do not implement:

- GPS, distance, heart-rate, pace, or activity tracking
- Weight/rep logging, set completion, PRs
- Workout or rest timers
- Exercise history or training analytics
- Calories, readiness, recovery scores, or nutrition
- Garmin, Apple Health, Strava, or Hevy integration
- Social features, sharing, comments
- Authentication, multi-user, cloud sync, hosted backend-as-a-service
- PostgreSQL, Supabase, Firebase, or similar
- AI-generated training plans
- Subscription or paywall logic
- Drag-and-drop calendar (MVP)
- Recurring rules / RRULE (“every Monday 07:00 forever”)
- Periodization, mesocycles, or training-load models
- Notifications, print, or ICS export

## MVP scope

In scope:

- File-backed session templates (Markdown + frontmatter)
- File-backed weekly schedule (JSON)
- Desktop 7-day hour grid with full-day scroll
- Mobile single-day agenda with week strip and jump-to-today
- Add scheduled session from session template or ad-hoc (form)
- Every scheduled session has a stored `name`
- Open session detail (rendered Markdown)
- Edit scheduled session placement, name, notes, duration
- Live-link body from session template; snapshot body when customized
- Library CRUD and Schedule-from-library
- Duplicate Week (shallow copy of scheduled sessions)
- Week navigation

Out of MVP:

- Drag-and-drop
- Recurrence / RRULE
- Variable-height duration blocks or overlap lane-packing
- Sync between devices (beyond whatever the user does with `data/`)
- JSON/Markdown import-export UI
- Search, tags beyond `type`, extra theming
- Print / ICS / notifications

## Assumptions

- One primary user.
- Week starts **Monday**.
- Timezone is the **browser/OS local timezone**. No multi-timezone support.
- Hour rows, 30-minute start times. No 15-minute grid.
- Markdown is sufficient for running and strength instructions; no structured sets/reps.
- The app runs as a **local Next.js server** that can write `data/`. It is not designed for a static/CDN host that cannot write files.
- “Mobile while training” means the same app in a browser on a reachable host (localhost, LAN IP, or later self-host). No cloud.
- Rest can be a session template or an untimed scheduled session; no special rest engine.

## Guiding question

> Does this feature help the user plan or view their training?

If not, it is out of scope.
