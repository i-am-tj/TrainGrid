-- ===========================================================================
-- Invite requests (1.1)
--
-- A visitor without an invitation can ask for one from the sign-in page. The
-- request is stored here for an admin to review on the Invitations page; the
-- server also emails the owner a copy.
--
--   * Nothing is reachable through the API: not the table and not the
--     function. The sign-in page's server action calls request_invite() with
--     the secret key (service role only), so the limits below cannot be
--     bypassed by calling the database directly, and anon keeps executing no
--     function at all (supabase/tests/database/07_function_exposure).
--     Admins read and resolve requests with the secret key.
--   * Limits: one pending request per email address; three requests per
--     network per hour (a daily-rotating keyed hash of the IP, made by the
--     server; never the address itself); 50 requests in 24 hours in total,
--     after which requests pause until the next day.
--   * The answer never says whether an address is already invited or a
--     member: an existing pending request or live invitation reads as
--     "received", exactly like a new one.
--   * Creating an invitation for the same address marks its pending request
--     "invited" (trigger). Requests are deleted 180 days after they are made.
-- ===========================================================================

create table public.invite_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  note text,
  ip_hash text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint invite_requests_email_normalised
    check (email = lower(btrim(email))),
  constraint invite_requests_email_format
    check (char_length(email) between 3 and 320 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint invite_requests_name_length
    check (name is null or char_length(name) between 1 and 80),
  constraint invite_requests_note_length
    check (note is null or char_length(note) between 1 and 500),
  constraint invite_requests_ip_hash_format
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  constraint invite_requests_status_valid
    check (status in ('pending', 'invited', 'dismissed')),
  constraint invite_requests_resolved_consistent
    check ((status = 'pending') = (resolved_at is null))
);

comment on table public.invite_requests is
  'Requests for an invitation from visitors. Written only by request_invite(); read and resolved by admins with the secret key.';

create unique index invite_requests_one_pending_per_email
  on public.invite_requests (email) where status = 'pending';
create index invite_requests_created_idx on public.invite_requests (created_at desc);
create index invite_requests_ip_created_idx on public.invite_requests (ip_hash, created_at desc);

alter table public.invite_requests enable row level security;
revoke all on table public.invite_requests from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- request_invite(): the only way in for visitors.
--
-- Returns 'created' (a new request: the server emails the owner),
-- 'received' (already pending or already invited: the visitor is told the
-- same thing as for 'created'), 'invalid', 'rate_limited' or 'paused'.
-- ---------------------------------------------------------------------------

create function public.request_invite(
  p_email text,
  p_name text default null,
  p_note text default null,
  p_ip_hash text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ip text := nullif(btrim(coalesce(p_ip_hash, '')), '');
begin
  if char_length(v_email) not between 3 and 320
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or (v_name is not null and char_length(v_name) > 80)
     or (v_note is not null and char_length(v_note) > 500)
     or (v_ip is not null and v_ip !~ '^[0-9a-f]{64}$') then
    return 'invalid';
  end if;

  -- Retention: requests are kept for 180 days.
  delete from public.invite_requests where created_at < now() - interval '180 days';

  -- Serialise requests so the counts below cannot be raced past.
  perform pg_advisory_xact_lock(hashtext('public.request_invite'));

  if (select count(*) from public.invite_requests where created_at > now() - interval '24 hours') >= 50 then
    return 'paused';
  end if;

  if v_ip is not null and (
    select count(*) from public.invite_requests
     where ip_hash = v_ip and created_at > now() - interval '1 hour'
  ) >= 3 then
    return 'rate_limited';
  end if;

  if exists (select 1 from public.invite_requests where email = v_email and status = 'pending')
     or exists (select 1 from public.invitations where email = v_email and revoked_at is null) then
    return 'received';
  end if;

  insert into public.invite_requests (email, name, note, ip_hash)
  values (v_email, v_name, v_note, v_ip);
  return 'created';
end;
$$;

comment on function public.request_invite(text, text, text, text) is
  'Stores a visitor''s request for an invitation, within limits. Never reveals whether the address is already invited.';

revoke execute on function public.request_invite(text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_invite(text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- An invitation for the same address resolves its pending request.
-- ---------------------------------------------------------------------------

create function public.invite_requests_mark_invited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invite_requests
     set status = 'invited', resolved_at = now()
   where email = new.email and status = 'pending';
  return new;
end;
$$;

comment on function public.invite_requests_mark_invited() is
  'After-insert trigger on invitations: marks a pending request for the same email as invited.';

revoke execute on function public.invite_requests_mark_invited() from public, anon, authenticated;

create trigger invitations_resolve_invite_request
  after insert on public.invitations
  for each row execute function public.invite_requests_mark_invited();
