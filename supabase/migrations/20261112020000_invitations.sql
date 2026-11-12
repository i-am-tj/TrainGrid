-- Invitation model and member provisioning (Epic 1, step 7).
--
-- Signing in with Google or GitHub proves identity. It does not grant access.
-- A user becomes a member only when their verified email matches an
-- invitation that has not been revoked; at that moment a profiles row is
-- created, and the existence of that row is what every RLS policy checks.
--
-- The invitations table stores no credentials. Supabase Auth owns identity.

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,

  -- Stored normalised so matching is a plain equality.
  constraint invitations_email_normalised
    check (email = lower(btrim(email))),
  constraint invitations_email_format
    check (char_length(email) between 3 and 320 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  -- Only an unused invitation can be revoked.
  constraint invitations_not_accepted_and_revoked
    check (accepted_at is null or revoked_at is null)
);

comment on table public.invitations is
  'Email addresses allowed to become TrainGrid members. Not readable or writable by members; managed by admin server actions with the service role.';

-- At most one live (not revoked) invitation per email address.
create unique index invitations_live_email_key
  on public.invitations (email)
  where revoked_at is null;

-- Closed to API roles: RLS on, no policies, no privileges.
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant all on public.invitations to service_role;

-- ---------------------------------------------------------------------------
-- accept_invitation()
--
-- Called by the signed-in user right after OAuth. Returns:
--   'member'            the caller is (now) a member
--   'not_invited'       no live invitation for the caller's email
--   'unverified_email'  the caller has no verified email from Google or GitHub
--
-- SECURITY DEFINER because it must read auth.users and invitations and write
-- profiles, none of which the caller may do directly. It takes no arguments:
-- everything is derived from the caller's own authenticated identity, so it
-- cannot be used to accept an invitation on someone else's behalf.
-- ---------------------------------------------------------------------------

create function public.accept_invitation()
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

  -- Already a member: nothing to do.
  if exists (select 1 from public.profiles where id = caller_id) then
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

  -- Require an email that Supabase has confirmed and that comes from a
  -- Google or GitHub identity belonging to this user.
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
  on conflict (id) do nothing;

  update public.invitations
     set accepted_at = coalesce(accepted_at, now()),
         accepted_by = coalesce(accepted_by, caller_id)
   where id = invitation_id;

  return 'member';
end;
$$;

comment on function public.accept_invitation() is
  'Makes the calling user a member if their verified Google/GitHub email has a live invitation. Returns member, not_invited or unverified_email.';

revoke execute on function public.accept_invitation() from public, anon;
grant execute on function public.accept_invitation() to authenticated;
