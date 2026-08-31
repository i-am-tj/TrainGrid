# Test results

Date: 31 Aug 2026

## Summary

| Suite | Result |
| --- | --- |
| Vitest (`npm test`) | **30 passed** (6 files) |
| Playwright (`npx playwright test`) | **11 passed** |
| MVP checklist | All implementation items **PASS** (see `MVP_CHECKLIST.md`) |

## Tests executed

### Unit (Vitest)

- ISO week Monday–Sunday, month/year boundary, 2020-W53 / 2026-W01, leap day 29 Feb 2024
- Previous/next week × 60 without corrupting Monday
- 30-minute times; `07:30` sits in hour 7
- Workout item parse/serialize, reorder, running session Markdown
- Live-link vs snapshot vs ad-hoc resolution; missing template keeps stored name
- Duplicate week copies with new ids; refuses same-week copy
- Backup JSON accept/reject (malformed, wrong version, invalid session)
- Name trim/cap; slug uniqueness; untimed-then-time sort

### End-to-end (Playwright)

- Journey 1 — Lower A template → schedule Monday 08:00 → open contents
- Journey 2 — VO2 running template → schedule Wednesday 07:00 → edit notes
- Journey 3 — Speed Run 07:00 + Lower B 08:30 → reschedule Lower B
- Journey 4 — Duplicate week → edit copy → original week unchanged
- Journey 5 — Export → wipe E2E data → import restores plan
- Invalid import JSON is rejected; existing template remains
- Seven-day planner + week navigation + Today
- Empty week / empty library
- Delete template; scheduled session still shows workout text
- Edit template body; live-linked session updates
- Mobile 390px: day nav, add control, no horizontal overflow

## Bugs discovered and fixed

| Bug | Fix |
| --- | --- |
| Invalid import could throw after starting a replace, and had no user-facing error | Parse/validate first (`parseBackupJson`); import returns `{ error }` without writing; banner on Import |
| Import used a data dir that could not be isolated in tests | `TRAINGRID_DATA_DIR` getters in `lib/paths.ts` |
| Invalid week ids / times could be stored | `coerceSession` requires ISO week + 30-minute times |
| Blank / huge names | `sanitizeName` (trim, max 200); form `maxLength` |
| “No specific time” matched Playwright `getByLabel('Time')` (substring) | Checkbox label is now **No start time** |
| Duplicate-week / backup logic was only inside Server Actions | Extracted `duplicateWeekSessions` and `parseBackupJson` for tests |
| Weak focus and small hit targets | `min-h-10` + `:focus-visible` ring |
| Unhandled action errors could surface raw exceptions | `app/error.tsx` with a safe message |

## Known limitations

- Next.js may log `The destination stream closed early` when a test downloads `/api/export`; the export file is still valid and Journey 5 passed.
- Vitest prints a Vite configLoader warning for `vitest.config.ts`; tests still run.
- Only Chromium is used in Playwright, not WebKit/Firefox.
- Screen-reader and colour-contrast audits were not run with dedicated a11y tooling.
- Timezone matrix is not CI-parameterised; week math uses local year/month/day, not UTC instants.
- E2E does not populate a full Mon–Sun sample week in one test; duplicate-week is covered with a single Easy Run plus unit tests for the copy function.

## Untested / light coverage

- Keyboard-only full-app tour
- Import of a backup with mixed valid/invalid rows (whole file is rejected — covered in unit tests)
- 05:00 / 22:00 on the scrolled grid (unit tests cover hour mapping; E2E uses 07:00–18:00)
- Simultaneous two-server writes to `schedule.json`
