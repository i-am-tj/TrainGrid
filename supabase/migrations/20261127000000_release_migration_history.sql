-- ===========================================================================
-- Let the schema check see which migrations a project has applied
--
-- The release check and /api/health compared only the names the Data API
-- lists: tables, columns and functions. A migration that changes a function
-- body or adds a trigger changes none of those, so on 25 November 2026
-- production reported schema "ok" while two such migrations (from #86) had
-- never been applied.
--
-- release_applied_migrations() returns the versions recorded by
-- `supabase db push` in supabase_migrations.schema_migrations, so the check
-- can name every migration in the build that the project lacks.
--
-- SECURITY DEFINER because that schema is not readable by the API roles.
-- Callable by the secret key (service_role) only, like the OpenAPI document
-- the check already reads. The versions are file timestamps; they hold no
-- member data.
-- ===========================================================================

create function public.release_applied_migrations()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.version order by m.version), '{}')
    from supabase_migrations.schema_migrations m;
$$;

comment on function public.release_applied_migrations() is
  'Versions of the migrations applied to this project, sorted. Read by the release check and /api/health with the secret key; not callable by members.';

revoke execute on function public.release_applied_migrations() from public, anon, authenticated;
grant execute on function public.release_applied_migrations() to service_role;
