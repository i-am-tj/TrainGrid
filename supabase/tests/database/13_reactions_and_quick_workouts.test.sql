-- Quick sessions, workout totals on posts, likes and comments.
-- Run with: npm run db:test
--
--   ada : member, PUBLIC profile, posts a finished quick workout
--   bea : member, PRIVATE profile; cyd is her approved follower
--   cyd : member, follows bea (accepted)
--   dev : member WITHOUT a social profile
--   eve : member with a profile, does not follow bea

begin;

select plan(47);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000aa001', 'ada13@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000bb001', 'bea13@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000cc001', 'cyd13@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000dd001', 'dev13@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000ee001', 'eve13@example.test', now(), '{}');

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000aa001', 'Ada'),
  ('00000000-0000-4000-8000-0000000bb001', 'Bea'),
  ('00000000-0000-4000-8000-0000000cc001', 'Cyd'),
  ('00000000-0000-4000-8000-0000000dd001', 'Dev'),
  ('00000000-0000-4000-8000-0000000ee001', 'Eve');

insert into public.social_profiles (user_id, username, display_name, visibility) values
  ('00000000-0000-4000-8000-0000000aa001', 'ada13', 'Ada', 'public'),
  ('00000000-0000-4000-8000-0000000bb001', 'bea13', 'Bea', 'private'),
  ('00000000-0000-4000-8000-0000000cc001', 'cyd13', 'Cyd', 'private'),
  ('00000000-0000-4000-8000-0000000ee001', 'eve13', 'Eve', 'public');

-- The database makes a follow of a private profile pending; bea then approves it.
insert into public.follows (follower_id, followee_id) values
  ('00000000-0000-4000-8000-0000000cc001', '00000000-0000-4000-8000-0000000bb001');
update public.follows set status = 'accepted' where follower_id = '00000000-0000-4000-8000-0000000cc001';

-- ===========================================================================
-- Quick sessions
-- ===========================================================================

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000aa001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.scheduled_sessions (id, user_id, date, name, category, origin)
    values ('30000000-0000-4000-8000-0000000aa001', '00000000-0000-4000-8000-0000000aa001', '2026-11-23', 'Quick lift', 'strength', 'quick')$$,
  'a member starts a quick session'
);
select is((select origin from public.scheduled_sessions where id = '30000000-0000-4000-8000-0000000aa001'), 'quick', 'it is marked quick');
select throws_ok(
  $$insert into public.scheduled_sessions (user_id, date, name, category, origin) values ('00000000-0000-4000-8000-0000000aa001', '2026-11-23', 'X', 'other', 'imported')$$,
  '23514', null, 'origin is planned or quick'
);
insert into public.scheduled_sessions (user_id, date, name, category)
  values ('00000000-0000-4000-8000-0000000aa001', '2026-11-24', 'Planned default', 'running');
select is(
  (select origin from public.scheduled_sessions where name = 'Planned default'),
  'planned', 'sessions are planned by default'
);
reset role;

-- ===========================================================================
-- Workout summary copied into a post
-- ===========================================================================

-- ada's finished workout: 3 sets done (100x5, 100x5, 10 bodyweight reps), 1 not done.
insert into public.workout_logs (user_id, session_id, status, started_at, finished_at, unit, entries) values (
  '00000000-0000-4000-8000-0000000aa001', '30000000-0000-4000-8000-0000000aa001', 'completed',
  now() - interval '47 minutes', now(), 'kg',
  '{"version": 1, "items": [
     {"item_id": "40000000-0000-4000-8000-000000000001", "name": "Back Squat", "mode": "load", "sets": [
       {"weight": 100, "reps": 5, "done": true}, {"weight": 100, "reps": 5, "done": true}, {"weight": 100, "reps": null, "done": false}]},
     {"item_id": "40000000-0000-4000-8000-000000000002", "name": "Push-up", "mode": "reps", "sets": [
       {"weight": null, "reps": 10, "done": true}]}
   ]}'::jsonb
);

