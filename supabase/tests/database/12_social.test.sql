-- Social profiles, following and session posts.
-- Run with: npm run db:test
--
--   ada   : member, PUBLIC profile
--   bea   : member, PRIVATE profile (the default)
--   cyd   : member, private profile
--   dev   : member WITHOUT a social profile
--   rex   : member with a public profile, revoked part-way through
--   nia   : signed-in user who is NOT a member (no profiles row)

begin;

select plan(96);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a001', 'ada@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-00000000b001', 'bea@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-00000000c001', 'cyd@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-00000000d001', 'dev@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-00000000e001', 'rex@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-00000000f001', 'nia@example.test', now(), '{}');

insert into public.profiles (id, display_name, avatar_url) values
  ('00000000-0000-4000-8000-00000000a001', 'Ada', 'https://avatars.example.test/ada.png'),
  ('00000000-0000-4000-8000-00000000b001', 'Bea', null),
  ('00000000-0000-4000-8000-00000000c001', 'Cyd', null),
  ('00000000-0000-4000-8000-00000000d001', 'Dev', null),
  ('00000000-0000-4000-8000-00000000e001', 'Rex', null);

insert into public.scheduled_sessions (id, user_id, date, start_time, name, category, duration_minutes, notes) values
  ('30000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a001', '2026-11-16', '06:00', 'Ada tempo run', 'running', 45, 'Ada private note'),
  ('30000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000b001', '2026-11-17', '07:30', 'Bea lower body', 'strength', 60, 'Bea private note'),
  ('30000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000b001', '2026-11-18', null, 'Bea box jumps', 'plyometrics', null, ''),
  ('30000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001', '2026-11-18', null, 'Rex easy run', 'running', 30, '');

-- ===========================================================================
-- Profiles
-- ===========================================================================

set local role anon;
select throws_ok($$select 1 from public.social_profiles$$, '42501', null, 'anon has no access to social profiles');
select throws_ok($$select 1 from public.session_posts$$, '42501', null, 'anon has no access to posts');
select throws_ok($$select * from public.social_posts()$$, '42501', null, 'anon cannot read the feed');
reset role;

-- ada creates her profile; it is private by default.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.social_profiles (username, display_name, bio, use_identity_avatar) values ('ada', 'Ada L', 'Runs early.', true)$$,
  'a member creates their own social profile'
);
select is((select visibility from public.social_profiles where username = 'ada'), 'private', 'new profiles are private by default');
select is((select avatar_url from public.social_profiles where username = 'ada'), 'https://avatars.example.test/ada.png', 'the avatar comes from the member''s own sign-in picture');
select throws_ok(
  $$update public.social_profiles set avatar_url = 'https://evil.example.test/x.png' where username = 'ada'$$,
  '42501', null, 'the avatar URL cannot be set directly'
);
select throws_ok(
  $$insert into public.social_profiles (user_id, username, display_name) values ('00000000-0000-4000-8000-00000000b001', 'notbea', 'Not Bea')$$,
  '42501', null, 'a profile cannot be created for someone else'
);
select lives_ok($$update public.social_profiles set visibility = 'public' where username = 'ada'$$, 'ada makes her profile public');
reset role;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000b001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.social_profiles (username, display_name) values ('ada', 'Bea')$$,
  '23505', null, 'usernames are unique'
);
select throws_ok(
  $$insert into public.social_profiles (username, display_name) values ('Bea', 'Bea')$$,
  '23514', null, 'usernames are stored lower-case'
);
select throws_ok(
  $$insert into public.social_profiles (username, display_name) values ('b', 'Bea')$$,
  '23514', null, 'usernames need at least three characters'
);
select throws_ok(
  $$insert into public.social_profiles (username, display_name) values ('bea__k', 'Bea')$$,
  '23514', null, 'usernames cannot contain double underscores'
);
select throws_ok(
  $$insert into public.social_profiles (username, display_name) values ('settings', 'Bea')$$,
  '23514', null, 'reserved usernames are refused'
);
select throws_ok(
  $$insert into public.social_profiles (username, display_name, bio) values ('bea', 'Bea', repeat('x', 161))$$,
  '23514', null, 'bios are at most 160 characters'
);
select lives_ok($$insert into public.social_profiles (username, display_name) values ('bea', 'Bea K')$$, 'bea creates a private profile');
select is(
  (select count(*)::int from public.social_profiles where username = 'ada' and bio = 'Runs early.'),
  1, 'members see each other''s basic identity'
);
select is_empty(
  $$update public.social_profiles set bio = 'hacked' where username = 'ada' returning 1$$,
  'a member cannot update someone else''s profile'
);
reset role;

