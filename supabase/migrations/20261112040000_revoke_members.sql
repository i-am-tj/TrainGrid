-- Revoking an accepted member (follow-up to Epic 1, step 8).
--
-- An admin can now revoke access for a member who has already accepted their
-- invitation. Their data is kept, hidden from everyone including themselves;
-- inviting the same email again restores access with the data intact.
--
--   * profiles.revoked_at marks a revoked member. A member is now "a profile
--     that is not revoked".
--   * Every policy on member data now requires active membership, not only
--     ownership. Before this, ownership implied membership, because only
--     members could create rows. A revoked member still owns rows.
--   * revoke_invitation() revokes a pending invitation, or an accepted one
--     together with the member's access, in one transaction. It refuses the
--     user ids it is told are protected (the admins).
--   * accept_invitation() restores a revoked member who has a new invitation.

-- ---------------------------------------------------------------------------
-- profiles.revoked_at
-- ---------------------------------------------------------------------------

alter table public.profiles add column revoked_at timestamptz;

comment on column public.profiles.revoked_at is
  'Set when an admin revokes this member. A revoked member has no access; their data is kept.';

-- Members cannot touch it: profiles UPDATE is granted on display_name and
-- avatar_url only (see the core schema migration).

-- An accepted invitation may now be revoked.
alter table public.invitations drop constraint invitations_not_accepted_and_revoked;

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------

create or replace function public.is_member()
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
       and revoked_at is null
  );
$$;

comment on function public.is_member() is
  'True when the calling user has a profile that has not been revoked. Runs as the caller, who can see only their own profile row.';

-- ---------------------------------------------------------------------------
-- Policies: ownership AND active membership
-- ---------------------------------------------------------------------------

-- profiles: a user may still read their own row (so the app can tell a revoked
-- member apart from a stranger) but only an active member may update it.
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) and (select public.is_member()))
  with check (id = (select auth.uid()) and (select public.is_member()));

-- routines
drop policy routines_select_global_or_own on public.routines;
create policy routines_select_global_or_own
  on public.routines
  for select
  to authenticated
  using (
    (select public.is_member())
    and (scope = 'GLOBAL' or owner_user_id = (select auth.uid()))
  );

drop policy routines_update_own_personal on public.routines;
create policy routines_update_own_personal
  on public.routines
  for update
  to authenticated
  using (scope = 'PERSONAL' and owner_user_id = (select auth.uid()) and (select public.is_member()))
  with check (scope = 'PERSONAL' and owner_user_id = (select auth.uid()) and (select public.is_member()));

drop policy routines_delete_own_personal on public.routines;
create policy routines_delete_own_personal
  on public.routines
  for delete
  to authenticated
  using (scope = 'PERSONAL' and owner_user_id = (select auth.uid()) and (select public.is_member()));

-- workout_items: follow the parent routine, and require membership explicitly.
drop policy workout_items_select_visible_routine on public.workout_items;
create policy workout_items_select_visible_routine
  on public.workout_items
  for select
  to authenticated
  using (
    (select public.is_member())
    and exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and (r.scope = 'GLOBAL' or r.owner_user_id = (select auth.uid()))
    )
  );

drop policy workout_items_insert_own_routine on public.workout_items;
create policy workout_items_insert_own_routine
  on public.workout_items
  for insert
  to authenticated
  with check (
    (select public.is_member())
    and exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  );

drop policy workout_items_update_own_routine on public.workout_items;
create policy workout_items_update_own_routine
  on public.workout_items
  for update
  to authenticated
  using (
    (select public.is_member())
    and exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_member())
    and exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  );

drop policy workout_items_delete_own_routine on public.workout_items;
create policy workout_items_delete_own_routine
  on public.workout_items
  for delete
  to authenticated
  using (
    (select public.is_member())
    and exists (
      select 1
        from public.routines r
       where r.id = workout_items.routine_id
         and r.scope = 'PERSONAL'
         and r.owner_user_id = (select auth.uid())
    )
  );

