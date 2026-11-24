# TrainGrid QA context

Verified on 24 November 2026 against main at `2547e5c`. Refresh the environment and test counts when using this context for another release. [System audit](../docs/SYSTEM_QUALITY_AUDIT.md)

## Product and stack

Invite-only web application for planning, logging and optionally sharing training. Highest-impact journeys are admission/revocation, private schedule access, workout persistence, social visibility and export. The lockfile resolves Next.js 16.4.6, React 19.2.8, TypeScript 5.9.3, Supabase SSR 0.12.7 and CLI 3.1.0. PostgreSQL 17 and PostgREST enforce the data boundary. Shared templates and user-owned records have different write rules.

## Environments and conventions

Use a clean checkout, a separately named local Supabase project, dedicated ports and synthetic members. Browser tests use a loopback Next server, a local mail mock, a fixed synthetic admin and role-based locators. Only a separately authorized release operator changes hosted data. The public health endpoint exposes coarse connectivity and schema status. Preview project settings and provider consoles require owner verification.

## Test stack and CI

Vitest 4.1.12 runs pure tests in lib and real API tests in tests/integration. pgTAP checks the effective migrated catalog and role behavior. Playwright 1.62.1 and axe-core 4.13.0 exercise component previews and the optimized app. GitHub Actions uses Node 22, npm ci and disposable databases. Run integration and browser suites sequentially per local stack because integration tests temporarily create GLOBAL routines.

## Quality goals and risk

Prioritize access isolation and preservation of member data. Require evidence from actual database roles, independent accounts and retries where appropriate. Treat skips, retries and unverified operator settings as distinct outcomes. The audit records observed coverage and a risk matrix. Field performance targets, incident rates, team size and a formal release SLO were not supplied. The release operator owns hosted checks. Reassess when auth, ownership rules, migrations or hosting change and after an incident.
