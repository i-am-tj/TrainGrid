# Continuous integration

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request to `main` and
on every push to `main`. It runs on Node 22 with `npm ci`, and has read-only access to the
repository (`permissions: contents: read`). It uses no production secrets: the build needs none,
and the test jobs use the fixed development keys of a local Supabase stack started inside the job.

| Job | Runs |
| --- | --- |
| `checks` | Lint, typecheck, unit tests, secret scan, production dependency audit, static asset budget and production build. |
| `database` | Fresh local stack, exact schema manifest, pgTAP and authenticated integration tests. |
| `e2e` | Production build, Chromium E2E with `E2E_SERVER=build`, component UI suite and production accessibility/performance audit. The E2E suite retries a failure once. A failing job uploads the available Playwright results and UI audit evidence. |

[`scripts/ci-supabase-env.sh`](../scripts/ci-supabase-env.sh) reads the local stack's URL,
publishable key and secret key from `supabase status` and hands them to the later steps. It
refuses any URL that is not `127.0.0.1` or `localhost`.

The three browser suites run sequentially in the same job. The production audit reuses its
local database and optimized build. Run `npm run test:all` for the local product suites and
`npm audit --omit=dev` for the production dependency check.

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
