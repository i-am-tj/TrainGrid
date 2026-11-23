-- ===========================================================================
-- Quick workouts, workout totals on posts, likes and comments
--
--   * scheduled_sessions.origin: 'planned' (as before) or 'quick', a session
--     started on the spot from Home. A quick session has no plan; its
--     exercises are added during the workout and live in its workout log.
--   * session_posts gain an optional WORKOUT SUMMARY, copied by the database
--     from the author's own completed workout log at posting time, like the
--     session snapshot: actual duration (when the duration is shown), sets done
--     and volume lifted (each only when the author ticks it). Exercises and
--     individual sets are never copied. Fixed once posted.
--   * post_likes and post_comments: visible to exactly the members who may
--     see the post (the author's visibility rules, ADR 002), only from active
--     members, and gone for anyone who loses access to the post. Liking and
--     commenting need a social profile. Comments are deleted by their author
--     or by the post's author; they are not edited.
--
-- As in the social migration: definer helpers live in `private` (not
-- exposed by the API); everything in `public` runs with the caller's rights.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Quick sessions
-- ---------------------------------------------------------------------------

alter table public.scheduled_sessions
  add column origin text not null default 'planned';

alter table public.scheduled_sessions
  add constraint scheduled_sessions_origin_valid check (origin in ('planned', 'quick'));

comment on column public.scheduled_sessions.origin is
  'planned: put on the calendar ahead of time. quick: started on the spot from Home; its exercises live in its workout log.';

-- ---------------------------------------------------------------------------
-- Workout summary on posts
-- ---------------------------------------------------------------------------

alter table public.session_posts
  add column shows_sets boolean not null default false,
  add column shows_volume boolean not null default false,
  add column workout_completed boolean not null default false,
  add column workout_sets integer,
  add column workout_volume numeric(12, 1),
  add column workout_unit text;

alter table public.session_posts
  add constraint session_posts_workout_sets_range
    check (workout_sets is null or (shows_sets and workout_sets between 1 and 100000)),
  add constraint session_posts_workout_volume_range
    check (workout_volume is null or (shows_volume and workout_volume > 0 and workout_volume < 100000000)),
  add constraint session_posts_workout_unit_valid
    check ((workout_volume is null) = (workout_unit is null) and (workout_unit is null or workout_unit in ('kg', 'lb')));

comment on column public.session_posts.workout_completed is
  'True when the session had a finished workout when it was posted. Copied by trigger.';
comment on column public.session_posts.workout_sets is
  'Sets done in the finished workout, only when shows_sets. Copied by trigger; never changes.';
comment on column public.session_posts.workout_volume is
  'Sum of weight x reps over done sets, only when shows_volume. Copied by trigger; never changes.';

-- Sets done and volume from a workout-log entries document, the same rules as
-- summarize() in lib/workouts/model.ts. Pure; no table access.
create function private.workout_totals(p_entries jsonb, out sets_done integer, out volume numeric)
language sql
immutable
set search_path = ''
as $$
  select
    count(*) filter (where (s ->> 'done')::boolean)::integer,
    round(coalesce(sum(
      case when (s ->> 'done')::boolean
                and jsonb_typeof(s -> 'weight') = 'number'
                and jsonb_typeof(s -> 'reps') = 'number'
           then (s ->> 'weight')::numeric * (s ->> 'reps')::numeric
      end
    ), 0), 1)
  from jsonb_array_elements(coalesce(p_entries -> 'items', '[]'::jsonb)) as i,
       jsonb_array_elements(coalesce(i -> 'sets', '[]'::jsonb)) as s;
$$;

revoke all on function private.workout_totals(jsonb) from public, anon;
grant execute on function private.workout_totals(jsonb) to authenticated, service_role;

-- Replaces the social migration's version: the same snapshot of the session,
-- plus the workout summary when the session has a finished workout.
create or replace function private.session_posts_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source record;
  workout record;
  totals record;
begin
  if new.session_id is null then
    raise exception 'post_session_required' using errcode = 'P0001';
  end if;

  select s.name, s.category, s.date, s.duration_minutes
    into source
    from public.scheduled_sessions s
   where s.id = new.session_id
     and s.user_id = new.author_id
     and (s.user_id = (select auth.uid()) or current_user = 'service_role');

  if not found then
    raise exception 'post_session_not_found' using errcode = 'P0001';
  end if;

  new.session_name := source.name;
  new.session_category := source.category;
  new.session_date := source.date;
  new.session_duration_minutes := case when new.shows_duration then source.duration_minutes end;

  -- The finished workout, if there is one. Runs as the caller, so it is the
  -- author's own log or nothing.
  select l.started_at, l.finished_at, l.unit, l.entries
    into workout
    from public.workout_logs l
   where l.session_id = new.session_id
     and l.user_id = new.author_id
     and l.status = 'completed';

  new.workout_completed := found;
  new.workout_sets := null;
  new.workout_volume := null;
  new.workout_unit := null;
  if found then
    select t.sets_done, t.volume into totals from private.workout_totals(workout.entries) t;
    if new.shows_duration then
      -- The time actually trained beats the planned duration.
      new.session_duration_minutes := least(1440, greatest(1,
        round(extract(epoch from (workout.finished_at - workout.started_at)) / 60)::integer));
    end if;
    if new.shows_sets and totals.sets_done > 0 then
      new.workout_sets := totals.sets_done;
    end if;
    if new.shows_volume and totals.volume > 0 then
      new.workout_volume := totals.volume;
      new.workout_unit := workout.unit;
    end if;
  end if;

  new.shows_duration := new.shows_duration and new.session_duration_minutes is not null;
  new.shows_sets := new.shows_sets and new.workout_sets is not null;
  new.shows_volume := new.shows_volume and new.workout_volume is not null;
  new.edited_at := null;

  -- Members post "now", within the daily limit. Only the service role may
  -- date a post (seeding realistic local data).
  if current_user = 'service_role' then
    return new;
  end if;
  new.created_at := now();

  if (
    select count(*) from public.session_posts p
     where p.author_id = new.author_id and p.created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'post_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.session_posts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_name is distinct from old.session_name
     or new.session_category is distinct from old.session_category
     or new.session_date is distinct from old.session_date
     or new.session_duration_minutes is distinct from old.session_duration_minutes
     or new.shows_duration is distinct from old.shows_duration
     or new.shows_sets is distinct from old.shows_sets
     or new.shows_volume is distinct from old.shows_volume
     or new.workout_completed is distinct from old.workout_completed
     or new.workout_sets is distinct from old.workout_sets
     or new.workout_volume is distinct from old.workout_volume
     or new.workout_unit is distinct from old.workout_unit
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at
     or (new.session_id is distinct from old.session_id and new.session_id is not null)
  then
    raise exception 'post_snapshot_immutable' using errcode = 'P0001';
  end if;
  if new.caption is distinct from old.caption then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.session_posts_before_insert() from public, anon, authenticated;
revoke all on function private.session_posts_before_update() from public, anon, authenticated;

grant insert (shows_sets, shows_volume) on table public.session_posts to authenticated;
grant select (shows_sets, shows_volume, workout_completed, workout_sets, workout_volume, workout_unit)
  on table public.session_posts to authenticated;

-- ---------------------------------------------------------------------------
-- Visibility of one post (definer: reads past RLS, decides like the policies)
-- ---------------------------------------------------------------------------

create function private.can_view_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.can_view_content(p.author_id) from public.session_posts p where p.id = p_post),
    false
  );
