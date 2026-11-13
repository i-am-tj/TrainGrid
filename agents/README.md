# agents/ — working records

Living records for multi-step epics. Product documentation stays in `docs/`; this folder holds
the plan, the state of the work, and the reasoning behind it.

| File | Purpose |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | Epics and the ordered PR steps for the current epic, with status |
| [BACKLOG.md](BACKLOG.md) | Every user story: status, owner, which PR step delivers it |
| [DECISIONS.md](DECISIONS.md) | Locked, approved, deferred and proposed decisions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current-state inventory and target architecture |
| [TEST_PLAN.md](TEST_PLAN.md) | Test layers and the release-blocking security matrix |
| [STORY_REPORTS.md](STORY_REPORTS.md) | Completion report per story, and the epic completion report |
| [EPIC-1.md](EPIC-1.md) | Epic 1 specification, verbatim (complete) |

Formal architecture decision records live in `docs/adr/`.

## Conventions

- One branch and one PR per roadmap step: `epic-<n>/NN-short-slug`, branched from `main`.
- Each epic's records are appended under its own heading; earlier epics' history is never rewritten.
  Specifications: `EPIC-1.md` (complete), `EPIC-2.md` (in progress).
- A step is done only when its PR is merged and its report is appended to `STORY_REPORTS.md`.
- Status values: `TODO`, `IN PROGRESS`, `BLOCKED`, `IN REVIEW`, `DONE`.
- Owner values: `Agent` (code/docs in this repo) or `Tanuj` (console work an agent must not do:
  creating cloud projects, OAuth credentials, entering secrets, repository settings).
- Never write secrets, personal emails, user UUIDs or private schedule data into this folder.
- Epic specifications are saved verbatim as `agents/EPIC-<n>.md`; decisions that refine them are
  recorded in `DECISIONS.md`.
