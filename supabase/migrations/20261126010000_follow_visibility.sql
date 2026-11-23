-- A follow and a visibility change must agree on which happened first.
-- Concurrent followers can share this row lock. A visibility update waits
-- for prior follows, and a later follow reads the committed visibility.
create or replace function private.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_visibility text;
begin
  select sp.visibility into target_visibility
    from public.social_profiles sp
   where sp.user_id = new.followee_id
   for share;

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
