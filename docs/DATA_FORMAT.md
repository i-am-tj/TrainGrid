# TrainGrid data format

Current as of TrainGrid 1.0 (November 2026). All application data lives in Supabase PostgreSQL; the schema
is defined by `supabase/migrations/`. This page describes the shapes; the access rules are in
[TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md).

## Shared values

| Value | Format |
| --- | --- |
| Session type (`category`) | `running` · `strength` · `plyometrics` · `other` |
| Equipment | `bodyweight` · `dumbbell` · `barbell` · `kettlebell` · `resistance-band` · `machine` · `cable` · `bench` · `pull-up-bar` · `plyometric-box` · `other` |
| Date | `YYYY-MM-DD` calendar date, no time zone |
| Start time | `HH:MM` on 30-minute steps, or `null` for untimed |
| Week (URLs only) | ISO week `YYYY-Www`, Monday–Sunday |
| Video link | YouTube only, stored as `https://www.youtube.com/watch?v=<id>` |
| Ids | UUIDs |

Equipment is a tag on a workout item, not a session type.

## Routines

`public.routines`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `scope` | `GLOBAL` / `PERSONAL` | GLOBAL routines are shared and read-only to members |
| `owner_user_id` | uuid or null | Null for GLOBAL, the owner for PERSONAL (enforced by a check constraint) |
| `slug` | text or null | Only seeded GLOBAL routines have one, e.g. `lower-a` |
| `name` | text, 1–200 | |
| `category` | session type | |
| `description` | text, ≤ 2000 | |

`public.workout_items`, ordered by `sort_order` within a routine:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Stable across edits |
| `routine_id` | uuid | |
| `name` | text, 1–200 | Exercise or step |
| `instruction` | text, ≤ 2000 | The planned work, e.g. `4 × 5–6` |
| `rest` | text, ≤ 200 | e.g. `2–3 min` |
| `target` | text, ≤ 200 | RPE, pace, zone, effort |
| `notes` | text, ≤ 4000 | |
| `equipment` | text[] | Equipment values above |
| `video_url` | text or null | YouTube link |
| `sort_order` | integer ≥ 0 | Unique within the routine |