-- cyd (private) and rex (public).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c001", "role": "authenticated"}', true);
set local role authenticated;
insert into public.social_profiles (username, display_name) values ('cyd', 'Cyd');
reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000e001", "role": "authenticated"}', true);
set local role authenticated;
insert into public.social_profiles (username, display_name, visibility) values ('rex', 'Rex', 'public');
reset role;

-- nia is not a member.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000f001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.social_profiles (username, display_name) values ('nia', 'Nia')$$,
  '42501', null, 'a non-member cannot create a social profile'
);
select is((select count(*)::int from public.social_profiles), 0, 'a non-member sees no profiles');
select is((select count(*)::int from public.social_profile('ada')), 0, 'a non-member cannot read a profile card');
select is((select count(*)::int from public.search_social_profiles('ad')), 0, 'a non-member finds nobody');
reset role;

-- ===========================================================================
-- Following
-- ===========================================================================

-- ada requests to follow bea (private): pending, whatever she asks for.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000b001')$$,
  'ada asks to follow bea'
);
select is(
  (select status from public.follows where followee_id = '00000000-0000-4000-8000-00000000b001'),
  'pending', 'following a private profile is a pending request'
);
select throws_ok(
  $$insert into public.follows (followee_id, status) values ('00000000-0000-4000-8000-00000000c001', 'accepted')$$,
  '42501', null, 'the caller cannot choose the status'
);
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001')$$,
  '42501', null, 'nobody can follow on someone else''s behalf'
);
select throws_ok(
  $$insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000a001')$$,
  '23514', null, 'members cannot follow themselves'
);
select throws_ok(
  $$insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000b001')$$,
  '23505', null, 'a relationship exists only once'
);
select is_empty(
  $$update public.follows set status = 'accepted' where followee_id = '00000000-0000-4000-8000-00000000b001' returning 1$$,
  'the follower cannot approve their own request'
);
select throws_ok(
  $$insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000d001')$$,
  '42501', null, 'a member without a social profile cannot be followed'
);
reset role;

-- cyd follows ada (public): accepted at once. cyd asks to follow bea.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c001", "role": "authenticated"}', true);
set local role authenticated;
insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000a001');
select is(
  (select status from public.follows where followee_id = '00000000-0000-4000-8000-00000000a001' and follower_id = '00000000-0000-4000-8000-00000000c001'),
  'accepted', 'following a public profile is immediate'
);
select is_empty(
  $$select 1 from public.follows where follower_id = '00000000-0000-4000-8000-00000000a001' and followee_id = '00000000-0000-4000-8000-00000000b001'$$,
  'pending requests are visible only to the two members involved'
);
select is_empty(
  $$update public.follows set status = 'accepted' where follower_id = '00000000-0000-4000-8000-00000000a001' returning 1$$,
  'a third member cannot approve someone else''s request'
);
select is_empty(
  $$delete from public.follows where follower_id = '00000000-0000-4000-8000-00000000a001' and followee_id = '00000000-0000-4000-8000-00000000b001' returning 1$$,
  'a third member cannot remove someone else''s relationship'
);
insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000b001');
reset role;

-- dev has no social profile, so cannot follow.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000d001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000a001')$$,
  '42501', null, 'following needs a social profile of your own'
);
reset role;

