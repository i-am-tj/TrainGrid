-- Tests for save_personal_routine() (Epic 1, step 10).
-- Run with: npm run db:test

begin;

select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'user-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'user-b@example.test'),
  ('00000000-0000-4000-8000-00000000000c', 'user-c@example.test');

insert into public.profiles (id) values
  ('00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-00000000000b');

insert into public.routines (id, scope, owner_user_id, slug, name, category) values
  ('10000000-0000-4000-8000-000000000001', 'GLOBAL', null, 'global-lower', 'Global Lower', 'strength'),
  ('10000000-0000-4000-8000-0000000000b1', 'PERSONAL', '00000000-0000-4000-8000-00000000000b', null, 'B routine', 'running');

insert into public.workout_items (id, routine_id, name, sort_order) values
  ('20000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-0000000000b1', 'B item', 0);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.save_personal_routine(null, 'x', 'other', '', '[]'::jsonb)$$,
  '42501', null, 'anon cannot call save_personal_routine'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);
select throws_ok(
  $$select public.save_personal_routine(null, 'x', 'other', '', '[]'::jsonb)$$,
  '42501', null, 'a signed-in non-member cannot create a routine through it'
);

-- ---------------------------------------------------------------------------
-- User A creates and edits a routine
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

create temporary table saved (id uuid) on commit drop;
grant all on saved to authenticated;

insert into saved
select public.save_personal_routine(
  null, 'A Lower', 'strength', 'Squat day',
  '[{"name": "Back Squat", "instruction": "4 × 5", "rest": "2 min", "target": "RPE 7",
     "notes": "Brace", "equipment": ["barbell"], "video_url": "https://www.youtube.com/watch?v=abcdefghijk"},
    {"name": "Calf Raise"}]'::jsonb
);

select results_eq(
  $$select scope, owner_user_id, name, category, description from public.routines where id = (select id from saved)$$,
  $$values ('PERSONAL', '00000000-0000-4000-8000-00000000000a'::uuid, 'A Lower', 'strength', 'Squat day')$$,
  'a new routine is PERSONAL and owned by the caller'
);

select results_eq(
  $$select name, instruction, rest, target, notes, equipment, video_url, sort_order
      from public.workout_items where routine_id = (select id from saved) order by sort_order$$,
  $$values ('Back Squat', '4 × 5', '2 min', 'RPE 7', 'Brace', array['barbell'], 'https://www.youtube.com/watch?v=abcdefghijk', 0),
           ('Calf Raise', '', '', '', '', '{}'::text[], null::text, 1)$$,
  'items are stored with their structured fields, in order'
);

create temporary table first_ids (name text, id uuid) on commit drop;
grant all on first_ids to authenticated;
insert into first_ids select name, id from public.workout_items where routine_id = (select id from saved);

-- Reorder, edit one, drop one, add one.
select lives_ok(
  format(
    $f$select public.save_personal_routine(%L, 'A Lower v2', 'strength', '',
      jsonb_build_array(
        jsonb_build_object('name', 'Walking Lunge'),
        jsonb_build_object('id', %L, 'name', 'Back Squat', 'instruction', '5 × 5')
      ))$f$,
    (select id from saved),
    (select id from first_ids where name = 'Back Squat')
  ),
  'A can save their routine again with reordered and changed items'
);

select results_eq(
  $$select name, instruction, sort_order from public.workout_items
     where routine_id = (select id from saved) order by sort_order$$,
  $$values ('Walking Lunge', '', 0), ('Back Squat', '5 × 5', 1)$$,
  'the item list is replaced: new order, edits applied, removed item gone'
);

select is(
  (select id from public.workout_items where routine_id = (select id from saved) and name = 'Back Squat'),
  (select id from first_ids where name = 'Back Squat'),
  'D-04B: an item kept across saves keeps its id'
);

select is(
  (select name from public.routines where id = (select id from saved)),
  'A Lower v2',
  'routine fields are updated'
);

