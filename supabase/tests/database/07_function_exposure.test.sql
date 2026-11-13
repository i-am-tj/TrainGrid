-- Which functions the API roles may call (Epic 1, step 15).
-- SECURITY DEFINER functions run with their owner's rights, so each one the
-- API can reach must be deliberate.

begin;

select plan(3);

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'no SECURITY DEFINER function in public is executable by anon'
);

select results_eq(
  $$select p.proname::text collate "C"
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')
     order by 1$$,
  $$values ('accept_invitation'::text collate "C"),
           ('account_status'),
           ('my_canonical_email')$$,
  'signed-in users can call only these SECURITY DEFINER functions (invitations; account status, E2-D22)'
);

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'anon can execute no function in public at all'
);

select * from finish();

rollback;
