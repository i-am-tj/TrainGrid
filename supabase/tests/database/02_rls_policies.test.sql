-- Row Level Security tests (Epic 1, step 3).
-- Run with: npm run db:test
--
-- Queries run as the `anon` and `authenticated` database roles with a JWT
-- subject set, exactly as the Supabase API would run them, so these prove the
-- policies themselves and not application code.
--
-- Identities
--   User A, User B : members (have a profiles row)
--   User C         : authenticated but never invited (no profiles row)
--
-- Statements blocked by a USING clause affect zero rows without raising, so
-- those attempts are executed as the user and then verified as the owner role.

begin;

select plan(52);

-- ---------------------------------------------------------------------------
-- Fixtures (as the owner role; RLS does not apply)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'user-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'user-b@example.test'),
  ('00000000-0000-4000-8000-00000000000c', 'user-c@example.test');

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-00000000000a', 'User A'),
  ('00000000-0000-4000-8000-00000000000b', 'User B');

insert into public.routines (id, scope, owner_user_id, slug, name, category) values
  ('10000000-0000-4000-8000-000000000001', 'GLOBAL', null, 'global-lower', 'Global Lower', 'strength'),
  ('10000000-0000-4000-8000-0000000000a1', 'PERSONAL', '00000000-0000-4000-8000-00000000000a', null, 'A routine', 'running'),
  ('10000000-0000-4000-8000-0000000000b1', 'PERSONAL', '00000000-0000-4000-8000-00000000000b', null, 'B routine', 'running');

insert into public.workout_items (id, routine_id, name, sort_order) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Global item', 0),
  ('20000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a1', 'A item', 0),
  ('20000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-0000000000b1', 'B item', 0);

insert into public.scheduled_sessions (id, user_id, date, name, category, source_routine_id) values
  ('30000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', '2026-11-16', 'A session', 'running', null),
  ('30000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', '2026-11-17', 'B session', 'running', '10000000-0000-4000-8000-0000000000b1');

-- ---------------------------------------------------------------------------
-- Coverage of the policy set itself
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'S4: Row Level Security is enabled on every table in public'
);

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (
        select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
      )),
  0,
  'every table in public has at least one policy'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and roles <> '{authenticated}'),
  0,
  'every policy targets the authenticated role only'
);

-- ---------------------------------------------------------------------------
-- I11: anonymous key reads and writes nothing
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok('select * from public.profiles', '42501', null, 'I11: anon cannot read profiles');
select throws_ok('select * from public.routines', '42501', null, 'I11: anon cannot read routines');
select throws_ok('select * from public.workout_items', '42501', null, 'I11: anon cannot read workout items');
select throws_ok('select * from public.scheduled_sessions', '42501', null, 'I11: anon cannot read scheduled sessions');
select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category)
    values ('00000000-0000-4000-8000-00000000000a', '2026-11-16', 'anon', 'other')$$,
  '42501', null, 'I11: anon cannot insert a scheduled session'
);

reset role;

-- ---------------------------------------------------------------------------
-- User A: what is visible
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

select ok(public.is_member(), 'A is a member');

select results_eq(
  'select id from public.profiles',
  $$values ('00000000-0000-4000-8000-00000000000a'::uuid)$$,
  'A sees only their own profile'
);

select set_eq(
  'select id from public.routines',
  $$values ('10000000-0000-4000-8000-000000000001'::uuid),
           ('10000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'I9: A sees GLOBAL routines and their own, not B''s'
);

select set_eq(
  'select id from public.workout_items',
  $$values ('20000000-0000-4000-8000-000000000001'::uuid),
           ('20000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'A sees items of GLOBAL routines and their own, not B''s'
);

select results_eq(
  'select id from public.scheduled_sessions',
  $$values ('30000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'I1: A sees only A''s schedule'
);

select is_empty(
  $$select 1 from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000b1'$$,
  'I2: A cannot read B''s session by id'
);

select is_empty(
  $$select 1 from public.routines where id = '10000000-0000-4000-8000-0000000000b1'$$,
  'I6: A cannot read B''s personal routine by id'
);

select is_empty(
  $$select 1 from public.workout_items where routine_id = '10000000-0000-4000-8000-0000000000b1'$$,
  'I6: A cannot read the items of B''s personal routine'
);

-- ---------------------------------------------------------------------------
-- User A: inserts
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.scheduled_sessions (id, user_id, date, name, category, source_routine_id)
    values ('30000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a',
            '2026-11-18', 'A from global', 'strength', '10000000-0000-4000-8000-000000000001')$$,
  'A can schedule a session for themselves from a GLOBAL routine'
);

select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category)
    values ('00000000-0000-4000-8000-00000000000b', '2026-11-18', 'planted', 'other')$$,
  '42501', null, 'I5: A cannot insert a session owned by B'
);

