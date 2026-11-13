# TrainGrid data format

Current as of Epic 1, November 2026. All application data lives in Supabase PostgreSQL; the schema
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

These describe what to **plan**. There are no performed-workout fields (weights lifted, reps done,
sets completed); those will be separate tables in a later epic.

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
  "version": 2,
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
  ]
}
```

It contains only the member’s PERSONAL routines and scheduled sessions: no GLOBAL routines, other
members, invitations, profile or account details. There is no import.

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
`Video:` → YouTube link; the first paragraph → instruction; later paragraphs → notes. Each routine
and item gets a fixed id derived from the slug and position, so re-seeding updates the same rows.
A unit test fails if `seed.sql` does not match the templates.

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
