# Releasing

A release is a Git tag and a GitHub release whose notes come from [CHANGELOG.md](../CHANGELOG.md);
the same notes appear in the app at `/whats-new`. Deployment is separate: Vercel deploys `main` on
every merge, and production database changes are applied by the owner (see `supabase/README.md`).

## Changes that need a migration

Merging is deploying: Vercel puts every merge to `main` live within a minute. So a PR whose code
needs a new migration merges only **after** that migration is on production. Otherwise the new
build runs against the old schema until someone applies it.

For such a PR:

1. Write the migration so the build that is live now keeps working with it: add columns and
   parameters with defaults, never drop or rename something the live build uses. A change that
   cannot be made that way is split across two PRs: the first adds the new shape, the second,
   merged after the first is live, removes the old one.
2. Say in the PR description which migration it needs, and that the live build works with it.
3. When the PR is reviewed and CI is green, apply the migration to production from the PR's
   branch, up to date with `main` (`supabase/README.md`). The dry run must list only this PR's
   migrations; if it lists others, production is behind `main`, so stop and find out why first.

   ```bash
   npx supabase db push --remote --dry-run
   npx supabase db push --remote
   ```

4. Merge. Once Vercel has deployed, `/api/health` answers `200` with `"schema":"ok"`.

If the PR is then closed instead, its migration stays on production but not in `main`: undo it with
a new migration in a PR of its own.

On 25 November 2026, #95 merged before its migration was applied. Its build was live for about 27
minutes against a schema without the column it reads, so starting, saving and finishing workouts could not
work until the migration was applied. The same push also applied two migrations from #86, merged
on 23 November without reaching production; the dry run in step 3 catches that.

## Versions

[Semantic Versioning](https://semver.org/). TrainGrid reached **1.0.0** on 18 November 2026, its
first release for early-access members. From then on:

| Change | Version | Example |
| --- | --- | --- |
| New things members can do | next minor | `1.1.0` |
| Fixes and polish only | next patch | `1.0.1` |
| A change that breaks how members work, or their exported data | next major | `2.0.0` |
| A preview for testing before a release | pre-release suffix | `1.1.0-rc.1` |

Before 1.0, each epic was a `0.x.0-beta` minor and fixes were patches; those tags stay as they are.
The product shows **Early access** while access is by invitation; that label is not part of the
version.

Tags are the version with a `v` in front (`v1.0.0`). A version with a `-` suffix is published as a
GitHub **pre-release**; anything else is a full release.

## Making a release

After the release's last PR is merged:

1. On a branch `feat/release-vX.Y.Z` from `main`:
   - set the version with `npm version X.Y.Z --no-git-tag-version` (updates `package.json` and
     `package-lock.json`);
   - rename `## [Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] — YYYY-MM-DD`, written for members
     (what they can now do), with a `### For maintainers` group for everything else (it is left
     out of `/whats-new`); add a new empty `## [Unreleased]` above it and a link line at the bottom;
   - refresh the screenshots if screens changed: `npm run screenshots`.
2. Open a PR, check CI is green, review and merge it.
3. Production checklist (owner):
   - check that every migration in `supabase/migrations/` is on the production project (`npx
     supabase db push --remote --dry-run` lists none). Each should have been applied before its PR
     merged ([Changes that need a migration](#changes-that-need-a-migration)). Check Supabase →
     Advisors;
   - **schema gate**: check that production has every table, column and function `main` needs.
     It only reads the Data API's schema, and exits non-zero (listing what is missing) when a
     migration has not been applied. Do not deploy, or roll back, until it passes:

     ```bash
     NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SECRET_KEY=<secret key> npm run release:check
     ```

   - set any new environment variables in Vercel (Production) and redeploy;
   - `/api/health` answers `200` with `{"supabase":"ok","schema":"ok"}`. A `503` with
     `"schema":"behind"` means Auth is up but a migration is missing (the planner would fail);
     `"schema":"unknown"` means the deployment has no secret key or the Data API did not answer;
   - smoke test with a member account, on a phone: `/` loads signed out, sign-in lands on
     `/home`; in Library, schedule a TrainGrid routine for **next week**, reload and find it in
     the planner on that day; start it, leave, **Resume** it from its session page and finish;
     start a quick workout from Home and find it on the calendar; download the data from
     Profile; Feedback sends. Delete the test sessions afterwards.

   The same journey runs in CI on a fully migrated local stack
   (`tests/integration/release-journey.test.ts`), and CI fails if
   `lib/release/schema-manifest.json` does not match the migrations (`npm run release:check --
   --exact`). After adding a migration, apply it locally and run
   `npm run release:check -- --write` to update the manifest.
4. Tag the merge commit on `main` and push the tag:

   ```bash
   git switch main && git pull
   git tag -a vX.Y.Z -m "TrainGrid vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. The **Release** workflow (`.github/workflows/release.yml`) checks that the tag matches
   `package.json`, takes the tag’s section from `CHANGELOG.md`, and creates the GitHub release.
   Check it at https://github.com/i-am-tj/TrainGrid/releases.

If the workflow fails (for example, the tag does not match `package.json`), delete the tag
(`git push origin :refs/tags/vX.Y.Z` and `git tag -d vX.Y.Z`), fix it in a PR, and tag again.
Never move a tag that has a published release.

## Rules

- Release notes contain no secrets, personal emails, user ids or private schedule data.
- A release never runs database migrations or seeds; it only records what is on `main`.
- A PR that needs a migration merges only after the migration is on production.
- Record each release in `agents/ROADMAP.md`.