-- bea approves ada and rejects cyd.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000b001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.follows where followee_id = '00000000-0000-4000-8000-00000000b001' and status = 'pending'), 2, 'bea sees her two pending requests');
select isnt_empty(
  $$update public.follows set status = 'accepted' where follower_id = '00000000-0000-4000-8000-00000000a001' and followee_id = '00000000-0000-4000-8000-00000000b001' returning 1$$,
  'the person followed approves a request'
);
select isnt(
  (select accepted_at from public.follows where follower_id = '00000000-0000-4000-8000-00000000a001' and followee_id = '00000000-0000-4000-8000-00000000b001'),
  null, 'approval stamps accepted_at'
);
select is_empty(
  $$update public.follows set status = 'pending' where follower_id = '00000000-0000-4000-8000-00000000a001' and followee_id = '00000000-0000-4000-8000-00000000b001' returning 1$$,
  'an accepted follow cannot go back to pending'
);
select isnt_empty(
  $$delete from public.follows where follower_id = '00000000-0000-4000-8000-00000000c001' and followee_id = '00000000-0000-4000-8000-00000000b001' and status = 'pending' returning 1$$,
  'the person followed rejects a request'
);
reset role;

-- ===========================================================================
-- Posts
-- ===========================================================================

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000b001", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.session_posts (session_id, caption) values ('30000000-0000-4000-8000-00000000b001', 'Legs done')$$,
  'bea posts about her own session'
);
select results_eq(
  $$select session_name, session_category, session_date, session_duration_minutes, shows_duration from public.session_posts where caption like 'Legs done%'$$,
  $$values ('Bea lower body'::text, 'strength'::text, '2026-11-17'::date, null::integer, false)$$,
  'the snapshot is copied from the session; the duration only when chosen'
);
select lives_ok(
  $$insert into public.session_posts (session_id, caption, shows_duration) values ('30000000-0000-4000-8000-00000000b001', 'With time', true)$$,
  'bea posts again, sharing the duration'
);
select is((select session_duration_minutes from public.session_posts where caption = 'With time'), 60, 'the duration is shared when chosen');
select lives_ok(
  $$insert into public.session_posts (session_id, caption, shows_duration) values ('30000000-0000-4000-8000-00000000b002', 'Box', true)$$,
  'a session without a duration can be posted'
);
select is((select shows_duration from public.session_posts where caption = 'Box'), false, 'no duration to share means none is shown');
select throws_ok(
  $$insert into public.session_posts (session_id, session_name) values ('30000000-0000-4000-8000-00000000b001', 'Forged')$$,
  '42501', null, 'the snapshot cannot be supplied by the caller'
);
select throws_ok(
  $$insert into public.session_posts (session_id, author_id) values ('30000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001')$$,
  '42501', null, 'the author cannot be chosen'
);
select throws_ok(
  $$select session_id from public.session_posts$$,
  '42501', null, 'the scheduled session behind a post is never readable, even by its author'
);
select throws_ok(
  $$update public.session_posts set session_name = 'Rewritten' where caption like 'Legs done%'$$,
  '42501', null, 'the snapshot cannot be edited'
);
select lives_ok(
  $$update public.session_posts set caption = 'Legs done, felt strong' where caption like 'Legs done%'$$,
  'the author edits the caption'
);
select isnt((select edited_at from public.session_posts where caption like 'Legs done%'), null, 'an edited caption is marked as edited');
reset role;

