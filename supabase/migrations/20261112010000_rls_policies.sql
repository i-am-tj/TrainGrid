-- Row Level Security policies (Epic 1, step 3).
--
-- Model
--   * A member is an authenticated user who has a profiles row.
--   * Private rows are visible and writable only by their owner.
--   * GLOBAL routines and their items are readable by members and writable by
--     no API role. They are managed with the service role only.
--   * Every policy targets the `authenticated` role. `anon` has neither
--     privileges nor policies.
--
-- `(select auth.uid())` is used instead of a bare `auth.uid()` so the planner
-- evaluates it once per statement rather than once per row.

-- ---------------------------------------------------------------------------
-- Membership helper
-- ---------------------------------------------------------------------------

create function public.is_member()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where id = (select auth.uid())
  );
$$;

comment on function public.is_member() is
  'True when the calling user has a profiles row. Runs as the caller, so it sees only what the profiles policies allow: the caller''s own row.';

revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles: a member reads and updates only their own row.
-- No insert or delete policy: rows are provisioned by the invitation flow.
-- ---------------------------------------------------------------------------

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- routines
-- ---------------------------------------------------------------------------

create policy routines_select_global_or_own
  on public.routines
  for select
  to authenticated
  using (
    (scope = 'GLOBAL' and (select public.is_member()))
    or owner_user_id = (select auth.uid())
  );

-- Members create PERSONAL routines for themselves only. A GLOBAL routine, or
-- a routine owned by someone else, fails the check.
create policy routines_insert_own_personal
  on public.routines
  for insert
  to authenticated
  with check (
    scope = 'PERSONAL'
    and owner_user_id = (select auth.uid())
    and (select public.is_member())
  );

create policy routines_update_own_personal
  on public.routines
  for update
  to authenticated
  using (scope = 'PERSONAL' and owner_user_id = (select auth.uid()))
  with check (scope = 'PERSONAL' and owner_user_id = (select auth.uid()));

create policy routines_delete_own_personal
  on public.routines
  for delete
  to authenticated
  using (scope = 'PERSONAL' and owner_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- workout_items: access follows the parent routine.
-- ---------------------------------------------------------------------------

create policy workout_items_select_visible_routine
  on public.workout_items
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and (
           (r.scope = 'GLOBAL' and (select public.is_member()))
           or r.owner_user_id = (select auth.uid())
         )
    )
  );

create policy workout_items_insert_own_routine
  on public.workout_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  );

create policy workout_items_update_own_routine
  on public.workout_items
  for update
  to authenticated
  using (
    exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  );

create policy workout_items_delete_own_routine
  on public.workout_items
  for delete
  to authenticated
  using (
    exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- scheduled_sessions: strictly the owner's.
-- ---------------------------------------------------------------------------

create policy scheduled_sessions_select_own
  on public.scheduled_sessions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The source routine, when given, must be one the caller can see. The inner
-- query runs under the routines policies, so another member's personal
-- routine cannot be referenced or probed for existence.
create policy scheduled_sessions_insert_own
  on public.scheduled_sessions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_member())
    and (
      source_routine_id is null
      or exists (
        select 1
          from public.routines r
         where r.id = scheduled_sessions.source_routine_id
      )
    )
  );

create policy scheduled_sessions_update_own
  on public.scheduled_sessions
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy scheduled_sessions_delete_own
  on public.scheduled_sessions
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
