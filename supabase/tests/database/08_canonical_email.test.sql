-- Canonical email rule (E2-D22): every identity linked to a member's account
-- must carry the invited address, or the whole account is locked.
-- Run with: npm run db:test
--
-- owner : invited as owner@; signs in with Google owner@.
-- other : another member (owner@ and other@ never mix).
-- fresh : invited as fresh@, not a member yet.
--
-- Nothing here depends on which identity a session came from, or on any
-- user-editable metadata: only on the account's identities, its stored
-- canonical email and whether the session still exists.

begin;

select plan(36);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e1', 'owner@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000e2', 'other@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000e3', 'fresh@example.test', now(), '{}');

insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000001', 'g-owner', '00000000-0000-4000-8000-0000000000e1', 'google', '{"email": "Owner@Example.Test"}'),
  ('30000000-0000-4000-8000-000000000002', 'g-other', '00000000-0000-4000-8000-0000000000e2', 'google', '{"email": "other@example.test"}'),
  ('30000000-0000-4000-8000-000000000003', 'g-fresh', '00000000-0000-4000-8000-0000000000e3', 'google', '{"email": "fresh@example.test"}');

insert into public.invitations (email, accepted_at, accepted_by) values
  ('owner@example.test', now(), '00000000-0000-4000-8000-0000000000e1');
insert into public.invitations (email) values ('fresh@example.test');

insert into public.profiles (id, canonical_email) values
  ('00000000-0000-4000-8000-0000000000e1', 'owner@example.test');
-- No canonical email given: taken from the account email by the trigger.
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000000e2');

insert into public.routines (id, scope, owner_user_id, name, category) values
  ('40000000-0000-4000-8000-000000000001', 'PERSONAL', '00000000-0000-4000-8000-0000000000e1', 'Owner private', 'other');

insert into auth.sessions (id, user_id) values
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000e1'),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000e1'),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000e2'),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000e3');

create function pg_temp.as_user(p_user text, p_session text, p_meta jsonb default '{}') returns void
language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user, 'role', 'authenticated', 'session_id', p_session,
    'user_metadata', p_meta)::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Canonical email
-- ---------------------------------------------------------------------------

select is((select canonical_email from public.profiles where id = '00000000-0000-4000-8000-0000000000e2'),
  'other@example.test', 'a profile created without one takes the account email');
select throws_ok(
  $$update public.profiles set canonical_email = 'Bad@Example.Test' where id = '00000000-0000-4000-8000-0000000000e2'$$,
  '23514', null, 'the canonical email is stored lower-cased');

-- ---------------------------------------------------------------------------
-- A consistent account
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-000000000001');
select is(public.account_status(), 'member', 'every identity on the invited address: member');
select ok(public.is_member(), 'is_member agrees');
select is((select count(*)::int from public.routines where id = '40000000-0000-4000-8000-000000000001'), 1,
  'the member reads their private routine');
select is(public.my_canonical_email(), 'owner@example.test', 'the member sees their own canonical email');
select throws_ok(
  $$update public.profiles set canonical_email = 'alias@example.test' where id = '00000000-0000-4000-8000-0000000000e1'$$,
  '42501', null, 'a member cannot change their canonical email');

-- ---------------------------------------------------------------------------
-- A different-address identity is linked (what Supabase Auth did)
-- ---------------------------------------------------------------------------

reset role;
insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000009', 'g-alias', '00000000-0000-4000-8000-0000000000e1', 'google', '{"email": "alias@example.test"}');
set local role authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-000000000001');
select is(public.account_status(), 'identity_mismatch', 'the whole account is locked');
select ok(not public.is_member(), 'not a member while locked');
select is((select count(*)::int from public.routines where id = '40000000-0000-4000-8000-000000000001'), 0,
  'the owner''s existing session reads nothing (no attribution needed)');
select is((select count(*)::int from public.routines where scope = 'GLOBAL'), 0,
  'not even GLOBAL routines');

select pg_temp.as_user('00000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-000000000002',
  '{"sub": "g-owner", "provider_id": "g-owner"}');
select is((select count(*)::int from public.routines where id = '40000000-0000-4000-8000-000000000001'), 0,
  'metadata claiming the owner''s identity changes nothing');

select throws_ok(
  $$insert into public.routines (scope, owner_user_id, name, category) values ('PERSONAL', '00000000-0000-4000-8000-0000000000e1', 'planted', 'other')$$,
  '42501', null, 'a locked account cannot write');

select pg_temp.as_user('00000000-0000-4000-8000-0000000000e2', '50000000-0000-4000-8000-000000000003');
select is(public.account_status(), 'member', 'another member is not affected');

-- An identity with no email address counts as a different address.
reset role;
delete from auth.identities where id = '30000000-0000-4000-8000-000000000009';
insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000008', 'h-noemail', '00000000-0000-4000-8000-0000000000e1', 'github', '{}');
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-000000000001');
select is(public.account_status(), 'identity_mismatch', 'an identity without an email locks the account too');

-- Removing it (what unlinkIdentity does) restores access.
reset role;
delete from auth.identities where id = '30000000-0000-4000-8000-000000000008';
set local role authenticated;
select is(public.account_status(), 'member', 'once the identity is removed, the account works again');

