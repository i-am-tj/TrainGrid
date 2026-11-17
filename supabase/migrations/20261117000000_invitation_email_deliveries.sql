-- Invitation email delivery log (Epic 3 integration).
--
-- An invitation (public.invitations) is what grants access; an email is only
-- a courtesy that tells the person about it. The two are kept apart:
--
--   * Creating, revoking or accepting an invitation never depends on an email.
--   * Each send attempt is one row here. A failed send leaves the invitation
--     exactly as it was, so the admin can retry or share the link by hand.
--   * "accepted" means the email provider accepted the request. It is NOT
--     proof that the message reached the recipient; nothing here claims that.
--
-- Like invitations, this table is closed to API roles. Only the admin server
-- action, running with the secret key after confirming the caller is an
-- admin, reads or writes it, through the two functions below.

create table public.invitation_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  status text not null default 'preparing',
  provider text not null default 'resend',
  provider_message_id text,
  failure_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,

  constraint invitation_email_deliveries_status
    check (status in ('preparing', 'accepted', 'failed')),
  constraint invitation_email_deliveries_provider
    check (char_length(provider) between 1 and 40),
  constraint invitation_email_deliveries_message_id
    check (provider_message_id is null or char_length(provider_message_id) between 1 and 200),
  -- A fixed vocabulary: provider responses are never stored verbatim.
  constraint invitation_email_deliveries_failure_code
    check (
      failure_code is null
      or failure_code in (
        'provider_auth',
        'provider_rejected',
        'rate_limited',
        'provider_unavailable',
        'timeout',
        'interrupted'
      )
    ),
  constraint invitation_email_deliveries_consistent
    check (
      (status = 'preparing' and finished_at is null and failure_code is null and provider_message_id is null)
      or (status = 'accepted' and finished_at is not null and failure_code is null)
      or (status = 'failed' and finished_at is not null and failure_code is not null and provider_message_id is null)
    )
);

comment on table public.invitation_email_deliveries is
  'One row per invitation email send attempt. accepted = the provider accepted the request, not proof of delivery. Service role only.';

-- At most one send in flight per invitation: a double submit or a second
-- admin cannot start a parallel send.
create unique index invitation_email_deliveries_one_preparing
  on public.invitation_email_deliveries (invitation_id)
  where status = 'preparing';

create index invitation_email_deliveries_by_invitation
  on public.invitation_email_deliveries (invitation_id, created_at desc);

alter table public.invitation_email_deliveries enable row level security;
revoke all on public.invitation_email_deliveries from anon, authenticated;
grant all on public.invitation_email_deliveries to service_role;

-- ---------------------------------------------------------------------------
-- begin_invitation_email()
--
-- Decides whether a send may start and, if so, records it as 'preparing'.
-- Returns one row: (outcome, delivery_id, recipient_email).
--
--   started          a new attempt was recorded; send to recipient_email
--   not_found        no such invitation
--   revoked          the invitation is revoked; nothing is sent
--   already_accepted the person is already a member; nothing is sent
--   in_progress      another attempt for this invitation is still running
--   recently_sent    the provider accepted a send less than a minute ago
--   limit_reached    five attempts in the last 24 hours
--
-- The invitation row is locked for the duration, so two concurrent calls for
-- the same invitation are serialised. An attempt left 'preparing' for more
-- than two minutes (the server died mid-send) is closed as 'interrupted'.
-- The invitation itself is never modified.
-- ---------------------------------------------------------------------------

create function public.begin_invitation_email(p_invitation_id uuid, p_requested_by uuid)
returns table (outcome text, delivery_id uuid, recipient_email text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invitation record;
  new_id uuid;
begin
  select i.id, i.email, i.accepted_at, i.revoked_at
    into invitation
    from public.invitations i
   where i.id = p_invitation_id
   for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text;
    return;
  end if;
  if invitation.revoked_at is not null then
    return query select 'revoked'::text, null::uuid, null::text;
    return;
  end if;
  if invitation.accepted_at is not null then
    return query select 'already_accepted'::text, null::uuid, null::text;
    return;
  end if;

  update public.invitation_email_deliveries d
     set status = 'failed', failure_code = 'interrupted', finished_at = now()
   where d.invitation_id = invitation.id
     and d.status = 'preparing'
     and d.created_at < now() - interval '2 minutes';

  if exists (
    select 1 from public.invitation_email_deliveries d
     where d.invitation_id = invitation.id and d.status = 'preparing'
  ) then
    return query select 'in_progress'::text, null::uuid, null::text;
    return;
  end if;

  if exists (
    select 1 from public.invitation_email_deliveries d
     where d.invitation_id = invitation.id
       and d.status = 'accepted'
       and d.finished_at > now() - interval '1 minute'
  ) then
    return query select 'recently_sent'::text, null::uuid, null::text;
    return;
  end if;

  if (
    select count(*) from public.invitation_email_deliveries d
     where d.invitation_id = invitation.id
       and d.created_at > now() - interval '24 hours'
  ) >= 5 then
    return query select 'limit_reached'::text, null::uuid, null::text;
    return;
  end if;

  insert into public.invitation_email_deliveries (invitation_id, requested_by)
  values (invitation.id, p_requested_by)
  returning id into new_id;

  return query select 'started'::text, new_id, invitation.email;
end;
$$;

comment on function public.begin_invitation_email(uuid, uuid) is
  'Starts an invitation email attempt if allowed. Returns (outcome, delivery_id, recipient_email). Never changes the invitation. Service role only.';

revoke execute on function public.begin_invitation_email(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_invitation_email(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- complete_invitation_email()
--
-- Records the provider's answer for an attempt that is still 'preparing'.
-- Returns 'updated', or 'not_preparing' if the attempt is unknown or already
-- closed (for example as 'interrupted'), in which case nothing changes.
-- ---------------------------------------------------------------------------

create function public.complete_invitation_email(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_failure_code text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_status not in ('accepted', 'failed') then
    raise exception 'Invalid delivery status' using errcode = '22023';
  end if;

  update public.invitation_email_deliveries d
     set status = p_status,
         provider_message_id = case when p_status = 'accepted' then p_provider_message_id end,
         failure_code = case when p_status = 'failed' then p_failure_code end,
         finished_at = now()
   where d.id = p_delivery_id
     and d.status = 'preparing';

  if not found then
    return 'not_preparing';
  end if;
  return 'updated';
end;
$$;

comment on function public.complete_invitation_email(uuid, text, text, text) is
  'Closes a preparing invitation email attempt as accepted or failed. Service role only.';

revoke execute on function public.complete_invitation_email(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_invitation_email(uuid, text, text, text) to service_role;
