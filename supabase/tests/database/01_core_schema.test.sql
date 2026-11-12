-- Schema tests for the core tables (Epic 1, step 2).
-- Run with: npm run db:test
-- Everything happens inside one transaction that is rolled back.

begin;

select plan(38);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'routines', 'routines table exists');
select has_table('public', 'workout_items', 'workout_items table exists');
select has_table('public', 'scheduled_sessions', 'scheduled_sessions table exists');

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
     from information_schema.columns
    where table_schema = 'public'
      and (column_name like 'actual\_%'
           or column_name like 'completed\_%'
           or column_name in ('weight', 'reps', 'rpe', 'set_number'))),
  0,
  'D7: no performed-workout columns exist'
);

select col_not_null('public', 'scheduled_sessions', 'user_id', 'scheduled_sessions.user_id is mandatory');
select col_type_is('public', 'scheduled_sessions', 'snapshot', 'jsonb', 'snapshot is jsonb');
select col_type_is('public', 'workout_items', 'id', 'uuid', 'workout item ids are uuids');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select')
  and not has_table_privilege('anon', 'public.routines', 'select')
  and not has_table_privilege('anon', 'public.workout_items', 'select')
  and not has_table_privilege('anon', 'public.scheduled_sessions', 'select'),
  'anon has no read access to any table'
);

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'insert')
  and not has_table_privilege('authenticated', 'public.profiles', 'delete'),
  'members cannot create or delete profiles'
);

select ok(
  not has_column_privilege('authenticated', 'public.scheduled_sessions', 'user_id', 'update'),
  'members cannot reassign a session to another user'
);

select ok(
  not has_column_privilege('authenticated', 'public.routines', 'owner_user_id', 'update')
  and not has_column_privilege('authenticated', 'public.routines', 'scope', 'update'),
  'members cannot change a routine''s owner or scope'
);

select ok(
  not has_column_privilege('authenticated', 'public.workout_items', 'routine_id', 'update'),
  'members cannot move an item to another routine'
);

-- ---------------------------------------------------------------------------
-- Fixtures (created as the table owner; RLS does not apply here)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'user-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'user-b@example.test');

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-00000000000a', 'User A'),
  ('00000000-0000-4000-8000-00000000000b', 'User B');

-- ---------------------------------------------------------------------------
-- routines
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.routines (id, scope, slug, name, category)
    values ('10000000-0000-4000-8000-000000000001', 'GLOBAL', 'test-lower-a', 'Lower A', 'strength')$$,
  'GLOBAL routine without an owner is accepted'
);

select lives_ok(
  $$insert into public.routines (id, scope, owner_user_id, name, category)
    values ('10000000-0000-4000-8000-000000000002', 'PERSONAL',
            '00000000-0000-4000-8000-00000000000a', 'My Run', 'running')$$,
  'PERSONAL routine with an owner is accepted'
);

select throws_ok(
  $$insert into public.routines (scope, owner_user_id, name, category)
    values ('GLOBAL', '00000000-0000-4000-8000-00000000000a', 'Bad', 'other')$$,
  '23514', null, 'GLOBAL routine with an owner is rejected'
);

select throws_ok(
  $$insert into public.routines (scope, name, category) values ('PERSONAL', 'Bad', 'other')$$,
  '23514', null, 'PERSONAL routine without an owner is rejected'
);

select throws_ok(
  $$insert into public.routines (scope, name, category) values ('SHARED', 'Bad', 'other')$$,
  '23514', null, 'unknown scope is rejected'
);

select throws_ok(
  $$insert into public.routines (scope, owner_user_id, slug, name, category)
    values ('PERSONAL', '00000000-0000-4000-8000-00000000000a', 'mine', 'Bad', 'other')$$,
  '23514', null, 'PERSONAL routine cannot carry a slug'
);

select throws_ok(
  $$insert into public.routines (scope, slug, name, category)
    values ('GLOBAL', 'test-lower-a', 'Lower A again', 'strength')$$,
  '23505', null, 'duplicate slug is rejected'
);

select throws_ok(
  $$insert into public.routines (scope, name, category) values ('GLOBAL', 'Bad', 'yoga')$$,
  '23514', null, 'unknown category is rejected'
);

select throws_ok(
  $$insert into public.routines (scope, name, category) values ('GLOBAL', '   ', 'other')$$,
  '23514', null, 'blank routine name is rejected'
);

