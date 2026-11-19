# agents/ — working records

The plan and the reasoning behind TrainGrid. Product documentation is in [docs/](../docs/README.md).

| File | Purpose |
| --- | --- |
| [ROADMAP.md](ROADMAP.md) | Releases, what TrainGrid does today, and what may come next |
| [DECISIONS.md](DECISIONS.md) | The decisions still in force, one line each |
| [archive/](archive/README.md) | Completed epics: specifications, handoffs, step reports, full decision history |

Formal architecture decision records live in `docs/adr/`.

## Conventions

- One branch and one PR per change, `feat/<short-slug>` from `main`; releases use
  `feat/release-vX.Y.Z` ([docs/RELEASING.md](../docs/RELEASING.md)).
- A new decision gets a line in `DECISIONS.md` with the date; a decision that is replaced is
  removed from there (its history stays in the archive or in Git).
- Finished epic plans and handoffs move to `archive/`; they are not rewritten.
- Owner values: `Agent` (code and docs in this repo) or `Tanuj` (console work an agent must not do:
  cloud projects, OAuth credentials, secrets, repository settings, production data).
- Never write secrets, personal emails, user UUIDs or private schedule data into this folder.
