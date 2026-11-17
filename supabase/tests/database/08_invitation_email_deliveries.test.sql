-- Invitation email delivery log (Epic 3 integration).
-- Run with: npm run db:test
--
--   pending : live invitation, never accepted — may be emailed
--   accepted: accepted by a member — never emailed
--   revoked : revoked — never emailed

begin;

select plan(32);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a8', 'admin8@example.test', now(), '{}'),
  ('00000000-0000-4000-8000-0000000000b8', 'member8@example.test', now(), '{}');
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000000a8', 'Admin'),
  ('00000000-0000-4000-8000-0000000000b8', 'Member');

insert into public.invitations (id, email) values
  ('80000000-0000-4000-8000-000000000001', 'pending8@example.test');
insert into public.invitations (id, email, accepted_at, accepted_by) values
  ('80000000-0000-4000-8000-000000000002', 'member8@example.test', now(), '00000000-0000-4000-8000-0000000000b8');
insert into public.invitations (id, email, revoked_at) values
  ('80000000-0000-4000-8000-000000000003', 'revoked8@example.test', now());

-- ---------------------------------------------------------------------------
-- Closed to API roles
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.invitation_email_deliveries'::regclass),
  'RLS is enabled on invitation_email_deliveries'
);
select ok(not has_table_privilege('anon', 'public.invitation_email_deliveries', 'select'), 'anon cannot read deliveries');
select ok(not has_table_privilege('authenticated', 'public.invitation_email_deliveries', 'select'), 'authenticated cannot read deliveries');
select ok(not has_table_privilege('authenticated', 'public.invitation_email_deliveries', 'insert'), 'authenticated cannot write deliveries');
select ok(not has_function_privilege('anon', 'public.begin_invitation_email(uuid, uuid)', 'execute'), 'anon cannot begin a send');
select ok(not has_function_privilege('authenticated', 'public.begin_invitation_email(uuid, uuid)', 'execute'), 'members cannot begin a send');
select ok(not has_function_privilege('authenticated', 'public.complete_invitation_email(uuid, text, text, text)', 'execute'), 'members cannot complete a send');
select ok(has_function_privilege('service_role', 'public.begin_invitation_email(uuid, uuid)', 'execute'), 'service role can begin a send');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a8", "role": "authenticated"}', true);
select throws_ok(
  $$select * from public.begin_invitation_email('80000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a8')$$,
  '42501', null, 'a signed-in member cannot call begin_invitation_email'
);
select throws_ok(
  $$select * from public.invitation_email_deliveries$$,
  '42501', null, 'a signed-in member cannot select deliveries'
);
reset role;

-- ---------------------------------------------------------------------------
-- begin / complete outcomes (as the service role)
-- ---------------------------------------------------------------------------

set local role service_role;

select is(
  (select outcome from public.begin_invitation_email('80000000-0000-4000-8000-0000000000ff', null)),
  'not_found', 'unknown invitation'
);
select is(
  (select outcome from public.begin_invitation_email('80000000-0000-4000-8000-000000000003', null)),
  'revoked', 'a revoked invitation is never emailed'
);
select is(
  (select outcome from public.begin_invitation_email('80000000-0000-4000-8000-000000000002', null)),
  'already_accepted', 'an accepted invitation is never emailed'
);
select is((select count(*)::int from public.invitation_email_deliveries), 0, 'refusals record nothing');

create temporary table started on commit drop as
  select * from public.begin_invitation_email(
    '80000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a8');

select is((select outcome from started), 'started', 'a pending invitation can be emailed');
select is((select recipient_email from started), 'pending8@example.test', 'the recipient is the invitation''s own email');
select is(
  (select status from public.invitation_email_deliveries where id = (select delivery_id from started)),
  'preparing', 'the attempt is recorded as preparing'
);
select is(
  (select outcome from public.begin_invitation_email('80000000-0000-4000-8000-000000000001', null)),
  'in_progress', 'a second send cannot start while one is in flight'
);
select throws_ok(
  $$insert into public.invitation_email_deliveries (invitation_id) values ('80000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'the unique index allows only one preparing attempt per invitation'
);

select is(
  public.complete_invitation_email((select delivery_id from started), 'failed', null, 'provider_unavailable'),
  'updated', 'a failure is recorded'
);
select is(
  public.complete_invitation_email((select delivery_id from started), 'accepted', 'msg_1', null),
  'not_preparing', 'a closed attempt cannot be changed again'
);
select is(
  (select failure_code from public.invitation_email_deliveries where id = (select delivery_id from started)),
  'provider_unavailable', 'the failure code is kept'
);
select is(
  (select revoked_at is null and accepted_at is null from public.invitations where id = '80000000-0000-4000-8000-000000000001'),
  true, 'a failed send leaves the invitation pending and usable'
);
select throws_ok(
  $$select public.complete_invitation_email(gen_random_uuid(), 'delivered', null, null)$$,
  '22023', null, 'only accepted or failed can be recorded'
);

-- Retry after a failure, accepted by the provider.
create temporary table retry on commit drop as
  select * from public.begin_invitation_email('80000000-0000-4000-8000-000000000001', null);
select is((select outcome from retry), 'started', 'a failed send can be retried');
select is(
  public.complete_invitation_email((select delivery_id from retry), 'accepted', 'msg_2', null),
  'updated', 'acceptance is recorded'
);
select is(
  (select outcome from public.begin_invitation_email('80000000-0000-4000-8000-000000000001', null)),
  'recently_sent', 'an immediate resend after acceptance is refused'
);

-- Unknown failure codes are rejected by the constraint.
select throws_ok(
  $$insert into public.invitation_email_deliveries (invitation_id, status, failure_code, finished_at)
    values ('80000000-0000-4000-8000-000000000001', 'failed', 'raw provider text', now())$$,
  '23514', null, 'failure codes come from a fixed vocabulary'
);

-- A stale preparing attempt is closed as interrupted.
update public.invitation_email_deliveries
   set finished_at = now() - interval '2 hours'
 where id = (select delivery_id from retry);
insert into public.invitation_email_deliveries (invitation_id, created_at)
values ('80000000-0000-4000-8000-000000000001', now() - interval '10 minutes');
select is(
  (select outcome from public.begin_invitation_email('80000000-0000-4000-8000-000000000001', null)),
  'started', 'a stale in-flight attempt does not block forever'
);
select is(
  (select count(*)::int from public.invitation_email_deliveries
    where invitation_id = '80000000-0000-4000-8000-000000000001' and failure_code = 'interrupted'),
  1, 'the stale attempt is recorded as interrupted'
);

-- Five attempts in 24 hours is the limit (four so far plus one more).
select public.complete_invitation_email(d.id, 'failed', null, 'provider_unavailable')
  from public.invitation_email_deliveries d
 where d.invitation_id = '80000000-0000-4000-8000-000000000001' and d.status = 'preparing';
insert into public.invitation_email_deliveries (invitation_id, status, failure_code, finished_at)
values ('80000000-0000-4000-8000-000000000001', 'failed', 'timeout', now());
select is(
  (select outcome from public.begin_invitation_email('80000000-0000-4000-8000-000000000001', null)),
  'limit_reached', 'no more than five attempts in 24 hours'
);

-- Deleting an invitation removes its delivery log.
delete from public.invitations where id = '80000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.invitation_email_deliveries), 0, 'deliveries cascade with their invitation');

reset role;

select * from finish();
rollback;