-- The account email changing (a user can request that) does not move the rule.
reset role;
update auth.users set email = 'alias@example.test' where id = '00000000-0000-4000-8000-0000000000e1';
insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000007', 'g-alias2', '00000000-0000-4000-8000-0000000000e1', 'google', '{"email": "alias@example.test"}');
set local role authenticated;
select is(public.account_status(), 'identity_mismatch',
  'the rule follows the stored canonical email, not auth.users.email');
reset role;
delete from auth.identities where id = '30000000-0000-4000-8000-000000000007';
update auth.users set email = 'owner@example.test' where id = '00000000-0000-4000-8000-0000000000e1';
set local role authenticated;

-- A locked session cannot read even its own profile row.
reset role;
insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000005', 'g-alias3', '00000000-0000-4000-8000-0000000000e1', 'google', '{"email": "alias@example.test"}');
set local role authenticated;
select is((select count(*)::int from public.profiles), 0, 'a locked session cannot read its own profile');
reset role;
delete from auth.identities where id = '30000000-0000-4000-8000-000000000005';
set local role authenticated;
select is((select count(*)::int from public.profiles), 1, 'once consistent again, it can');

-- ---------------------------------------------------------------------------
-- At least one Google/GitHub identity on the canonical email
-- ---------------------------------------------------------------------------

reset role;
delete from auth.identities where id = '30000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.account_status(), 'identity_mismatch', 'an account with no identities at all is locked');
select is((select count(*)::int from public.routines where id = '40000000-0000-4000-8000-000000000001'), 0,
  'and reads nothing');

reset role;
insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e1', 'email', '{"email": "owner@example.test"}');
set local role authenticated;
select is(public.account_status(), 'identity_mismatch',
  'an email/password identity on the canonical address is not enough: Google or GitHub is required');

reset role;
insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000001', 'g-owner', '00000000-0000-4000-8000-0000000000e1', 'google', '{"email": "Owner@Example.Test"}');
delete from auth.identities where id = '30000000-0000-4000-8000-000000000004';
set local role authenticated;
select is(public.account_status(), 'member', 'with its Google identity back, the account works');

-- ---------------------------------------------------------------------------
-- Every member-data policy carries the restriction
-- ---------------------------------------------------------------------------

reset role;
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('routines', 'workout_items', 'scheduled_sessions', 'profiles')
      and not (policyname = 'profiles_select_own')
      and not (coalesce(qual, '') like '%is_member()%' or coalesce(with_check, '') like '%is_member()%')),
  0,
  'every policy on member data requires is_member()'
);
select ok(
  (select qual like '%account_status()%' from pg_policies
    where schemaname = 'public' and policyname = 'profiles_select_own'),
  'reading one''s own profile requires a usable (or revoked) account'
);
select is(
  (select count(*)::int from pg_policies p
    where p.schemaname = 'public' and p.cmd in ('INSERT', 'UPDATE')
      and p.tablename in ('routines', 'workout_items', 'scheduled_sessions', 'profiles')
      and coalesce(p.with_check, '') not like '%is_member()%'),
  0,
  'every write policy checks is_member() on the new row too'
);
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

reset role;
delete from auth.sessions where id = '50000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-000000000002');
select is(public.account_status(), 'session_ended', 'a signed-out session''s token is refused at once');
select is((select count(*)::int from public.routines where id = '40000000-0000-4000-8000-000000000001'), 0,
  'and reads nothing');

select pg_temp.as_user('00000000-0000-4000-8000-0000000000e1', '50000000-0000-4000-8000-000000000003');
select is(public.account_status(), 'session_ended', 'another user''s session id does not count');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}', true);
select is(public.account_status(), 'session_ended', 'a token without a session id is refused');

-- ---------------------------------------------------------------------------
-- Becoming a member
-- ---------------------------------------------------------------------------

reset role;
insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('30000000-0000-4000-8000-000000000006', 'h-fresh', '00000000-0000-4000-8000-0000000000e3', 'github', '{"email": "work@example.test"}');
set local role authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000e3', '50000000-0000-4000-8000-000000000004');
select is(public.accept_invitation(), 'identity_mismatch',
  'an invited account that also has a sign-in on another address is not made a member');
reset role;
select ok(
  not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000e3')
  and exists (select 1 from public.invitations where email = 'fresh@example.test' and accepted_at is null),
  'no membership is created and the invitation stays unused'
);

delete from auth.identities where id = '30000000-0000-4000-8000-000000000006';
set local role authenticated;
select is(public.accept_invitation(), 'member', 'with only the invited address, the invitation is accepted');
select is(public.account_status(), 'member', 'and the new member can use the account');
reset role;
select is((select canonical_email from public.profiles where id = '00000000-0000-4000-8000-0000000000e3'),
  'fresh@example.test', 'accepting records the invited address as the canonical email');

-- ---------------------------------------------------------------------------
-- Invite-time check
-- ---------------------------------------------------------------------------

insert into auth.identities (provider_id, user_id, provider, identity_data) values
  ('h-owner', '00000000-0000-4000-8000-0000000000e1', 'github', '{"email": "second@example.test"}');
set local role service_role;
select ok(public.invitation_email_conflict('second@example.test'),
  'the admin cannot invite an address already linked to another account');
reset role;

select * from finish();

rollback;