-- ---------------------------------------------------------------------------
-- What A cannot do
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.save_personal_routine('10000000-0000-4000-8000-0000000000b1', 'hacked', 'other', '', '[]'::jsonb)$$,
  'P0002', null, 'A cannot save over B''s routine'
);

select throws_ok(
  $$select public.save_personal_routine('10000000-0000-4000-8000-000000000001', 'hacked', 'other', '', '[]'::jsonb)$$,
  'P0002', null, 'A cannot save over a GLOBAL routine'
);

select lives_ok(
  format(
    $f$select public.save_personal_routine(%L, 'A Lower v3', 'strength', '',
      '[{"id": "20000000-0000-4000-8000-0000000000b1", "name": "Stolen"}]'::jsonb)$f$,
    (select id from saved)
  ),
  'an item id from another routine is accepted as input'
);

select isnt(
  (select id from public.workout_items where routine_id = (select id from saved) and name = 'Stolen'),
  '20000000-0000-4000-8000-0000000000b1'::uuid,
  '…but gets a new id instead of taking over the other routine''s item'
);

select throws_ok(
  $$select public.save_personal_routine(null, 'Bad', 'other', '', '{"not": "an array"}'::jsonb)$$,
  '22023', null, 'items must be an array'
);

select throws_ok(
  $$select public.save_personal_routine(null, 'Bad', 'other', '', '[{"name": "x", "equipment": ["trampoline"]}]'::jsonb)$$,
  '23514', null, 'table constraints still apply (unknown equipment)'
);

select throws_ok(
  $$select public.save_personal_routine(null, '   ', 'other', '', '[]'::jsonb)$$,
  '23514', null, 'table constraints still apply (blank name)'
);

-- E2-04: copying a GLOBAL routine creates through this function, so a copy that
-- fails part-way must leave nothing behind: not the routine, not the first items.
create temporary table before_count on commit drop as
  select count(*) as n from public.routines where owner_user_id = '00000000-0000-4000-8000-00000000000a';
grant select on before_count to authenticated;
select throws_ok(
  $$select public.save_personal_routine(null, 'Copy of Global Lower', 'strength', '',
      '[{"name": "Back Squat", "instruction": "3 × 8", "equipment": ["barbell"]},
        {"name": "Hip Thrust", "equipment": ["trampoline"]}]'::jsonb)$$,
  '23514', null, 'a create that fails on its second item is refused'
);
select is(
  (select count(*) from public.routines where owner_user_id = '00000000-0000-4000-8000-00000000000a'),
  (select n from before_count),
  'and leaves no routine (or items) behind: the save is one transaction'
);

reset role;

-- ---------------------------------------------------------------------------
-- Nothing of B's or the GLOBAL routine changed
-- ---------------------------------------------------------------------------

select results_eq(
  $$select name from public.routines where id = '10000000-0000-4000-8000-0000000000b1'$$,
  $$values ('B routine')$$,
  'B''s routine is unchanged'
);

select results_eq(
  $$select name, routine_id from public.workout_items where id = '20000000-0000-4000-8000-0000000000b1'$$,
  $$values ('B item', '10000000-0000-4000-8000-0000000000b1'::uuid)$$,
  'B''s item is unchanged and still belongs to B''s routine'
);

select results_eq(
  $$select name from public.routines where id = '10000000-0000-4000-8000-000000000001'$$,
  $$values ('Global Lower')$$,
  'the GLOBAL routine is unchanged'
);

select is(
  (select count(*)::int from public.routines where owner_user_id = '00000000-0000-4000-8000-00000000000c'),
  0,
  'the non-member created nothing'
);

select ok(
  (select prosecdef = false from pg_proc where oid = 'public.save_personal_routine(uuid, text, text, text, jsonb)'::regprocedure),
  'save_personal_routine runs as the caller (security invoker)'
);

select * from finish();

rollback;
