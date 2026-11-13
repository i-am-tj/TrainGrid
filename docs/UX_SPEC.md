# TrainGrid — UX specification

Low-fidelity behaviour only. No visual design system. Current as of Epic 1, November 2026.

Canonical terms: **routine** (GLOBAL or PERSONAL), **scheduled session**, **snapshot**, **workout item**. See `docs/REQUIREMENTS.md`.

## Information architecture

```text
Sign in                   /login                     public
App (members only)
├── Planner               /  and  /week/[weekId]
├── Scheduled session     /session/[id]   (+ /edit, /customize)
├── Library               /library
│   └── Routine           /library/[routineId]   (+ /edit for own routines)
│                         /library/new
└── Invitations           /admin/invitations      admins only
```

### Header

`TrainGrid · Planner · Library · Export · [Invitations] · Sign out`

- Planner, Library and Export appear for members only; Invitations for admins only.
- Sign out shows “Signing out…” immediately while it works.
- The header wraps on narrow screens; no horizontal scrolling.

Primary entry: **Planner**. Secondary: **Library**.

---

## Sign in

```text
Welcome to TrainGrid
Invite-only access

[ Continue with Google ]
[ Continue with GitHub ]
```

- No email, password or sign-up fields. No buttons for providers that are not configured.
- Each sign-in asks the provider to show an account chooser.
- After sign-in, an invited member lands on the page they originally asked for.
- Not invited: back on this page with “TrainGrid is currently invite-only. Ask the person who invited
  you to verify the email used for your account.”
- No verified email from the provider: a fixed explanation to add one or use another account.
- Any other failure: “Sign-in could not be completed. Please try again.” Provider details are never
  shown.
- A signed-in member who opens this page sees “Signed in as …” and a link to the planner.

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
Day:      [ Wed 11 Nov        ▾ ]
Time:     [ 07:00             ▾ ]  [ ] No start time
Duration: [ — optional —        ]
From:     (•) Routine  ( ) Blank

Routine:  [ My routines / TrainGrid library ▾ ]
Name:     [ VO2max              ]   required
Notes:    [                      ]

        [Add]  [Cancel]
```

- Time options: 30-minute steps `00:00`–`23:30`, plus “No start time”.
- **From routine**: the picker groups the member’s own routines and the shared library. Choosing one
  prefills the name; the type comes from the routine. On save, the routine’s workout items are
  **copied** into the session.
- **Blank**: the member enters a name and type and adds workout items with the item editor.
- Rationale for forms: planning is infrequent; drag-and-drop is not justified.

### Edit scheduled session

Same fields: week, day, time, duration, name, type, notes. The week must exist.

To change the workout of one occurrence, use **Customize content** on the session: it opens the item
editor for this session only. The routine and other sessions are not affected.

There is no “replace routine”; schedule the other routine instead.

### Delete scheduled session

Confirm: “Remove this session from the week? Its routine is kept.”

### Move / reschedule

Change day and/or time in the edit form.

---

## Scheduled session detail

```text
← Back to week

Lower A
Lift · Mon 9 Nov · 18:00 · 60m
Copied from Lower A. Changes to that routine do not affect this session.

Notes: Gym before work

────────────────────────────────
Back Squat
4 × 5–6
Rest: 2–3 min    Target: RPE 7–8
Controlled descent.
[Barbell]   ▶ Watch demo
…
────────────────────────────────

[Edit]  [Customize content]
```

- Workout items are read-only here; **Customize content** edits them for this session only.
- Source line: “Copied from <routine>” with a link when the routine still exists; otherwise “Not
  linked to a routine. This session has its own copy of the workout.”
- Another member’s session does not exist for you (not found).

---

## Library

```text
Library
Reusable routines. Schedule them onto any week from here or from the planner.

[ All ] [ Running ] [ Strength ] [ Plyometrics ] [ Other ]

RUNNING
Easy Run                         [Schedule]
My Tempo   (Mine)                [Schedule]
STRENGTH
Lower A                          [Schedule]

[New routine]
```

- Lists the shared TrainGrid routines and the member’s own, which are marked **Mine**.
- Click a row → routine detail. Shared routines show “TrainGrid library · read-only” and have no
  Edit. The member’s own show “Your routine” and **Edit**.
- **Schedule** opens the add-session form with that routine selected.

### Routine editor (own routines only)

```text
Name: [ My Lower ]
Type: [ Strength ▾ ]
Description: [ … ]

Workout item 1
  Name:        [ Back Squat ]
  Instruction: [ 4 × 5–6    ]
  ▸ More details
      Rest [ 2–3 min ]   Target [ RPE 7–8 ]
      Notes [ … ]
      Equipment [Bodyweight][Dumbbell][Barbell] …
      YouTube URL [ … ]
  [Up] [Down] [Remove]
[Add workout item]

[Save] [Cancel] [Back to library]          [Delete routine]
```

- “More details” opens automatically when any of its fields has a value.
- Invalid YouTube links are flagged while typing and rejected on save.

### Delete routine

Confirm: “Delete this routine? Sessions already on your calendar keep their own copy of the workout.”
Scheduled sessions stay on the planner unchanged.

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
| Empty week | “No sessions this week.” + Add session |
| Empty day (mobile) | “Nothing planned.” Add session |
| Empty library filter | “No routines yet.” + New routine (the shared library is never empty) |
| Missing scheduled session | “Session not found.” Link to planner |
| Duplicate onto empty week | No extra empty-state; just copy |
| Duplicate destination has sessions | Confirm append, as above |

---

## Important interaction decisions

1. **No drag-and-drop.**
2. **Every scheduled session stores its own name** (prefilled from the routine, editable). Blank sessions require a name.
3. **Scheduling copies the workout.** A session never changes because its routine changed.
4. **Customize changes one occurrence only.**
5. **Shared routines are read-only;** members edit only their own.
6. **Hour rows**, 30-minute start times, **one-row card height**, duration as label.
7. **Untimed lane = no start time only.** Full-day scroll for other hours.
8. **No RRULE.** Repeat a week with **Duplicate Week**, or schedule a routine again.
9. **Rest** is an untimed session or an empty day.
10. Fast path: **Today**.

---

## Admin — invitations

```text
Invitations
Only invited email addresses can use TrainGrid. …

Invite someone
Email address [ friend@example.com ] [Invite]
No email is sent. After inviting, send them this link yourself:
https://train-grid.vercel.app/login

All invitations
friend@example.com     Invited 12 Nov 2026          Pending   [Revoke]
pal@example.com        Invited 12 Nov 2026          Accepted  [Revoke access]
you@example.com        Invited 12 Nov 2026 · Admin  Accepted
old@example.com        … · Access revoked, data kept Revoked
```

- Revoke (pending) and Revoke access (accepted) ask for confirmation; the second explains that data
  is kept and that inviting the email again restores it.
- Admin rows have no revoke action.
- Results show as “Invitation created.”, “Revoked.” or a fixed error such as “That email address
  already has an invitation.”

---

## Accessibility (lightweight)

- Cards/links have accessible names including session name, weekday, and time (or “no time”).
- Forms labelled; delete and duplicate-into-non-empty-week use confirmation.
- Type colour/accent is not the only identifier.
