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

## Linked sign-in identities

Supabase Auth **links** a new Google or GitHub sign-in to an existing user when its verified email
matches the email of any identity that user already has. It does not create a separate user.
Whoever signs in through a linked identity *is* that user: they see that user's routines and
sessions, because to RLS and the app they are the same person.

So an address that is already a sign-in of one member must never be invited as a separate person.
Two checks enforce this (decision E2-D22):

- **When inviting**, the admin page refuses an address that is already a linked identity of a
  user whose account email differs (`invitation_email_conflict()`).
- **When signing in**, `accept_invitation()` refuses a sign-in made through a linked identity whose
  address has a live invitation that this user never accepted. The callback signs the session out
  and `/login` shows a fixed message that names no one.

A sign-in check cannot undo a link that already exists, or end sessions that are already open. If
it happens:

1. **Revoke the pending invitation** for the address on the admin page.
2. **End the sessions** of the affected user in Supabase → Authentication → Users → (user) →
   sign out. That covers anyone still signed in through the linked identity.
3. **Remove the linked identity** if it belongs to someone else. This is owner-only database
   work: delete that row from `auth.identities`, after checking its `provider` and `created_at`.
   While another identity of the member carries the same address (for example their GitHub
   email), the address cannot have an account of its own. Invite a different address instead.
4. Review and delete anything created in that window, and record what happened.

### Incident 2026-11-13: routines from "another account" in Mine

In production, three identical routines appeared in a member's **Mine** view. They had been
created by what was meant to be a different, newly invited account. Reasoning, from read-only
queries (ids, timestamps and providers only):

- All three rows had the same `owner_user_id`, the member viewing them, and were created within
  three seconds. RLS and the data layer returned exactly that member's rows. **No other user's
  data was exposed.**
- That user had three identities: Google, GitHub, and a **second Google identity linked at
  11:59:26 UTC**. Its address was the same as the email on the member's GitHub identity.
- The admin had invited that address as a separate person at 11:58:31. The sign-in at 11:59 was
  linked onto the existing member, and the invitation was never used.
- The routines were created at 12:04 in that session, as the existing member.

Fixed by the two checks above (migration `20261113000000_linked_identity_gate.sql`). Follow-up for
the owner: apply the migration to production, then complete steps 1 to 4 for that identity.

## Dependencies

- `npm audit --omit=dev` must report no vulnerabilities before a release.
- Dependabot security updates raise pull requests for vulnerable dependencies; review them like any
  other change and run `npm run test:all`.
- Known and accepted: moderate advisories in the lint toolchain (`typescript-eslint`, `minimatch`
  through `eslint-config-next`). They affect only linting on a developer machine; npm's suggested
  fix is a downgrade to the Next 15 config, which is wrong for this app. Revisit when a patched
  `typescript-eslint` is released.
