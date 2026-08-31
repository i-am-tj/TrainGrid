# TrainGrid — MVP checklist

The app is a functional MVP when **all** items below are true. Nothing else is required.

Phase 3 verification (31 Aug 2026): statuses are **PASS** / **FAIL** / **NOT APPLICABLE**.

## Data

- [x] Session templates live in `data/templates/*.md` with `id`, `name`, `type`, and Markdown body — **PASS**
- [x] Schedule lives in `data/schedule.json` as `{ "sessions": [ ... ] }` — **PASS**
- [x] Every scheduled session stores: `id`, `name`, `type`, `weekId`, `day`, `time` (or null), `durationMinutes` (or null), `notes`, `templateId` (or null), `bodySnapshot` (or null) — **PASS**
- [x] Display title is always `scheduledSession.name` (never derived from Markdown) — **PASS**
- [x] Example session templates exist (e.g. Easy Run, VO2max, Lower A, Upper A) — **PASS**

## Planner

- [x] 7-day Mon–Sun view with weekday + date and a 24-hour time axis (desktop), initially scrolled to ~06:00–21:00 — **PASS**
- [x] Timed sessions appear in the hour row of their start hour (`07:30` in `07:00`) — **PASS** (unit + E2E half-hour)
- [x] Untimed sessions (`time` null) appear only in the untimed lane — **PASS**
- [x] Timed sessions outside 06:00–21:00 remain on the hour grid (scroll), not in the untimed lane — **PASS**
- [x] Multiple sessions on one day are all visible; same-hour sessions stack in that row — **PASS**
- [x] Card height is one hour row; duration is a label only (no multi-row span) — **PASS**
- [x] Previous week / next week / Today (current week) — **PASS**
- [x] Current day is distinguishable — **PASS**
- [x] Empty week shows empty state and Add — **PASS**
- [x] Duplicate Week copies the current week onto a different week as new scheduled sessions (append if destination is not empty, with confirm) — **PASS**

## Sessions

- [x] Add scheduled session form: day, optional time (30-minute steps or untimed), optional duration, **required name**, type, notes, template **or** blank — **PASS**
- [x] Scheduling from a template copies name and type; body live-links until customized — **PASS**
- [x] Open detail: name, when, notes, rendered Markdown — **PASS**
- [x] Live-linked sessions show template body; customizing snapshots body; template file unchanged — **PASS**
- [x] Changing day/time/name/notes on a scheduled session does not rewrite the session template — **PASS**
- [x] Delete scheduled session removes only that row — **PASS**
- [x] Ad-hoc session stores and displays its own name and Markdown — **PASS**
- [x] No drag-and-drop — **PASS**

## Library

- [x] List session templates; filter by `running` / `strength` / `mobility` / `other` — **PASS**
- [x] Create / read / update / delete session template — **PASS**
- [x] Workout items are edited as Markdown sections in the template body — **PASS**
- [x] Schedule from library opens add form with that template — **PASS**
- [x] Delete template snapshots remaining live-linked bodies, then deletes the file; scheduled sessions stay (confirm) — **PASS**

## Mobile

- [x] Below `md`, **single-day agenda** + week strip, not seven squeezed columns — **PASS**
- [x] Default landing is **today** — **PASS**
- [x] Previous/next day and week-strip jump; week changes at Sunday/Monday edges — **PASS**
- [x] Session detail is readable — **PASS**

## Quality bar

- [x] TypeScript app (Next.js + Tailwind as designed) — **PASS**
- [x] Local writable `data/` files; no database or auth — **PASS**
- [x] No tracker features, integrations, analytics, AI plans, or subscriptions — **PASS**
- [x] User can plan a week, duplicate it, and on a phone-sized viewport read what to do today — **PASS**

## Explicitly not needed for MVP

- Drag-and-drop — **NOT APPLICABLE** (intentionally absent)
- RRULE / recurring sessions — **NOT APPLICABLE**
- Variable-height duration blocks / overlap lanes — **NOT APPLICABLE**
- Cloud sync / login — **NOT APPLICABLE**
- Import/export UI — **PASS** (Phase 2 added it; tested in Phase 3)
- Search, ICS, notifications — **NOT APPLICABLE**
- 15-minute grid — **NOT APPLICABLE**
- Structured set/rep or interval objects — **NOT APPLICABLE**
