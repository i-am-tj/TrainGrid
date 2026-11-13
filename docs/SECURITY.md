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

## Sign-in identities and approval

Supabase Auth **links** a new Google or GitHub sign-in to an existing user when its verified email
matches the email of any identity that user already has. It then issues an ordinary session for
that **user**. Row Level Security only sees `auth.uid()`, so before decision E2-D22 every linked
identity had the member's full access, whatever the app's callback decided. A check in the
callback or in `accept_invitation()` is advisory: a client can exchange its own code and call the
REST API without asking.

Access is therefore granted per **identity**, and enforced where tokens are issued and on every
query (migration `20261113000000_identity_approval.sql`):

| Piece | What it does |
| --- | --- |
| `approved_identities` | Which identities may be used. Automatic when the identity's verified email equals the account email (the invited mailbox). Otherwise the member approves it on **Sign-in methods** from an approved session signed in within the last 10 minutes. Invitations play no part. |
| `custom_access_token_hook` | Called by Supabase Auth before issuing **any** token. On sign-in it finds the identity used (`raw_user_meta_data.sub`, which Supabase Auth writes on every OAuth sign-in), refuses an unapproved one with 403, and records session → identity. On refresh it uses that record, so the session keeps its identity. |
| `session_is_approved()` | Used by `is_member()` and the profile read policy. The token's session must still exist and be recorded against an approved identity. Unlinking an identity, or signing out, cuts access on the next query, not at token expiry. |
| Sign-in methods page | Lists the member's identities. Approve, or **Remove** with Supabase Auth's `unlinkIdentity()`. The identity of the current session cannot be removed there. |
| Invite check | The admin page refuses to invite an address that is already a linked identity of another account (`invitation_email_conflict()`). |

Legitimate linking still works. A same-address identity is approved automatically. Another address,
for example your GitHub email, is approved once on Sign-in methods.

### Deploying identity approval (owner)

The migration and the hook must go live together. Without the hook no session is recorded, and
every member sees nothing (it fails closed).

1. **Settings first.** Authentication → Sign In / Providers → enable **Manual Linking**. It is
   required by `unlinkIdentity()`. It also lets members link identities manually, but those still
   need approval.
2. Dry run, then apply: `npx supabase db push --remote --dry-run`, then without `--dry-run`.
3. **Straight away**, Authentication → Hooks → **Customize Access Token (JWT) Claims** → Postgres
   function → `public.custom_access_token_hook` → enable.
4. Every existing session loses access at once and cannot refresh, including any session opened
   through a linked identity. Everyone signs in once more. No session rows need deleting.
5. Smoke test: your usual Google sign-in works. A linked identity with another address is refused
   with the "has not been approved" message. Sign-in methods lists your identities.

Rollback: disable the hook, then restore `is_member()` and the `profiles_select_own` policy from
`20261112040000_revoke_members.sql` and `20261112010000_rls_policies.sql` in a new migration.
Disabling the hook alone leaves members locked out.

### Cleaning up a wrongly linked identity

Use the app, not SQL against `auth.identities`:

1. Sign in with the identity whose email is the account email. It is approved automatically.
2. **Sign-in methods** → **Remove** each identity that should not be there (`unlinkIdentity()`).
   Its sessions lose access at once and cannot refresh.
3. **Automatic relinking.** Supabase Auth links by email across *all* of the account's
   identities. While any remaining identity carries an address, a new sign-in with that address
   links back into this account. With approval it is refused, but it never becomes its own
   account. To let that address have its own account, remove **every** identity with that address
   from this account, including for example a GitHub identity whose email is that address.
4. A provider account that knows **both** addresses (GitHub lists all of an account's verified
   emails) may later link to either account, or be refused as ambiguous. Keep one of the two
   addresses on that provider account, or do not use it to sign in.
5. Delete anything created through the wrong identity, and record what happened.

### Incident 2026-11-13: routines from a "second account" in Mine

Three identical routines appeared in the admin's **Mine** view, created from a phone signed in
with a second Gmail address that the admin had invited as a separate member. Read-only queries
(ids, timestamps and providers only) showed:

- The rows' owner was the admin's own user id. RLS was correct and no other user's data was read.
- On 12 Nov, the admin's GitHub identity was linked to the admin account. Its email is the second
  address. GitHub most likely also lists the admin's Gmail as verified, which is why the link
  happened.
- On 13 Nov at 11:59 UTC, the phone's Google sign-in for the second address was **linked into the
  admin account** through that GitHub email. The invitation was never used.
- In review, the first fix (a check in `accept_invitation()`) was shown to be advisory: a session
  for the linked identity still read member data straight through the REST API. That was
  reproduced in `tests/integration/linked-identity.test.ts`, and replaced by identity approval.

Owner follow-up, after deploying: on Sign-in methods remove the phone Google identity **and** the
GitHub identity (both carry the second address). Then sign in on the phone again to create the
separate account, and delete the duplicate routines.

## Dependencies

- `npm audit --omit=dev` must report no vulnerabilities before a release.
- Dependabot security updates raise pull requests for vulnerable dependencies; review them like any
  other change and run `npm run test:all`.
- Known and accepted: moderate advisories in the lint toolchain (`typescript-eslint`, `minimatch`
  through `eslint-config-next`). They affect only linting on a developer machine; npm's suggested
  fix is a downgrade to the Next 15 config, which is wrong for this app. Revisit when a patched
  `typescript-eslint` is released.
