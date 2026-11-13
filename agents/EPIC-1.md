<!--
Epic 1 specification as provided by Tanuj on 2026-11-12, saved verbatim.
The follow-up decision resolution (D-03, D-04, D-04A, D-04B, D-05, D-06) is recorded in
agents/DECISIONS.md. Delivery: agents/ROADMAP.md, agents/BACKLOG.md, agents/STORY_REPORTS.md.
Status: complete (2026-11-13).
-->

Epic 1 — Secure Invite-Only Multi-User Cloud Foundation
Objective
Transform TrainGrid from its current single-user / read-only hosted model into a secure, invite-only, multi-user application hosted fully in the cloud.
After this epic:

* TrainGrid continues to run on Vercel.
* Only invited users can access the application.
* Users can authenticate with Google or GitHub.
* Every user has private, isolated TrainGrid data.
* User data persists in Supabase PostgreSQL.
* Supabase Row Level Security protects user-owned data at the database layer.
* Production no longer depends on writable local files.
* Secrets remain outside GitHub.
* The complete infrastructure remains within free tiers for the expected friends-only usage.

This epic creates the foundation required for:

```
Epic 2 — Global Workout Library
Epic 3 — Personal Workout Library
Epic 4 — Per-User Calendar & Scheduling
```

Do not prematurely implement those epics unless required to establish the underlying ownership model.
1. Locked Architecture
These decisions are approved.
Do not replace these technologies without explicit approval.
Hosting
Use:

```
Vercel Hobby
```

Production:

```
https://train-grid.vercel.app
```

Deployment remains:

```
GitHub
   ↓
Vercel Git Integration
   ↓
Production
```

No separate deployment pipeline is required.
Authentication
Use:

```
Supabase Auth
```

Supported sign-in providers for this phase:

```
Google OAuth
GitHub OAuth
```

Do not implement:

```
Apple OAuth
Sign in with ChatGPT
Email/password signup
Open public registration
```

Apple is intentionally excluded because maintaining a zero-cost architecture is a requirement.
Sign in with ChatGPT is deferred until general developer access is practical.
Database
Use:

```
Supabase PostgreSQL — Free Plan
```

All mutable production TrainGrid data must live in PostgreSQL.
Do not use production filesystem writes for user data.
Authorization
Use both:

```
Application-level authorization
+
Supabase PostgreSQL Row Level Security
```

RLS is mandatory.
Do not rely only on application code for user isolation.
Database Client
Use the official Supabase clients appropriate for Next.js.
Prefer:

```
@supabase/supabase-js
@supabase/ssr
```

using the current recommended Supabase + Next.js App Router patterns.
Do not introduce an ORM unless the existing implementation genuinely benefits from one.
The default decision for this epic is:

```
No ORM
```

Use:

* Supabase client
* SQL migrations
* generated database types where useful

Keep the stack small.
Object Storage
Do not provision Supabase Storage.
TrainGrid currently has no file-upload requirement.
YouTube references remain external URLs.
2. Target Architecture

```
                    GitHub
                       │
                       │ push
                       ▼
                    Vercel
                 Next.js 16
                       │
               ┌───────┴────────┐
               │                │
               ▼                ▼
        Supabase Auth      Supabase Postgres
        Google OAuth        Profiles
        GitHub OAuth        Routines
        Sessions            Workout Items
        Invitations         Calendar Sessions
                                │
                                ▼
                         Row Level Security
```

The user's Supabase Auth identity is the source of ownership.
Conceptually:

```
auth.users.id
      │
      ▼
profiles.id
      │
      ├── personal routines
      │
      └── scheduled sessions
```

3. Fundamental Security Model
Every private TrainGrid record must be protected twice.
Layer 1 — Application
Next.js determines the authenticated Supabase user.
Never accept ownership from the browser.
Bad:

```
const userId = request.body.userId;
```

Good conceptually:

```
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  throw unauthorized;
}
```

Layer 2 — Database
PostgreSQL RLS must independently restrict the same record.
Conceptually:

```
auth.uid() = user_id
```

Therefore:

```
UI bug
or
API bug
or
modified request

            ↓

RLS still prevents access to another user's row
```

This is a release requirement.
User Story 1 — Introduce Supabase Cloud Infrastructure
Goal
Connect TrainGrid to Supabase for authentication and persistent storage.
Tasks

