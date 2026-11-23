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
| `TRAINGRID_FEEDBACK_TO`, `TRAINGRID_INVITE_REQUESTS_TO`, `TRAINGRID_CONTACT_EMAIL` | Server-only config | Vercel (Production) | — |
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
- PR #87 updated the lint toolchain for the minimatch advisory. The full lockfile audit on
  24 November 2026 reported zero advisories. Recheck the current lockfile at release time.

## Error reports and alerts

`instrumentation.ts` reports every server error as one JSON log line (`"event":"server_error"`,
searchable in Vercel → Logs) with the route, the path **without its query**, the method, the
error's class name and Next.js's digest. It never includes the error message, headers, cookies,
request bodies or user ids. When `TRAINGRID_ALERT_WEBHOOK_URL` is an `https` Slack or Discord
webhook, the same line is posted there, at most once per distinct error per 10 minutes per server
instance (`lib/observability/alerts.ts`).

For uptime, point a monitor (for example UptimeRobot's free plan) at `/api/health`: it answers
`200 {"supabase":"ok","schema":"ok"}` when the app can reach Supabase and its database has every
table, column and function this build needs, and `503` when Supabase is unreachable or the schema
is `"behind"` (a migration was not applied). It reveals nothing else: not which part of the schema is
missing (`npm run release:check` says that, for the owner, with the secret key). The schema is read
at most once per server instance every five minutes.

## Member feedback

Feedback is stored in `public.member_feedback`. Members may only **insert** their own rows
(column-level grant on `kind`, `message`, `page_path`; `user_id` defaults to the caller and the
policy checks it plus active membership). Nobody can read it through the API; the owner reads it
in the Supabase dashboard, and optionally by email (`TRAINGRID_FEEDBACK_TO`). A trigger refuses
more than 10 messages per member per 24 hours. Messages are escaped in the HTML email.

## Invite requests

`Request an invite` on the sign-in page is the only public write. It is a server action; the
browser never talks to the database for it.

- `public.invite_requests` has RLS on, no policies and no privileges for `anon` or
  `authenticated`. The only way in is `request_invite()`, a security-definer function executable
  by the **service role only**: the action calls it with the secret key, so the rule that `anon`
  can execute no function (`supabase/tests/database/07_function_exposure.test.sql`) still holds
  and the limits cannot be bypassed by calling the API directly.
- The function validates every field and enforces: one pending request per address, three per
  network per hour, 50 in 24 hours overall (then it pauses), all under an advisory lock.
- The network is identified by an HMAC-SHA-256 of the client IP (first `x-forwarded-for`
  address, set by Vercel), keyed with the secret key and the UTC date, so it changes daily and
  the address itself is never stored.
- The visitor gets the same answer whether the request is new, already pending, or the address is
  already invited, so the form cannot be used to discover members. A hidden honeypot field makes
  form-filling bots receive a quiet "sent" without storing anything.
- Only new requests email the owner (`TRAINGRID_INVITE_REQUESTS_TO`, else
  `TRAINGRID_FEEDBACK_TO`); the visitor's text is escaped in the HTML email, and nothing is ever
  emailed to the visitor, so the form cannot be used to send mail to third parties.
- Requests are deleted 180 days after they are made, by a daily `pg_cron` job
  (`private.purge_expired_invite_requests()`, migration `20261124000000_invite_request_retention`;
  test `14_invite_request_retention.test.sql`), and again whenever a request arrives. Creating an
  invitation for the address marks
  its request invited (trigger).

## Social profiles, follows and posts

Design and reasoning: [ADR 002](adr/002-members-only-social-layer.md). Enforced in the database by
`supabase/migrations/20261122000000_social.sql`, tested in
`supabase/tests/database/12_social.test.sql`, `tests/integration/social.test.ts` and
`e2e/social.spec.ts`.

- **Members only.** `anon` has no privileges on `social_profiles`, `follows` or `session_posts`;
  every policy requires `is_member()` for the caller, and other members' rows are visible only while
  that member is active (`private.is_active_member`). Revoked members see nothing and disappear for
  everyone else.
- **Posts and lists** are visible to the author, to every active member when the profile is public,
  and otherwise only to accepted followers (`private.can_view_content`). Relationship rows are
  visible to third parties only through the followed profile's rule. Removing a follower,
  unfollowing or switching to private applies on the next query.
- **Nothing is chosen by the caller that should not be.** Column grants let members insert only
  `followee_id` (the follower defaults to the caller; the status is set by a trigger), approve only
  their own pending requests, insert only `session_id`, `caption` and `shows_duration` for a post,
  and update only the caption. The author defaults to the caller. The post's session summary is
  copied by a security-invoker trigger from the caller's **own** session, so another member's
  session cannot be posted, and the snapshot cannot be forged or rewritten.
- **No session leaks.** `session_posts.session_id` is not granted to API roles at all; start
  times, notes, exercises and workout logs are never copied into a post.
- **No email or enumeration beyond the directory.** The social layer stores no email address.
  Search needs 2–60 characters, escapes `LIKE` wildcards and returns at most 20 profiles; only
  members who created a social profile are listed. Unknown, revoked and invisible profiles and
  posts all answer 404.
- **Limits.** 20 posts and 100 new follows per member per 24 hours; usernames, names, bios and
  captions have length limits in Zod and in check constraints.
- **Definer functions.** The helpers that look past RLS are `SECURITY DEFINER` functions in the
  `private` schema, which the Data API does not expose; `anon` cannot use the schema. The social
  functions in `public` are `SECURITY INVOKER`. The app never uses the secret key for social data.
- **Caching and indexing.** Social pages are dynamic, members-only, `noindex`/`noarchive` in
  metadata and in an `X-Robots-Tag` header, and have generic titles. Avatars are only the member's
  own sign-in picture (copied by trigger, `https` only) and load with `referrerPolicy=no-referrer`.

## Likes, comments and workout totals

[ADR 003](adr/003-quick-workouts-likes-comments.md); migration
`20261123000000_quick_workouts_likes_comments`; tests in
`supabase/tests/database/13_reactions_and_quick_workouts.test.sql`,
`tests/integration/reactions-and-quick-workouts.test.ts` and `e2e/quick-workout-social.spec.ts`.

- `post_likes` and `post_comments` are readable only where the post is (`private.can_view_post`,
  a definer helper in the unexposed `private` schema) and only from active members; members also
  see their own rows so they can remove them after losing access. `anon` has no privileges.
- Members insert only `post_id` (likes) or `post_id` and `body` (comments); the author column
  defaults to the caller and the policy checks it. Comments are deleted by their author or the
  post's author and cannot be updated. 100 comments per member per day (trigger, run as the caller).
- A post's workout totals are copied by the database from the author's own completed workout log
  and cannot be supplied or changed through the API; only the totals the author ticked are copied,
  never exercises, sets or notes.
- Quick sessions are ordinary `scheduled_sessions` rows (`origin = 'quick'`), under the existing
  owner-only policies. `start_quick_workout()` and `finish_workout()` are security invoker and
  executable by `authenticated` only, so they add atomicity, not rights. The session id a member
  supplies to start one is checked against their own quick sessions: another member's id, or a
  planned session's, reads as not found and is never adopted.