-- ada cannot post someone else's session, nor touch bea's posts.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.session_posts (session_id) values ('30000000-0000-4000-8000-00000000b001')$$,
  'P0001', 'post_session_not_found', 'a member cannot post someone else''s session'
);
insert into public.session_posts (session_id, caption) values ('30000000-0000-4000-8000-00000000a001', 'Tempo');
select is((select count(*)::int from public.session_posts where author_id = '00000000-0000-4000-8000-00000000b001'), 3, 'an approved follower sees a private profile''s posts');
select is_empty(
  $$update public.session_posts set caption = 'hacked' where caption like 'Legs done%' returning 1$$,
  'a follower cannot edit someone else''s post'
);
select is_empty(
  $$delete from public.session_posts where caption like 'Legs done%' returning 1$$,
  'a follower cannot delete someone else''s post'
);
select is(
  (select array_agg(id order by created_at desc, id desc) from public.social_posts())::text,
  (select array_agg(id order by created_at desc, id desc) from public.session_posts
    where author_id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001'))::text,
  'the feed holds her own posts and those of members she follows, newest first'
);
select is((select count(*)::int from public.social_posts(p_limit => 2)), 2, 'the feed is paginated');
select is(
  (select count(*)::int from public.social_posts(
     p_before_created_at => (select created_at from public.social_posts(p_limit => 2) offset 1 limit 1),
     p_before_id => (select id from public.social_posts(p_limit => 2) offset 1 limit 1))),
  2, 'the next page continues after the cursor'
);
reset role;

-- cyd: bea's posts are hidden (request rejected), bea's identity is not.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.session_posts where author_id = '00000000-0000-4000-8000-00000000b001'), 0, 'a non-follower sees no posts of a private profile');
select is((select count(*)::int from public.social_posts('00000000-0000-4000-8000-00000000b001')), 0, 'a private timeline is empty for a non-follower');
select results_eq(
  $$select display_name, follower_count, following_count, post_count, can_view_posts, viewer_follow from public.social_profile('BEA')$$,
  $$values ('Bea K'::text, 1, 0, 3, false, null::text)$$,
  'a private profile shows basic identity and counts only'
);
select is_empty(
  $$select 1 from public.follows where followee_id = '00000000-0000-4000-8000-00000000b001'$$,
  'a private profile''s followers list is hidden from non-followers'
);
select is((select count(*)::int from public.session_posts where author_id = '00000000-0000-4000-8000-00000000a001'), 1, 'everyone who follows a public profile sees its posts');
select is_empty(
  $$select 1 from public.follows where follower_id = '00000000-0000-4000-8000-00000000a001'$$,
  'nor does it leak through a public follower''s following list'
);
reset role;

-- dev (no social profile) sees public posts, not private ones.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000d001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.session_posts where author_id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000e001')), 1, 'public posts are visible to every active member, private ones are not');
reset role;

-- Editing or deleting the session never touches the post's snapshot.
update public.scheduled_sessions set name = 'Renamed', duration_minutes = 90 where id = '30000000-0000-4000-8000-00000000b001';
select results_eq(
  $$select session_name, session_duration_minutes from public.session_posts where caption = 'With time'$$,
  $$values ('Bea lower body'::text, 60)$$,
  'editing the session keeps the post''s snapshot'
);
delete from public.scheduled_sessions where id = '30000000-0000-4000-8000-00000000b001';
select results_eq(
  $$select session_id, session_name from public.session_posts where caption = 'With time'$$,
  $$values (null::uuid, 'Bea lower body'::text)$$,
  'deleting the session keeps the post and its snapshot'
);
select is(
  (select count(*)::int from public.session_posts p where p.session_name = 'Bea lower body' and p.caption like '%note%'),
  0, 'session notes are never copied into a post'
);

-- ===========================================================================
-- Privacy changes and removal revoke access at once
-- ===========================================================================

-- ada goes private: cyd (accepted follower) keeps access, dev loses it.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);
set local role authenticated;
update public.social_profiles set visibility = 'private' where username = 'ada';
reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000d001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.session_posts where author_id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000e001')), 0, 'switching to private hides posts from non-followers');
reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.session_posts where author_id = '00000000-0000-4000-8000-00000000a001'), 1, 'approved followers keep access after the switch');
insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000b001');
reset role;

-- bea removes ada as a follower: ada loses access at once.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000b001", "role": "authenticated"}', true);
set local role authenticated;
select isnt_empty(
  $$delete from public.follows where follower_id = '00000000-0000-4000-8000-00000000a001' and followee_id = '00000000-0000-4000-8000-00000000b001' returning 1$$,
  'bea removes a follower'
);
-- Going public approves cyd's waiting request.
update public.social_profiles set visibility = 'public' where username = 'bea';
select is(
  (select status from public.follows where follower_id = '00000000-0000-4000-8000-00000000c001' and followee_id = '00000000-0000-4000-8000-00000000b001'),
  'accepted', 'going public approves waiting requests'
);
update public.social_profiles set visibility = 'private' where username = 'bea';
reset role;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000a001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.session_posts where author_id = '00000000-0000-4000-8000-00000000b001'), 0, 'a removed follower loses access at once');
select is((select viewer_follow from public.social_profile('bea')), null, 'a removed follower no longer follows');
reset role;