* Create Supabase Free project.
* Record project URL.
* Configure project for TrainGrid.
* Install required Supabase Next.js packages.
* Add browser Supabase client.
* Add server Supabase client.
* Configure cookie-based SSR authentication.
* Verify local Next.js → Supabase connection.
* Verify Vercel → Supabase connection.
* Create migrations directory.
* Document Supabase setup.

User Story 2 — Define the User/Profile Model
Supabase owns:

```
auth.users
```

Do not create a duplicate authentication-user table.
Create a public application profile table conceptually like:

```
profiles
────────────────────────
id uuid PK
display_name
avatar_url
created_at
updated_at
```

`profiles.id` should correspond directly to:

```
auth.users.id
```

Profile creation
When a valid invited user first authenticates, ensure a corresponding TrainGrid profile exists.
Use either:

* a secure database trigger
* or reliable server-side provisioning

Choose the simpler maintainable pattern.
User Story 3 — Define the Routine Data Model
Prepare the model for both global and personal routines.
Conceptually:

```
routines
────────────────────────
id uuid
scope
owner_user_id nullable
name
category
description
created_at
updated_at
```

Allowed scopes:

```
GLOBAL
PERSONAL
```

Rules:

```
GLOBAL
owner_user_id = NULL

PERSONAL
owner_user_id = auth user
```

If practical, enforce this relationship using a database constraint.
User Story 4 — Define Workout Items
Preserve the current TrainGrid functionality.
Conceptually:

```
workout_items
────────────────────────
id
routine_id
name
prescription
rest
target
notes
equipment
video_url
sort_order
created_at
updated_at
```

Preserve:

* workout ordering
* equipment tags
* YouTube references
* prescriptions
* rest guidance
* notes

Do not add workout execution/logging fields.
This remains a planning application.
User Story 5 — Define Scheduled Sessions
Conceptually:

```
scheduled_sessions
────────────────────────
id
user_id
date
start_time nullable
name
category
source_routine_id nullable
snapshot jsonb
created_at
updated_at
```

`user_id` is mandatory.
Preserve the existing TrainGrid rule:
A scheduled session is a snapshot.
Example:

```
Global Lower A
      ↓
Add to Calendar
      ↓
Scheduled Lower A snapshot
```

Later editing the source routine must not silently change an already-scheduled workout.
User Story 6 — Enable Row Level Security Everywhere
RLS must be enabled on every exposed application table containing user data.
At minimum:

```
profiles
routines
scheduled_sessions
```

and other ownership-dependent tables as appropriate.
Profiles
Users may read/update only their own profile unless a future feature explicitly requires otherwise.
Conceptually:

```
auth.uid() = id
```

Personal routines
Users may:

```
SELECT own
INSERT own
UPDATE own
DELETE own
```

but not another user's.
Conceptually:

```
auth.uid() = owner_user_id
```

For INSERT/UPDATE, use:

```
WITH CHECK
```

so the user cannot assign ownership to somebody else.
Global routines
Prepare policies so later Epic 2 can allow:

```
authenticated users → SELECT

normal users → no INSERT
normal users → no UPDATE
normal users → no DELETE
```

Do not build the full global-library admin UX in this epic.
Scheduled sessions
Users may interact only with:

```
user_id = auth.uid()
```

for:

```
SELECT
INSERT
UPDATE
DELETE
```

This includes Duplicate Week.
User Story 7 — Configure Google OAuth
Goal
Allow invited friends to authenticate using Google.
Tasks

* Create/configure Google OAuth credentials.
* Configure Supabase Google provider.
* Add correct Supabase callback URL.
* Add allowed production redirect URL.
* Add local development redirect URL.
* Implement `Continue with Google`.
* Verify account creation/login.
* Verify email is available for invite checking.
* Test local and Vercel production flow.

User Story 8 — Configure GitHub OAuth
Goal
Allow invited friends to authenticate using GitHub.
Tasks

* Create GitHub OAuth App.
* Configure Supabase GitHub provider.
* Add correct callback URL.
* Implement `Continue with GitHub`.
* Verify local development.
* Verify Vercel production.
* Verify invite validation still applies.

