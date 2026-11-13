# TrainGrid docs

Project documentation lives here so the repository root stays focused on the app.

| Doc | Purpose |
| --- | --- |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | Product requirements |
| [UX_SPEC.md](./UX_SPEC.md) | UX and interaction model |
| [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) | Architecture, security model, data model, routing |
| [DATA_FORMAT.md](./DATA_FORMAT.md) | Database tables, snapshot and export formats, seed templates |
| [MVP_CHECKLIST.md](./MVP_CHECKLIST.md) | Historical: the original file-backed MVP checklist (Aug 2026) |
| [TEST_PLAN.md](./TEST_PLAN.md) | Test strategy and coverage |
| [TEST_RESULTS.md](./TEST_RESULTS.md) | Latest results |
| [SECURITY.md](./SECURITY.md) | Credentials, dev/prod separation, release checks, incident steps |
| [RELEASING.md](./RELEASING.md) | Versions and how a release is made at the end of each epic |
| [CONTENT.md](./CONTENT.md) | Maintaining the shared TrainGrid routines: templates, stable item ids, applying the seed |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Local Supabase stack, production project, environment variables |
| [adr/](./adr/) | Architecture decision records |
| [images/](./images/) | Screenshots used in the root README (mobile + desktop, Nov 2026) |

## How TrainGrid runs

- TrainGrid is an **invite-only** app at `train-grid.vercel.app`. Members sign in with Google or
  GitHub; an admin invites them by email.
- Data lives in **Supabase** (PostgreSQL with Row Level Security). Each member sees only their own
  calendar and routines; the shared routine library is read-only.
- Local development uses a local Supabase stack in Docker and never touches production data.
- The working records for Epic 1 (roadmap, backlog, decisions, security test matrix, story reports)
  are in [`agents/`](../agents/README.md).
