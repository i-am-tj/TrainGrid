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
| `RESEND_API_KEY` | Secret; sends email as your domain | Vercel (Production, type **Sensitive**) | Git, browser bundles, chat, logs |
| `TRAINGRID_SITE_URL`, `TRAINGRID_EMAIL_FROM` | Server-only config | Vercel (Production) | — |
| `TRAINGRID_FEEDBACK_TO`, `TRAINGRID_CONTACT_EMAIL` | Server-only config | Vercel (Production) | — |
| `TRAINGRID_ALERT_WEBHOOK_URL` | Secret; anyone with it can post to your channel | Vercel (Production, type **Sensitive**) | Git, browser bundles, chat, logs |
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
grep -rl "RESEND_API_KEY" .next/static        # must print nothing
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

## Known limitation: linked sign-in identities

Supabase Auth automatically **links** a Google or GitHub sign-in to an existing user when its
verified email matches the email of any identity that user already has. This cannot be switched
off. The sign-in then becomes that user, with their full access, including through Supabase's API
directly. **The invitation check does not prevent this.** It only decides who becomes a member,
not which identity an existing member's session came from.

In practice this needs control of a mailbox that is on one of the member's linked identities,
usually the member's own other address. To keep it that way:

- Each member signs in with the address they were invited with.
- On GitHub, keep the invited address as the account's primary email, and do not list addresses
  you share with anyone.
- Do not invite, as a separate person, an address that is already on someone's Google or GitHub
  sign-in. It would be linked into that person's account.

**One-off cleanup** (13 Nov 2026 incident: an admin's GitHub identity carried a second address, and
a phone sign-in with that address was linked into the admin account). The owner runs it in a
controlled window, with the other device signed out:

1. Turn **Manual Linking** on (Authentication → Sign In / Providers). Supabase requires it for
   removing identities.
2. Signed in as the member, call Supabase Auth's own endpoints:
   1. sign out other sessions (`POST /auth/v1/logout?scope=others`)
   2. remove each unwanted identity (`DELETE /auth/v1/user/identities/{id}`)
   3. sign out other sessions again
3. Turn **Manual Linking** off. Check that `auth.identities` has only the identities you meant to
   keep, and that `auth.sessions` has one session for that user.
4. Wait one access-token lifetime (Authentication → Sessions, JWT expiry). Access tokens issued
   earlier stay valid until they expire, though they cannot be refreshed.

No TrainGrid data is changed by the cleanup. A removed identity reappears only if someone signs in
with it again while it could still link. Turning Manual Linking off does not stop automatic
linking, so the conventions above still matter.

## Dependencies

- `npm audit --omit=dev` must report no vulnerabilities before a release.
- Dependabot security updates raise pull requests for vulnerable dependencies; review them like any
  other change and run `npm run test:all`.
- Known and accepted: moderate advisories in the lint toolchain (`typescript-eslint`, `minimatch`
  through `eslint-config-next`). They affect only linting on a developer machine; npm's suggested
  fix is a downgrade to the Next 15 config, which is wrong for this app. Revisit when a patched
  `typescript-eslint` is released.

## Error reports and alerts

`instrumentation.ts` reports every server error as one JSON log line (`"event":"server_error"`,
searchable in Vercel → Logs) with the route, the path **without its query**, the method, the
error's class name and Next.js's digest. It never includes the error message, headers, cookies,
request bodies or user ids. When `TRAINGRID_ALERT_WEBHOOK_URL` is an `https` Slack or Discord
webhook, the same line is posted there, at most once per distinct error per 10 minutes per server
instance (`lib/observability/alerts.ts`).

For uptime, point a monitor (for example UptimeRobot's free plan) at `/api/health`: it answers
`200 {"supabase":"ok"}` when the app can reach Supabase, `503` otherwise, and reveals nothing else.

## Member feedback

Feedback is stored in `public.member_feedback`. Members may only **insert** their own rows
(column-level grant on `kind`, `message`, `page_path`; `user_id` defaults to the caller and the
policy checks it plus active membership). Nobody can read it through the API; the owner reads it
in the Supabase dashboard, and optionally by email (`TRAINGRID_FEEDBACK_TO`). A trigger refuses
more than 10 messages per member per 24 hours. Messages are escaped in the HTML email.
