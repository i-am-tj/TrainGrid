-- Canonical email rule for linked identities (decision E2-D22, revised).
--
-- Why. Supabase Auth links a new Google/GitHub identity onto an existing user
-- when verified emails match, and issues sessions per USER. RLS only sees
-- auth.uid(), so a linked identity with a different address had the
-- member's full access. Telling WHICH identity a session came from is not
-- possible safely: the only signal, raw_user_meta_data.sub, is user-editable
-- and is last-writer-wins across concurrent sign-ins (shown in review).
--
-- Rule. Each member has a canonical email: the invitation address they
-- accepted, stored here and never read from auth.users.email (users can ask
-- to change that). Every identity linked to the account must carry exactly
-- that address. If any does not, the WHOLE account is locked for every
-- session, whichever identity it came from, until the identity is removed.
-- This needs no attribution: it depends only on account state the user
-- cannot edit. Linking a different address is not supported (deferred).
--
-- Also: the token's session must still exist in auth.sessions, so a signed-out
-- session's access token stops working on the next query, not at expiry.
--
-- Enforced in is_member(), which every member-data policy uses. No auth hook
-- and no Supabase Auth setting is needed.

-- ---------------------------------------------------------------------------
-- Canonical email
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column canonical_email text
    check (canonical_email is null or (canonical_email = lower(btrim(canonical_email)) and canonical_email like '%@%'));

comment on column public.profiles.canonical_email is
  'The invited address this member accepted. Every linked identity must carry it (E2-D22). Not updatable by members.';

-- Backfill: the most recent invitation each member accepted, else the account email.
update public.profiles p
   set canonical_email = coalesce(
         (select i.email
            from public.invitations i
           where i.accepted_by = p.id
           order by i.revoked_at is null desc, i.accepted_at desc nulls last
           limit 1),
         (select lower(btrim(u.email)) from auth.users u where u.id = p.id and u.email like '%@%'));

-- A profile created without one (only accept_invitation and the secret key
-- create profiles) takes the account email.
create function public.profiles_default_canonical_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.canonical_email is null then
    select lower(btrim(u.email)) into new.canonical_email
      from auth.users u
     where u.id = new.id and u.email like '%@%';
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_default_canonical_email() from public, anon, authenticated;

create trigger profiles_default_canonical_email
  before insert on public.profiles
  for each row execute function public.profiles_default_canonical_email();

-- ---------------------------------------------------------------------------
-- The checks
-- ---------------------------------------------------------------------------

-- Why the caller's account is or is not usable right now.
--   member           : profile live, every identity on the canonical email, session current
--   not_member       : no profile
--   revoked          : profile revoked
--   identity_mismatch: an identity with another (or no) email is linked to the account
--   session_ended    : the token's session no longer exists (signed out)
create function public.account_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.revoked_at, p.canonical_email
      from public.profiles p
     where p.id = (select auth.uid())
  )
  select case
    when (select auth.uid()) is null then 'not_member'
    when not exists (
      select 1 from auth.sessions s
       where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
         and s.user_id = (select auth.uid())
    ) then 'session_ended'
    when not exists (select 1 from me) then 'not_member'
    when (select revoked_at from me) is not null then 'revoked'
    when (select canonical_email from me) is null
      or exists (
        select 1 from auth.identities i
         where i.user_id = (select auth.uid())
           and coalesce(lower(btrim(i.email)), '') <> (select canonical_email from me)
      ) then 'identity_mismatch'
    else 'member'
  end;
$$;

comment on function public.account_status() is
  'member | not_member | revoked | identity_mismatch | session_ended for the caller (E2-D22).';

revoke execute on function public.account_status() from public, anon;
grant execute on function public.account_status() to authenticated;

create or replace function public.is_member()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select public.account_status()) = 'member';
$$;

comment on function public.is_member() is
  'True only when account_status() is member: live profile, every linked identity on the canonical email, current session.';

-- The caller's canonical email, for the account page (only their own).
create function public.my_canonical_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.canonical_email from public.profiles p where p.id = (select auth.uid());
$$;

revoke execute on function public.my_canonical_email() from public, anon;
grant execute on function public.my_canonical_email() to authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation(): never grant membership to an account that already has
-- an identity on another address, and record the canonical email.
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

  -- Already an active member: nothing to do. (Whether the account may be
  -- used right now is decided by account_status() on every request.)
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

  -- Every identity on the account must carry the invited address.
  if exists (
    select 1 from auth.identities i
     where i.user_id = caller_id
       and coalesce(lower(btrim(i.email)), '') <> caller_email
  ) then
    return 'identity_mismatch';
  end if;

  -- New member, or a revoked member invited again (their data is kept).
  insert into public.profiles (id, display_name, avatar_url, canonical_email)
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
    end,
    caller_email
  )
  on conflict (id) do update set revoked_at = null, canonical_email = excluded.canonical_email;

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
-- Invite-time check (admin action, secret-key role only)
-- ---------------------------------------------------------------------------

create function public.invitation_email_conflict(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- True when the address already signs in as a user whose own account email
  -- is different: the invitee would be linked into that account.
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