$$;

revoke all on function private.can_view_post(uuid) from public, anon;
grant execute on function private.can_view_post(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Likes
-- ---------------------------------------------------------------------------

create table public.post_likes (
  post_id uuid not null references public.session_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint post_likes_pkey primary key (post_id, user_id)
);

comment on table public.post_likes is
  'One like per member per post. Visible to whoever may see the post; only from active members.';

create index post_likes_user_idx on public.post_likes (user_id, created_at desc);

alter table public.post_likes enable row level security;

create policy post_likes_select_visible
  on public.post_likes
  for select
  to authenticated
  using (
    (select public.is_member())
    and (
      -- Your own likes, always: so you can take one back even after losing access to the post.
      user_id = (select auth.uid())
      or (private.can_view_post(post_id) and private.is_active_member(user_id))
    )
  );

create policy post_likes_insert_own
  on public.post_likes
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member()) and private.can_view_post(post_id));

create policy post_likes_delete_own
  on public.post_likes
  for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));

revoke all on table public.post_likes from public, anon, authenticated;
grant select, delete on table public.post_likes to authenticated;
grant insert (post_id) on table public.post_likes to authenticated;
grant all on table public.post_likes to service_role;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.session_posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),

  constraint post_comments_body_length
    check (char_length(btrim(body)) between 1 and 500 and body = btrim(body))
);

