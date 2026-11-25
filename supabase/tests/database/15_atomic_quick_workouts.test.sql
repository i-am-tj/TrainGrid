-- Quick workouts start and finish in one transaction each, and a repeated
-- start returns the same workout (PRODUCT_AUDIT F18).
-- Run with: npm run db:test
--
--   q1: active member
--   q2: another active member
--   q3: revoked member

begin;

select plan(22);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000f1', 'member-q1@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000f2', 'member-q2@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000f3', 'revoked-q3@example.test', now(), '{}');
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000000f1', 'Member One'),
  ('00000000-0000-4000-8000-0000000000f2', 'Member Two');
insert into public.profiles (id, display_name, revoked_at) values
  ('00000000-0000-4000-8000-0000000000f3', 'Revoked', now());

-- q1's planned session, started.
insert into public.scheduled_sessions (id, user_id, date, name, category, duration_minutes) values
  ('30000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-0000000000f1', '2026-11-25', 'Tempo run', 'running', 45);
insert into public.workout_logs (session_id, user_id) values
  ('30000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-0000000000f1');

-- ---------------------------------------------------------------------------
-- Who may call them
-- ---------------------------------------------------------------------------

select ok(
  not (select prosecdef from pg_proc where oid = 'public.start_quick_workout(uuid, date, text, text, text, jsonb)'::regprocedure),
  'start_quick_workout runs as the caller (SECURITY INVOKER)'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.finish_workout(uuid, text, jsonb, text, timestamptz, text, timestamptz, uuid)'::regprocedure),
  'finish_workout runs as the caller (SECURITY INVOKER)'
);
select ok(
  not has_function_privilege('anon', 'public.start_quick_workout(uuid, date, text, text, text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.finish_workout(uuid, text, jsonb, text, timestamptz, text, timestamptz, uuid)', 'execute'),
  'anon can call neither'
);
select ok(
  has_function_privilege('authenticated', 'public.start_quick_workout(uuid, date, text, text, text, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.finish_workout(uuid, text, jsonb, text, timestamptz, text, timestamptz, uuid)', 'execute'),
  'signed-in members can call both'
);

-- ---------------------------------------------------------------------------
-- Starting: once per request id
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f1", "role": "authenticated"}', true);

select is(
  public.start_quick_workout('30000000-0000-4000-8000-0000000000f1', '2026-11-25', 'strength', 'Quick lift', 'kg', '{"version": 1, "items": []}'),
  '30000000-0000-4000-8000-0000000000f1'::uuid,
  'a member starts a quick workout under the id they chose'
);
select results_eq(
  $$select s.user_id, s.origin, s.name, l.status
      from public.scheduled_sessions s join public.workout_logs l on l.session_id = s.id
     where s.id = '30000000-0000-4000-8000-0000000000f1'$$,
  $$values ('00000000-0000-4000-8000-0000000000f1'::uuid, 'quick'::text, 'Quick lift'::text, 'in_progress'::text)$$,
  'the session is theirs, quick, and its workout is under way'
);

update public.workout_logs set entries = '{"version": 1, "items": [{"key": "k1", "name": "Squat", "sets": []}]}'
 where session_id = '30000000-0000-4000-8000-0000000000f1';

