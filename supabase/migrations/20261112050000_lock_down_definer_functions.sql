-- Close API access to Supabase's own rls_auto_enable() (Epic 1, step 15).
--
-- The "Enable automatic RLS" project option installs public.rls_auto_enable(),
-- a SECURITY DEFINER event-trigger function. The Supabase security advisor
-- reports it as executable by anon and authenticated through
-- /rest/v1/rpc/rls_auto_enable. It only needs to run as an event trigger,
-- so nobody should be able to call it through the API.
--
-- The function exists only on projects created with that option (not on the
-- local stack), so the revoke is conditional.

do $$
begin
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'rls_auto_enable'
       and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