select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category, source_routine_id)
    values ('00000000-0000-4000-8000-00000000000a', '2026-11-18', 'probe', 'other',
            '10000000-0000-4000-8000-0000000000b1')$$,
  '42501', null, 'A cannot reference B''s personal routine as a session source'
);

select lives_ok(
  $$insert into public.routines (id, scope, owner_user_id, name, category)
    values ('10000000-0000-4000-8000-0000000000a2', 'PERSONAL',
            '00000000-0000-4000-8000-00000000000a', 'A second routine', 'other')$$,
  'A can create a PERSONAL routine for themselves'
);

select throws_ok(
  $$insert into public.routines (scope, owner_user_id, name, category)
    values ('PERSONAL', '00000000-0000-4000-8000-00000000000b', 'planted', 'other')$$,
  '42501', null, 'I7: A cannot insert a routine owned by B'
);

select throws_ok(
  $$insert into public.routines (scope, name, category) values ('GLOBAL', 'planted', 'other')$$,
  '42501', null, 'I7: A cannot insert a GLOBAL routine'
);

select lives_ok(
  $$insert into public.workout_items (routine_id, name, sort_order)
    values ('10000000-0000-4000-8000-0000000000a1', 'A new item', 1)$$,
  'A can add an item to their own routine'
);

select throws_ok(
  $$insert into public.workout_items (routine_id, name, sort_order)
    values ('10000000-0000-4000-8000-0000000000b1', 'planted', 1)$$,
  '42501', null, 'A cannot add an item to B''s routine'
);

select throws_ok(
  $$insert into public.workout_items (routine_id, name, sort_order)
    values ('10000000-0000-4000-8000-000000000001', 'planted', 1)$$,
  '42501', null, 'I9: A cannot add an item to a GLOBAL routine'
);

select throws_ok(
  $$insert into public.profiles (id) values ('00000000-0000-4000-8000-00000000000c')$$,
  '42501', null, 'A cannot create a profile'
);

-- ---------------------------------------------------------------------------
-- User A: ownership cannot be changed, profiles cannot be deleted
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.scheduled_sessions
       set user_id = '00000000-0000-4000-8000-00000000000b'
     where id = '30000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'A cannot hand their session to B'
);

select throws_ok(
  $$update public.routines set scope = 'GLOBAL'
     where id = '10000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'A cannot promote their routine to GLOBAL'
);

select throws_ok('delete from public.profiles', '42501', null, 'A cannot delete profiles');

select lives_ok(
  $$update public.profiles set display_name = 'A renamed'$$,
  'A can update their own profile'
);

-- ---------------------------------------------------------------------------
-- User A: attempts against rows that are not theirs (silently affect nothing)
-- ---------------------------------------------------------------------------

update public.scheduled_sessions set name = 'hacked'
 where id = '30000000-0000-4000-8000-0000000000b1';
delete from public.scheduled_sessions
 where id = '30000000-0000-4000-8000-0000000000b1';

update public.routines set name = 'hacked'
 where id in ('10000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001');
delete from public.routines
 where id in ('10000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001');

update public.workout_items set name = 'hacked'
 where id in ('20000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-000000000001');
delete from public.workout_items
 where id in ('20000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-000000000001');

update public.profiles set display_name = 'hacked'
 where id = '00000000-0000-4000-8000-00000000000b';

-- I8: "Duplicate Week" aimed at B's week copies nothing, because B's rows
-- are not visible to A.
insert into public.scheduled_sessions (user_id, date, name, category, snapshot)
select '00000000-0000-4000-8000-00000000000a', date + 7, name, category, snapshot
  from public.scheduled_sessions
 where user_id = '00000000-0000-4000-8000-00000000000b';

reset role;

select results_eq(
  $$select name from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000b1'$$,
  $$values ('B session')$$,
  'I3, I4: B''s session is neither changed nor deleted by A'
);

