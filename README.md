# TrainGrid

TrainGrid is a lightweight personal training planner built around a 7-day, time-slot-based weekly view. It is for **planning and referencing** sessions, not logging completed workouts.

External apps such as Strava and Hevy remain responsible for activity tracking. TrainGrid stores session templates and a weekly schedule as local files.

## Why it exists

Many training apps put planning and reusable templates behind a subscription. TrainGrid is a local alternative: plan the week, reuse templates, and open a session to see what to do. It does not duplicate GPS tracking, lift logging, or analytics.

## Features

- 7-day Monday–Sunday planner with a 24-hour time axis
- Time-slot scheduling (30-minute steps) or untimed sessions
- Multiple sessions on the same day
- Reusable session templates (running, strength, mobility, other)
- Workout content as Markdown sections (no set logging)
- Session detail / reference view
- Duplicate week onto another week
- JSON export and import
- Local file persistence (no account, no database)

## Non-goals

TrainGrid is not a replacement for Strava, Hevy, GPS/activity tracking, workout logging, or training analytics. There is no requirement to enter completed distance, pace, heart rate, weight, or PRs.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router) and React 19
- TypeScript
- Tailwind CSS v4
- `gray-matter` for template Markdown + frontmatter
- `react-markdown` for session body rendering
- Vitest (unit) and Playwright (end-to-end)

## Getting started

Requires Node.js 20+.

```bash
git clone <repository-url>
cd traingrid
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production-style local run:

```bash
npm run build
npm start
```

The app needs a **Node server with a writable disk**. It is not meant for a read-only static host.

To try the planner from a phone on the same network:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open `http://<your-lan-ip>:3000`. Do not expose this on the public internet; there is no login.

## Local persistence

TrainGrid is a **local, single-user** app. There is no authentication.

It reads and writes:

| Path | Role |
| --- | --- |
| `data/templates/*.md` | Session templates (seed examples are in the repo) |
| `data/schedule.json` | Scheduled sessions (**not** committed; created at runtime) |

On first run, if `schedule.json` is missing, the planner starts with an empty calendar. Copy `data/schedule.example.json` if you want an explicit empty file.

Edits in the UI survive a process restart. You can also edit these files in a text editor, or use Export / Import.

Tests use `TRAINGRID_DATA_DIR` so Playwright writes to `e2e/.data` instead of your planner files.

## Project structure

```text
traingrid/
├── README.md
├── REQUIREMENTS.md
├── UX_SPEC.md
├── TECHNICAL_DESIGN.md
├── MVP_CHECKLIST.md
├── DATA_FORMAT.md
├── TEST_PLAN.md
├── TEST_RESULTS.md
├── package.json
├── app/                 # Next.js App Router pages and API
├── components/          # UI
├── lib/                 # domain, file I/O, server actions
├── data/
│   ├── templates/       # seed session templates
│   └── schedule.example.json
├── e2e/                 # Playwright journeys
├── public/
└── .gitignore
```

## Development

```bash
npm run dev         # development server
npm run build       # production build
npm start           # serve the production build
npm run lint        # ESLint
npm test            # Vitest unit tests
npm run test:watch  # Vitest watch mode
npm run test:e2e    # Playwright (stop other `next dev` processes first)
```

## Testing

- **Unit:** `npm test` (week math, templates vs instances, import/export parse, duplicate week).
- **E2E:** `npm run test:e2e` (first-plan, running session, multi-session day, duplicate week, backup). Uses Chromium and an isolated data directory.

See `TEST_PLAN.md` and `TEST_RESULTS.md`.

File shapes for templates, schedule, and backups: `DATA_FORMAT.md`.

## Status

**MVP complete** (requirements, implementation, and Phase 3 validation). Local-first; no cloud sync.
