-- Invitation model tests (Epic 1, step 7).
-- Run with: npm run db:test
--
-- Identities
--   invited    : Google identity, verified email, live invitation
--   mixedcase  : GitHub identity whose email differs from the invitation only by case
--   stranger   : Google identity, verified email, no invitation
--   revoked    : Google identity, verified email, invitation revoked
--   unverified : Google identity, email not confirmed, live invitation
--   passworder : email/password identity only, confirmed email, live invitation

begin;

select plan(31);

-- E2-D22: is_member() needs the token's session to exist in auth.sessions.
-- Gives every test user one, with session id = user id.
create function pg_temp.bind_sessions() returns void
language sql security definer as $bind$
  insert into auth.sessions (id, user_id)
  select u.id, u.id from auth.users u
  on conflict (id) do nothing;
$bind$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'invited@example.test', now(),
   '{"full_name": "Invited Friend", "avatar_url": "https://example.test/a.png"}'),
  ('00000000-0000-4000-8000-0000000000a2', 'Mixed.Case@Example.Test', now(), '{"name": "Mixed Case"}'),
  ('00000000-0000-4000-8000-0000000000a3', 'stranger@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000a4', 'revoked@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000a5', 'unverified@example.test', null, '{}'),
  ('00000000-0000-4000-8000-0000000000a6', 'passworder@example.test', now(),
   '{"avatar_url": "javascript:alert(1)"}');

insert into auth.identities (provider_id, user_id, provider, identity_data) values
  ('g-1', '00000000-0000-4000-8000-0000000000a1', 'google', '{"email": "invited@example.test"}'),
  ('h-2', '00000000-0000-4000-8000-0000000000a2', 'github', '{"email": "Mixed.Case@Example.Test"}'),
  ('g-3', '00000000-0000-4000-8000-0000000000a3', 'google', '{"email": "stranger@example.test"}'),
  ('g-4', '00000000-0000-4000-8000-0000000000a4', 'google', '{"email": "revoked@example.test"}'),
  ('g-5', '00000000-0000-4000-8000-0000000000a5', 'google', '{"email": "unverified@example.test"}'),
  ('e-6', '00000000-0000-4000-8000-0000000000a6', 'email', '{"email": "passworder@example.test"}');

insert into public.invitations (id, email) values
  ('50000000-0000-4000-8000-000000000001', 'invited@example.test'),
  ('50000000-0000-4000-8000-000000000002', 'mixed.case@example.test'),
  ('50000000-0000-4000-8000-000000000005', 'unverified@example.test'),
  ('50000000-0000-4000-8000-000000000006', 'passworder@example.test');

insert into public.invitations (id, email, revoked_at) values
  ('50000000-0000-4000-8000-000000000004', 'revoked@example.test', now());

-- ---------------------------------------------------------------------------
-- Table constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.invitations (email) values ('Upper@Example.Test')$$,
  '23514', null, 'email must be stored lower-cased'
);

select throws_ok(
  $$insert into public.invitations (email) values (' padded@example.test ')$$,
  '23514', null, 'email must be stored trimmed'
);

select throws_ok(
  $$insert into public.invitations (email) values ('not-an-email')$$,
  '23514', null, 'email must look like an address'
);

select throws_ok(
  $$insert into public.invitations (email) values ('invited@example.test')$$,
  '23505', null, 'only one live invitation per email'
);

select lives_ok(
  $$insert into public.invitations (email) values ('revoked@example.test')$$,
  'a revoked email can be invited again'
);

delete from public.invitations
 where email = 'revoked@example.test' and revoked_at is null;

select lives_ok(
  $$insert into public.invitations (email, accepted_at, revoked_at)
    values ('both@example.test', now(), now())$$,
  'an accepted invitation may later be revoked (member revocation)'
);

delete from public.invitations where email = 'both@example.test';

-- ---------------------------------------------------------------------------
-- The table is closed to API roles
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'invitations'),
  0,
  'invitations has no policies'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.invitations'::regclass),
  'invitations has Row Level Security enabled'
);

set local role anon;
select throws_ok('select * from public.invitations', '42501', null, 'M3: anon cannot read invitations');
select throws_ok(
  $$insert into public.invitations (email) values ('anon@example.test')$$,
  '42501', null, 'M3: anon cannot create an invitation'
);
select throws_ok('select public.accept_invitation()', '42501', null, 'anon cannot call accept_invitation');
reset role;

set local role authenticated;
select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a3", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000a3"}', true);

select throws_ok('select * from public.invitations', '42501', null, 'M2: a signed-in user cannot read invitations');
select throws_ok(
  $$insert into public.invitations (email) values ('stranger@example.test')$$,
  '42501', null, 'M2: a signed-in user cannot invite themselves'
);
select throws_ok(
  $$update public.invitations set revoked_at = null$$,
  '42501', null, 'M2: a signed-in user cannot un-revoke invitations'
);

-- ---------------------------------------------------------------------------
-- accept_invitation(): refusals
-- ---------------------------------------------------------------------------

select is(public.accept_invitation(), 'not_invited', 'A4: uninvited OAuth user is refused');
select ok(not public.is_member(), 'uninvited user is still not a member');

select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a4", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000a4"}', true);
select is(public.accept_invitation(), 'not_invited', 'a revoked invitation grants nothing');

select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a5", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000a5"}', true);
select is(public.accept_invitation(), 'unverified_email', 'A6: an unconfirmed email is refused even with an invitation');

select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a6", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000a6"}', true);
select is(public.accept_invitation(), 'unverified_email', 'an email/password identity is refused even with an invitation');

select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ff", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000ff"}', true);
select throws_ok('select public.accept_invitation()', '28000', null, 'a subject with no auth user is rejected');

select pg_temp.bind_sessions();
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok('select public.accept_invitation()', '28000', null, 'a token without a subject is rejected');

-- ---------------------------------------------------------------------------
-- accept_invitation(): acceptance
-- ---------------------------------------------------------------------------

select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000a1"}', true);

select ok(not public.is_member(), 'invited user is not a member before accepting');
select is(public.accept_invitation(), 'member', 'invited, verified OAuth user becomes a member');
select ok(public.is_member(), 'invited user is a member after accepting');
select is(public.accept_invitation(), 'member', 'calling again is harmless');

select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000a2"}', true);
select is(public.accept_invitation(), 'member', 'email matching ignores case');

reset role;

select results_eq(
  $$select display_name, avatar_url from public.profiles
     where id = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values ('Invited Friend', 'https://example.test/a.png')$$,
  'the profile is created from the provider''s name and avatar'
);

select results_eq(
  $$select accepted_at is not null, accepted_by from public.invitations
     where id = '50000000-0000-4000-8000-000000000001'$$,
  $$values (true, '00000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'the invitation is marked accepted by that user'
);

select is(
  (select count(*)::int from public.profiles
    where id in (
      '00000000-0000-4000-8000-0000000000a3',
      '00000000-0000-4000-8000-0000000000a4',
      '00000000-0000-4000-8000-0000000000a5',
      '00000000-0000-4000-8000-0000000000a6'
    )),
  0,
  'no profile exists for any refused user'
);

select is(
  (select count(*)::int from public.invitations
    where id in ('50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000006')
      and accepted_at is not null),
  0,
  'refused attempts do not consume invitations'
);

select ok(
  (select revoked_at is null from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'),
  'a newly accepted member is not revoked'
);

select * from finish();

rollback;
