-- Invite request retention: a daily job deletes requests after 180 days,
-- with no new request needed to trigger it (PRODUCT_AUDIT F7).
-- Run with: npm run db:test

begin;

select plan(7);

select ok(
  exists (
    select 1 from cron.job
     where jobname = 'purge-expired-invite-requests'
       and schedule = '17 3 * * *'
       and command like '%private.purge_expired_invite_requests()%'
       and active
  ),
  'a daily job purges expired invite requests'
);
select ok(
  not has_function_privilege('anon', 'private.purge_expired_invite_requests()', 'execute'),
  'anon cannot run the purge'
);
select ok(
  not has_function_privilege('authenticated', 'private.purge_expired_invite_requests()', 'execute'),
  'members cannot run the purge'
);

insert into public.invite_requests (email, created_at) values
  ('old@example.test', now() - interval '181 days'),
  ('edge@example.test', now() - interval '179 days'),
  ('new@example.test', now() - interval '1 day');

-- No request_invite() call: the job alone removes what is past 180 days.
select ok(private.purge_expired_invite_requests() >= 1, 'the expired request is deleted');
select is(
  (select count(*)::int from public.invite_requests where email = 'old@example.test'),
  0, 'the request older than 180 days is gone'
);
select is(
  (select count(*)::int from public.invite_requests where email in ('edge@example.test', 'new@example.test')),
  2, 'younger requests are kept'
);
select is(private.purge_expired_invite_requests(), 0, 'running it again deletes nothing more');

select * from finish();
rollback;