User Story 9 — Enforce Invite-Only Access
Goal
OAuth authentication must NOT mean unrestricted TrainGrid registration.
A random Google or GitHub user must not gain TrainGrid access.
Desired flow

```
Tanuj invites:
friend@example.com

        ↓

friend receives invitation

        ↓

friend opens TrainGrid

        ↓

Continue with Google
or
Continue with GitHub

        ↓

Supabase authenticates identity

        ↓

TrainGrid validates invited email

        ↓

MATCH
→ provision profile
→ allow application

NO MATCH
→ deny TrainGrid access
```

User Story 10 — Invitation Model
Because TrainGrid requires explicit invite-only access, create a small application invitation table if necessary.
Conceptually:

```
invitations
────────────────────────
id
email
invited_by
created_at
accepted_at nullable
revoked_at nullable
```

Do not store passwords.
Do not create custom authentication credentials.
Supabase Auth still owns identity/authentication.
The invitation table exists only to determine:

```
Is this authenticated email allowed to become a TrainGrid member?
```

Invitation matching
Normalize email addresses appropriately.
A user must satisfy:

```
authenticated
AND
verified OAuth identity
AND
email exists in valid invitation
AND
invitation not revoked
```

Then mark the invitation accepted.
User Story 11 — Admin Invitation Management
Goal
Tanuj must be able to invite friends without creating a large admin system.
Create a minimal protected route such as:

```
/admin/invitations
```

Admin identification
Use a server-controlled variable:

```
TRAINGRID_ADMIN_USER_IDS
```

or equivalent secure role model.
Never determine admin access using:

```
browser payload
query parameter
client-only state
```

Admin capabilities
Minimum:

```
Invite email
View invitation status
Revoke unused invitation
```

Statuses may be:

```
Pending
Accepted
Revoked
```

Do not build unnecessary user-management functionality.
User Story 12 — Invitation Email Delivery
Prefer Supabase's built-in invitation email capability where practical.
Expected user count is very small.
The current free-tier email rate limit is acceptable for this friends-only application.
Do not introduce:

```
Resend
SendGrid
Mailgun
paid SMTP
```

during this epic.
If automated invitation email proves unnecessarily awkward, an acceptable fallback is:

```
Admin creates invitation
+
TrainGrid produces invite URL
+
Tanuj manually sends it to friend
```

Do not compromise authentication security merely to automate email.
User Story 13 — Protect Application Routes
Unauthenticated users must not receive private application data.
Protect relevant routes such as:

```
/
 /library
 /library/*
 /admin/*
```

Adapt to the actual project routing.
Allowed public surfaces may include:

```
/login
/auth/callback
/invite/*
```

and any intentional landing page.
Important
Do not rely solely on route middleware.
Server-side data queries must still:

```
authenticate
+
authorize
```

independently.
User Story 14 — Remove Hosted Read-Only Architecture
The current TrainGrid implementation was designed around:

```
local writable app
+
hosted read-only Vercel site
```

That model ends after this epic.
Remove/rework logic such as:

```
TRAINGRID_READONLY
Published mode
clone this repo to edit
```

where it no longer reflects the product.
After Epic 1:

```
Vercel production
=
actual authenticated TrainGrid application
```

User Story 15 — Migrate Away From Runtime Files
Production must stop using:

```
data/schedule.json
```

as mutable user state.
Do not perform runtime writes to the Vercel filesystem.
Existing template files
Existing:

```
data/templates/*.md
```

are valuable.
Do not delete them immediately.
Treat them as migration/seed input for future:

```
GLOBAL routines
```

Preserve:

* Running
* Strength
* Plyometrics
* Other
* equipment tags
* YouTube URLs
* ordering
* notes

User Story 16 — Migrate Existing Personal Data Safely
If an existing personal schedule needs migration, provide a one-time administrative/local migration script.
It must:

* explicitly target Tanuj's Supabase user UUID
* run locally/server-side
* read existing schedule data
* insert it into Supabase
* never expose the Supabase secret
* not become a public route

Do not commit personal schedule data into database migrations.
User Story 17 — Preserve Planner Functionality
This infrastructure change must not break the current UX.
Preserve:

* 7-day planner
* weekday/date layout
* timed sessions
* untimed sessions
* multiple sessions per day
* session detail
* scheduling
* rescheduling
* deleting
* Duplicate Week
* session snapshots
* mobile behaviour
* desktop behaviour