select results_eq(
  $$select sets_done, volume from private.workout_totals((select entries from public.workout_logs where session_id = '30000000-0000-4000-8000-0000000aa001'))$$,
  $$values (3, 1000.0::numeric)$$,
  'totals: done sets and weight x reps, like summarize()'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000aa001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.session_posts (session_id, caption, shows_duration, shows_sets, shows_volume)
    values ('30000000-0000-4000-8000-0000000aa001', 'Squats!', true, true, true)$$,
  'ada posts her finished workout with everything shown'
);
select results_eq(
  $$select workout_completed, session_duration_minutes, workout_sets, workout_volume, workout_unit from public.session_posts where caption = 'Squats!'$$,
  $$values (true, 47, 3, 1000.0::numeric, 'kg'::text)$$,
  'the post copies the actual duration, sets done and volume'
);
select lives_ok(
  $$insert into public.session_posts (session_id, caption) values ('30000000-0000-4000-8000-0000000aa001', 'Quiet')$$,
  'ada posts again, sharing no totals'
);
select results_eq(
  $$select workout_completed, session_duration_minutes, workout_sets, workout_volume, shows_sets, shows_volume from public.session_posts where caption = 'Quiet'$$,
  $$values (true, null::integer, null::integer, null::numeric, false, false)$$,
  'nothing is shared that was not ticked'
);
select throws_ok(
  $$insert into public.session_posts (session_id, workout_sets) values ('30000000-0000-4000-8000-0000000aa001', 999)$$,
  '42501', null, 'the workout summary cannot be supplied by the caller'
);
select throws_ok(
  $$update public.session_posts set workout_volume = 5 where caption = 'Squats!'$$,
  '42501', null, 'the workout summary cannot be edited'
);
-- A planned session without a workout: no summary, the planned duration.
insert into public.scheduled_sessions (id, user_id, date, name, category, duration_minutes)
  values ('30000000-0000-4000-8000-0000000aa002', '00000000-0000-4000-8000-0000000aa001', '2026-11-23', 'Easy run', 'running', 30);
insert into public.session_posts (session_id, caption, shows_duration, shows_sets, shows_volume)
  values ('30000000-0000-4000-8000-0000000aa002', 'Planned only', true, true, true);
select results_eq(
  $$select workout_completed, session_duration_minutes, workout_sets, shows_sets from public.session_posts where caption = 'Planned only'$$,
  $$values (false, 30, null::integer, false)$$,
  'without a finished workout the post has no workout summary'
);
reset role;

select throws_ok(
  $$update public.session_posts set workout_sets = 1 where caption = 'Squats!'$$,
  'P0001', 'post_snapshot_immutable', 'even the owner role cannot rewrite the workout summary'
);

-- bea posts (private) for the visibility tests below.
insert into public.scheduled_sessions (id, user_id, date, name, category)
  values ('30000000-0000-4000-8000-0000000bb001', '00000000-0000-4000-8000-0000000bb001', '2026-11-23', 'Bea lift', 'strength');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000bb001", "role": "authenticated"}', true);
set local role authenticated;
insert into public.session_posts (session_id, caption) values ('30000000-0000-4000-8000-0000000bb001', 'Bea private');
reset role;

-- ===========================================================================
-- Likes
-- ===========================================================================

create temporary table ids on commit drop as
  select (select id from public.session_posts where caption = 'Squats!') as ada_post,
         (select id from public.session_posts where caption = 'Bea private') as bea_post;
grant select on ids to authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000cc001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.post_likes (post_id) select ada_post from ids$$, 'a member likes a public post');
select lives_ok($$insert into public.post_likes (post_id) select bea_post from ids$$, 'an approved follower likes a private post');
select throws_ok($$insert into public.post_likes (post_id) select ada_post from ids$$, '23505', null, 'a post is liked once per member');
select throws_ok(
  $$insert into public.post_likes (post_id, user_id) select ada_post, '00000000-0000-4000-8000-0000000ee001' from ids$$,
  '42501', null, 'nobody likes on someone else''s behalf'
);
select is((select like_count from public.social_posts(p_post => (select ada_post from ids))), 1, 'the post shows one like');
select is((select viewer_liked from public.social_posts(p_post => (select ada_post from ids))), true, 'and that the viewer liked it');
reset role;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000ee001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.post_likes (post_id) select bea_post from ids$$, '42501', null, 'a non-follower cannot like a private post');
select is((select count(*)::int from public.post_likes where post_id = (select bea_post from ids)), 0, 'nor see who liked it');
select is_empty($$delete from public.post_likes where user_id = '00000000-0000-4000-8000-0000000cc001' returning 1$$, 'nor remove someone else''s like');
reset role;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000dd001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.post_likes (post_id) select ada_post from ids$$, '23503', null, 'liking needs a social profile');
select is((select like_count from public.social_posts(p_post => (select ada_post from ids))), 1, 'a member without a profile still sees public like counts');
reset role;

