# Roadmap

Last updated: 2026-11-18

TrainGrid is in invite-only early access. Releases follow SemVer ([docs/RELEASING.md](../docs/RELEASING.md));
member-facing notes are in [CHANGELOG.md](../CHANGELOG.md) and at `/whats-new`.

## Releases

| Version | Date | Highlights |
| --- | --- | --- |
| Unreleased | — | Profile page (What's new, privacy and terms move there for members), planner and home use the member's day even on the first request, simpler planner and home on phones. |
| `v1.0.0` | 2026-11-18 | First release for early-access members: landing page, member home, invitation emails, getting started, feedback, privacy/terms/What's new, installable app, error alerts, CI on every PR. |
| `v0.2.1-beta` | 2026-11-14 | Loaders and faster navigation. |
| `v0.2.0-beta` | 2026-11-13 | Invite-only multi-user foundation and the shared routine library (Epics 1 and 2). |

## What TrainGrid does today

| Area | Done |
| --- | --- |
| Access | Google and GitHub sign-in, invite-only; admins invite by email, see delivery status, revoke and restore access. Row Level Security on every table. |
| Home | Today's sessions, the week's planned counts, quick actions and the member's routines, each streaming on its own; first-visit welcome; getting started; release note. |
| Planner | Monday–Sunday grid on desktop, day view on phones; timed and untimed sessions; today follows the member's time zone. |
| Sessions | Add from scratch or from a routine (a snapshot copy), edit, customise the workout, delete. |
| Library | Shared TrainGrid routines and the member's own; search by name, exercise, type and equipment; copy to My Library; create and edit routines with sets, targets, rest, notes, equipment and video links. |
| Profile | Name, plan numbers, data download (JSON), appearance, time zone, sign out, What's new, privacy notice, terms. |
| Everywhere | Light and dark themes, phone layouts, installable app, feedback dialog, slow-loading notices with one retry, themed dialogs (no browser pop-ups), accessible to WCAG 2.2 AA in automated checks. |
| Operations | CI (lint, types, unit, database, integration, E2E) on every PR; tagged releases from CHANGELOG; structured error logs and optional alerts; `/api/health`. |

## Next

Not committed; ordered by what early-access members are likely to need first. Each becomes a
release when it ships.

| Idea | Why | Notes |
| --- | --- | --- |
| Edit display name on the profile | Members are greeted by their provider's name | `profiles.display_name` is already member-updatable (column grant). |
| Delete my account from the profile | Today it is an email to the owner (privacy notice) | Needs a security-definer function and a confirmation modal. |
| Repeat a session weekly | Replaces Duplicate week with something smaller | Must keep snapshots independent (D-03). |
| Exercise identity across routines | Enables “every time I did this lift” views | Deferred design D-04B in the decision history. |
| Multi-select equipment filter | Deferred in Epic 2 (E2-D08) | URL contract would change. |

## History

Epic plans, step-by-step reports and handoffs are archived in [archive/](archive/README.md):
Epic 1 (secure multi-user foundation), Epic 2 (shared library) and Epic 3 (product experience and
integrations), all complete.
