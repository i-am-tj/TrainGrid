begin;
select plan(12);

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
update public.invitations set accepted_by=null where email='return@example.test';
set local role authenticated;
select is(public.accept_invitation(),'not_invited','account deletion does not turn a consumed invitation into a pending one');
reset role;
update public.invitations set revoked_at=now() where email='return@example.test';
insert into public.invitations(email) values ('return@example.test');
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

select * from finish();
rollback;
