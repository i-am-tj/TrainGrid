# TrainGrid — Technical design

## Stack

| Dependency | Why |
| --- | --- |
| **Next.js** (App Router) | Routing, server-side file I/O, Server Actions to mutate `data/` without a separate API server. |
| **TypeScript** | Domain types for session template vs scheduled session. |
| **Tailwind CSS** | Layout (grid, responsive breakpoints) without a component library. |
| **gray-matter** | Parse YAML frontmatter from session template Markdown files. |
| **react-markdown** | Render workout Markdown on session detail. |

Not recommended for MVP:

| Avoid | Why |
| --- | --- |
| Prisma / Postgres / Supabase / Firebase | No multi-user or query needs. |
| Auth libraries | Single user, local files. |
| Zustand / Redux | Server reads files per request; client state is week/day UI only. |
| FullCalendar / big calendar kits | A CSS grid is enough. |
| dnd-kit | Drag-and-drop is out of MVP. |
| date-fns / luxon | A local `week.ts` util is enough. |
| MDX | Templates are data, not app pages. |
| Component libraries | Not required to ship a planner. |
| IndexedDB / localStorage as primary store | MVP persistence is the local `data/` folder (review accepted this for a local app). |

Node.js `fs/promises` via Server Actions. No database.

**Deployment constraint:** this architecture is valid for a **local (or self-hosted) Node process with a writable disk**. It is **not** valid on a read-only host that only serves a bundled app (typical static/CDN or serverless without a volume). Do not implement “edit Markdown at runtime” on such a host. Do not add a database to work around that; keep the app local-first.

---

## Project structure

```text
traingrid/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # current ISO week planner
│   ├── week/[weekId]/page.tsx   # weekId = 2026-W36
│   ├── session/[id]/page.tsx    # scheduled session
│   ├── library/page.tsx
│   ├── library/new/page.tsx
│   └── library/[templateId]/page.tsx
├── components/
│   ├── planner/…
│   ├── session/…
│   └── library/…
├── lib/
│   ├── domain.ts
│   ├── week.ts
│   ├── templates.ts             # read/write Markdown (fs)
│   ├── schedule.ts              # read/write JSON (fs)
│   └── resolve-session.ts
├── data/
│   ├── templates/               # session templates (*.md)
│   └── schedule.json            # scheduled sessions
└── (Phase 1 markdown docs)
```

`data/` is the runtime source of truth. Seed/default session templates may ship in `data/templates/` and are then **mutable** on disk. There is no separate “bundled read-only Markdown” layer in MVP.

---

## Domain / data model

```ts
type SessionType = "running" | "strength" | "plyometrics" | "other";

type SessionTemplate = {
  id: string;          // filename slug, immutable after create
  name: string;
  type: SessionType;
  body: string;        // Markdown; workout items are ## sections
                       // plus optional Equipment: / Video: lines
};

type ScheduledSession = {
  id: string;          // uuid
  name: string;        // always stored; required; used on cards and detail
  type: SessionType;   // copied at create; may be edited on the session
  weekId: string;      // "2026-W36"
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1 = Monday
  time: string | null; // "HH:mm" on 30-minute steps, or null = untimed
  durationMinutes: number | null; // metadata only; does not affect layout
  notes: string;
  templateId: string | null;      // null = ad-hoc
  bodySnapshot: string | null;    // non-null = this session owns body
};
```

**Session type vs equipment:** `SessionType` is the library category (running / strength / plyometrics / other). Equipment tags live on workout items. Library equipment filtering is a follow-up; type filters are enough for now.

**Resolved session** (view model for UI):

```ts
type ResolvedSession = ScheduledSession & {
  body: string;
  source: "template" | "snapshot" | "adhoc";
};
```

**Title rule:** `ScheduledSession.name` is the only display title. Never derive the title from Markdown.

**Body resolution:**

1. If `bodySnapshot` is non-null → use it. `source = snapshot` if `templateId` is set, else `adhoc`.
2. Else if `templateId` is set → load that session template’s **body** (not name). `source = template`. If the template file is missing, treat as error/empty body and keep the stored `name`.
3. Else → ad-hoc; `bodySnapshot` should already hold the body (may be empty string).

**Name / type vs template:** scheduling from a template **copies** `name` and `type` onto the scheduled session. Later template rename or type change does **not** update existing scheduled sessions. Later template **body** change **does** update live-linked sessions (`bodySnapshot === null`).

**Customize:** set `bodySnapshot` to the currently resolved body. `templateId` may remain for provenance; the UI treats the session as snapshotted (`source = snapshot`) and **does not** offer Open template unless `bodySnapshot` is null. Replace-template sets a new `templateId` and clears `bodySnapshot`.

**Delete session template:** for each scheduled session with that `templateId` and `bodySnapshot === null`, write current body into `bodySnapshot`, then delete the file. Keep `templateId` or set it null after copy — **MVP: set `templateId` to null** after snapshot so detail does not link to a missing template. `name` already on the scheduled session.

Workout items are not a second table. Parse only for display as Markdown.

---

## Persistence

### Session templates — Markdown + frontmatter

`data/templates/lower-a.md`