The planner should now simply operate on:

```
current authenticated user's schedule
```

User Story 18 — Environment Variable Contract
Use approximately:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SECRET_KEY=

TRAINGRID_ADMIN_USER_IDS=
```

Use the actual current Supabase naming/recommended keys if they differ.
Public values
These may be exposed to the browser:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

They are intentionally public.
Security depends on:

```
Auth
+
RLS
```

not on hiding the public client key.
Secret values
The following must NEVER enter client bundles:

```
SUPABASE_SECRET_KEY
```

The secret/admin key bypasses RLS.
It may be used only from trusted server-side/admin operations where truly required.
Normal application CRUD should prefer the authenticated Supabase client so RLS remains active.
User Story 19 — Secure GitHub Repository Secrets
Goal
The public GitHub repository must contain no credentials.
Track:

```
.env.example
```

Do NOT track:

```
.env
.env.local
.env.*.local
```

Ensure `.gitignore` contains appropriate rules.
Also ignore:

```
.vercel/
```

if currently created locally.
`.env.example`
Contains only:

```
variable names
+
safe placeholders
```

Never real keys.
User Story 20 — Store Production Secrets in Vercel
Real production values belong in:

```
Vercel
→ TrainGrid
→ Settings
→ Environment Variables
```

Configure separately where appropriate for:

```
Production
Preview
Development
```

Never paste secrets into:

* README
* Git commits
* GitHub issues
* PR descriptions
* logs
* test snapshots
* screenshots

User Story 21 — Protect Supabase Secrets
The following must never be browser-accessible:

```
Supabase secret/service-role credential
```

The browser should use only:

```
Supabase project URL
+
publishable/anon key
```

with RLS.
Never use the secret/service-role key for normal user CRUD.
Doing so would bypass RLS and undermine the security model.
User Story 22 — Separate Development and Production
A local developer or preview deployment must not accidentally mutate production workouts.
At minimum:

```
Production Vercel
→ production Supabase configuration
```

Development should use either:

```
separate Supabase project
```

or a safe isolated development strategy.
Given the small size of TrainGrid and the free-tier requirement, prefer the simplest approach that does not risk production data.
If creating multiple free Supabase projects causes free-tier/project-limit complications, document the alternative clearly and ensure test data cannot alter production.
User Story 23 — GitHub Security Hardening
For the TrainGrid GitHub repository, verify/enable where available:

* Secret scanning
* Push protection
* Dependency graph
* Dependabot alerts
* Dependabot security updates

If GitHub detects a secret:

```
STOP
```

Do not bypass the warning casually.
If a real secret ever enters Git history:

```
1. Rotate credential immediately
2. Remove it from source/history as appropriate
3. Configure the replacement through Vercel
```

Deleting the latest visible line alone is not sufficient.
User Story 24 — Input Validation
Use server-side validation for every mutation.
Use the project's existing validation solution or introduce:

```
Zod
```

if necessary.
Validate:

* UUIDs
* routine names
* categories
* dates
* times
* workout items
* equipment values
* YouTube URLs
* sort order
* Duplicate Week parameters

Client validation is for UX only.
The server remains authoritative.
User Story 25 — OAuth Account Handling
A user may initially register with:

```
Google
```

or:

```
GitHub
```

Do not build a custom identity-account-linking system unless Supabase already supports the desired behaviour safely.
Use verified email as the invite eligibility signal where appropriate.
Be careful about provider-specific email availability.
Test GitHub accounts whose primary email visibility differs.
If GitHub does not provide a usable verified email for a user, fail safely and provide a clear explanation instead of bypassing invite validation.
User Story 26 — Authentication UI
Keep the login experience minimal.
Conceptually:

```
Welcome to TrainGrid

Invite-only access

[ Continue with Google ]

