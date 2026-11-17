# Releasing

A release is a Git tag and a GitHub release whose notes come from [CHANGELOG.md](../CHANGELOG.md);
the same notes appear in the app at `/whats-new`. Deployment is separate: Vercel deploys `main` on
every merge, and production database changes are applied by the owner (see `supabase/README.md`).

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
   - apply any new migrations in `supabase/migrations/` to the production project **before or
     with** the deploy, and check Supabase → Advisors;
   - set any new environment variables in Vercel (Production) and redeploy;
   - smoke test: `/` loads signed out, sign-in lands on `/home`, the planner and library load,
     Feedback sends, `/api/health` answers `200`.
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
- Record each release in `agents/ROADMAP.md`.
