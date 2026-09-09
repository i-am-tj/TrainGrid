# Test plan

## Strategy

Phase 3 checks that the planner matches Phase 1 behaviour, not implementation trivia.

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest | ISO weeks, times, workout Markdown, equipment/YouTube metadata, template vs scheduled session, duplicate week, backup parse, names/slugs |
| End-to-end | Playwright | Critical journeys, plyometrics filter, equipment + Watch demo |
| Manual | Browser | Desktop density, keyboard focus, contrast (already improved in this phase) |

E2E runs against a throwaway directory (`e2e/.data` via `TRAINGRID_DATA_DIR`) so it does not overwrite `data/`.

## Coverage map

1. Weekly planner — Playwright 7-day headings; Vitest dates, month/year/leap, week navigation round-trip
2. Time slots — Vitest `07:30` → hour 7; E2E 07:00 / 08:00 / 08:30 / 18:00
3. Library CRUD — E2E create/read/update/delete
4. Workout items — Vitest parse/serialize/reorder; E2E add multiple items
5. Running / strength templates — E2E journeys 1–2
6. Scheduling / instances — E2E schedule twice, reschedule one, live-link vs snapshot vs delete-template
7. Duplicate week — Vitest copy semantics; E2E journey 4
8. Persistence — file writes + E2E reload via navigation
9. Import/export — Vitest parse; E2E journey 5 + invalid JSON
10. Empty states — E2E
11. Validation — Vitest names/times; server sanitizes names; HTML `required` / `maxLength`
12. Dates — Vitest local calendar dates, no UTC day shift in helpers
13. Mobile — Playwright 390×844, no horizontal overflow, day nav
15. Equipment / YouTube — Vitest parse/serialize; E2E Watch demo + Barbell tag
16. Categories — Plyometrics present, Mobility absent

## Out of scope for automation

- Exhaustive screen-reader pass
- Every timezone in CI (dates are local `Date` components)
- Visual regression screenshots
- Concurrent two-process file writes
