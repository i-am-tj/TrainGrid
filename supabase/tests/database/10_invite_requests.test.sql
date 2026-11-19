-- Invite requests (1.1).
-- Run with: npm run db:test

begin;

select plan(25);

-- ---------------------------------------------------------------------------
-- Privileges: nothing through the API
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.invite_requests'::regclass),
  'RLS is enabled on invite_requests'
);
select ok(not has_table_privilege('anon', 'public.invite_requests', 'insert'), 'anon cannot insert requests');
select ok(not has_table_privilege('anon', 'public.invite_requests', 'select'), 'anon cannot read requests');
select ok(not has_table_privilege('authenticated', 'public.invite_requests', 'select'), 'members cannot read requests');
select ok(not has_table_privilege('authenticated', 'public.invite_requests', 'insert'), 'members cannot insert requests');
select ok(
  not has_function_privilege('anon', 'public.request_invite(text, text, text, text)', 'execute'),
  'anon cannot call request_invite directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.request_invite(text, text, text, text)', 'execute'),
  'members cannot call request_invite directly'
);
select ok(
  has_function_privilege('service_role', 'public.request_invite(text, text, text, text)', 'execute'),
  'the server (service role) can call request_invite'
);

-- ---------------------------------------------------------------------------
-- Requests (as the service role, as the server does)
-- ---------------------------------------------------------------------------

set local role service_role;

select is(
  public.request_invite('  Runner@Example.TEST ', ' Riley ', ' Saw it on a friend''s phone. ', repeat('a', 64)),
  'created', 'a new request is created'
);
select results_eq(
  $$select email, name, note, status from public.invite_requests where email = 'runner@example.test'$$,
  $$values ('runner@example.test'::text, 'Riley'::text, 'Saw it on a friend''s phone.'::text, 'pending'::text)$$,
  'the request is stored normalised and pending'
);
select is(
  public.request_invite('runner@example.test', null, null, repeat('b', 64)),
  'received', 'a second request for a pending address reads as received'
);
select is(
  (select count(*)::int from public.invite_requests where email = 'runner@example.test'),
  1, 'and stores nothing new'
);

insert into public.invitations (email) values ('invited@example.test');
select is(
  public.request_invite('invited@example.test', null, null, repeat('c', 64)),
  'received', 'an already-invited address reads as received, the same as a new one'
);
select is(
  (select count(*)::int from public.invite_requests where email = 'invited@example.test'),
  0, 'and is not stored'
);

select is(public.request_invite('not-an-email', null, null, null), 'invalid', 'a malformed address is invalid');
select is(public.request_invite('a@b.test', repeat('n', 81), null, null), 'invalid', 'a name over 80 characters is invalid');
select is(public.request_invite('a@b.test', null, repeat('n', 501), null), 'invalid', 'a note over 500 characters is invalid');
select is(public.request_invite('a@b.test', null, null, 'not-a-hash'), 'invalid', 'a malformed network hash is invalid');

-- Three per network per hour.
select is(public.request_invite('one@example.test', null, null, repeat('d', 64)), 'created', 'first from a network');
select is(public.request_invite('two@example.test', null, null, repeat('d', 64)), 'created', 'second from a network');
select is(public.request_invite('three@example.test', null, null, repeat('d', 64)), 'created', 'third from a network');
select is(public.request_invite('four@example.test', null, null, repeat('d', 64)), 'rate_limited', 'a fourth within the hour is refused');

-- Inviting the address resolves its request.
insert into public.invitations (email) values ('runner@example.test');
select results_eq(
  $$select status, resolved_at is not null from public.invite_requests where email = 'runner@example.test'$$,
  $$values ('invited'::text, true)$$,
  'creating an invitation marks the pending request invited'
);
select is(
  public.request_invite('runner@example.test', null, null, null),
  'received', 'once invited, asking again still reads as received'
);

-- 50 in 24 hours, then requests pause.
insert into public.invite_requests (email)
select 'bulk' || i || '@example.test' from generate_series(1, 50) as i;
select is(public.request_invite('late@example.test', null, null, null), 'paused', 'after 50 in a day, requests pause');

select * from finish();

rollback;
