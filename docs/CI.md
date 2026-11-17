# Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request to `main` and
on every push to `main`. It runs on Node 22 with `npm ci`, and has read-only access to the
repository (`permissions: contents: read`). It uses no production secrets: the build needs none,
and the test jobs use the fixed development keys of a local Supabase stack started inside the job.

| Job | Runs |
| --- | --- |
| `checks` | `npm run lint`, `npm run typecheck`, `npm test`, `npm run scan:secrets`, `npm run build` |
| `database` | `npm run supabase:start`, then `npm run db:test` (pgTAP) and `npm run test:integration` |
| `e2e` | `npm run supabase:start`, `npm run build`, then `npm run test:e2e` with `E2E_SERVER=build` (Playwright, Chromium, against `next start`). A failed test is retried once and reported as flaky if it then passes. The report is uploaded as an artifact when the job fails. |

[`scripts/ci-supabase-env.sh`](../scripts/ci-supabase-env.sh) reads the local stack's URL,
publishable key and secret key from `supabase status` and hands them to the later steps. It
refuses any URL that is not `127.0.0.1` or `localhost`.

Not in CI yet: `npm run test:ui`, `npm run test:assets` and `npm run test:audit`. Run them locally
before a release (`npm run test:all` runs everything).

## Reproduce locally

Needs Node 22 and Docker.

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run scan:secrets && npm run build
npm run supabase:start
scripts/ci-supabase-env.sh > .env.local   # or copy the keys from npm run supabase:status
npm run db:test && npm run test:integration && npm run test:e2e
```

To run E2E exactly as CI does (production build, one retry):

```bash
npm run build && CI=1 E2E_SERVER=build npm run test:e2e
```

Without `E2E_SERVER=build`, Playwright starts `next dev`, which is handier while writing tests. CI
avoids it because `next dev` compiles each route on its first request, and on a CI runner that can
take longer than a test's timeouts.

`scripts/ci-supabase-env.sh > .env.local` overwrites an existing `.env.local`; it only ever writes
local-stack values.
