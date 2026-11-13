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
the invitation address they accepted, and at least one **Google or GitHub** identity must be on
it. The canonical email is stored in `profiles.canonical_email` (members cannot change it) and is
never read from `auth.users.email`, which a user can ask to change. If any identity has another
address or none, or no Google/GitHub identity carries the canonical email, the **whole account is
locked**, for every session, until it is put right. Linking a different address is not supported
(deferred).

| Where | What it does |
| --- | --- |
| `account_status()` / `is_member()` | `member` only if the profile is live, the token's `session_id` still exists in `auth.sessions`, every identity is on the canonical email, and a Google/GitHub identity is on it. Every policy on `routines`, `workout_items`, `scheduled_sessions` and `profiles` (update) requires `is_member()`. Reading one's own profile requires `account_status()` to be `member` or `revoked`. So the rule covers direct REST calls, tokens issued earlier and refreshed tokens (a database test checks the policies). A signed-out session's token stops working on the next query. |
| `accept_invitation()` | Does not make a member of an account that also has an identity on another address. Records the canonical email. |
| App | A locked member is sent to **Sign-in methods**. It reads identities from Supabase Auth's own account API, offers **Remove** (`unlinkIdentity()`) only for identities on another address, and **Sign out of other devices**. The export answers 401. |
| Invite check | The admin page refuses to invite an address that is already a linked identity of another account. |

No auth hook and no Supabase Auth setting is involved.

### What a locked session can still do (residual risk)

A locked account reads and writes **no TrainGrid data**. But Supabase Auth still accepts that
session on its own account endpoints, because they do not consult our tables. A person holding a
stray identity can:

| Through Supabase Auth | Effect | Condition / mitigation |
| --- | --- | --- |
| Refresh the session | Gets new tokens that read nothing. | Ended by "Sign out of other devices". |
| `getUser()`, `getUserIdentities()` | Sees the account email and the email of every linked identity, including the owner's. | Not preventable without an auth hook; accepted. |
| `updateUser({ data })` | Edits user metadata. | Harmless: TrainGrid never uses metadata for access. |
| `updateUser({ password })` | Sets a password on the account. | A way back in after cleanup **only if the Email provider is on**. Keep it **off**, and the preflight checks that no account has a password. |
| `updateUser({ email })` | Asks to change the account email. | Needs confirmation from both addresses while **Secure email change** is on (keep it on). It does not affect the rule, which uses the stored canonical email. |
| `signOut({ scope: 'global' })` | Ends the owner's sessions too. | Denial of service only. |
| `unlinkIdentity()`, `linkIdentity()` | Removes or adds identities on the account. | Only while **Manual Linking** is on, so keep it off outside a cleanup. Removing the owner's Google identity would leave the account locked (no Google/GitHub identity on the canonical email), not open it. |
| MFA enrolment | Adds a factor to the account. | If MFA is enabled for the project, a stray factor could get in the owner's way. The preflight lists factors. TrainGrid does not use MFA. |

### Deploying the rule (owner)

1. **Read-only preflight** in the SQL editor. `canonical` below is the **same expression the
   migration stores** (`20261113000000_canonical_email.sql`, the backfill): the most recent
   accepted invitation, live ones first, else the account email.
   ```sql
   with c as (
     select p.id, p.revoked_at,
            coalesce(
              (select i.email from public.invitations i
                where i.accepted_by = p.id
                order by i.revoked_at is null desc, i.accepted_at desc nulls last
                limit 1),
              (select lower(btrim(u.email)) from auth.users u where u.id = p.id and u.email like '%@%')
            ) as canonical
       from public.profiles p
   )
   select c.id, c.revoked_at is not null as revoked, c.canonical is not null as has_canonical,
     (select count(*) from auth.identities x
       where x.user_id = c.id and coalesce(lower(btrim(x.email)), '') <> coalesce(c.canonical, '')) as identities_off_canonical,
     (select count(*) from auth.identities x
       where x.user_id = c.id and x.provider in ('google', 'github')
         and lower(btrim(x.email)) = c.canonical) as oauth_on_canonical,
     (select coalesce(u.encrypted_password, '') <> '' from auth.users u where u.id = c.id) as has_password,
     (select count(*) from auth.mfa_factors f where f.user_id = c.id) as mfa_factors,
     (select count(*) from auth.sessions s where s.user_id = c.id) as sessions
   from c;
   ```
   After deploy, a live member works only with `has_canonical`, `identities_off_canonical = 0`
   and `oauth_on_canonical >= 1`. Any other live row is **locked by the deploy** until it is
   cleaned up. Expect `has_password = false` and `mfa_factors = 0` everywhere. Investigate before
   deploying if not.
2. Check that the Email provider is **off**, Secure email change is **on**, and Manual Linking is
   **off**.
3. Dry run, then apply: `npx supabase db push --remote --dry-run`, then without `--dry-run`.
   Deploy the app at the same time (merging to `main` does this).
4. Post-deploy check: the same query against the stored value. Replace the `c` CTE with
   `select id, revoked_at, canonical_email as canonical from public.profiles`.
5. Smoke test: an ordinary member signs in and sees their data. A locked account lands on
   Sign-in methods.

Rollback: restore `is_member()`, `accept_invitation()` and `profiles_select_own` from the
earlier migrations in a new migration. The added column and functions are harmless.

### Cleaning up a locked account (owner, controlled window)

**The cleanup is not atomic.** It is several separate calls to Supabase Auth, and between them a
new sign-in through the stray identity can open a fresh session. A session opened while the
account is locked reads nothing, **but it regains full access the moment the last stray identity
is removed**. So:

- Do it in a **controlled window**. Sign out the stray device first if you can (or switch it off),
  and allow no sign-ins on the account other than the one doing the cleanup.
- Follow this order exactly. It is covered by
  `tests/integration/linked-identity.test.ts` ("cleanup in the runbook's order").

1. Run the preflight query and note the account's `sessions` count.
2. Turn **Manual Linking on**, for the cleanup only.
3. Sign in with a Google/GitHub identity on the canonical email. The account is locked, so the
   app opens Sign-in methods.
4. **Sign out of other devices first**, while the account is still locked. This ends every stray
   session before anything is unlocked.
5. **Remove** the identities with a different address, the last one last. Also remove any
   identity on another address that could relink the stray sign-in: Supabase links by email
   across *all* of the account's identities.
6. **Sign out of other devices again** straight away, to end any session that slipped in during
   steps 4–5.
7. Turn **Manual Linking off**.
8. **Verify** with the preflight query (stored-value version): `identities_off_canonical = 0`,
   `oauth_on_canonical >= 1`, `sessions = 1` (the cleanup session only), `has_password = false`.
   If `sessions` is higher, repeat step 6 and check again.
9. Delete anything created through the stray identity, and record what happened.

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

Owner follow-up after deploying, in a controlled window (phone signed out or switched off first):
Sign-in methods → sign out of other devices → remove the phone's Google identity **and** the GitHub
identity (both carry the second address) → sign out of other devices again → verify (one identity,
one session). Then sign in on the phone again to create the separate account, and delete the
duplicate routines.

## Dependencies

- `npm audit --omit=dev` must report no vulnerabilities before a release.
- Dependabot security updates raise pull requests for vulnerable dependencies; review them like any
  other change and run `npm run test:all`.
- Known and accepted: moderate advisories in the lint toolchain (`typescript-eslint`, `minimatch`
  through `eslint-config-next`). They affect only linting on a developer machine; npm's suggested
  fix is a downgrade to the Next 15 config, which is wrong for this app. Revisit when a patched
  `typescript-eslint` is released.
