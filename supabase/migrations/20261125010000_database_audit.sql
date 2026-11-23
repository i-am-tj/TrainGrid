-- Keep the existing signature, caller checks and function privileges.
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
     -- Active members returned above. Every new admission needs an unused invite,
     -- including when the previously invited auth account has been deleted.
     and i.accepted_at is null
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
     set accepted_at = now(),
         accepted_by = caller_id
   where id = invitation_id;

  return 'member';
end;
$$;

-- Deleting the accepting account (accepted_by ON DELETE SET NULL) spends the
-- invitation for good. Retire it so it no longer holds the address's one live
-- slot: an admin can then invite that address again in one step. accepted_at
-- stays as the record of the original admission.
create function private.invitations_retire_on_account_delete()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.revoked_at := coalesce(new.revoked_at, now());
  return new;
end;
$$;
revoke all on function private.invitations_retire_on_account_delete() from public, anon, authenticated;

create trigger invitations_retire_on_account_delete
before update of accepted_by on public.invitations
for each row
when (old.accepted_by is not null and new.accepted_by is null and new.accepted_at is not null)
execute function private.invitations_retire_on_account_delete();

-- Invitations already spent by earlier account deletions.
update public.invitations
   set revoked_at = now()
 where accepted_at is not null
   and accepted_by is null
   and revoked_at is null;

-- Existing CHECKs enforce types and version when keys exist. Missing keys
-- yield SQL UNKNOWN. Check presence when the application writes a document.
-- Historical malformed documents remain editable in unrelated columns.
create function private.require_training_document_keys()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  doc jsonb;
begin
  if tg_table_name = 'scheduled_sessions' then
    doc := new.snapshot;
    if tg_op = 'UPDATE' and doc is not distinct from old.snapshot then return new; end if;
  else
    doc := new.entries;
    if tg_op = 'UPDATE' and doc is not distinct from old.entries then return new; end if;
  end if;
  if not (doc ?& array['version', 'items']) then
    raise exception 'Training document needs version and items' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.require_training_document_keys() from public, anon, authenticated;

create trigger scheduled_sessions_require_document_keys
before insert or update of snapshot on public.scheduled_sessions
for each row execute function private.require_training_document_keys();

create trigger workout_logs_require_document_keys
before insert or update of entries on public.workout_logs
for each row execute function private.require_training_document_keys();

-- Serialize the existing daily count checks per writer and table under the
-- Data API's READ COMMITTED isolation. PostgreSQL fires same-timing triggers
-- in name order, so 'acquire_daily_limit' must sort before every other BEFORE
-- INSERT trigger on these tables; 16_database_audit.test.sql fails if one
-- ever sorts ahead of it.
create function private.lock_daily_member_limit()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  writer uuid;
begin
  case tg_table_name
    when 'member_feedback' then writer := new.user_id;
    when 'follows' then writer := new.follower_id;
    else writer := new.author_id;
  end case;
  -- Key on the caller, not the row: RLS rejects a row naming someone else
  -- only after this runs, so a forged writer column must not take (and hold)
  -- that member's lock. The service role has no auth.uid() and uses the row.
  writer := coalesce((select auth.uid()), writer);
  perform pg_advisory_xact_lock(hashtextextended(writer::text, tg_relid::bigint));
  return new;
end;
$$;
revoke all on function private.lock_daily_member_limit() from public, anon, authenticated;

create trigger acquire_daily_limit before insert on public.member_feedback
for each row execute function private.lock_daily_member_limit();
create trigger acquire_daily_limit before insert on public.follows
for each row execute function private.lock_daily_member_limit();
create trigger acquire_daily_limit before insert on public.session_posts
for each row execute function private.lock_daily_member_limit();
create trigger acquire_daily_limit before insert on public.post_comments
for each row execute function private.lock_daily_member_limit();
