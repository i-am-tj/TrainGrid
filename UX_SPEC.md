# TrainGrid — UX specification

Low-fidelity behaviour only. No visual design system.

Canonical terms: **session template**, **scheduled session**, **workout item**. See `REQUIREMENTS.md`.

## Information architecture

```text
App
├── Planner               /  and  /week/[weekId]
├── Scheduled session     /session/[id]
└── Library               /library
    └── Session template  /library/[templateId]
                          /library/new
```

Primary entry: **Planner**. Secondary: **Library**.

---

## Desktop — weekly planner

Primary layout: 8 columns (time gutter + 7 days). Rows = hours `00:00`–`23:00`. The grid **scrolls vertically**. On load, scroll so roughly **06:00–21:00** is in view.

```text
┌──────────────────────────────────────────────────────────────────┐
│  ←  Week of 31 Aug 2026          Today     Duplicate week  →    │
│                                  [Library]                       │
├──────┬────────┬────────┬────────┬────────┬────────┬────────┬─────┤
│      │  MON   │  TUE   │  WED   │  THU   │  FRI   │  SAT   │ SUN │
│      │  31    │   1    │   2    │   3    │   4    │   5    │  6  │
│ untimed (time = none only)                                       │
├──────┼────────┼────────┼────────┼────────┼────────┼────────┼─────┤
│00:00 │        │        │        │        │        │        │     │
│  …   │  (scroll)                                                 │
│06:00 │        │        │        │        │        │        │     │
│07:00 │ Speed  │ Easy   │ VO2    │        │ Tempo  │ Long   │     │
│      │ Lower B│ Upper A│ Lower A│        │ Upper B│        │     │
│08:00 │        │        │        │        │        │        │     │
│  …   │                                                           │
│23:00 │        │        │        │        │        │        │     │
└──────┴────────┴────────┴────────┴────────┴────────┴────────┴─────┘
```

### Planner behaviour

- Each day column shows **weekday + date**.
- **Today**: highlight today’s column when that week is shown. The **Today** control jumps to the ISO week containing today (and on mobile, selects today).
- **Week nav**: previous / next ISO week. Label is the Monday date of that week (e.g. “Week of 31 Aug 2026”).
- Click empty hour cell → **Add scheduled session** with that day and that hour prefilled (`HH:00`).
- Click untimed lane empty area → **Add scheduled session** with that day prefilled and no start time.
- Click a session card → scheduled session detail route.

### Time placement rules (deterministic)

1. **Untimed lane** contains only scheduled sessions whose `time` is `null`. Never put timed sessions here.
2. **Hour row** for a timed session is `floor` of the start hour: `07:00` and `07:30` both sit in the **07:00** row. Show `07:30` on the card so the half hour is visible.
3. The grid is **24 hours**, scrollable. Early/late sessions stay in their hour rows (`05:00` in 05:00, `22:30` in 22:00).
4. Card **height is always one hour row**, whether duration is set or not. Duration, if present, is a **label only** (e.g. `60m`). Cards do not span 08:00–09:00 because duration is 90 minutes.
5. Several timed sessions in the **same hour row** (same hour, including `07:00` and `07:30` together) **stack vertically inside that row**. No overlap engine, no extra columns, no clipping across rows.
6. Untimed sessions on the same day sit as compact chips in that day’s untimed lane, wrapping if needed.

### Session card (grid)

Show:

- **Name** of the scheduled session (required, one line)
- Start time when not exactly the row hour, or always show time if it aids scanning (`07:30`)
- Optional duration label if set
- Type accent (left border or small `Run` / `Lift` / etc.) — supplementary, not the only identifier

Do not show full workout text or individual workout items.

Accessible name example: `VO2max, Wednesday 07:00`.

### Untimed lane

Chips for `time === null` only (e.g. `Rest`, `Mobility`). Timed overflow must not appear here.

---

## Add / edit / delete / move

No drag-and-drop in MVP.

### Add scheduled session (form)

```text
Add session
───────────
Day:     [ Wed 2 Sep        ▾ ]
Time:    [ 07:00            ▾ ]  ( ) No specific time
Duration:[ — optional —       ]
Name:    [ VO2max             ]   required
Type:    [ running          ▾ ]
From:    (•) Template  ( ) Blank

Template: [ VO2max            ▾ ]

Notes:    [                     ]

        [Cancel]  [Add]
```

- Time options: 30-minute steps `00:00`–`23:30`, plus “No specific time”.
- **From template**: choosing a session template prefills `Name` and `Type` from the template; the user may edit the scheduled session name before saving. Body stays live-linked (`bodySnapshot` null, `templateId` set).
- **Blank (ad-hoc)**: user must enter `Name`; body starts empty (or a placeholder heading). `templateId` is null; body is stored on the scheduled session.
- Rationale for forms: planning is infrequent; drag-and-drop is not justified for MVP.

### Edit scheduled session