comment on table public.post_comments is
  'Comments on a post. Visible to whoever may see the post; deleted by their author or the post''s author; not edited.';

create index post_comments_post_created_idx on public.post_comments (post_id, created_at, id);
create index post_comments_author_created_idx on public.post_comments (author_id, created_at desc);

-- At most 100 comments per member per 24 hours; the time is the database's
-- (only the service role, seeding local data, may date a comment). Runs as
-- the caller: a member can always read their own comments, which is all the
-- count needs, and current_user then really is the caller.
create function private.post_comments_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    new.created_at := now();
    if (
      select count(*) from public.post_comments c
       where c.author_id = new.author_id and c.created_at > now() - interval '24 hours'
    ) >= 100 then
      raise exception 'comment_rate_limited' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.post_comments_before_insert() from public, anon, authenticated;

create trigger post_comments_before_insert
  before insert on public.post_comments
  for each row execute function private.post_comments_before_insert();

alter table public.post_comments enable row level security;

create policy post_comments_select_visible
  on public.post_comments
  for select
  to authenticated
  using (
    (select public.is_member())
    and (
      -- Your own comments, always: so you can delete what you wrote even after losing access.
      author_id = (select auth.uid())
      or (private.can_view_post(post_id) and private.is_active_member(author_id))
    )
  );

create policy post_comments_insert_own
  on public.post_comments
  for insert
  to authenticated
  with check (author_id = (select auth.uid()) and (select public.is_member()) and private.can_view_post(post_id));

-- The comment's author, or the post's author (the inner read runs under the
-- session_posts policies: the caller's own post or nothing).
create policy post_comments_delete_author_or_post_author
  on public.post_comments
  for delete
  to authenticated
  using (
    (select public.is_member())
    and (
      author_id = (select auth.uid())
      or exists (
        select 1 from public.session_posts p
         where p.id = post_comments.post_id and p.author_id = (select auth.uid())
      )
    )
  );

revoke all on table public.post_comments from public, anon, authenticated;
grant select, delete on table public.post_comments to authenticated;
grant insert (post_id, body) on table public.post_comments to authenticated;
grant all on table public.post_comments to service_role;

-- ---------------------------------------------------------------------------
-- social_posts(): the feed and timelines, now with the workout summary,
-- like and comment counts, and whether the caller liked each post. One post
-- by id with p_post. Still invoker: RLS decides every row and every count.
-- ---------------------------------------------------------------------------

drop function public.social_posts(uuid, timestamptz, uuid, integer);

create function public.social_posts(
  p_author uuid default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20,
  p_post uuid default null
)
returns table (
  id uuid,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  caption text,
  shows_duration boolean,
  session_name text,
  session_category text,
  session_date date,
  session_duration_minutes integer,
  workout_completed boolean,
  workout_sets integer,
  workout_volume numeric,
  workout_unit text,
  like_count integer,
  comment_count integer,
  viewer_liked boolean,
  created_at timestamptz,
  edited_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.author_id, a.username, a.display_name, a.avatar_url,
    p.caption, p.shows_duration, p.session_name, p.session_category, p.session_date,
    p.session_duration_minutes, p.workout_completed, p.workout_sets, p.workout_volume, p.workout_unit,
    (select count(*)::integer from public.post_likes l where l.post_id = p.id),
    (select count(*)::integer from public.post_comments c where c.post_id = p.id),
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())),
    p.created_at, p.edited_at
  from public.session_posts p
  join public.social_profiles a on a.user_id = p.author_id
  where (
      (p_post is not null and p.id = p_post)
      or (p_post is null and p_author is not null and p.author_id = p_author)
      or (
        p_post is null
        and p_author is null
        and (
          p.author_id = (select auth.uid())
          or exists (
            select 1 from public.follows f
             where f.follower_id = (select auth.uid())
               and f.followee_id = p.author_id
               and f.status = 'accepted'
          )
        )
      )
    )
    and (
      p_before_created_at is null
      or p_before_id is null
      or (p.created_at, p.id) < (p_before_created_at, p_before_id)
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

comment on function public.social_posts(uuid, timestamptz, uuid, integer, uuid) is
  'Feed (no author, no post), one timeline (p_author) or one post (p_post), newest first, keyset-paginated, with workout summary, like and comment counts. Invoker rights.';

revoke all on function public.social_posts(uuid, timestamptz, uuid, integer, uuid) from public, anon;
grant execute on function public.social_posts(uuid, timestamptz, uuid, integer, uuid) to authenticated, service_role;
