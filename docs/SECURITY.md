# Security operations

How TrainGrid keeps credentials out of Git, separates development from production, and what to
check before a release. The security model itself (invite-only access, Row Level Security) is in
[ADR 001](adr/001-multi-user-supabase-architecture.md).

## Credentials and where they live

| Credential | Kind | Lives in | Never in |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Vercel (Production), `.env.local` (local stack) | — |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public by design | Vercel (Production), `.env.local` (local stack) | Git (production value) |
| `SUPABASE_SECRET_KEY` | Secret; bypasses RLS | Vercel (Production, type **Secret**) | Git, browser bundles, Preview, chat, logs |
| `TRAINGRID_ADMIN_USER_IDS` | Server-only config | Vercel (Production) | Git |
| Supabase database password | Secret | Password manager | Anywhere else |
| Google OAuth client secret | Secret | Supabase dashboard (Google provider) | Git, Vercel |
| GitHub OAuth client secret | Secret | Supabase dashboard (GitHub provider) | Git, Vercel |

The keys printed by the local Supabase stack (`npm run supabase:status`) are fixed development
defaults that only work on your own machine. They live in `.env.local`, which Git ignores.

Git ignores `.env`, every `.env.*` except `.env.example`, `.vercel/`, `supabase/.temp/` and
`.agent/`. `.env.example` holds names and placeholders only.

## Development and production are separate

| Where | Supabase it talks to | Can it reach production data? |
| --- | --- | --- |
| Your machine, tests | Local stack in Docker | No: production values are never in `.env.local` |
| Vercel Preview | None (no Supabase variables) | No. Previews are also behind Vercel Authentication |
| Vercel Production | The TrainGrid project | Yes |

Production schema changes happen only through `npx supabase db push --remote`, run deliberately by
the project owner after a dry run (see `supabase/README.md`).

## Checks

```bash
npm run scan:secrets              # current files
npm run scan:secrets -- --history # every commit on every branch
npm audit --omit=dev              # production dependencies
npm run test:all                  # lint, typecheck, unit, database, integration, E2E, build
```

`scan:secrets` looks for Supabase secret and publishable keys, JWTs, private keys, GitHub tokens,
Google OAuth secrets and API keys, AWS keys, database URLs with passwords, and secrets assigned in
env files. It prints matches redacted and exits non-zero if it finds any. It is a guard rail;
GitHub secret scanning is the primary control.

After `npm run build`, the secret key must not appear in `.next/static`:

```bash
grep -rl "SUPABASE_SECRET_KEY" .next/static   # must print nothing
```

## GitHub repository settings

In GitHub → the repository → Settings → Advanced Security (or "Code security"), enable:

- [ ] Dependency graph
- [ ] Dependabot alerts
- [ ] Dependabot security updates
- [ ] Secret scanning
- [ ] Push protection

All are free for public repositories. If push protection blocks a push, **stop**: do not bypass it
unless you are certain the match is not a real credential.

## Vercel settings

In Vercel → TrainGrid → Settings:

- [ ] Environment Variables: all four TrainGrid variables are ticked for **Production only**;
      `SUPABASE_SECRET_KEY` has type **Secret**.
- [ ] Deployment Protection: Vercel Authentication stays on for Preview deployments.
- [ ] No Supabase–Vercel integration is connected (it would sync credentials into every environment).

## If a secret is exposed

Deleting the line in a new commit is not enough: it stays in Git history and may already be copied.

1. **Rotate it immediately.**
   - Supabase secret key: Supabase → Project Settings → API Keys → create a new secret key, then
     delete the exposed one.
   - Database password: Supabase → Project Settings → Database → reset password.
   - OAuth client secret: regenerate it in Google Cloud Console or GitHub, then paste the new one
     into the Supabase provider page.
2. **Replace it where it is used**: update the Vercel variable (or the Supabase provider) and
   redeploy.
3. **Remove it from history** if it was committed: rewrite history (for example with
   `git filter-repo`) and force-push, then ask GitHub support to purge cached views. Rotation in
   step 1 is what actually protects you; history cleanup only limits further copies.
4. Record what happened, when, and what was rotated.

## Linked sign-in identities: the canonical email rule

Supabase Auth **links** a new Google or GitHub sign-in to an existing user when its verified email
matches the email of any identity that user already has. It then issues an ordinary session for
that **user**. Row Level Security sees only `auth.uid()`, so a linked identity with another address
used to have the member's full access.

We cannot safely tell *which* identity a session came from. The access token hook receives no
identity or provider id. The only per-sign-in signal, `raw_user_meta_data.sub`, can be edited by
the user, and with concurrent sign-ins the last one to write it wins. Both were shown in review.
So TrainGrid does not try (decision E2-D22).

**Rule:** every identity linked to a member's account must carry the member's **canonical email**,
the invitation address they accepted. It is stored in `profiles.canonical_email` (members cannot
change it) and never read from `auth.users.email`, which a user can ask to change. If any identity
has another address, or none, the **whole account** is locked, for every session, until the
identity is removed. Linking a different address is not supported (deferred).

