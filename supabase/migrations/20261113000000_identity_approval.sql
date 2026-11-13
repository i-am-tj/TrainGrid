-- Identity approval: access is granted per sign-in identity, enforced when
-- tokens are issued and on every query (decision E2-D22).
--
-- Why. Supabase Auth links a new Google/GitHub identity onto an existing user
-- when the verified emails match, then issues an ordinary session for that
-- USER. Row Level Security only sees auth.uid(), so any linked identity had
-- the member's full access, whatever the app's callback decided. A check in
-- accept_invitation() is advisory: a client can exchange its code and call
-- the REST API without ever asking.
--
-- Model.
--   * approved_identities: which of a user's identities may be used. An
--     identity is approved automatically when its verified email equals the
--     account's own email (the invited address: same mailbox, same trust);
--     any other identity must be approved by the member from an approved,
--     recent session (approve_my_identity). Invitations play no part.
--   * custom_access_token_hook: Supabase Auth calls it before issuing ANY
--     token. On sign-in it finds the identity used (Supabase records it in
--     raw_user_meta_data.sub on every OAuth sign-in), refuses an unapproved one
--     (HTTP 403, no tokens), and records session -> identity. On refresh it
--     uses that record, so later metadata changes cannot move a session to
--     another identity; a session with no record, or whose identity is no
--     longer approved or no longer exists, gets no new token.
--   * session_is_approved(), used by is_member() and the profiles read
--     policy: the token's session must still exist and be recorded against
--     an approved identity. Unlinking an identity, or signing out, cuts access
--     on the next query, not when the access token expires. Sessions issued
--     before this migration have no record, so they lose access at once.
--
-- Deploy: this migration and the hook (Dashboard → Authentication → Hooks →
-- Customize Access Token → public.custom_access_token_hook) must go live
-- together. Without the hook no session is recorded and members see nothing
-- (fails closed). Runbook: docs/SECURITY.md.

-- ---------------------------------------------------------------------------
-- Tables (no API access; functions below are the only way in)
-- ---------------------------------------------------------------------------

create table public.approved_identities (
  identity_id uuid primary key references auth.identities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  basis text not null check (basis in ('account_email', 'member_approved')),
  approved_at timestamptz not null default now()
);

comment on table public.approved_identities is
  'Sign-in identities allowed to obtain sessions. Removed with the identity (unlinking).';

create table public.session_identities (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_id uuid not null references auth.identities (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.session_identities is
  'Which identity each session was signed in with; written by custom_access_token_hook.';

create index session_identities_identity_idx on public.session_identities (identity_id);

alter table public.approved_identities enable row level security;
alter table public.session_identities enable row level security;
revoke all on public.approved_identities, public.session_identities from public, anon, authenticated;

-- Existing identities whose email is the account's own email are approved;
-- every other linked identity starts unapproved.
insert into public.approved_identities (identity_id, user_id, basis)
select i.id, i.user_id, 'account_email'
  from auth.identities i
  join auth.users u on u.id = i.user_id
 where i.email is not null
   and lower(btrim(i.email)) = lower(btrim(coalesce(u.email, '')))
on conflict (identity_id) do nothing;

-- ---------------------------------------------------------------------------
-- Approval and session checks
-- ---------------------------------------------------------------------------

create function public.identity_is_approved(p_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.approved_identities where identity_id = p_identity_id);
$$;

revoke execute on function public.identity_is_approved(uuid) from public, anon, authenticated;

create function public.session_is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.session_identities si
      join auth.sessions s on s.id = si.session_id and s.user_id = si.user_id
      join public.approved_identities a on a.identity_id = si.identity_id
     where si.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and si.user_id = (select auth.uid())
  );
$$;

comment on function public.session_is_approved() is
  'True when the caller''s session still exists and was signed in with an approved identity.';

revoke execute on function public.session_is_approved() from public, anon;
grant execute on function public.session_is_approved() to authenticated;

create or replace function public.is_member()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select public.session_is_approved())
     and exists (
       select 1
         from public.profiles
        where id = (select auth.uid())
          and revoked_at is null
     );
$$;

comment on function public.is_member() is
  'True when the caller''s session is approved (session_is_approved) and their profile is not revoked.';