These describe what to **plan**. What was actually done (weights lifted, reps, sets completed) is
recorded separately, per session, in [workout logs](#workout-logs).

## Scheduled sessions

`public.scheduled_sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `user_id` | uuid | The member who owns it |
| `date` | date | |
| `start_time` | time or null | Null = untimed lane |
| `name` | text, 1–200 | Display title |
| `category` | session type | |
| `duration_minutes` | 1–1440 or null | Label only |
| `notes` | text, ≤ 4000 | |
| `source_routine_id` | uuid or null | The routine it was copied from; cleared if that routine is deleted |
| `snapshot` | jsonb | The session’s own copy of the workout |

### Snapshot document

```json
{
  "version": 1,
  "items": [
    {
      "id": "6c1e…",
      "source_item_id": "0f2a…",
      "name": "Back Squat",
      "instruction": "4 × 5–6",
      "rest": "2–3 min",
      "target": "RPE 7–8",
      "notes": "Controlled descent.",
      "equipment": ["barbell"],
      "video_url": null
    }
  ]
}
```

Array order is display order. `source_item_id` is the routine item this was copied from, or `null`
for blank sessions and items added later. The database rejects a snapshot that is not an object with
`version` 1 and an `items` array; the app validates every field with Zod.

## Workout logs

`public.workout_logs`: what the member actually did in a scheduled session (live workouts). One per
session; deleted with the session or the member. Logging never changes the session’s snapshot.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `user_id` | uuid | Defaults to the caller; members cannot set or change it |
| `session_id` | uuid, unique | The scheduled session; cannot be changed after insert |
| `status` | `in_progress` or `completed` | `completed` exactly when `finished_at` is set |
| `started_at` | timestamptz | When Start was tapped |
| `finished_at` | timestamptz or null | When Finish was tapped (kept on later edits) |
| `unit` | `kg` or `lb` | The unit of every weight in the log |
| `entries` | jsonb, ≤ 200 kB | The performed sets |
| `notes` | text, ≤ 2000 | “How did it feel?” |

```json
{
  "version": 1,
  "items": [
    {
      "item_id": "6c1e…",
      "name": "Back Squat",
      "sets": [
        { "weight": 100, "reps": 6, "done": true },
        { "weight": 100, "reps": null, "done": false }
      ]
    }
  ]
}
```

`item_id` is the snapshot item the sets belong to; `name` is copied so the log reads correctly if the
session is customised later. Only sets with `done: true` count as performed. Weights are 0–2000 with
two decimals at most, reps whole numbers 0–1000, at most 30 sets per exercise. How the screen reads
the plan (“4 × 5–6” is four sets with five reps suggested; “Rest: 2 min” starts a two-minute timer;
loaded equipment logs weight and reps, bodyweight logs reps, runs and distances log a tick per set)
lives in `lib/workouts/model.ts`.

## Membership

`public.profiles`: `id` (the Supabase Auth user id), `display_name`, `avatar_url`, `revoked_at`.

`public.invitations`: `email` (trimmed, lower-case), `invited_by`, `created_at`, `accepted_at`,
`accepted_by`, `revoked_at`. One invitation per email may be live (not revoked) at a time. Status is
Pending (neither accepted nor revoked), Accepted, or Revoked.

## Export

`GET /api/export` downloads the signed-in member’s own data:

```json
{
  "format": "traingrid-export",
  "version": 4,
  "exportedAt": "2026-11-13T09:00:00.000Z",
  "routines": [
    {
      "id": "…",
      "name": "My Lower",
      "category": "strength",
      "description": "",
      "items": [
        { "id": "…", "name": "Back Squat", "instruction": "3 × 6–8", "rest": "2 min",
          "target": "RPE 7", "notes": "", "equipment": ["barbell"], "videoUrl": null }
      ]
    }
  ],
  "sessions": [
    {
      "id": "…", "date": "2026-11-09", "weekId": "2026-W46", "day": 1, "startTime": "18:00",
      "name": "Lower A", "category": "strength", "durationMinutes": null, "notes": "",
      "sourceRoutineId": "…", "items": [ { "id": "…", "sourceItemId": "…", "name": "Back Squat", "…": "…" } ]
    }
  ],
  "workoutLogs": [
    {
      "id": "…", "sessionId": "…", "status": "completed",
      "startedAt": "2026-11-09T08:02:11.000Z", "finishedAt": "2026-11-09T08:58:40.000Z",
      "unit": "kg", "notes": "",
      "entries": { "version": 1, "items": [
        { "item_id": "…", "name": "Back Squat", "sets": [ { "weight": 100, "reps": 6, "done": true } ] }
      ] },
      "updatedAt": "2026-11-09T08:58:40.000Z"
    }
  ],
  "social": {
    "profile": { "username": "alex_morgan", "displayName": "Alex Morgan", "bio": "",
                 "visibility": "private", "useIdentityAvatar": false },
    "following": [ { "username": "sam_runs", "status": "accepted", "since": "2026-11-20T07:00:00.000Z" } ],
    "followers": [ { "username": "priya_lifts", "status": "pending", "since": "2026-11-21T18:30:00.000Z" } ],
    "posts": [
      { "id": "…", "caption": "Three blocks at threshold.", "createdAt": "2026-11-21T08:00:00.000Z", "editedAt": null,
        "session": { "name": "Tempo Tuesdays", "category": "running", "date": "2026-11-17", "durationMinutes": null } }
    ]
  }
}
```

It contains only the member’s PERSONAL routines, scheduled sessions, workout logs and social data:
no GLOBAL routines, other members' content, invitations or account details. Other members appear
only as the usernames the member follows or is followed by, never as ids or emails. There is no
import. Version 4 added `social` (`profile` is null without a social profile); version 3 added
`workoutLogs`; versions 1 and 2 had no logs.

## Social

| Table | Column | Format |
| --- | --- | --- |
| `social_profiles` | `username` | 3–30 of `a-z`, `0-9`, `_`; no leading, trailing or double underscore; not reserved (`feed`, `people`, `requests`, `settings`, …); unique |
| | `display_name` | 1–60 characters, trimmed |
| | `bio` | 0–160 characters, one line |
| | `visibility` | `private` (default) or `public` |
| | `avatar_url` | `https://` URL copied from the member's sign-in picture when `use_identity_avatar`; otherwise null |
| `follows` | `status` | `pending` (request to a private profile) or `accepted`; `accepted_at` set exactly when accepted |
| `session_posts` | `caption` | 0–500 characters |
| | `session_name`, `session_category`, `session_date` | Copied from the session when posted; never change |
| | `session_duration_minutes` | Copied only when `shows_duration`; else null |
| | `edited_at` | Set when the caption changes |

Feed and timeline pages use an opaque cursor: base64url of `<created_at>|<post id>`, validated on
the way back in.

## Seed templates (tooling input)

The shared GLOBAL routines are written as Markdown in `data/templates/{slug}.md` and converted once,
by `npm run seed:generate`, into `supabase/seed.sql`. The running app never reads these files.

```md
---
id: lower-a
name: Lower A
type: strength
description: Squat-pattern lower body.
---

## Back Squat

4 × 5–6
Rest: 2–3 min
Target: RPE 7–8

Controlled descent. Drive aggressively out of the bottom.

Equipment: Barbell
Video: https://www.youtube.com/watch?v=…
```

Within each `## ` section: `Rest:` → rest; `Target:` or `Intensity:` → target; `Equipment:` → tags;
`Video:` → YouTube link; `Key:` → the item's id (below); the first paragraph → instruction; later
paragraphs → notes.

Each routine gets a fixed id from its slug. Each item's id comes from the slug and its position
(`routine-item:<slug>:<index>`), unless it has a `Key:`. A word key (`Key: good-morning`) gives a
position-independent id, for new items placed anywhere. A number key (`Key: 3`) pins an existing
item to the id of its original position, for reordering or removing items before it. Re-seeding
therefore updates the same rows. `data/templates/seed-ids.json` records which exercise every item
id belongs to, and `npm run seed:generate` refuses any change that would move an id to a different
exercise. Unit tests fail if `seed.sql` or `seed-ids.json` does not match the templates. Workflow:
[CONTENT.md](CONTENT.md).

## Legacy schedule file (one-time import)

Before Epic 1, a schedule was stored as `data/schedule.json`:

```json
{ "sessions": [ { "id": "…", "name": "VO2 Run", "type": "running", "weekId": "2026-W36", "day": 3,
  "time": "07:00", "durationMinutes": 60, "notes": "", "templateId": "vo2-run", "bodySnapshot": null } ] }
```

`npm run import:legacy -- --file <path> --user <member uuid> [--apply]` imports such a file into one
member’s calendar, locally, with the secret key from the environment. It is a dry run unless
`--apply` is given; sessions whose id already exists are skipped. A session that followed a template
becomes a snapshot of the matching GLOBAL routine; a session with its own copied body keeps that
content as structured items. The repository no longer contains a schedule file.