| Where | What it does |
| --- | --- |
| `account_status()` / `is_member()` | `member` only if the profile is live, every identity is on the canonical email, **and** the token's `session_id` still exists in `auth.sessions`. Every member-data policy uses `is_member()`, so this applies to direct REST calls and to tokens issued earlier. A signed-out session's token stops working on the next query. |
| `accept_invitation()` | Does not make a member of an account that also has an identity on another address. Records the canonical email. |
| App | A locked member is sent to **Sign-in methods**. It reads identities from Supabase Auth's own account API, offers **Remove** (`unlinkIdentity()`) only for identities on another address, and **Sign out of other devices**. |
| Invite check | The admin page refuses to invite an address that is already a linked identity of another account. |

No auth hook and no Supabase Auth setting is involved. While locked, the holder of a stray identity
still gets a session but reads nothing. They can still use Supabase's self-service account
endpoints, so two production settings matter:

- **Email sign-in must stay off** (Authentication → Sign In / Providers → Email). Otherwise a stray
  session could set a password and use it after the cleanup.
- **Secure email change must stay on.** An email change then needs confirmation from both addresses.

**Manual Linking stays off** except during a supervised cleanup. `unlinkIdentity()` needs it, and
while it is on, a stray session could also unlink identities (denial of service only).

### Deploying the rule (owner)

1. Read-only pre-checks in the SQL editor:
   ```sql
   select p.id, p.revoked_at is not null as revoked,
     (select count(*) from public.invitations i where i.accepted_by = p.id) as accepted_invitations,
     coalesce(u.encrypted_password, '') <> '' as has_password,
     (select count(*) from auth.identities x
       where x.user_id = p.id and lower(coalesce(x.email, '')) <> lower(coalesce(u.email, ''))) as identities_on_other_address
   from public.profiles p join auth.users u on u.id = p.id;
   ```
   Expect `has_password = false` everywhere. An account with `identities_on_other_address > 0`
   is locked by the deploy until it is cleaned up.
2. Check that the Email provider is off and Secure email change is on.
3. Dry run, then apply: `npx supabase db push --remote --dry-run`, then without `--dry-run`.
   Deploy the app at the same time (merging to `main` does this).
4. Smoke test: an ordinary member signs in and sees their data. A locked account lands on
   Sign-in methods.

Rollback: restore `is_member()` and `accept_invitation()` from
`20261112040000_revoke_members.sql` in a new migration. The added column and functions are
harmless.

### Cleaning up a locked account (owner, supervised)

1. Turn **Manual Linking on**, for the cleanup only.
2. Sign in with the identity on the canonical email. The account is locked, so the app opens
   Sign-in methods.
3. **Remove** every identity with a different address. Check afterwards: an address left on any
   remaining identity would let the same sign-in **link back** automatically, and the account
   would lock again.
4. **Sign out of other devices.** Removing the stray identity unlocks the account for *every*
   session, including any the stray sign-in opened. Signing out others deletes those sessions, so
   their access tokens fail at once (session check) and cannot refresh. This step is required.
5. Turn **Manual Linking off**.
6. Read-only checks: one identity per address, one session, `has_password = false`.
7. Delete anything created through the stray identity, and record what happened.

A provider account that knows both addresses (GitHub lists all of an account's verified emails)
may later link to either account, or be refused as ambiguous. Keep one address on it, or do not
use it to sign in.

### Incident 2026-11-13: routines from a "second account" in Mine

Three identical routines appeared in the admin's **Mine** view, created from a phone signed in
with a second Gmail address that the admin had invited as a separate member. Read-only queries
(ids, timestamps and providers only) showed:

- The rows' owner was the admin's own user id. RLS was correct and no other user's data was read.
- On 12 Nov, the admin's GitHub identity was linked to the admin account. Its email is the second
  address.
- On 13 Nov at 11:59 UTC, the phone's Google sign-in for the second address was **linked into the
  admin account** through that GitHub email. The invitation was never used.
- Review of the fix found two flawed designs before this one:
  - a check in `accept_invitation()`, which was advisory and bypassed through the REST API
  - per-identity approval in an access token hook, whose identity attribution came from
    user-editable, racy metadata

  Both were reproduced in tests and replaced by the canonical email rule.

Owner follow-up after deploying: on Sign-in methods, remove the phone's Google identity **and** the
GitHub identity (both carry the second address), then sign out of other devices. Sign in on the
phone again to create the separate account, and delete the duplicate routines.

## Dependencies

- `npm audit --omit=dev` must report no vulnerabilities before a release.
- Dependabot security updates raise pull requests for vulnerable dependencies; review them like any
  other change and run `npm run test:all`.
- Known and accepted: moderate advisories in the lint toolchain (`typescript-eslint`, `minimatch`
  through `eslint-config-next`). They affect only linting on a developer machine; npm's suggested
  fix is a downgrade to the Next 15 config, which is wrong for this app. Revisit when a patched
  `typescript-eslint` is released.
