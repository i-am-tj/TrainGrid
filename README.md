# 🏃 TrainGrid

**TrainGrid** is a lightweight training planner built for runners, lifters, and hybrid athletes who want one simple place to organise their week. 💪📅

Plan your runs, strength sessions, recovery days, and combined training in a **7-day time-slot-based calendar**, save reusable workout templates, and open any session whenever you need to see exactly what you're supposed to do.

No workout tracking. No GPS. No analytics overload.

**Strava and Hevy already do that. TrainGrid does the planning.**

---

## ✨ Why TrainGrid?

Most fitness apps are great at recording what you already did.

Planning what you're going to do is often a different story — especially when reusable routines, calendars, and scheduling features sit behind premium subscriptions.

TrainGrid keeps things simple:

- 📅 Plan your entire training week
- 🏃 Schedule running sessions
- 🏋️ Schedule strength workouts
- 🔁 Reuse saved session templates
- ⚡ Plan multiple sessions on the same day
- 🕒 Organise sessions by time
- 📋 Open any workout and see the full plan
- 📆 Duplicate a training week instead of rebuilding it

---

## 🗓️ What It Looks Like

```text
MONDAY
07:00  🏃 Speed Run
18:00  🏋️ Lower B

TUESDAY
07:00  🏃 Easy Run
18:00  🏋️ Upper A

WEDNESDAY
07:00  🏃 VO₂max
18:00  🏋️ Lower A

THURSDAY
        🧘 Recovery

FRIDAY
07:00  🏃 Tempo Run
18:00  🏋️ Upper B

SATURDAY
07:00  🏃 Long Run

SUNDAY
        😴 Rest
```

Open a session and TrainGrid simply tells you what to do:

```text
VO₂MAX — 6 × 200m

🔥 Warm-up
1 km easy

⚡ Main
6 × 200m hard
200m walk/jog recovery

❄️ Cooldown
1 km easy
```

Then track the actual run in Strava or your lifting session in Hevy.

---

## 🎯 The Idea

TrainGrid is intentionally focused on one thing:

> **Plan the week. Open the session. Train.**

It is not trying to become another fitness ecosystem.

---

## 🚫 What TrainGrid Doesn't Do

TrainGrid does **not** try to replace:

- Strava
- Hevy
- Garmin Connect
- Apple Health
- GPS tracking
- Heart-rate tracking
- Set and rep logging
- PR tracking
- Training analytics
- Nutrition tracking

Those tools already exist and do those jobs well.

TrainGrid fills the gap between **having a training plan** and **actually tracking the workout**.

---

## 🧩 Core Concepts

### 📚 Session Templates

Create reusable sessions such as:

```text
🏃 Easy Run
⚡ Speed Run
🔥 Tempo Run
🫁 VO₂max
🏋️ Upper A
🏋️ Upper B
🦵 Lower A
🦵 Lower B
🧘 Mobility
```

Use them again whenever you build another week.

### 📆 Scheduled Sessions

Drop a template onto a specific day and time.

Each scheduled session becomes independent, so changing one occurrence doesn't unexpectedly modify everything else.

### 📝 Workout Items

A session can contain simple instructions such as:

```text
Back Squat
3 × 6–8

Romanian Deadlift
3 × 8–10
```

or:

```text
1 km warm-up
3 × 5 min tempo
2 min easy recovery
1 km cooldown
```

TrainGrid keeps workout definitions human-readable instead of trying to model every training concept.

---

## 💾 Local-First

TrainGrid currently uses local writable storage and is designed as a lightweight single-user application.

That means:

- no account required
- no database required
- no subscription
- no cloud dependency
- your training plan stays under your control

---

## 🛠️ Development

```bash
git clone <repository-url>
cd traingrid
npm install
npm run dev
```

Then open the local development URL shown in your terminal.

---

## 🚧 Status

TrainGrid is currently under active development.

The MVP is centred around:

```text
📅 Weekly Planner
+
📚 Session Library
+
✏️ Scheduling CRUD
+
📋 Session Details
+
💾 Local Persistence
```

More can come later.

For now, the goal is simple:

**Make planning training easier than maintaining it across notes, spreadsheets, and premium fitness apps.**

## 🛠️ Tech Stack

TrainGrid is built with a lightweight TypeScript stack focused on simplicity, local persistence, and maintainability.

