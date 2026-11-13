-- GLOBAL routines seeded from data/templates (Epic 1, step 11).
-- These run after `supabase db reset`, which applies supabase/seed.sql.

begin;

select plan(12);

-- E2-D22: is_member() needs the token's session to exist in auth.sessions.
-- Gives every test user one, with session id = user id.
create function pg_temp.bind_sessions() returns void
language sql security definer as $bind$
  insert into auth.sessions (id, user_id)
  select u.id, u.id from auth.users u
  on conflict (id) do nothing;
$bind$;

select is(
  (select count(*)::int from public.routines where scope = 'GLOBAL' and slug is not null),
  18, 'all 18 templates are seeded as GLOBAL routines'
);
select is(
  (select count(*)::int from public.workout_items wi
     join public.routines r on r.id = wi.routine_id
    where r.scope = 'GLOBAL' and r.slug is not null),
  96, 'with all 96 workout items'
);
select is(
  (select count(*)::int from public.routines where slug is not null and owner_user_id is not null),
  0, 'seeded routines have no owner'
);

select results_eq(
  $$select wi.name, wi.instruction, wi.rest, wi.target, wi.notes, wi.equipment
      from public.workout_items wi join public.routines r on r.id = wi.routine_id
     where r.slug = 'lower-a' and wi.sort_order = 0$$,
  $$values ('Back Squat', '4 × 5–6', '2–3 min', 'RPE 7–8',
            'Controlled descent. Drive aggressively out of the bottom.', array['barbell'])$$,
  'structured fields are filled from the template (Lower A, first item)'
);
select results_eq(
  $$select wi.equipment from public.workout_items wi join public.routines r on r.id = wi.routine_id
     where r.slug = 'lower-a' and wi.name = 'Bulgarian Split Squat'$$,
  $$values (array['dumbbell', 'bench'])$$,
  'several equipment tags survive'
);
select results_eq(
  $$select wi.target from public.workout_items wi join public.routines r on r.id = wi.routine_id
     where r.slug = 'tempo-run' and wi.name = 'Main'$$,
  $$values ('RPE 6–7 / 10')$$,
  '"Intensity" becomes the target'
);
select results_eq(
  $$select string_agg(wi.name, ' > ' order by wi.sort_order)
      from public.workout_items wi join public.routines r on r.id = wi.routine_id
     where r.slug = 'tempo-run'$$,
  $$values ('Warm-up > Main > Recovery > Cooldown > Progression')$$,
  'item order is preserved'
);
select is(
  (select count(*)::int from public.workout_items wi
     join public.routines r on r.id = wi.routine_id
    where r.scope = 'GLOBAL' and r.slug is not null
      and (wi.instruction ~* '^\s*(rest|target|intensity|equipment|video)\s*:'
           or wi.notes ~* '(^|\n)\s*(rest|target|intensity|equipment|video)\s*:')),
  0, 'no metadata line was left inside instructions or notes'
);

-- Members read them; nobody changes them.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'seed-member@example.test');
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000000d1');

set local role authenticated;
select pg_temp.bind_sessions();
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "session_id": "00000000-0000-4000-8000-0000000000d1"}', true);

select is(
  (select count(*)::int from public.routines where scope = 'GLOBAL' and slug is not null),
  18, 'a member can read every seeded routine'
);

update public.routines set name = 'hacked' where slug = 'lower-a';
delete from public.workout_items where routine_id = (select id from public.routines where slug = 'lower-a');
select throws_ok(
  $$select public.save_personal_routine((select id from public.routines where slug = 'lower-a'), 'hacked', 'other', '', '[]'::jsonb)$$,
  'P0002', null, 'a member cannot save over a seeded routine'
);

reset role;

select results_eq(
  $$select r.name, count(wi.id)::int from public.routines r
      join public.workout_items wi on wi.routine_id = r.id
     where r.slug = 'lower-a' group by r.name$$,
  $$values ('Lower A', 6)$$,
  'the seeded routine is unchanged after a member tried'
);

set local role anon;
select throws_ok('select 1 from public.routines', '42501', null, 'anon cannot read seeded routines');
reset role;

select * from finish();

rollback;