-- ===========================================================================
-- Comments
-- ===========================================================================

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000cc001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.post_comments (post_id, body) select bea_post, 'Strong!' from ids$$, 'an approved follower comments on a private post');
select lives_ok($$insert into public.post_comments (post_id, body) select ada_post, 'Nice squats' from ids$$, 'a member comments on a public post');
select throws_ok($$insert into public.post_comments (post_id, body) select ada_post, '  ' from ids$$, '23514', null, 'empty comments are refused');
select throws_ok($$insert into public.post_comments (post_id, body) select ada_post, repeat('x', 501) from ids$$, '23514', null, 'comments are at most 500 characters');
select throws_ok(
  $$insert into public.post_comments (post_id, body, author_id) select ada_post, 'Forged', '00000000-0000-4000-8000-0000000ee001' from ids$$,
  '42501', null, 'nobody comments on someone else''s behalf'
);
select throws_ok($$update public.post_comments set body = 'edited'$$, '42501', null, 'comments are not edited');
select is((select comment_count from public.social_posts(p_post => (select bea_post from ids))), 1, 'the post shows its comment count');
reset role;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000ee001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.post_comments (post_id, body) select bea_post, 'Hi' from ids$$, '42501', null, 'a non-follower cannot comment on a private post');
select is((select count(*)::int from public.post_comments where post_id = (select bea_post from ids)), 0, 'nor read its comments');
select is_empty($$delete from public.post_comments where body = 'Nice squats' returning 1$$, 'a third member cannot delete someone else''s comment');
reset role;

-- The post's author removes a comment on her post.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000aa001", "role": "authenticated"}', true);
set local role authenticated;
select isnt_empty($$delete from public.post_comments where body = 'Nice squats' returning 1$$, 'the post''s author deletes a comment on her post');
reset role;

-- Removing a follower takes away their access to likes and comments at once.
delete from public.follows where follower_id = '00000000-0000-4000-8000-0000000cc001';
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000cc001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.post_comments where post_id = (select bea_post from ids) and author_id <> '00000000-0000-4000-8000-0000000cc001'), 0, 'a removed follower no longer sees other people''s comments');
select throws_ok($$insert into public.post_comments (post_id, body) select bea_post, 'Still here?' from ids$$, '42501', null, 'nor can comment');
select isnt_empty($$delete from public.post_likes where post_id = (select bea_post from ids) returning 1$$, 'but can still take back their own like');
select is((select count(*)::int from public.post_comments where body = 'Strong!'), 1, 'and still sees (so can delete) their own comment');
reset role;

-- The owner still sees the removed follower's comment on her post.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000bb001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.post_comments where post_id = (select bea_post from ids)), 1, 'the post''s author still sees every comment');
reset role;

-- A revoked member's likes and comments disappear for everyone.
update public.profiles set revoked_at = now() where id = '00000000-0000-4000-8000-0000000cc001';
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000bb001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.post_comments where post_id = (select bea_post from ids)), 0, 'a revoked member''s comments disappear');
reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000aa001", "role": "authenticated"}', true);
set local role authenticated;
select is((select like_count from public.social_posts(p_post => (select ada_post from ids))), 0, 'and their likes stop counting');
reset role;

-- Deleting the post deletes its likes and comments.
delete from public.session_posts where caption = 'Bea private';
select is((select count(*)::int from public.post_comments where post_id = (select bea_post from ids)), 0, 'deleting a post deletes its comments');

-- At most 100 comments a day, counted as the member themself.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000ee001", "role": "authenticated"}', true);
set local role authenticated;
insert into public.post_comments (post_id, body) select (select ada_post from ids), 'c' || g from generate_series(1, 100) g;
select throws_ok(
  $$insert into public.post_comments (post_id, body) select ada_post, 'one too many' from ids$$,
  'P0001', 'comment_rate_limited', 'at most 100 comments a day'
);
reset role;

-- ===========================================================================
-- Exposure
-- ===========================================================================

set local role anon;
select throws_ok($$select 1 from public.post_likes$$, '42501', null, 'anon cannot read likes');
select throws_ok($$select 1 from public.post_comments$$, '42501', null, 'anon cannot read comments');
reset role;

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'social_posts' and p.prosecdef),
  0, 'social_posts still runs with the caller''s rights'
);

select * from finish();

rollback;
