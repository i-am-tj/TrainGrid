begin;
select plan(19);

insert into auth.users (id, email, email_confirmed_at) values
  ('ade00000-0000-4000-8000-000000000001','first@example.test',now()),
  ('ade00000-0000-4000-8000-000000000002','return@example.test',now());
insert into public.profiles(id) values ('ade00000-0000-4000-8000-000000000001');
insert into auth.identities (user_id, provider, provider_id, identity_data) values
  ('ade00000-0000-4000-8000-000000000002','google','audit-return','{"email":"return@example.test"}');
-- Historical delivery record retains the original identity after an address changes hands.
insert into public.invitations(email,accepted_at,accepted_by) values
  ('return@example.test',now(),'ade00000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ade00000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is(public.accept_invitation(),'not_invited','a previously consumed invitation does not admit a new identity');
select ok(not public.is_member(),'the second identity has no membership');
reset role;
-- What deleting the accepting auth user does to the row (ON DELETE SET NULL).
update public.invitations set accepted_by=null where email='return@example.test';
select ok((select revoked_at is not null and accepted_at is not null from public.invitations where email='return@example.test'),
  'deleting the accepting account retires the invitation and keeps its acceptance time');
set local role authenticated;
select is(public.accept_invitation(),'not_invited','account deletion does not turn a consumed invitation into a pending one');
reset role;
select lives_ok($$insert into public.invitations(email) values ('return@example.test')$$,
  'an admin can invite the address again without revoking the spent invitation first');
set local role authenticated;
select is(public.accept_invitation(),'member','a newly issued invitation admits the intended member');

insert into public.scheduled_sessions (id,user_id,date,name,category)
values ('ade10000-0000-4000-8000-000000000002',auth.uid(),current_date,'Audit','other');
select throws_ok($$update public.scheduled_sessions set snapshot='{"items":[]}'$$,'23514',null,'version is required');
select throws_ok($$update public.scheduled_sessions set snapshot='{"version":1}'$$,'23514',null,'items are required');
select throws_ok($$insert into public.workout_logs(session_id,entries)
 values ('ade10000-0000-4000-8000-000000000002','{}')$$,'23514',null,'a workout log needs its document envelope');
select lives_ok($$insert into public.workout_logs(session_id)
 values ('ade10000-0000-4000-8000-000000000002')$$,'the default empty workout is valid');
select set_config('request.jwt.claims','{"sub":"ade00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is_empty($$select id from public.workout_logs where session_id='ade10000-0000-4000-8000-000000000002'$$,
  'a different active member cannot read the logged workout');
-- Simulate one pre-migration row. Only this new trigger is suspended,
-- inside this rollback-only test transaction. The original CHECK stays active.
reset role;
alter table public.scheduled_sessions disable trigger scheduled_sessions_require_document_keys;
update public.scheduled_sessions set snapshot='{}' where id='ade10000-0000-4000-8000-000000000002';
alter table public.scheduled_sessions enable trigger scheduled_sessions_require_document_keys;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ade00000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.scheduled_sessions set notes='moved', snapshot=snapshot
    where id='ade10000-0000-4000-8000-000000000002'$$,'a historical payload can be retained on unrelated edits');
select lives_ok($$update public.scheduled_sessions set snapshot='{"version":1,"items":[]}'
    where id='ade10000-0000-4000-8000-000000000002'$$,'an owner can replace a historical payload with valid data');
select is((select snapshot from public.scheduled_sessions where id='ade10000-0000-4000-8000-000000000002'),
    '{"version":1,"items":[]}'::jsonb,'the repaired snapshot is persisted');

-- Daily limits: the lock only works if it fires before each table's counter,
-- and PostgreSQL fires same-timing triggers in name order.
reset role;
select is((select count(*)::int from pg_trigger where tgname = 'acquire_daily_limit' and not tgisinternal), 4,
  'the daily-limit lock is installed on all four limited tables');
select is_empty($$
  select t.tgrelid::regclass || '.' || t.tgname
    from pg_trigger t
   where not t.tgisinternal
     and t.tgrelid in ('public.member_feedback'::regclass, 'public.follows'::regclass,
                       'public.session_posts'::regclass, 'public.post_comments'::regclass)
     and t.tgtype::int & 7 = 7 -- ROW (1) + BEFORE (2) + INSERT (4)
     and t.tgname < 'acquire_daily_limit'
$$, 'no BEFORE INSERT trigger fires ahead of the daily-limit lock');

-- Follow vs going public: a follow holds the followee's visibility lock
-- shared; only a private -> public switch takes it exclusively. Locks held by
-- this transaction are visible in pg_locks.
insert into public.social_profiles (user_id, username, display_name) values
  ('ade00000-0000-4000-8000-000000000001', 'audit_first', 'First'),
  ('ade00000-0000-4000-8000-000000000002', 'audit_return', 'Return');
create temporary view audit_visibility_locks as
  select l.mode, k.user_id
    from pg_locks l
    join (values ('ade00000-0000-4000-8000-000000000001'::uuid), ('ade00000-0000-4000-8000-000000000002'::uuid)) as k(user_id)
      on ((l.classid::bigint << 32) | l.objid::bigint) = private.social_visibility_lock_key(k.user_id)
   where l.locktype = 'advisory' and l.pid = pg_backend_pid();
-- Act as the member, check as the test owner (the key helper is private).
set local role authenticated;
insert into public.follows (followee_id) values ('ade00000-0000-4000-8000-000000000001');
reset role;
select results_eq($$select mode, user_id from audit_visibility_locks$$,
  $$values ('ShareLock'::text, 'ade00000-0000-4000-8000-000000000001'::uuid)$$,
  'a follow holds its followee''s visibility lock shared');
set local role authenticated;
update public.social_profiles set bio = 'Edited', visibility = 'private' where user_id = auth.uid();
reset role;
select is_empty($$select 1 from audit_visibility_locks where user_id = auth.uid()$$,
  'editing a profile without going public takes no visibility lock');
set local role authenticated;
update public.social_profiles set visibility = 'public' where user_id = auth.uid();
reset role;
select results_eq($$select mode from audit_visibility_locks where user_id = auth.uid()$$,
  $$values ('ExclusiveLock'::text)$$,
  'going public takes the visibility lock exclusively');

select * from finish();
rollback;