```md
---
id: lower-a
name: Lower A
type: strength
---

## Back Squat

3 × 6–8
```

Rules:

- Filename = `{id}.md`
- `id` immutable after create
- One session template per file
- Human-editable on the machine that runs the app
- Markdown is **runtime-writable storage** in this local architecture, and also the human-readable template format. It is not an export format and not documentation.

### Schedule — one JSON file

`data/schedule.json`

```json
{
  "sessions": [
    {
      "id": "3f2c…",
      "name": "VO2max",
      "type": "running",
      "weekId": "2026-W36",
      "day": 3,
      "time": "07:00",
      "durationMinutes": 60,
      "notes": "",
      "templateId": "vo2max",
      "bodySnapshot": null
    }
  ]
}
```

JSON key is `sessions` (scheduled sessions). Writes: read → mutate → write (optional temp-file rename). Single user; no concurrent writers.

### Import / export

Not in MVP. The files **are** the backup (`data/` copy, git, Syncthing, etc.). Do not add a JSON export UI unless a later phase needs browser-only persistence.

### Why not a database or browser storage as primary

The access pattern is load-this-week and load-this-template. Local files match editable Markdown. IndexedDB would be appropriate if the app were a static host with no disk writes; that is not the MVP target.

---

## Duplicate Week (data)

Server Action `duplicateWeek({ sourceWeekId, destWeekId })`:

- Reject if `sourceWeekId === destWeekId`.
- Load all scheduled sessions with `weekId === sourceWeekId`.
- For each, insert a clone: new `id`, `weekId: destWeekId`, all other fields copied (`name`, `type`, `day`, `time`, `durationMinutes`, `notes`, `templateId`, `bodySnapshot`).
- Do not modify source rows. Do not delete destination rows (append).
- Return the new ids; UI navigates to `destWeekId`.

---

## State management

- Server Components load `schedule.json` + templates for `weekId`.
- Server Actions: `addScheduledSession`, `updateScheduledSession`, `deleteScheduledSession`, `duplicateWeek`, `upsertTemplate`, `deleteTemplate`.
- URL: `/week/2026-W36` and optional `?day=3` for mobile.
- No global client store.

---

## Planner layout (implementation rules)

- Desktop: CSS grid, 8 columns, 24 hour rows. Container scrolls. Initial `scrollTop` aligns ~06:00.
- Card occupies its start-hour row only (`Math.floor(hour)`).
- Same-row sessions: stack in document order (sort by `time` then `id`).
- `durationMinutes` is not used for height or row span.
- Mobile: `DayAgenda` list; no 24-row grid.

---

## Component boundaries

| Component | Responsibility |
| --- | --- |
| `WeekGrid` | Desktop hours × days; no `fs`. |
| `DayAgenda` | Mobile list for one day. |
| `WeekStrip` | Mobile day jump. |
| `SessionCard` | Resolved scheduled session; links to detail. |
| `AddSessionForm` | Create scheduled session. |
| `SessionDetail` | Resolved body + actions. |
| `TemplateEditor` | Frontmatter + Markdown body. |
| `lib/templates.ts`, `lib/schedule.ts` | Only modules that touch `fs`. |

---

## Routing

| Route | Purpose |
| --- | --- |
| `/` | Current ISO week. |
| `/week/[weekId]` | Planner for that week (`?day=` optional). |
| `/session/[id]` | Scheduled session detail. |
| `/library` | Session template list + filters. |
| `/library/new` | Create session template. |
| `/library/[templateId]` | Edit session template. |

Breakpoint `md`: WeekGrid vs DayAgenda.

---

## Markdown

- Frontmatter via `gray-matter`.
- Body is opaque Markdown. Do not parse `3 × 6–8` into objects.
- `react-markdown` without raw HTML.

---

## Mobile vs desktop

- `md` (~768px): week grid. Below: agenda + week strip.
- Phone must open the running Next.js origin (`http://<lan-ip>:3000` if used on LAN). Document in README at implementation time.

---

## Important tradeoffs

| Choice | Benefit | Cost |
| --- | --- | --- |
| File-backed, no DB | Simple, git-friendly templates | Local/writable process only; no hosted static writes |
| Name on every scheduled session | Stable titles for ad-hoc and snapshots | Template rename does not rename existing cards |
| Live-link body + optional snapshot | Edit workout text once | Two body-edit paths |
| One-row cards, duration as label | No overlap layout | Duration is not a visual block |
| 24h scroll, untimed = no time only | Untimed lane stays meaningful | Users scroll for 05:00 / 22:00 |
| Duplicate Week vs RRULE | Simple copies | No “every Monday” automation |
| Forms vs drag-and-drop | Faster MVP, works on mobile | Extra taps to move |

---

## Security / privacy

- Bind localhost by default; LAN bind is a conscious choice.
- No auth does not mean public internet exposure.

---

## Implementation order (Phase 2)

1. Domain types + `week.ts` + seed session templates
2. Read-only planner (file read) with 24h grid + stacking + untimed lane
3. Library CRUD
4. Add/edit/delete scheduled sessions (including required `name`)
5. Session detail + Markdown render + live-link / snapshot
6. Duplicate Week
7. Mobile agenda + Today
8. Empty states