[ Continue with GitHub ]
```

No:

```
Create account
Email/password form
Public signup
```

If a non-invited user authenticates successfully with an OAuth provider:

```
Authentication succeeded
but
TrainGrid access denied
```

Show a friendly message such as:

```
TrainGrid is currently invite-only.
Ask the person who invited you to verify the email used for your account.
```

Do not expose internal authorization information.
User Story 27 — Admin Security
Only admin users may:

```
create invitations
revoke invitations
manage global data in later epics
```

The `/admin` route must be protected:

```
authenticated
+
admin-authorized
```

RLS/policies should reinforce admin-only database operations where appropriate.
User Story 28 — Security Tests
Create test identities:

```
User A
User B
Admin
```

Verify:
Authentication

* anonymous visitor cannot access planner
* valid invited Google user can access
* valid invited GitHub user can access
* non-invited OAuth user is denied
* sign-out removes application access

User isolation

* A sees A's schedule
* B sees B's schedule
* A cannot read B session
* A cannot update B session
* A cannot delete B session
* A cannot read B personal routine
* A cannot update B personal routine
* A cannot delete B personal routine
* A cannot duplicate B's week

Database/RLS
Attempt direct authenticated queries where practical.
Prove RLS itself blocks cross-user access.
Do not validate only through the UI.
Admin

* Admin can create invite
* Member cannot create invite
* Anonymous user cannot create invite
* Member cannot access `/admin`

These are release blockers.
User Story 29 — Supabase Migration Management
All schema changes must be version-controlled.
Use:

```
supabase/migrations/
```

or the current recommended Supabase migration structure.
Track:

```
tables
indexes
constraints
RLS enablement
RLS policies
functions/triggers where necessary
```

Do NOT put into migrations:

```
real secrets
personal emails
private schedules
production credentials
```

Generic global workout seed data may be handled separately and explicitly.
User Story 30 — Vercel Production Configuration
Before releasing:

* Supabase production project configured
* Google OAuth configured
* GitHub OAuth configured
* production callback URLs correct
* Vercel env variables configured
* admin user IDs configured
* database migrations applied
* RLS enabled
* RLS tests pass
* secrets absent from Git
* production build succeeds
* authentication works at `train-grid.vercel.app`

User Story 31 — Free-Tier Constraint
Epic 1 must use:

```
Vercel Hobby
+
Supabase Free
+
GitHub
```

No paid infrastructure may be introduced without approval.
Do not add:

* Clerk
* Neon
* paid email provider
* Redis
* Upstash unless absolutely necessary later
* paid monitoring
* object storage
* Apple Developer membership
* paid OAuth provider
* paid database service

Expected usage is a small circle of friends.
Design accordingly.
User Story 32 — Update Architecture Documentation
Create:

```
docs/adr/001-multi-user-supabase-architecture.md
```

Document the locked decision:

```
Hosting         → Vercel Hobby
Database        → Supabase PostgreSQL
Authentication  → Supabase Auth
OAuth           → Google + GitHub
Authorization   → Supabase RLS + server checks
Deployment      → GitHub → Vercel
Secrets         → Vercel environment variables
```

Also document:

* zero-cost requirement
* why Supabase was chosen
* invite-only model
* database ownership model
* RLS strategy
* OAuth providers intentionally deferred
* filesystem migration

User Story 33 — Update Existing Documentation
Review and update:

```
README.md
docs/REQUIREMENTS.md
docs/TECHNICAL_DESIGN.md
docs/DATA_FORMAT.md
docs/TEST_PLAN.md
docs/TEST_RESULTS.md
```

The current repository may still describe TrainGrid as:

```
single-user
local-first
file-backed
hosted read-only
no authentication
```

After this epic, those descriptions become incorrect.
Do not document Epic 2–4 features as already shipped.
Deferred Authentication Providers
Explicitly document:

```
Google   → supported now
GitHub   → supported now

Apple    → deferred because zero-cost requirement
ChatGPT  → deferred pending practical/general developer availability
```

Do not leave placeholder buttons for providers that are not configured.
Non-Goals
Do NOT add during Epic 1:

* Apple OAuth
* ChatGPT OAuth
* passwords
* public registration
* social feeds
* friends/following
* workout completion tracking
* lifted-weight logging
* run GPS tracking
* Strava integration
* Hevy integration
* Garmin integration
* subscriptions
* payments
* push notifications
* broad admin dashboard
* complex role system
* object uploads
* cloud file storage
* final Global Library UX
* final Personal Library UX

Required Implementation Order
Implement as separate reviewable stories/PRs.
Recommended order:

```
1. Supabase architecture + ADR