select is(
  public.start_quick_workout('30000000-0000-4000-8000-0000000000f1', '2026-11-26', 'running', 'Quick run', 'lb', '{"version": 1, "items": []}'),
  '30000000-0000-4000-8000-0000000000f1'::uuid,
  'the same request again returns the same workout'
);
select is(
  (select count(*)::int from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000f1'),
  1, 'without a second session'
);
select results_eq(
  $$select s.name, s.date, l.unit, jsonb_array_length(l.entries -> 'items')
      from public.scheduled_sessions s join public.workout_logs l on l.session_id = s.id
     where s.id = '30000000-0000-4000-8000-0000000000f1'$$,
  $$values ('Quick lift'::text, '2026-11-25'::date, 'kg'::text, 1)$$,
  'and without touching what was already logged'
);

select throws_ok(
  $$select public.start_quick_workout('30000000-0000-4000-8000-0000000000f9', '2026-11-25', 'strength', 'Quick lift', 'kg', '{"version": 1, "items": []}')$$,
  'P0002', null,
  'a planned session''s id is not adopted as a quick workout'
);

select throws_ok(
  $$select public.start_quick_workout('30000000-0000-4000-8000-0000000000f2', '2026-11-25', 'strength', 'Quick lift', 'stone', '{"version": 1, "items": []}')$$,
  '23514', null,
  'a start whose workout cannot be created fails as a whole'
);
reset role;
select is(
  (select count(*)::int from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000f2'),
  0, 'and leaves no empty session behind'
);

-- Another member cannot take over q1's workout through its id.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated"}', true);
select throws_ok(
  $$select public.start_quick_workout('30000000-0000-4000-8000-0000000000f1', '2026-11-25', 'strength', 'Quick lift', 'kg', '{"version": 1, "items": []}')$$,
  'P0002', null,
  'another member''s session id reads as not found'
);
select throws_ok(
  $$select public.finish_workout('30000000-0000-4000-8000-0000000000f1', 'kg', '{"version": 1, "items": []}', '', now(), 'Hijacked')$$,
  'P0002', null,
  'another member cannot finish or rename it'
);

-- A revoked member cannot start one.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f3", "role": "authenticated"}', true);
select throws_ok(
  $$select public.start_quick_workout('30000000-0000-4000-8000-0000000000f3', '2026-11-25', 'strength', 'Quick lift', 'kg', '{"version": 1, "items": []}')$$,
  '42501', null,
  'a revoked member cannot start a quick workout'
);

-- ---------------------------------------------------------------------------
-- Finishing: the log and the name together
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f1", "role": "authenticated"}', true);

select throws_ok(
  $$select public.finish_workout('30000000-0000-4000-8000-0000000000f1', 'kg', '{"version": 1, "items": []}', '', now(), repeat('x', 201))$$,
  '23514', null,
  'a finish whose name cannot be saved fails as a whole'
);
select is(
  (select status from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000f1'),
  'in_progress', 'and the workout is not left finished under its placeholder name'
);

select is(
  (public.finish_workout('30000000-0000-4000-8000-0000000000f1', 'kg', '{"version": 1, "items": []}', 'Good', now() + interval '1 day', 'Leg day')).status,
  'completed', 'a member finishes and names their quick workout'
);
select results_eq(
  -- now() is fixed for the whole test transaction, and the workout started at
  -- that same now(), so the finish lands at started + 1 ms, not a day later.
  $$select s.name, s.duration_minutes between 1 and 1440, l.finished_at < now() + interval '1 second', l.finished_at > l.started_at
      from public.scheduled_sessions s join public.workout_logs l on l.session_id = s.id
     where s.id = '30000000-0000-4000-8000-0000000000f1'$$,
  $$values ('Leg day'::text, true, true, true)$$,
  'the session takes the name and time trained; a future finish time is capped at now'
);

select is(
  (public.finish_workout('30000000-0000-4000-8000-0000000000f1', 'kg', '{"version": 1, "items": []}', 'Edited', now(), 'Leg day')).finished_at,
  (select finished_at from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000f1'),
  'finishing again keeps the first finish time'
);

select is(
  (public.finish_workout('30000000-0000-4000-8000-0000000000f9', 'kg', '{"version": 1, "items": []}', '', now(), 'Renamed')).status,
  'completed', 'a planned workout finishes the same way'
);
select results_eq(
  $$select name, duration_minutes from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000000f9'$$,
  $$values ('Tempo run'::text, 45)$$,
  'and keeps its own name and planned duration'
);

reset role;

select * from finish();

rollback;
