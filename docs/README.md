# TrainGrid docs

Project documentation lives here so the repository root stays focused on the app.

| Doc | Purpose |
| --- | --- |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | Product requirements |
| [UX_SPEC.md](./UX_SPEC.md) | UX and interaction model |
| [TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md) | Architecture and persistence |
| [DATA_FORMAT.md](./DATA_FORMAT.md) | Template and schedule file shapes |
| [MVP_CHECKLIST.md](./MVP_CHECKLIST.md) | MVP acceptance checklist |
| [TEST_PLAN.md](./TEST_PLAN.md) | Test strategy |
| [TEST_RESULTS.md](./TEST_RESULTS.md) | Latest validation notes |
| [images/](./images/) | Screenshots used in the root README (mobile + desktop) |

## Hosted / published behaviour

TrainGrid is **edit locally, publish via Git**.

- Seed templates ship in `data/templates/`.
- The default `data/schedule.json` is **empty**.
- A hosted site (for example Vercel) is **read-only** and shows only committed schedule data.
- Visitors should **clone or fork and deploy their own instance** to plan training.
- The owner updates the plan with `npm run dev`, then commits and pushes `data/` to publish.