2. Database schema + migrations

3. RLS policies + database tests

4. Supabase SSR/Auth foundation

5. Google OAuth

6. GitHub OAuth

7. Invitation/allowlist model

8. Admin invitation flow

9. Route protection

10. User-scoped repository/data layer

11. Existing template migration foundation

12. Planner migration from files → Supabase

13. Cross-user authorization tests

14. Vercel environment/secrets hardening

15. Production rollout

16. Documentation closure
```

Do not implement this entire epic as one huge unreviewed change.
Each PR should leave the codebase in a coherent state.
Release Blockers
Do not mark Epic 1 complete if ANY of the following is true:

```
Public signup is possible

Production calendar still writes to filesystem

Supabase secret/service-role key reaches browser

Real credentials exist in Git history

RLS is disabled on user-owned tables

Ownership depends only on application checks

User A can access User B data

Admin invitation route works for normal members

OAuth bypasses invitation check

Google production OAuth is unverified

GitHub production OAuth is unverified

Vercel deployment is unverified
```

Epic Acceptance Criteria
Epic 1 is complete only when:

* Vercel Hobby remains production host
* Supabase Free is production backend
* Supabase Auth is configured
* Google OAuth works
* GitHub OAuth works
* application is invite-only
* unrestricted signup is impossible
* admin can invite users
* non-admin cannot invite users
* invited user can access TrainGrid
* non-invited OAuth user is denied
* sign-out works
* private routes require authentication
* user-owned database rows contain user ownership
* RLS is enabled
* SELECT isolation works
* INSERT ownership is enforced
* UPDATE isolation works
* DELETE isolation works
* cross-user tests fail safely
* existing planner works
* Duplicate Week is user-specific
* scheduled-session snapshot semantics remain intact
* existing equipment metadata survives migration
* existing YouTube metadata survives migration
* production no longer depends on `data/schedule.json`
* secrets are absent from Git
* `.env.example` is safe
* Vercel production env variables configured
* GitHub security settings reviewed
* migrations are version-controlled
* lint passes
* unit tests pass
* integration tests pass
* RLS tests pass
* E2E authentication tests pass
* production build passes
* `https://train-grid.vercel.app` verified after deployment
* no paid dependency introduced

Agent Instructions Before Implementation
Before making implementation changes:

1. Inspect the entire existing TrainGrid repository.
2. Identify every filesystem persistence path.
3. Identify all server actions and API routes.
4. Identify current published/read-only logic.
5. Identify existing planner CRUD flows.
6. Identify existing workout data structures.
7. Identify existing test coverage.
8. Compare current implementation with this Epic.
9. Create an ordered issue/story breakdown.
10. Implement incrementally.

Do not replace approved infrastructure choices.
Required Story Completion Report
For each story, report:

```
Story:
Branch:
PR:
Commit:
Schema impact:
RLS impact:
Secrets/config impact:
Tests:
Deployment impact:
Status:
```

Required Epic Completion Report
Infrastructure

```
Vercel Hobby: PASS / FAIL
Supabase Free: PASS / FAIL
```

OAuth

```
Google: PASS / FAIL
GitHub: PASS / FAIL
Public signup blocked: PASS / FAIL
```

Invite-only Access

```
Admin invitation: PASS / FAIL
Invited user access: PASS / FAIL
Non-invited access: BLOCKED / FAIL
```

Data Isolation

```
User A → User A: PASS
User A → User B: BLOCKED
User B → User A: BLOCKED
```

RLS

```
Profiles: PASS / FAIL
Personal routines: PASS / FAIL
Scheduled sessions: PASS / FAIL
```

Secrets

```
Git repository clean: PASS / FAIL
Vercel environment configured: PASS / FAIL
Service secret absent from browser: PASS / FAIL
```

Validation

```
Lint:
Unit:
Integration:
RLS:
E2E:
Build:
Production smoke:
```

Cost

```
Vercel Hobby: $0
Supabase Free: $0
Google OAuth: $0
GitHub OAuth: $0
Additional paid services: NONE
```

End with exactly:

```
EPIC 1 COMPLETE — SECURE INVITE-ONLY MULTI-USER CLOUD FOUNDATION LIVE
```

or:

```
EPIC 1 BLOCKED
```

with the precise blocking reason.
