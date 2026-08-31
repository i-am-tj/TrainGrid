# TrainGrid data format

Identifiers use local timezone for weeks. A week is Monday–Sunday, written as ISO week `YYYY-Www` (example: `2026-W36`).

Days on a scheduled session are ISO weekdays: `1` = Monday … `7` = Sunday.

Session types: `running` | `strength` | `mobility` | `other`.

Times are `HH:mm` on 30-minute steps, or JSON `null` for untimed.

---

## Session templates

Path: `data/templates/{id}.md`

`id` is a stable slug. The filename must match `{id}.md`. After create, `id` does not change.

```md
---
id: lower-a
name: Lower A
type: strength
description: Squat-pattern lower body.
---

## Back Squat

3 × 6–8

## Romanian Deadlift

3 × 8–10
```

| Field | Where | Notes |
| --- | --- | --- |
| `id` | frontmatter | Immutable slug |
| `name` | frontmatter | Display name in the library |
| `type` | frontmatter | Filter label |
| `description` | frontmatter | Optional notes |
| body | Markdown after frontmatter | Workout items as `##` headings |

Workout item CRUD in the UI rewrites this Markdown. There is no separate item table.

---

## Schedule

Path: `data/schedule.json` (local runtime; gitignored). Empty example: `data/schedule.example.json`.

```json
{
  "sessions": [
    {
      "id": "3f2c9a1e-…",
      "name": "VO2 Run",
      "type": "running",
      "weekId": "2026-W36",
      "day": 3,
      "time": "07:00",
      "durationMinutes": 60,
      "notes": "",
      "templateId": "vo2-run",
      "bodySnapshot": null
    }
  ]
}
```

| Field | Notes |
| --- | --- |
| `id` | UUID of this scheduled session |
| `name` | **Display title** on cards and detail. Always stored. Never derived from Markdown. |
| `type` | Copied from the template at schedule time; may be edited on the session |
| `weekId` | `YYYY-Www` |
| `day` | 1–7 (Monday–Sunday) |
| `time` | `HH:mm` or `null` (untimed lane) |
| `durationMinutes` | Optional metadata; does not change card height |
| `notes` | Optional |
| `templateId` | Session template id, or `null` if ad-hoc / after template delete |
| `bodySnapshot` | `null` = live-link template **body**. A string = this session owns the workout text |

### Body resolution

1. If `bodySnapshot` is a string, use it (`snapshot` or `adhoc`).
2. Else if `templateId` is set, use that template’s Markdown body (`template`).
3. Else body is empty.

Editing a template’s body updates live-linked sessions. It does not rename existing scheduled sessions.

---

## Import / export

Export is a single JSON file:

```json
{
  "version": 1,
  "exportedAt": "2026-08-31T12:00:00.000Z",
  "templates": [
    {
      "id": "lower-a",
      "name": "Lower A",
      "type": "strength",
      "description": "…",
      "body": "## Back Squat\n\n3 × 6–8\n"
    }
  ],
  "sessions": []
}
```

`templates` is the same information as the Markdown files. `sessions` matches `schedule.json`’s `sessions` array.

Import **replaces** all templates and all scheduled sessions.