-- ---------------------------------------------------------------------------
-- workout_items
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.workout_items
      (id, routine_id, name, instruction, rest, target, notes, equipment, video_url, sort_order)
    values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
            'Back Squat', '4 × 5–6', '2–3 min', 'RPE 7–8', 'Controlled descent.',
            array['barbell'], 'https://www.youtube.com/watch?v=abcdefghijk', 0)$$,
  'fully specified workout item is accepted'
);

select lives_ok(
  $$insert into public.workout_items (routine_id, name, sort_order)
    values ('10000000-0000-4000-8000-000000000001', 'Calf Raise', 1)$$,
  'workout item with only a name and position is accepted'
);

select throws_ok(
  $$insert into public.workout_items (routine_id, name, equipment, sort_order)
    values ('10000000-0000-4000-8000-000000000001', 'Bad', array['trampoline'], 2)$$,
  '23514', null, 'unknown equipment tag is rejected'
);

select throws_ok(
  $$insert into public.workout_items (routine_id, name, video_url, sort_order)
    values ('10000000-0000-4000-8000-000000000001', 'Bad', 'javascript:alert(1)', 2)$$,
  '23514', null, 'non-https video URL is rejected'
);

select throws_ok(
  $$insert into public.workout_items (routine_id, name, sort_order)
    values ('10000000-0000-4000-8000-000000000001', '', 2)$$,
  '23514', null, 'blank item name is rejected'
);

select throws_ok(
  $q$do $do$
    begin
      set constraints all immediate;
      insert into public.workout_items (routine_id, name, sort_order)
      values ('10000000-0000-4000-8000-000000000001', 'Duplicate position', 1);
    end
    $do$$q$,
  '23505', null, 'two items cannot share a position in one routine'
);

set constraints all deferred;

-- ---------------------------------------------------------------------------
-- scheduled_sessions
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.scheduled_sessions
      (id, user_id, date, start_time, name, category, source_routine_id, snapshot)
    values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
            '2026-11-16', '07:30', 'Lower A', 'strength', '10000000-0000-4000-8000-000000000001',
            '{"version": 1, "items": [{"id": "40000000-0000-4000-8000-000000000001",
              "source_item_id": "20000000-0000-4000-8000-000000000001", "name": "Back Squat",
              "instruction": "4 × 5–6", "rest": "2–3 min", "target": "RPE 7–8", "notes": "",
              "equipment": ["barbell"], "video_url": null}]}'::jsonb)$$,
  'timed session with a snapshot is accepted'
);

select lives_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category)
    values ('00000000-0000-4000-8000-00000000000a', '2026-11-16', 'Stretch', 'other')$$,
  'untimed session with the default empty snapshot is accepted'
);

select throws_ok(
  $$insert into public.scheduled_sessions (date, name, category)
    values ('2026-11-16', 'No owner', 'other')$$,
  '23502', null, 'session without a user is rejected'
);

select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category, snapshot)
    values ('00000000-0000-4000-8000-00000000000a', '2026-11-16', 'Bad', 'other', '[]'::jsonb)$$,
  '23514', null, 'snapshot that is not an object is rejected'
);

select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category, snapshot)
    values ('00000000-0000-4000-8000-00000000000a', '2026-11-16', 'Bad', 'other',
            '{"version": 2, "items": []}'::jsonb)$$,
  '23514', null, 'snapshot with an unknown version is rejected'
);

select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category, duration_minutes)
    values ('00000000-0000-4000-8000-00000000000a', '2026-11-16', 'Bad', 'other', 0)$$,
  '23514', null, 'zero duration is rejected'
);

-- ---------------------------------------------------------------------------
-- Snapshot independence and cascades (D-03)
-- ---------------------------------------------------------------------------

delete from public.routines where id = '10000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::int from public.workout_items
    where routine_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'deleting a routine deletes its workout items'
);

select results_eq(
  $$select source_routine_id is null, jsonb_array_length(snapshot -> 'items')
      from public.scheduled_sessions
     where id = '30000000-0000-4000-8000-000000000001'$$,
  $$values (true, 1)$$,
  'D3: deleting the source routine keeps the session and its snapshot, and clears the reference'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

update public.scheduled_sessions
   set updated_at = '2000-01-01T00:00:00Z', name = 'Lower A (edited)'
 where id = '30000000-0000-4000-8000-000000000001';

select ok(
  (select updated_at > '2026-01-01T00:00:00Z' from public.scheduled_sessions
    where id = '30000000-0000-4000-8000-000000000001'),
  'updated_at is stamped by the trigger and cannot be set by the caller'
);

select * from finish();

rollback;