- ⚡ [Next.js](https://nextjs.org/) 16 with the App Router
- ⚛️ React 19
- 🔷 TypeScript
- 🎨 Tailwind CSS v4
- 📝 `gray-matter` for Markdown templates with frontmatter
- 📄 `react-markdown` for rendering session content
- 🧪 Vitest for unit testing
- 🎭 Playwright for end-to-end testing

---

## 🚀 Getting Started

### Requirements

- Node.js 20+
- npm

Clone the repository:

```bash
git clone https://github.com/i-am-tj/traingrid.git
cd traingrid
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Production-style Local Run

Build and run the production version locally:

```bash
npm run build
npm start
```

---

## 🏠 Local-First Architecture

TrainGrid is currently designed as a **local, single-user application**.

It runs on a Node.js server and stores training data directly on a writable filesystem.

That means:

- no account required
- no authentication
- no database
- no cloud sync
- no external storage dependency

Because TrainGrid writes directly to `data/`, it requires a runtime with **persistent writable disk access**.

It is therefore not intended for read-only/static hosting or serverless environments where filesystem writes are temporary.

---

## 📱 Using TrainGrid on Your Phone

You can access TrainGrid from another device on the same local network.

Start the development server on all network interfaces:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open:

```text
http://<your-lan-ip>:3000
```

from your phone or another device connected to the same network.

> ⚠️ TrainGrid currently has no authentication. Keep the application on a trusted local network and do not expose the writable instance directly to the public internet.

---

## 💾 Local Persistence

TrainGrid stores templates and scheduled sessions as human-readable local files.

| Path | Purpose |
| --- | --- |
| `data/templates/*.md` | Reusable session templates |
| `data/schedule.json` | Your scheduled training sessions |
| `data/schedule.example.json` | Example empty schedule structure |

Session templates use Markdown with frontmatter, making them easy to read and edit even outside the application.

For example:

```md
---
id: lower-a
name: Lower A
type: strength
---

# Lower A

## Back Squat

3 × 6–8

## Romanian Deadlift

3 × 8–10
```

If `data/schedule.json` does not exist when TrainGrid starts, the planner simply begins with an empty calendar.

Changes made through the application persist across Node process restarts because they are written back to the local filesystem.

### Backing Up Your Plan

There is no application-level backup system in the MVP.

To back up TrainGrid, simply copy or version your local `data/` directory.

Personal schedule data is intentionally excluded from the public Git repository.

---

## 📁 Project Structure

```text
traingrid/
├── app/                    # Next.js App Router pages and API routes
├── components/             # Planner and reusable UI components
├── lib/                    # Domain logic, persistence and server utilities
│
├── data/
│   ├── templates/          # Reusable seed session templates
│   └── schedule.example.json
│
├── e2e/                    # Playwright end-to-end tests
├── public/                 # Static assets
│
├── REQUIREMENTS.md         # Product requirements
├── UX_SPEC.md              # Planner and interaction specification
├── TECHNICAL_DESIGN.md     # Architecture and persistence decisions
├── MVP_CHECKLIST.md        # MVP acceptance criteria
├── DATA_FORMAT.md          # Template and schedule file formats
├── TEST_PLAN.md            # Test strategy
├── TEST_RESULTS.md         # Validation results
│
├── package.json
├── .gitignore
└── README.md
```

Agent-specific planning and review files are kept locally under `.agent/` and are intentionally excluded from Git.

---

## 👨‍💻 Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |

When running Playwright, stop any other TrainGrid development server first if it is using the same port.

---

## 🧪 Testing

TrainGrid includes both unit and end-to-end coverage.

### Unit Tests

Run:

```bash
npm test
```

Coverage includes core behaviour such as:

- calendar/week calculations
- session template vs scheduled-session behaviour
- duplicate-week logic
- schedule persistence and domain rules

### End-to-End Tests

Run:

```bash
npm run test:e2e
```

Playwright validates major user journeys such as:

- creating the first training plan
- scheduling running sessions
- managing multiple sessions on the same day
- rescheduling sessions
- duplicating a training week
- persistence across planner interactions

E2E tests use an isolated data directory through `TRAINGRID_DATA_DIR`, so they do not modify your real training plan.

For more detail, see:

- `TEST_PLAN.md`
- `TEST_RESULTS.md`
- `DATA_FORMAT.md`

---

## ✅ Status

**MVP Complete**

The initial TrainGrid scope has been implemented and validated:

```text
📅 7-Day Weekly Planner
+
🕒 Time-Slot Scheduling
+
📚 Reusable Session Templates
+
✏️ Session & Workout CRUD
+
📆 Duplicate Week
+
💾 Local File Persistence
+
🧪 Automated Testing
```

TrainGrid remains intentionally **local-first and planning-focused**.

Cloud sync, accounts, authentication, fitness-platform integrations, and advanced analytics are outside the current MVP.