select results_eq(
  $$select name from public.routines where id = '10000000-0000-4000-8000-0000000000b1'$$,
  $$values ('B routine')$$,
  'I6: B''s personal routine is neither changed nor deleted by A'
);

select results_eq(
  $$select name from public.workout_items where id = '20000000-0000-4000-8000-0000000000b1'$$,
  $$values ('B item')$$,
  'I6: B''s workout item is neither changed nor deleted by A'
);

select results_eq(
  $$select name from public.routines where id = '10000000-0000-4000-8000-000000000001'$$,
  $$values ('Global Lower')$$,
  'I9: the GLOBAL routine is neither changed nor deleted by a member'
);

select results_eq(
  $$select name from public.workout_items where id = '20000000-0000-4000-8000-000000000001'$$,
  $$values ('Global item')$$,
  'I9: the GLOBAL routine''s item is neither changed nor deleted by a member'
);

select results_eq(
  $$select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000b'$$,
  $$values ('User B')$$,
  'B''s profile is not changed by A'
);

select is(
  (select count(*)::int from public.scheduled_sessions
    where user_id = '00000000-0000-4000-8000-00000000000a' and date = '2026-11-24'),
  0,
  'I8: A cannot duplicate B''s week'
);

select results_eq(
  $$select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a'$$,
  $$values ('A renamed')$$,
  'A''s own profile update took effect'
);

-- ---------------------------------------------------------------------------
-- User A: full control over their own rows
-- ---------------------------------------------------------------------------

set local role authenticated;

update public.scheduled_sessions set name = 'A edited'
 where id = '30000000-0000-4000-8000-0000000000a1';
delete from public.scheduled_sessions
 where id = '30000000-0000-4000-8000-0000000000a2';
update public.routines set name = 'A routine edited'
 where id = '10000000-0000-4000-8000-0000000000a1';
delete from public.workout_items
 where id = '20000000-0000-4000-8000-0000000000a1';
delete from public.routines
 where id = '10000000-0000-4000-8000-0000000000a2';

reset role;

select results_eq(
  $$select name from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000a1'$$,
  $$values ('A edited')$$,
  'A can update their own session'
);

select is_empty(
  $$select 1 from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000a2'$$,
  'A can delete their own session'
);

select results_eq(
  $$select name from public.routines where id = '10000000-0000-4000-8000-0000000000a1'$$,
  $$values ('A routine edited')$$,
  'A can update their own routine'
);

select is_empty(
  $$select 1 from public.workout_items where id = '20000000-0000-4000-8000-0000000000a1'$$,
  'A can delete an item from their own routine'
);

select is_empty(
  $$select 1 from public.routines where id = '10000000-0000-4000-8000-0000000000a2'$$,
  'A can delete their own routine'
);

-- ---------------------------------------------------------------------------
-- User B: the mirror image
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);

select results_eq(
  'select id from public.scheduled_sessions',
  $$values ('30000000-0000-4000-8000-0000000000b1'::uuid)$$,
  'I1: B sees only B''s schedule'
);

select set_eq(
  'select id from public.routines',
  $$values ('10000000-0000-4000-8000-000000000001'::uuid),
           ('10000000-0000-4000-8000-0000000000b1'::uuid)$$,
  'B sees GLOBAL routines and their own, not A''s'
);

reset role;

-- ---------------------------------------------------------------------------
-- I10: User C is authenticated but was never invited
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);

select ok(not public.is_member(), 'I10: an uninvited user is not a member');
select is_empty('select 1 from public.profiles', 'I10: uninvited user sees no profiles');
select is_empty('select 1 from public.routines', 'I10: uninvited user sees no routines, not even GLOBAL ones');
select is_empty('select 1 from public.workout_items', 'I10: uninvited user sees no workout items');
select is_empty('select 1 from public.scheduled_sessions', 'I10: uninvited user sees no sessions');

select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category)
    values ('00000000-0000-4000-8000-00000000000c', '2026-11-18', 'uninvited', 'other')$$,
  '42501', null, 'I10: uninvited user cannot create a session for themselves'
);

select throws_ok(
  $$insert into public.routines (scope, owner_user_id, name, category)
    values ('PERSONAL', '00000000-0000-4000-8000-00000000000c', 'uninvited', 'other')$$,
  '42501', null, 'I10: uninvited user cannot create a routine for themselves'
);

reset role;

select * from finish();

rollback;
