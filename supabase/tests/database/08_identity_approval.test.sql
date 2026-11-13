-- Identity approval (E2-D22): the access token hook and the database-side check.
-- Run with: npm run db:test
--
-- owner  : account email owner@. Identities: Google owner@ (same address),
--          GitHub alias@ and Google alias@ (linked by Supabase Auth because
--          the verified emails matched; different address).
-- other  : another member, used to check that approvals stay per user.
--
-- The hook is called with the event Supabase Auth sends (it is a definer
-- function, so the caller does not matter; who may call it is tested below).

begin;

select plan(32);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000c1', 'owner@example.test', now(), '{"sub": "g-owner"}'),
  ('00000000-0000-4000-8000-0000000000c2', 'other@example.test', now(), '{"sub": "g-other"}');

insert into auth.identities (id, provider_id, user_id, provider, identity_data) values
  ('10000000-0000-4000-8000-0000000000c1', 'g-owner', '00000000-0000-4000-8000-0000000000c1', 'google', '{"email": "owner@example.test"}'),
  ('10000000-0000-4000-8000-0000000000c2', 'h-owner', '00000000-0000-4000-8000-0000000000c1', 'github', '{"email": "Alias@Example.Test"}'),
  ('10000000-0000-4000-8000-0000000000c3', 'g-alias', '00000000-0000-4000-8000-0000000000c1', 'google', '{"email": "alias@example.test"}'),
  ('10000000-0000-4000-8000-0000000000c4', 'g-other', '00000000-0000-4000-8000-0000000000c2', 'google', '{"email": "other@example.test"}'),
  ('10000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c2', 'email', '{"email": "other@example.test"}');

insert into public.profiles (id) values
  ('00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-0000000000c2');

-- The admin once invited alias@ as a separate person. It must make no difference.
insert into public.invitations (email) values ('alias@example.test');

-- Sessions as Supabase Auth would have created them.
insert into auth.sessions (id, user_id) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000c1'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000c1'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000c2'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000c1');

create function pg_temp.event(p_user text, p_method text, p_session text) returns jsonb
language sql as $$
  select jsonb_build_object(
    'user_id', p_user,
    'authentication_method', p_method,
    'claims', jsonb_build_object('sub', p_user, 'session_id', p_session, 'role', 'authenticated'));
$$;

create function pg_temp.set_meta(p_user text, p_meta jsonb) returns void
language sql as $$
  update auth.users set raw_user_meta_data = p_meta where id = p_user::uuid;
$$;

create function pg_temp.as_member(p_user text, p_session text, p_auth_age_seconds int default 30) returns void
language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user, 'role', 'authenticated', 'session_id', p_session,
    'amr', jsonb_build_array(jsonb_build_object('method', 'oauth',
      'timestamp', extract(epoch from now())::int - p_auth_age_seconds)))::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Hook: sign-in
-- ---------------------------------------------------------------------------


select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'oauth', '20000000-0000-4000-8000-000000000001')) -> 'error',
  null,
  'sign-in with the identity whose email is the account email gets a token'
);

reset role;
select ok(
  exists (select 1 from public.approved_identities where identity_id = '10000000-0000-4000-8000-0000000000c1' and basis = 'account_email'),
  'that identity is approved automatically, on the account-email basis'
);
select is(
  (select identity_id from public.session_identities where session_id = '20000000-0000-4000-8000-000000000001'),
  '10000000-0000-4000-8000-0000000000c1'::uuid,
  'the session is recorded against the identity it was signed in with'
);

select pg_temp.set_meta('00000000-0000-4000-8000-0000000000c1', '{"sub": "g-alias"}');
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'oauth', '20000000-0000-4000-8000-000000000002')) -> 'error',
  '{"http_code": 403, "message": "identity_not_approved"}'::jsonb,
  'sign-in through a linked identity with a different address gets no token (403)'
);
reset role;
select ok(
  not exists (select 1 from public.session_identities where session_id = '20000000-0000-4000-8000-000000000002'),
  'a refused sign-in records no session'
);

select pg_temp.set_meta('00000000-0000-4000-8000-0000000000c1', '{"sub": "h-owner"}');
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'oauth', '20000000-0000-4000-8000-000000000002')) -> 'error' ->> 'message',
  'identity_not_approved',
  'the GitHub identity with the other address is refused too, until approved'
);

reset role;
delete from public.invitations where email = 'alias@example.test';
select pg_temp.set_meta('00000000-0000-4000-8000-0000000000c1', '{"sub": "g-alias"}');
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'oauth', '20000000-0000-4000-8000-000000000002')) -> 'error' ->> 'message',
  'identity_not_approved',
  'without any invitation the linked identity is still refused: invitations play no part'
);

select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'password', '20000000-0000-4000-8000-000000000002')) -> 'error' ->> 'message',
  'identity_not_approved',
  'the identity Supabase recorded is used whatever the method'
);