drop policy profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) and (select public.session_is_approved()));

-- ---------------------------------------------------------------------------
-- The access token hook
-- ---------------------------------------------------------------------------

create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := nullif(event ->> 'user_id', '')::uuid;
  method text := coalesce(event ->> 'authentication_method', '');
  sid uuid := nullif(event -> 'claims' ->> 'session_id', '')::uuid;
  meta jsonb;
  account_email text;
  identity_id uuid;
  identity_email text;
begin
  if uid is null or sid is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'identity_unknown'));
  end if;

  -- Refresh: the session keeps the identity it was signed in with.
  if method = 'token_refresh' then
    select si.identity_id into identity_id
      from public.session_identities si
     where si.session_id = sid and si.user_id = uid;
    if identity_id is null or not public.identity_is_approved(identity_id) then
      return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'identity_not_approved'));
    end if;
    return event;
  end if;

  select u.raw_user_meta_data, lower(btrim(coalesce(u.email, '')))
    into meta, account_email
    from auth.users u
   where u.id = uid;

  -- Sign-in: the identity Supabase Auth recorded for this sign-in.
  select i.id, lower(btrim(i.email))
    into identity_id, identity_email
    from auth.identities i
   where i.user_id = uid
     and i.provider_id = coalesce(meta ->> 'sub', meta ->> 'provider_id')
   limit 1;

  -- Email-based sign-ins (local development and tests) use the email identity.
  if identity_id is null and method in ('password', 'otp', 'magiclink', 'email/signup', 'invite', 'recovery', 'email_change') then
    select i.id, lower(btrim(i.email))
      into identity_id, identity_email
      from auth.identities i
     where i.user_id = uid and i.provider = 'email'
     limit 1;
  end if;

  if identity_id is null then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'identity_unknown'));
  end if;

  -- Same verified address as the account: the same mailbox the invitation went to.
  if identity_email is not null and identity_email <> '' and identity_email = account_email then
    insert into public.approved_identities (identity_id, user_id, basis)
    values (identity_id, uid, 'account_email')
    on conflict on constraint approved_identities_pkey do nothing;
  end if;

  if not public.identity_is_approved(identity_id) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'identity_not_approved'));
  end if;

  insert into public.session_identities (session_id, user_id, identity_id)
  values (sid, uid, identity_id)
  on conflict (session_id) do nothing;

  return event;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Auth access token hook: refuses tokens for unapproved identities and binds sessions to identities.';

grant usage on schema public to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Member functions: see and approve one's own sign-in methods
-- ---------------------------------------------------------------------------

create function public.list_my_identities()
returns table (
  identity_id uuid,
  provider text,
  email text,
  linked_at timestamptz,
  approved boolean,
  this_session boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.provider, i.email, i.created_at,
         exists (select 1 from public.approved_identities a where a.identity_id = i.id),
         exists (select 1 from public.session_identities si
                  where si.identity_id = i.id
                    and si.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid)
    from auth.identities i
   where i.user_id = (select auth.uid())
     and (select public.is_member())
   order by i.created_at;
$$;

revoke execute on function public.list_my_identities() from public, anon;
grant execute on function public.list_my_identities() to authenticated;

create function public.approve_my_identity(p_identity_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  signed_in_at double precision;
begin
  if caller_id is null or not (select public.is_member()) then
    return 'not_member';
  end if;

  if not exists (select 1 from auth.identities where id = p_identity_id and user_id = caller_id) then
    return 'unknown';
  end if;

  -- Approving a way into the account needs a sign-in in the last 10 minutes.
  select max((entry ->> 'timestamp')::double precision)
    into signed_in_at
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as entry;
  if signed_in_at is null or signed_in_at < extract(epoch from now()) - 600 then
    return 'reauth_required';
  end if;

  insert into public.approved_identities (identity_id, user_id, basis)
  values (p_identity_id, caller_id, 'member_approved')
  on conflict (identity_id) do nothing;
  return 'approved';
end;
$$;

revoke execute on function public.approve_my_identity(uuid) from public, anon;
grant execute on function public.approve_my_identity(uuid) to authenticated;

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