Same fields: day, time, duration, name, type, notes.

Additional actions:

- **Replace template** — pick another session template; copies that template’s name/type onto the scheduled session only if the user accepts overwrite of name; sets `templateId`, clears `bodySnapshot`. Confirm if a snapshot would be discarded.
- **Customize this session** — copies current resolved Markdown into `bodySnapshot`. Name is unchanged. Later template body edits no longer apply.

### Delete scheduled session

Confirm: “Remove from this week? The session template will be kept.”

### Move / reschedule

Change day and/or time in the edit form.

---

## Scheduled session detail

```text
← Back to week

VO2max                         running
Wed 2 Sep  ·  07:00  ·  60m
Linked template: VO2max
Updates if you edit the template.

Notes: Track if windy

────────────────────────────────
## Warm-up
1 km easy
…
────────────────────────────────

[Edit]  [Customize content]  [Open template]  [Delete]
```

- Workout Markdown is read-only until Customize (then a textarea).
- Snapshot banner: “This session has its own copy.” Hide Open template if not live-linked.
- Ad-hoc: no Open template. Banner: “Not linked to a template.”

---

## Library

```text
Library                    [New template]

[ All ] [ Running ] [ Strength ] [ Plyometrics ] [ Other ]

Lower A          strength          [Schedule]
Upper A          strength          [Schedule]
VO2max           running           [Schedule]
```

- Click row → session template editor.
- **Schedule** opens the add-session form with that template selected (current week, user picks day/time).

### Session template editor

```text
Name: [ Lower A ]
Type: [ Strength ▾ ]

Body (workout-item CRUD):

## Back Squat
4 × 5–6
Equipment: [ Barbell ]
YouTube URL (optional)
```

- Create / read / update / delete the session template here.
- Workout items support optional equipment tags and an optional YouTube URL.

### Delete session template

Confirm. Then: for every live-linked scheduled session, copy current template body into `bodySnapshot` (and keep each session’s existing `name` / `type`). Then delete the template file. Scheduled sessions remain on the planner.

---

## Duplicate Week

```text
Duplicate week
──────────────
From:  Week of 31 Aug 2026   (current; not editable)
To:    [ Week of 7 Sep 2026 ▾ ]

If destination already has sessions:
  “Week of 7 Sep already has 4 sessions.
   8 copies will be added alongside them.”

        [Cancel]  [Duplicate]
```

- Source = week currently shown.
- Destination ≠ source.
- Result: new scheduled sessions on the destination week; source unchanged.
- After success, navigate to the destination week.

---

## Mobile

Do **not** show seven hour-columns.

**Chosen approach: single-day agenda + week strip.**

```text
←  Wed 2 Sep  →          Today
Mo Tu We Th Fr Sa Su     (dot = has any session; ring = selected day)

Untimed
  Rest

07:00  VO2max
07:30  Lower A
19:00  Mobility

[ + Add ]
```

- Launch → **today** (correct ISO week + day).
- Chevrons or equivalent: previous/next **day**. Crossing Sunday → next week; crossing Monday backward → previous week.
- Week strip jumps to that day (and week if needed).
- List order: untimed first, then timed chronological (including times outside 06:00–21:00).
- Same-hour sessions appear as consecutive list rows (both visible).
- Tap row → session detail (full screen).
- **+ Add** → same add form, day prefilled.
- Duplicate week and Library remain available (header or overflow).

Desktop vs mobile is **layout only**; same data and routes.

---

## Empty states

| Surface | Copy / action |
| --- | --- |
| Empty week | “No sessions this week.” Add session · Duplicate week |
| Empty day (mobile) | “Nothing planned.” Add session |
| Empty library | “No templates yet.” New template |
| Missing scheduled session | “Session not found.” Link to planner |
| Duplicate onto empty week | No extra empty-state; just copy |
| Duplicate destination has sessions | Confirm append, as above |

---

## Important interaction decisions

1. **No drag-and-drop in MVP.**
2. **Scheduled session `name` is stored on every scheduled session** (copied from the session template at schedule time, user-editable). Ad-hoc sessions require a name. Display never depends on Markdown headings.
3. **Live-link for body only.** Template body edits update live-linked scheduled sessions. Name/placement on the calendar do not follow template renames.
4. **Customize snapshots body** so one occurrence can diverge.
5. **Ad-hoc** scheduled sessions store their own body and name.
6. **Hour rows**, 30-minute start times, **one-row card height**, duration as label.
7. **Untimed lane = no start time only.** Full-day scroll for other hours.
8. **No RRULE.** Repeat a week with **Duplicate Week**, or add another scheduled session from a template.
9. **Rest** is a normal template or untimed scheduled session.
10. Fast path: **Today**.

---

## Accessibility (lightweight)

- Cards/links have accessible names including session name, weekday, and time (or “no time”).
- Forms labelled; delete and duplicate-into-non-empty-week use confirmation.
- Type colour/accent is not the only identifier.
