# 🏃 TrainGrid

**TrainGrid** is a lightweight training planner built for runners, lifters, and hybrid athletes who want one simple place to organise their week.

Plan your runs, strength sessions, plyometrics, warm-ups, and cooldowns in a **7-day time-slot-based calendar**, save reusable workout templates, and open any session whenever you need to see exactly what you're supposed to do.

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
- ⚡ Plan plyometric sessions
- 🔥 Reuse warm-up and cooldown templates
- 🏷️ Tag exercises with equipment
- ▶ Attach an optional YouTube demo to an exercise
- 🔁 Reuse saved session templates
- 🕒 Organise sessions by time
- 📋 Open any workout and see the full plan
- 📆 Duplicate a training week instead of rebuilding it

---

## 🗓️ What It Looks Like

```text
MONDAY
07:00  🏃 Speed / Power
18:00  🏋️ Lower B

TUESDAY
07:00  🏃 Easy Run
18:00  🏋️ Upper A

WEDNESDAY
07:00  🏃 VO2max
18:00  🏋️ Lower A

THURSDAY
        Recovery Run

FRIDAY
07:00  🏃 Tempo / Threshold
18:00  🏋️ Upper B

SATURDAY
07:00  🏃 Long Run

SUNDAY
        Rest
```

Open a session and TrainGrid simply tells you what to do — including optional equipment tags and a **Watch demo** link when you have saved a YouTube URL.

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
- YouTube search or the YouTube API

Those tools already exist and do those jobs well.

---

## 🧩 Core Concepts

### 📚 Session Templates

Library categories:

```text
🏃 Running
🏋️ Strength
⚡ Plyometrics
🔥 Other (warm-up & cooldown)
```

### 📆 Scheduled Sessions

Drop a template onto a specific day and time. Each scheduled session is independent.

### 📝 Workout Items

Markdown `##` sections plus optional **equipment** tags and an optional **YouTube URL**. Session category is not the same as equipment.

---

## 🛠️ Tech Stack

- [Next.js](https://nextjs.org/) 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS v4
- `gray-matter` for Markdown templates with frontmatter
- `react-markdown` for session content
- Vitest and Playwright

---

## 🚀 Getting Started

Requires Node.js 20+.

```bash
git clone https://github.com/i-am-tj/traingrid.git
cd traingrid
npm install
npm run dev
```

Open http://localhost:3000

```bash
npm run build
npm start
```

The app needs a **Node server with a writable disk**. It is not deployed on Vercel: serverless instances do not provide durable `data/` writes.

```bash
npm run dev -- --hostname 0.0.0.0
```

Then `http://<your-lan-ip>:3000`. There is no login; keep it on a trusted network.

---

## 💾 Local Persistence

| Path | Purpose |
| --- | --- |
| `data/templates/*.md` | Session templates (seed examples are in the repo) |
| `data/schedule.json` | Scheduled sessions (**not** committed) |
| `data/schedule.example.json` | Empty calendar example |

Workout items may include:

```text
Equipment: Dumbbell, Bench
Video: https://www.youtube.com/watch?v=…
```

Tests use `TRAINGRID_DATA_DIR` (`e2e/.data`) so they do not overwrite your planner files.

---

## 📁 Project Structure

```text
traingrid/
├── app/
├── components/
├── lib/
├── data/templates/
├── e2e/
├── REQUIREMENTS.md
├── UX_SPEC.md
├── TECHNICAL_DESIGN.md
├── DATA_FORMAT.md
└── README.md
```

---

## 👨‍💻 Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright (stop other `next dev` first) |

---

## ✅ Status

**MVP complete**, plus a richer training library (plyometrics, warm-up/cooldown, equipment tags, optional YouTube references).

TrainGrid remains **local-first and planning-focused**.
