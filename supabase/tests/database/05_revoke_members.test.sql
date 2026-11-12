-- Revoking accepted members (follow-up to Epic 1, step 8).
-- Run with: npm run db:test
--
--   member : accepted invitation, owns a routine and a session; gets revoked
--   admin  : accepted invitation; protected
--   pending: invitation never accepted

begin;

select plan(33);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e1', 'member@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000e2', 'admin@example.test', now(), '{}');

insert into auth.identities (provider_id, user_id, provider, identity_data) values
  ('g-e1', '00000000-0000-4000-8000-0000000000e1', 'google', '{"email": "member@example.test"}'),
  ('g-e2', '00000000-0000-4000-8000-0000000000e2', 'github', '{"email": "admin@example.test"}');

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000000e1', 'Member'),
  ('00000000-0000-4000-8000-0000000000e2', 'Admin');

insert into public.invitations (id, email, accepted_at, accepted_by) values
  ('60000000-0000-4000-8000-0000000000e1', 'member@example.test', now(), '00000000-0000-4000-8000-0000000000e1'),
  ('60000000-0000-4000-8000-0000000000e2', 'admin@example.test', now(), '00000000-0000-4000-8000-0000000000e2');
insert into public.invitations (id, email) values
  ('60000000-0000-4000-8000-0000000000e3', 'pending@example.test');

insert into public.routines (id, scope, owner_user_id, name, category) values
  ('10000000-0000-4000-8000-0000000000e1', 'PERSONAL', '00000000-0000-4000-8000-0000000000e1', 'Member routine', 'running'),
  ('10000000-0000-4000-8000-0000000000f1', 'GLOBAL', null, 'Global', 'other');
insert into public.workout_items (id, routine_id, name, sort_order) values
  ('20000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', 'Member item', 0);
insert into public.scheduled_sessions (id, user_id, date, name, category) values
  ('30000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e1', '2026-11-16', 'Member session', 'running');

-- ---------------------------------------------------------------------------
-- Who may call revoke_invitation()
-- ---------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.revoke_invitation('60000000-0000-4000-8000-0000000000e3', '{}')$$,
  '42501', null, 'anon cannot call revoke_invitation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}', true);
select throws_ok(
  $$select public.revoke_invitation('60000000-0000-4000-8000-0000000000e2', '{}')$$,
  '42501', null, 'a member cannot call revoke_invitation'
);

-- Before revocation the member sees their own data.
select is((select count(*)::int from public.scheduled_sessions), 1, 'before: member sees their session');
select is((select count(*)::int from public.routines where id::text like '10000000-%'), 2, 'before: member sees their routine and the GLOBAL one');
reset role;

-- ---------------------------------------------------------------------------
-- revoke_invitation() outcomes (as the service role)
-- ---------------------------------------------------------------------------

set local role service_role;

select is(
  public.revoke_invitation('60000000-0000-4000-8000-0000000000e2', array['00000000-0000-4000-8000-0000000000e2']::uuid[]),
  'protected', 'an admin''s accepted invitation is protected'
);
select is(
  public.revoke_invitation('60000000-0000-4000-8000-0000000000ff', '{}'),
  'not_found', 'unknown invitation'
);
select is(
  public.revoke_invitation('60000000-0000-4000-8000-0000000000e3', '{}'),
  'revoked', 'a pending invitation is revoked'
);
select is(
  public.revoke_invitation('60000000-0000-4000-8000-0000000000e3', '{}'),
  'already_revoked', 'revoking twice is reported, not repeated'
);
select is(
  public.revoke_invitation('60000000-0000-4000-8000-0000000000e1', array['00000000-0000-4000-8000-0000000000e2']::uuid[]),
  'revoked', 'an accepted member''s invitation is revoked'
);

reset role;

select ok(
  (select revoked_at is not null from public.profiles where id = '00000000-0000-4000-8000-0000000000e1'),
  'the member''s profile is marked revoked'
);
select ok(
  (select revoked_at is null from public.profiles where id = '00000000-0000-4000-8000-0000000000e2'),
  'the admin is untouched'
);
select ok(
  (select revoked_at is null from public.invitations where id = '60000000-0000-4000-8000-0000000000e2'),
  'the admin''s invitation is untouched'
);

