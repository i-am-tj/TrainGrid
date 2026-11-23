-- A follow and a profile going public must agree on which happened first.
--
-- Without this, a follow could read 'private' while the owner's switch to
-- public was committing; the switch's pending-request sweep did not see the
-- uncommitted follow, which then committed as pending on a public profile.
--
-- One advisory lock per followee orders the two. A follow takes it shared, so
-- concurrent followers never wait on each other. Only an actual private →
-- public change takes it exclusively, so ordinary profile edits (bio, name,
-- avatar) never wait on follows. Whichever comes second sees the first:
--   * a later follow reads the committed 'public' and is accepted at once;
--   * a later switch waits for earlier follows to commit, and its sweep
--     (social_profiles_accept_pending, AFTER UPDATE) then accepts them.
create function private.social_visibility_lock_key(p_user_id uuid)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select hashtextextended('social_visibility:' || p_user_id::text, 0);
$$;
revoke all on function private.social_visibility_lock_key(uuid) from public, anon, authenticated;

create or replace function private.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_visibility text;
begin
  perform pg_advisory_xact_lock_shared(private.social_visibility_lock_key(new.followee_id));

  -- A separate statement, so it reads after the lock is granted.
  select sp.visibility into target_visibility
    from public.social_profiles sp
   where sp.user_id = new.followee_id;

  if target_visibility = 'public' then
    new.status := 'accepted';
    new.accepted_at := now();
  else
    new.status := 'pending';
    new.accepted_at := null;
  end if;
  new.created_at := now();

  if (
    select count(*) from public.follows f
     where f.follower_id = new.follower_id and f.created_at > now() - interval '24 hours'
  ) >= 100 then
    raise exception 'follow_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function private.social_profiles_lock_going_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(private.social_visibility_lock_key(new.user_id));
  return new;
end;
$$;
revoke all on function private.social_profiles_lock_going_public() from public, anon, authenticated;

create trigger social_profiles_lock_going_public
  before update of visibility on public.social_profiles
  for each row
  when (old.visibility = 'private' and new.visibility = 'public')
  execute function private.social_profiles_lock_going_public();