reset role;
select pg_temp.set_meta('00000000-0000-4000-8000-0000000000c1', '{"sub": "no-such-identity"}');
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'oauth', '20000000-0000-4000-8000-000000000002')) -> 'error' ->> 'message',
  'identity_unknown',
  'an OAuth sign-in whose identity cannot be found gets no token'
);
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000000c1', 'authentication_method', 'oauth', 'claims', '{}'::jsonb)) -> 'error' ->> 'message',
  'identity_unknown',
  'an event without a session id gets no token'
);

reset role;
select pg_temp.set_meta('00000000-0000-4000-8000-0000000000c2', '{}');
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c2', 'password', '20000000-0000-4000-8000-000000000004')) -> 'error',
  null,
  'a password sign-in without OAuth metadata uses the email identity (same address: approved)'
);

-- ---------------------------------------------------------------------------
-- Hook: refresh
-- ---------------------------------------------------------------------------

reset role;
-- Even if the metadata now names another identity, refresh follows the record.
select pg_temp.set_meta('00000000-0000-4000-8000-0000000000c1', '{"sub": "g-alias"}');
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'token_refresh', '20000000-0000-4000-8000-000000000001')) -> 'error',
  null,
  'a recorded, approved session is refreshed (metadata changes do not move it)'
);
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'token_refresh', '20000000-0000-4000-8000-000000000003')) -> 'error' ->> 'message',
  'identity_not_approved',
  'a session with no record (for example from before this change) is not refreshed'
);
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c2', 'token_refresh', '20000000-0000-4000-8000-000000000001')) -> 'error' ->> 'message',
  'identity_not_approved',
  'another user cannot refresh against this session''s record'
);

-- ---------------------------------------------------------------------------
-- Database-side check: session_is_approved, is_member, profiles
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000001');
select ok(public.is_member(), 'a member on a recorded, approved session is a member');
select is((select count(*)::int from public.profiles), 1, 'and can read their profile');

select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000003');
select ok(not public.is_member(), 'a valid token for a session with no record is not a member');
select is((select count(*)::int from public.profiles), 0, 'and cannot read the profile either');

select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000004');
select ok(not public.session_is_approved(), 'another user''s session id in the token does not count');

-- Sign-out deletes the session: the old access token stops working at once.
reset role;
insert into public.session_identities (session_id, user_id, identity_id) values
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-0000000000c1');
delete from auth.sessions where id = '20000000-0000-4000-8000-000000000005';
set local role authenticated;
select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000005');
select ok(not public.is_member(), 'a signed-out session''s access token is refused immediately');

-- ---------------------------------------------------------------------------
-- Member approval and listing
-- ---------------------------------------------------------------------------

select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000001');
select results_eq(
  $$select provider, approved, this_session from public.list_my_identities() order by provider, approved$$,
  $$values ('github'::text, false, false), ('google'::text, false, false), ('google'::text, true, true)$$,
  'the member sees their own identities, which are approved, and which one this session uses'
);

select is(public.approve_my_identity('10000000-0000-4000-8000-0000000000c4'), 'unknown',
  'a member cannot approve another user''s identity');

select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000001', 3600);
select is(public.approve_my_identity('10000000-0000-4000-8000-0000000000c2'), 'reauth_required',
  'approving needs a sign-in in the last 10 minutes');

select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000003');
select is(public.approve_my_identity('10000000-0000-4000-8000-0000000000c2'), 'not_member',
  'a session that is not approved cannot approve anything');

select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000001');
select is(public.approve_my_identity('10000000-0000-4000-8000-0000000000c2'), 'approved',
  'from an approved, recent session the member approves their GitHub identity');

reset role;
select pg_temp.set_meta('00000000-0000-4000-8000-0000000000c1', '{"sub": "h-owner"}');
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'oauth', '20000000-0000-4000-8000-000000000002')) -> 'error',
  null,
  'legitimate linking: once approved, the GitHub identity signs in'
);

-- Unlinking deletes the identity; its approval and session records go with it.
reset role;
delete from auth.identities where id = '10000000-0000-4000-8000-0000000000c2';
select is(
  public.custom_access_token_hook(pg_temp.event('00000000-0000-4000-8000-0000000000c1', 'token_refresh', '20000000-0000-4000-8000-000000000002')) -> 'error' ->> 'message',
  'identity_not_approved',
  'after unlinking, that identity''s session is not refreshed'
);
reset role;
set local role authenticated;
select pg_temp.as_member('00000000-0000-4000-8000-0000000000c1', '20000000-0000-4000-8000-000000000002');
select ok(not public.is_member(), 'and its current access token loses access at once');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

reset role;
select ok(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.custom_access_token_hook(jsonb)', 'execute'),
  'only Supabase Auth can call the hook'
);
select ok(
  not has_table_privilege('authenticated', 'public.approved_identities', 'select')
  and not has_table_privilege('authenticated', 'public.session_identities', 'insert'),
  'members cannot read or write approval and session records directly'
);

-- Invite-time check (secret-key role only).
set local role service_role;
select ok(public.invitation_email_conflict('alias@example.test'),
  'invite check: an address that signs in to another account is a conflict');
select ok(not public.invitation_email_conflict('owner@example.test'),
  'invite check: a user''s own account email is not a conflict (re-inviting a revoked member works)');
reset role;

select * from finish();

rollback;
