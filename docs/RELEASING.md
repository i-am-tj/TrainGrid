# Releasing

TrainGrid has one release per epic. A release is a Git tag and a GitHub release whose notes come
from [CHANGELOG.md](../CHANGELOG.md). Deployment is separate: Vercel deploys `main` on every
merge, and production database changes are applied by the owner (see `supabase/README.md`).

## Versions

[Semantic Versioning](https://semver.org/), with `0.x` while TrainGrid is in beta:

| Change | Version | Example |
| --- | --- | --- |
| An epic is complete | next minor | Epic 3 → `0.3.0-beta` |
| Fixes between epics | next patch | `0.3.1-beta` |
| Leaving beta | `1.0.0` | when the owner decides |

Tags are the version with a `v` in front (`v0.3.0-beta`). A version with a `-` suffix is published
as a GitHub **pre-release**.

## Making a release

At the end of each epic, after its last PR is merged and its production smoke test has passed:

1. On a branch `release/vX.Y.Z-beta` from `main`:
   - set `"version"` in `package.json` (and `package-lock.json`, with
     `npm version X.Y.Z-beta --no-git-tag-version`);
   - add a `## [X.Y.Z-beta] — YYYY-MM-DD` section at the top of `CHANGELOG.md`, written for
     members (what they can now do), plus a link line at the bottom.
2. Open a PR, review and merge it.
3. Tag the merge commit on `main` and push the tag:

   ```bash
   git switch main && git pull
   git tag -a vX.Y.Z-beta -m "TrainGrid vX.Y.Z-beta"
   git push origin vX.Y.Z-beta
   ```

4. The **Release** workflow (`.github/workflows/release.yml`) checks that the tag matches
   `package.json`, takes the tag's section from `CHANGELOG.md`, and creates the GitHub release
   (a pre-release for `-beta` versions). Check it at
   https://github.com/i-am-tj/TrainGrid/releases.

If the workflow fails (for example, the tag does not match `package.json`), delete the tag
(`git push origin :refs/tags/vX.Y.Z-beta` and `git tag -d vX.Y.Z-beta`), fix it in a PR, and tag
again. Never move a tag that has a published release.

## Rules

- Release notes contain no secrets, personal emails, user ids or private schedule data.
- A release never runs database migrations or seeds; it only records what is on `main`.
- Record each release in `agents/ROADMAP.md` next to its epic.
