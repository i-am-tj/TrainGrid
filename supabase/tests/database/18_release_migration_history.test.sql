-- The schema check reads which migrations a project has applied, through a
-- function only the secret key may call.
-- Run with: npm run db:test

begin;

select plan(5);

select ok(
  (select prosecdef from pg_proc where oid = 'public.release_applied_migrations()'::regprocedure),
  'release_applied_migrations reads the migration history as its owner (SECURITY DEFINER)'
);
select ok(
  has_function_privilege('service_role', 'public.release_applied_migrations()', 'execute'),
  'the secret key may call it'
);
select ok(
  not has_function_privilege('anon', 'public.release_applied_migrations()', 'execute')
    and not has_function_privilege('authenticated', 'public.release_applied_migrations()', 'execute'),
  'visitors and members may not'
);

select is(
  public.release_applied_migrations(),
  (select array_agg(version order by version) from supabase_migrations.schema_migrations),
  'it returns every applied version, in order'
);

-- As the secret key: the API role cannot read the history itself, only through the function.
set local role service_role;
select ok(
  '20261127000000' = any (public.release_applied_migrations()),
  'the secret key reads it, including the migration that added it'
);
reset role;

select * from finish();

rollback;
