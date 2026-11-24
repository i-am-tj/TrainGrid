-- Finishing a workout refuses a log saved from another device since the
-- caller last saw it, instead of overwriting it. A device's own earlier save
-- (its reply lost) is not a conflict.
-- Run with: npm run db:test
--
--   w1: active member with a workout under way
--
-- now() is fixed for the whole test transaction, so every write here leaves
-- updated_at at now(). A stale version is any other timestamp.

begin;

select plan(10);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e1', 'member-w1@example.test', now(), '{}');
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000000e1', 'Member One');
insert into public.scheduled_sessions (id, user_id, date, name, category, duration_minutes) values
  ('30000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e1', '2026-11-26', 'Upper body', 'strength', 45);
-- Last saved by the "tablet" device.
insert into public.workout_logs (session_id, user_id, started_at, notes, saved_by) values
  ('30000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e1', now() - interval '1 hour', 'From the other device',
   '0e000000-0000-4000-8000-0000000000b2');

select is(
  to_regprocedure('public.finish_workout(uuid, text, jsonb, text, timestamptz, text)'),
  null,
  'the finish without a version check is gone'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.finish_workout(uuid, text, jsonb, text, timestamptz, text, timestamptz, uuid)'::regprocedure),
  'finish_workout still runs as the caller (SECURITY INVOKER)'
);
select ok(
  has_column_privilege('authenticated', 'public.workout_logs', 'saved_by', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.workout_logs', 'user_id', 'UPDATE'),
  'members may record which device saved, and still never the owner'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}', true);

select throws_ok(
  $$select public.finish_workout('30000000-0000-4000-8000-0000000000e1', 'kg', '{"version": 1, "items": []}',
      'From this device', now(), null, now() - interval '1 minute', '0e000000-0000-4000-8000-0000000000a1')$$,
  '40001', 'Workout changed since it was loaded',
  'a finish from a stale version, saved since by another device, is refused'
);
select throws_ok(
  $$select public.finish_workout('30000000-0000-4000-8000-0000000000e1', 'kg', '{"version": 1, "items": []}',
      'From this device', now(), null, now() - interval '1 minute')$$,
  '40001', 'Workout changed since it was loaded',
  'so is a stale finish that names no device'
);
select results_eq(
  $$select status, notes from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  $$values ('in_progress'::text, 'From the other device'::text)$$,
  'and the other device''s version is left as it was'
);

select is(
  (public.finish_workout('30000000-0000-4000-8000-0000000000e1', 'kg', '{"version": 1, "items": []}',
      'From this device', now(), null,
      (select updated_at from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'),
      '0e000000-0000-4000-8000-0000000000a1')).status,
  'completed',
  'a finish from the current version completes the workout'
);
select results_eq(
  $$select notes, saved_by from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000000e1'$$,
  $$values ('From this device'::text, '0e000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'with this device''s values, recorded as its save'
);
select is(
  (public.finish_workout('30000000-0000-4000-8000-0000000000e1', 'kg', '{"version": 1, "items": []}',
      'Retried', now(), null, now() - interval '1 minute', '0e000000-0000-4000-8000-0000000000a1')).notes,
  'Retried',
  'a stale finish from the device that saved last applies (its own reply was lost)'
);
select is(
  (public.finish_workout('30000000-0000-4000-8000-0000000000e1', 'kg', '{"version": 1, "items": []}',
      'Edited later', now())).notes,
  'Edited later',
  'without a version, a finish applies as before'
);

reset role;

select * from finish();

rollback;