-- scheduled_sessions
drop policy scheduled_sessions_select_own on public.scheduled_sessions;
create policy scheduled_sessions_select_own
  on public.scheduled_sessions
  for select
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));

drop policy scheduled_sessions_update_own on public.scheduled_sessions;
create policy scheduled_sessions_update_own
  on public.scheduled_sessions
  for update
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

drop policy scheduled_sessions_delete_own on public.scheduled_sessions;
create policy scheduled_sessions_delete_own
  on public.scheduled_sessions
  for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));

-- routines_insert_own_personal and scheduled_sessions_insert_own already
-- require is_member(), which now also excludes revoked members.

-- ---------------------------------------------------------------------------
-- accept_invitation(): also restores a revoked member who is invited again
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller record;
  caller_email text;
  invitation_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Already an active member: nothing to do.
  if exists (select 1 from public.profiles where id = caller_id and revoked_at is null) then
    return 'member';
  end if;

  select u.email, u.email_confirmed_at, u.raw_user_meta_data
    into caller
    from auth.users u
   where u.id = caller_id;

  if not found then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  caller_email := lower(btrim(coalesce(caller.email, '')));

  if caller_email = ''
     or caller.email_confirmed_at is null
     or not exists (
       select 1
         from auth.identities i
        where i.user_id = caller_id
          and i.provider in ('google', 'github')
          and i.email = caller_email
     )
  then
    return 'unverified_email';
  end if;

  select i.id
    into invitation_id
    from public.invitations i
   where i.email = caller_email
     and i.revoked_at is null
   for update;

  if not found then
    return 'not_invited';
  end if;

  -- New member, or a revoked member invited again (their data is kept).
  insert into public.profiles (id, display_name, avatar_url)
  values (
    caller_id,
    left(nullif(btrim(coalesce(
      caller.raw_user_meta_data ->> 'full_name',
      caller.raw_user_meta_data ->> 'name',
      ''
    )), ''), 200),
    case
      when caller.raw_user_meta_data ->> 'avatar_url' ~ '^https://'
       and char_length(caller.raw_user_meta_data ->> 'avatar_url') <= 2048
      then caller.raw_user_meta_data ->> 'avatar_url'
    end
  )
  on conflict (id) do update set revoked_at = null;

  update public.invitations
     set accepted_at = coalesce(accepted_at, now()),
         accepted_by = coalesce(accepted_by, caller_id)
   where id = invitation_id;

  return 'member';
end;
$$;

revoke execute on function public.accept_invitation() from public, anon;
grant execute on function public.accept_invitation() to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_invitation()
--
-- Called only by the admin server action, with the secret key, after the
-- server has confirmed the caller is an admin. The database cannot see the
-- admin list, so the action passes it in and the function refuses those ids.
-- Returns: 'revoked', 'not_found', 'already_revoked' or 'protected'.
-- ---------------------------------------------------------------------------

create function public.revoke_invitation(p_invitation_id uuid, p_protected_user_ids uuid[])
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invitation record;
begin
  select i.id, i.accepted_by, i.revoked_at
    into invitation
    from public.invitations i
   where i.id = p_invitation_id
   for update;

  if not found then
    return 'not_found';
  end if;
  if invitation.revoked_at is not null then
    return 'already_revoked';
  end if;
  if invitation.accepted_by is not null
     and invitation.accepted_by = any (coalesce(p_protected_user_ids, '{}'))
  then
    return 'protected';
  end if;

  update public.invitations set revoked_at = now() where id = invitation.id;

  if invitation.accepted_by is not null then
    update public.profiles
       set revoked_at = now()
     where id = invitation.accepted_by
       and revoked_at is null;
  end if;

  return 'revoked';
end;
$$;

comment on function public.revoke_invitation(uuid, uuid[]) is
  'Revokes an invitation; if it was accepted, also revokes that member''s access (data kept). Refuses protected user ids. Service role only.';

revoke execute on function public.revoke_invitation(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.revoke_invitation(uuid, uuid[]) to service_role;