-- ===========================================================================
-- Search
-- ===========================================================================

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000d001", "role": "authenticated"}', true);
set local role authenticated;
select results_eq($$select username from public.search_social_profiles('BE') where username in ('ada', 'bea', 'cyd', 'rex')$$, $$values ('bea'::text)$$, 'search matches usernames, ignoring case');
select results_eq($$select username from public.search_social_profiles('Bea K') where username in ('ada', 'bea', 'cyd', 'rex')$$, $$values ('bea'::text)$$, 'search matches display names too');
select is((select count(*)::int from public.search_social_profiles('a')), 0, 'a one-character search returns nothing');
select is((select count(*)::int from public.search_social_profiles('%%')), 0, 'wildcards are matched literally');
select is((select count(*)::int from public.search_social_profiles('example.test')), 0, 'email addresses are not searchable');
reset role;

-- ===========================================================================
-- Revoked members disappear, and lose access
-- ===========================================================================

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000e001", "role": "authenticated"}', true);
set local role authenticated;
insert into public.session_posts (session_id, caption) values ('30000000-0000-4000-8000-00000000e001', 'Rex run');
insert into public.follows (followee_id) values ('00000000-0000-4000-8000-00000000c001');
reset role;
-- cyd approves rex, so rex counts as a follower until revoked.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c001", "role": "authenticated"}', true);
set local role authenticated;
update public.follows set status = 'accepted' where follower_id = '00000000-0000-4000-8000-00000000e001';
select is((select follower_count from public.social_profile('cyd')), 1, 'before revocation: rex follows cyd');
reset role;

update public.profiles set revoked_at = now() where id = '00000000-0000-4000-8000-00000000e001';

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000c001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.social_profiles where username = 'rex'), 0, 'a revoked member''s profile disappears');
select is((select count(*)::int from public.session_posts where caption = 'Rex run'), 0, 'a revoked member''s public posts disappear');
select is((select follower_count from public.social_profile('cyd')), 0, 'a revoked member no longer counts as a follower');
select is((select count(*)::int from public.search_social_profiles('rex')), 0, 'a revoked member is not found by search');
reset role;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000e001", "role": "authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.social_profiles), 0, 'a revoked member sees no profiles');
select is((select count(*)::int from public.session_posts), 0, 'a revoked member sees no posts');
select is((select count(*)::int from public.social_posts()), 0, 'a revoked member has no feed');
select throws_ok(
  $$insert into public.session_posts (session_id) values ('30000000-0000-4000-8000-00000000e001')$$,
  'P0001', 'post_session_not_found', 'a revoked member cannot post (their sessions are hidden from them)'
);
select is_empty(
  $$update public.social_profiles set bio = 'still here' where username = 'rex' returning 1$$,
  'a revoked member cannot edit their profile'
);
reset role;

-- The service role may post for a member, but only from that member's session.
set local role service_role;
select lives_ok(
  $$insert into public.session_posts (author_id, session_id, caption) values ('00000000-0000-4000-8000-00000000b001', '30000000-0000-4000-8000-00000000b002', 'Seeded')$$,
  'the service role can seed a post from the member''s own session'
);
select throws_ok(
  $$insert into public.session_posts (author_id, session_id) values ('00000000-0000-4000-8000-00000000c001', '30000000-0000-4000-8000-00000000b002')$$,
  'P0001', 'post_session_not_found', 'even the service role cannot attach someone else''s session'
);
reset role;
delete from public.session_posts where caption = 'Seeded';

-- ===========================================================================
-- Limits and function exposure
-- ===========================================================================

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000b001", "role": "authenticated"}', true);
set local role authenticated;
insert into public.session_posts (session_id) select '30000000-0000-4000-8000-00000000b002' from generate_series(1, 17);
select throws_ok(
  $$insert into public.session_posts (session_id) values ('30000000-0000-4000-8000-00000000b002')$$,
  'P0001', 'post_rate_limited', 'at most 20 posts a day'
);
reset role;

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('social_profile', 'social_posts', 'search_social_profiles') and p.prosecdef),
  0, 'the social read functions run with the caller''s rights'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon can execute no private helper'
);
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon cannot use the private schema');

select * from finish();

rollback;