-- ---------------------------------------------------------------------------
-- The revoked member has no access, to anything, including their own rows
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}', true);

select ok(not public.is_member(), 'a revoked member is not a member');
select is_empty('select 1 from public.scheduled_sessions', 'revoked: cannot read their own sessions');
select is_empty('select 1 from public.routines', 'revoked: cannot read their own routines or GLOBAL ones');
select is_empty('select 1 from public.workout_items', 'revoked: cannot read any items');
select results_eq(
  'select revoked_at is not null from public.profiles',
  $$values (true)$$,
  'revoked: can still see their own profile row (so the app can tell them apart)'
);

select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category)
    values ('00000000-0000-4000-8000-0000000000e1', '2026-11-17', 'sneaky', 'other')$$,
  '42501', null, 'revoked: cannot add a session'
);
select throws_ok(
  $$insert into public.routines (scope, owner_user_id, name, category)
    values ('PERSONAL', '00000000-0000-4000-8000-0000000000e1', 'sneaky', 'other')$$,
  '42501', null, 'revoked: cannot add a routine'
);
select throws_ok(
  $$select public.save_personal_routine('10000000-0000-4000-8000-0000000000e1', 'sneaky', 'other', '', '[]'::jsonb)$$,
  'P0002', null, 'revoked: cannot save their routine through the function'
);
select throws_ok(
  $$update public.profiles set revoked_at = null$$,
  '42501', null, 'revoked: cannot un-revoke themselves'
);

update public.scheduled_sessions set name = 'changed';
delete from public.scheduled_sessions;
update public.routines set name = 'changed';
delete from public.routines;
delete from public.workout_items;
update public.profiles set display_name = 'changed';

select is(public.accept_invitation(), 'not_invited', 'revoked: signing in again does not restore access');

reset role;

select results_eq(
  $$select name from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000e1'$$,
  $$values ('Member session')$$,
  'the member''s session is kept and unchanged'
);
select results_eq(
  $$select name from public.routines where id = '10000000-0000-4000-8000-0000000000e1'$$,
  $$values ('Member routine')$$,
  'the member''s routine is kept and unchanged'
);
select results_eq(
  $$select name from public.workout_items where id = '20000000-0000-4000-8000-0000000000e1'$$,
  $$values ('Member item')$$,
  'the member''s item is kept and unchanged'
);
select results_eq(
  $$select display_name from public.profiles where id = '00000000-0000-4000-8000-0000000000e1'$$,
  $$values ('Member')$$,
  'the member''s profile was not changed'
);

-- ---------------------------------------------------------------------------
-- Invite again: access returns, with the data
-- ---------------------------------------------------------------------------

insert into public.invitations (id, email) values
  ('60000000-0000-4000-8000-0000000000e4', 'member@example.test');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}', true);

select is(public.accept_invitation(), 'member', 'a new invitation restores the member');
select ok(public.is_member(), 'restored member is a member again');
select results_eq(
  'select name from public.scheduled_sessions',
  $$values ('Member session')$$,
  'restored member sees their kept session'
);
select results_eq(
  $$select name from public.routines where scope = 'PERSONAL'$$,
  $$values ('Member routine')$$,
  'restored member sees their kept routine'
);

reset role;

select results_eq(
  $$select accepted_by from public.invitations where id = '60000000-0000-4000-8000-0000000000e4'$$,
  $$values ('00000000-0000-4000-8000-0000000000e1'::uuid)$$,
  'the new invitation is marked accepted'
);

-- ---------------------------------------------------------------------------
-- Other members were never affected
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}', true);
select ok(public.is_member(), 'the admin stayed a member throughout');
select is_empty(
  $$select 1 from public.scheduled_sessions where user_id = '00000000-0000-4000-8000-0000000000e1'$$,
  'the admin still cannot see the member''s sessions'
);
reset role;

select * from finish();

rollback;
