-- Workout logs (live workouts).
-- Run with: npm run db:test
--
--   w1: active member with a session
--   w2: another active member with a session
--   w3: revoked member with a session

begin;

select plan(28);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e1', 'member-w1@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000e2', 'member-w2@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000e3', 'revoked-w3@example.test', now(), '{}');
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000000e1', 'Member One'),
  ('00000000-0000-4000-8000-0000000000e2', 'Member Two');
insert into public.profiles (id, display_name, revoked_at) values
  ('00000000-0000-4000-8000-0000000000e3', 'Revoked', now());

insert into public.scheduled_sessions (id, user_id, date, name, category) values
  ('30000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e1', '2026-11-20', 'Upper A', 'strength'),
  ('30000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000e2', '2026-11-20', 'Lower A', 'strength'),
  ('30000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000e3', '2026-11-20', 'Easy run', 'running'),
  ('30000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000e1', '2026-11-21', 'Spare', 'strength');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.workout_logs'::regclass),
  'RLS is enabled on workout_logs'
);
select ok(not has_table_privilege('anon', 'public.workout_logs', 'select'), 'anon cannot read logs');
select ok(not has_table_privilege('anon', 'public.workout_logs', 'insert'), 'anon cannot write logs');
select ok(not has_column_privilege('authenticated', 'public.workout_logs', 'user_id', 'insert'), 'members cannot choose the owner');
select ok(not has_column_privilege('authenticated', 'public.workout_logs', 'user_id', 'update'), 'members cannot change the owner');
select ok(not has_column_privilege('authenticated', 'public.workout_logs', 'session_id', 'update'), 'members cannot move a log to another session');
select ok(has_column_privilege('authenticated', 'public.workout_logs', 'entries', 'update'), 'members can update their sets');

-- ---------------------------------------------------------------------------
-- An active member logs their own session
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.workout_logs (session_id) values ('30000000-0000-4000-8000-0000000000e1')$$,
  'an active member can start a workout for their own session'
);
select is(
  (select user_id from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'),
  '00000000-0000-4000-8000-0000000000e1'::uuid,
  'the owner defaults to the caller'
);
select throws_ok(
  $$insert into public.workout_logs (session_id) values ('30000000-0000-4000-8000-0000000000e1')$$,
  '23505', null, 'a session has at most one log'
);
select throws_ok(
  $$insert into public.workout_logs (session_id) values ('30000000-0000-4000-8000-0000000000e2')$$,
  '42501', null, 'another member''s session cannot be logged'
);
select throws_ok(
  $$insert into public.workout_logs (user_id, session_id) values ('00000000-0000-4000-8000-0000000000e2', '30000000-0000-4000-8000-0000000000e4')$$,
  '42501', null, 'a log cannot be written for someone else'
);
select lives_ok(
  $$update public.workout_logs
       set entries = '{"version": 1, "items": [{"item_id": "40000000-0000-4000-8000-000000000001", "name": "Bench Press", "sets": [{"weight": 80, "reps": 6, "done": true}]}]}'::jsonb
     where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  'a member can record sets'
);
select throws_ok(
  $$update public.workout_logs set entries = '{"version": 2, "items": []}'::jsonb
     where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'an unknown entries version is refused'
);
select throws_ok(
  $$update public.workout_logs set unit = 'stone'
     where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'an unknown unit is refused'
);
select throws_ok(
  $$update public.workout_logs set status = 'completed'
     where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'a completed workout needs a finish time'
);
select throws_ok(
  $$update public.workout_logs set finished_at = started_at - interval '1 minute', status = 'completed'
     where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  '23514', null, 'a workout cannot finish before it started'
);
select lives_ok(
  $$update public.workout_logs set status = 'completed', finished_at = now()
     where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  'a member can finish their workout'
);

-- ---------------------------------------------------------------------------
-- Other members and revoked members
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.workout_logs), 0, 'another member sees no one else''s logs'
);
select lives_ok(
  $$update public.workout_logs set notes = 'hijacked'$$,
  'an update of someone else''s log runs'
);
select lives_ok(
  $$delete from public.workout_logs$$,
  'a delete of someone else''s log runs'
);
select lives_ok(
  $$insert into public.workout_logs (session_id) values ('30000000-0000-4000-8000-0000000000e2')$$,
  'the other member can log their own session'
);

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e3", "role": "authenticated"}', true);
select throws_ok(
  $$insert into public.workout_logs (session_id) values ('30000000-0000-4000-8000-0000000000e3')$$,
  '42501', null, 'a revoked member cannot start a workout'
);

reset role;

-- ---------------------------------------------------------------------------
-- What was stored
-- ---------------------------------------------------------------------------

select is(
  (select notes from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'),
  '', 'another member''s update changed nothing'
);
select is(
  (select count(*)::int from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'),
  1, 'another member''s delete removed nothing'
);
select is(
  (select status from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'),
  'completed', 'the finished workout is stored as completed'
);

-- Deleting the session deletes its log.
delete from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000e1';
select is(
  (select count(*)::int from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'),
  0, 'a log is deleted with its session'
);

-- Deleting a member removes their logs with them.
delete from auth.users where id = '00000000-0000-4000-8000-0000000000e2';
select is(
  (select count(*)::int from public.workout_logs), 0, 'logs are deleted with their member'
);

select * from finish();
rollback;
