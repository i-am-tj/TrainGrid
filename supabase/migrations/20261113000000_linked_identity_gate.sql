-- Linked-identity gate (bug found 2026-11-13; decision E2-D22 in agents/DECISIONS.md).
--
-- Supabase Auth links a new OAuth identity to an EXISTING user when the new
-- identity's verified email matches the email of any identity that user
-- already has. So if a member's GitHub identity carries address X and the
-- admin invites X as a separate person, signing in with a Google account for
-- X does not create a new user: it signs in as the existing member, with full
-- access to that member's data, and the invitation for X is never used.
--
-- Two checks close this:
--   1. invitation_email_conflict(email): used by the admin invite action, so
--      such an invitation is refused before it is created.
--   2. accept_invitation(): refuses a sign-in made through a linked identity
--      whose email has a live invitation the caller never accepted, i.e. one
--      the admin meant for someone else. Returns 'linked_identity'; the
--      callback then signs the session out.
--
-- The identity used for a sign-in is the one whose provider id matches
-- raw_user_meta_data ->> 'sub': Supabase Auth copies the signing-in identity's
-- profile there on every OAuth sign-in. auth.identities.last_sign_in_at is not
-- updated on later sign-ins, so it cannot be used. If no identity matches,
-- check 2 does not apply and the existing rules decide, as before.

-- ---------------------------------------------------------------------------
-- 1. Invite-time check (secret-key role only)
-- ---------------------------------------------------------------------------

create function public.invitation_email_conflict(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- True when the address already signs in as a user whose own account email
  -- is different: inviting it would let that person into the other account.
  select exists (
    select 1
      from auth.identities i
      join auth.users u on u.id = i.user_id
     where lower(btrim(i.email)) = lower(btrim(p_email))
       and lower(btrim(coalesce(u.email, ''))) <> lower(btrim(p_email))
  );
$$;

comment on function public.invitation_email_conflict(text) is
  'True if the email is already a linked sign-in identity of a user with a different account email. Admin invite action only.';

revoke execute on function public.invitation_email_conflict(text) from public, anon, authenticated;
grant execute on function public.invitation_email_conflict(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Sign-in check inside accept_invitation()
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
  signin_email text;
  invitation_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select u.email, u.email_confirmed_at, u.raw_user_meta_data
    into caller
    from auth.users u
   where u.id = caller_id;

  if not found then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  caller_email := lower(btrim(coalesce(caller.email, '')));

  -- The identity this sign-in used (see the header comment).
  select lower(btrim(i.email))
    into signin_email
    from auth.identities i
   where i.user_id = caller_id
     and i.provider in ('google', 'github')
     and i.provider_id = coalesce(
           caller.raw_user_meta_data ->> 'sub',
           caller.raw_user_meta_data ->> 'provider_id')
   limit 1;

  -- Signed in through a linked identity whose address the admin invited as a
  -- separate person: never let that person into this account.
  if signin_email is not null
     and signin_email <> caller_email
     and exists (
       select 1
         from public.invitations inv
        where inv.email = signin_email
          and inv.revoked_at is null
          and (inv.accepted_by is null or inv.accepted_by <> caller_id)
     )
  then
    return 'linked_identity';
  end if;

  -- Already an active member: nothing to do.
  if exists (select 1 from public.profiles where id = caller_id and revoked_at is null) then
    return 'member';
  end if;

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
