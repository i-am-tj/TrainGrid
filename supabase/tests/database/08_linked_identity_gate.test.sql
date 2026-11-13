-- Linked-identity gate (bug 2026-11-13, E2-D22).
-- Run with: npm run db:test
--
-- The member "owner" signs in with Google (owner@) and has a GitHub identity
-- whose email is alias@. Supabase Auth would link ANY new identity with a
-- verified alias@ email to this same user, so a Google account for alias@,
-- invited by the admin as a separate person, would land in owner's account.

begin;

select plan(14);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000c1', 'owner@example.test', now(), '{"sub": "g-owner"}'),
  ('00000000-0000-4000-8000-0000000000c2', 'other@example.test', now(), '{"sub": "g-other"}');

insert into auth.identities (provider_id, user_id, provider, identity_data) values
  ('g-owner', '00000000-0000-4000-8000-0000000000c1', 'google', '{"email": "owner@example.test"}'),
  ('h-owner', '00000000-0000-4000-8000-0000000000c1', 'github', '{"email": "Alias@Example.Test"}'),
  -- The Google account for alias@ that Supabase linked onto owner.
  ('g-alias', '00000000-0000-4000-8000-0000000000c1', 'google', '{"email": "alias@example.test"}'),
  ('g-other', '00000000-0000-4000-8000-0000000000c2', 'google', '{"email": "other@example.test"}');

insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000000c1');

-- The admin invites alias@ thinking it is a different person.
insert into public.invitations (id, email) values
  ('60000000-0000-4000-8000-000000000001', 'alias@example.test');

-- ---------------------------------------------------------------------------
-- Invite-time check
-- ---------------------------------------------------------------------------

set local role service_role;

select ok(public.invitation_email_conflict('alias@example.test'),
  'an address that signs in as another user (through a linked identity) is a conflict');
select ok(public.invitation_email_conflict('  ALIAS@example.test '),
  'the conflict check ignores case and surrounding spaces');
select ok(not public.invitation_email_conflict('owner@example.test'),
  'a user''s own account email is not a conflict (re-inviting a revoked member still works)');
select ok(not public.invitation_email_conflict('new@example.test'),
  'an unknown address is not a conflict');

reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000c2", "role": "authenticated"}', true);
select throws_ok($$select public.invitation_email_conflict('alias@example.test')$$,
  '42501', null, 'signed-in users cannot probe which addresses are linked');
reset role;

-- ---------------------------------------------------------------------------
-- Sign-in check
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated"}', true);

select is(public.accept_invitation(), 'member',
  'the member signing in with their own Google identity gets in');

reset role;
update auth.users set raw_user_meta_data = '{"sub": "g-alias"}'
 where id = '00000000-0000-4000-8000-0000000000c1';
set local role authenticated;

select is(public.accept_invitation(), 'linked_identity',
  'the linked Google account for the separately invited alias@ is refused');

reset role;
update auth.users set raw_user_meta_data = '{"sub": "h-owner"}'
 where id = '00000000-0000-4000-8000-0000000000c1';
set local role authenticated;

select is(public.accept_invitation(), 'linked_identity',
  'while alias@ is invited to someone else, every identity with that address is refused');

reset role;
update auth.users set raw_user_meta_data = '{"provider_id": "g-alias"}'
 where id = '00000000-0000-4000-8000-0000000000c1';
set local role authenticated;

select is(public.accept_invitation(), 'linked_identity',
  'the signing-in identity is also found by provider_id');

reset role;
update auth.users set raw_user_meta_data = '{}'
 where id = '00000000-0000-4000-8000-0000000000c1';
set local role authenticated;

select is(public.accept_invitation(), 'member',
  'without a recorded sign-in identity the existing rules decide, unchanged');

-- Revoking the alias@ invitation removes the conflict.
reset role;
update auth.users set raw_user_meta_data = '{"sub": "g-alias"}'
 where id = '00000000-0000-4000-8000-0000000000c1';
update public.invitations set revoked_at = now() where id = '60000000-0000-4000-8000-000000000001';
set local role authenticated;

select is(public.accept_invitation(), 'member',
  'once the admin revokes the alias@ invitation, the linked identity is just the member again');

-- An invitation the member accepted themselves is theirs, not someone else's.
reset role;
insert into public.invitations (email, accepted_at, accepted_by) values
  ('alias@example.test', now(), '00000000-0000-4000-8000-0000000000c1');
set local role authenticated;

select is(public.accept_invitation(), 'member',
  'an invitation accepted by the caller is not a conflict');

-- The gate never creates membership or consumes the other invitation.
reset role;
delete from public.invitations where email = 'alias@example.test';
insert into public.invitations (id, email) values
  ('60000000-0000-4000-8000-000000000002', 'alias@example.test');
delete from public.profiles where id = '00000000-0000-4000-8000-0000000000c1';
set local role authenticated;

select is(public.accept_invitation(), 'linked_identity',
  'a non-member signing in through the linked identity is refused too');

reset role;
select ok(
  not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000c1')
  and exists (select 1 from public.invitations
               where id = '60000000-0000-4000-8000-000000000002' and accepted_at is null),
  'a refused sign-in creates no membership and leaves the invitation unused'
);

select * from finish();

rollback;
