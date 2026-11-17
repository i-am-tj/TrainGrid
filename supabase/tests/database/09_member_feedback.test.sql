-- Member feedback (v1.0.0).
-- Run with: npm run db:test
--
--   f1: active member
--   f2: another active member
--   f3: revoked member

begin;

select plan(22);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000f1', 'member-f1@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000f2', 'member-f2@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000f3', 'revoked-f3@example.test', now(), '{}');
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000000f1', 'Member One'),
  ('00000000-0000-4000-8000-0000000000f2', 'Member Two');
insert into public.profiles (id, display_name, revoked_at) values
  ('00000000-0000-4000-8000-0000000000f3', 'Revoked', now());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.member_feedback'::regclass),
  'RLS is enabled on member_feedback'
);
select ok(not has_table_privilege('anon', 'public.member_feedback', 'insert'), 'anon cannot send feedback');
select ok(not has_table_privilege('anon', 'public.member_feedback', 'select'), 'anon cannot read feedback');
select ok(not has_table_privilege('authenticated', 'public.member_feedback', 'select'), 'members cannot read feedback');
select ok(not has_table_privilege('authenticated', 'public.member_feedback', 'update'), 'members cannot change feedback');
select ok(not has_table_privilege('authenticated', 'public.member_feedback', 'delete'), 'members cannot delete feedback');
select ok(not has_column_privilege('authenticated', 'public.member_feedback', 'user_id', 'insert'), 'members cannot choose the author');
select ok(not has_column_privilege('authenticated', 'public.member_feedback', 'created_at', 'insert'), 'members cannot choose the time');
select ok(
  not has_function_privilege('authenticated', 'public.member_feedback_rate_limit()', 'execute'),
  'members cannot call the rate-limit function directly'
);

-- ---------------------------------------------------------------------------
-- Sending as an active member
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f1", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.member_feedback (kind, message, page_path) values ('idea', 'A dark calendar, please.', '/home')$$,
  'an active member can send feedback'
);
select throws_ok(
  $$insert into public.member_feedback (kind, message) values ('rant', 'Hello')$$,
  '23514', null, 'an unknown kind is refused'
);
select throws_ok(
  $$insert into public.member_feedback (kind, message) values ('idea', '   ')$$,
  '23514', null, 'an empty message is refused'
);
select throws_ok(
  format($$insert into public.member_feedback (kind, message) values ('idea', %L)$$, repeat('x', 2001)),
  '23514', null, 'a message over 2000 characters is refused'
);
select throws_ok(
  $$insert into public.member_feedback (kind, message, page_path) values ('idea', 'Hi', 'https://evil.example')$$,
  '23514', null, 'page_path must be a local path'
);
select throws_ok(
  $$insert into public.member_feedback (user_id, kind, message) values ('00000000-0000-4000-8000-0000000000f2', 'idea', 'Spoofed')$$,
  '42501', null, 'a member cannot send feedback as someone else'
);

-- Nine more make ten in 24 hours; the eleventh is refused.
select lives_ok(
  $$insert into public.member_feedback (kind, message)
    select 'praise', 'Message ' || n from generate_series(2, 10) n$$,
  'up to ten messages in 24 hours'
);
select throws_ok(
  $$insert into public.member_feedback (kind, message) values ('problem', 'One too many')$$,
  'P0001', 'feedback_rate_limited', 'the eleventh message in 24 hours is refused'
);

-- Another member is not affected by the first member's limit.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated"}', true);
select lives_ok(
  $$insert into public.member_feedback (kind, message) values ('problem', 'Separate limit')$$,
  'the limit is per member'
);

-- A revoked member cannot send feedback.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f3", "role": "authenticated"}', true);
select throws_ok(
  $$insert into public.member_feedback (kind, message) values ('idea', 'Still here?')$$,
  '42501', null, 'a revoked member cannot send feedback'
);

reset role;

-- ---------------------------------------------------------------------------
-- What was stored
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.member_feedback where user_id = '00000000-0000-4000-8000-0000000000f1'),
  10, 'the first member has exactly ten messages, all their own'
);
select is(
  (select page_path from public.member_feedback where message = 'A dark calendar, please.'),
  '/home', 'the page the feedback was sent from is kept'
);

-- Deleting a member removes their feedback with them.
delete from auth.users where id = '00000000-0000-4000-8000-0000000000f2';
select is(
  (select count(*)::int from public.member_feedback where message = 'Separate limit'),
  0, 'feedback is deleted with its member'
);

select * from finish();
rollback;
