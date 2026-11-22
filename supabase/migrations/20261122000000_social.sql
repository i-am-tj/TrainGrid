-- ===========================================================================
-- Social: member profiles, following and session posts
--
-- TrainGrid members can now opt in to a small, members-only social layer:
--
--   * social_profiles  one optional row per member: a unique @username, a
--                      display name, a short bio, an avatar choice and a
--                      visibility ('private' by default, or 'public').
--   * follows          follower -> followee, 'pending' (a request to a
--                      private profile) or 'accepted'.
--   * session_posts    a caption plus a SNAPSHOT of one of the author's own
--                      scheduled sessions (name, category, date and, only if
--                      the author chooses, its duration).
--
-- Visibility rules, all enforced here and not only in the app:
--
--   * Nothing is visible to anon, to signed-in non-members or to revoked
--     members. "Public" means every active TrainGrid member, never the open
--     internet.
--   * Any active member sees any active member's basic identity (username,
--     display name, bio, avatar, visibility, counts). Email addresses are not
--     part of the social layer at all.
--   * Posts, and the followers/following lists, of a profile are visible to
--     its owner; to everyone when the profile is public; otherwise only to
--     followers whose request was accepted. Removing a follower, cancelling a
--     follow or switching to private takes effect on the next query.
--   * A revoked member's profile, posts and relationships disappear for
--     everyone (kept, as with the rest of their data, and restored if they
--     are invited again).
--   * A post never exposes its scheduled session: session_id is not readable
--     through the API at all, start time, notes, exercises and workout logs
--     are never copied, and the snapshot is filled by the database from the
--     author's own session, so it cannot be forged or later rewritten.
--
-- Helpers that need to look past RLS (another member's revoked_at, follow
-- counts) live in the `private` schema, which the Data API does not expose:
-- policies and the invoker functions below can use them, nobody can call
-- them through /rest/v1/rpc. Every function in `public` here is SECURITY
-- INVOKER, so RLS applies to everything they read.
-- ===========================================================================

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
comment on schema private is
  'Internal helpers for RLS policies. Not exposed by the Data API.';
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- social_profiles
-- ---------------------------------------------------------------------------

create table public.social_profiles (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text not null default '',
  visibility text not null default 'private',
  use_identity_avatar boolean not null default false,
  -- Filled by the database from the member's sign-in picture when
  -- use_identity_avatar is on; never set by the member directly.
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 3-30 characters: lower-case letters, digits and single underscores, not
  -- at either end. Stored lower-case so uniqueness is a plain equality.
  constraint social_profiles_username_format
    check (username ~ '^[a-z0-9](?:[a-z0-9]|_(?!_)){1,28}[a-z0-9]$'),
  constraint social_profiles_username_not_reserved
    check (username not in (
      'about', 'account', 'admin', 'administrator', 'api', 'edit', 'everyone',
      'feed', 'followers', 'following', 'help', 'home', 'login', 'me', 'new',
      'null', 'people', 'post', 'posts', 'profile', 'requests', 'root',
      'search', 'settings', 'support', 'system', 'traingrid', 'undefined'
    )),
  constraint social_profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 60 and display_name = btrim(display_name)),
  constraint social_profiles_bio_length
    check (char_length(bio) <= 160),
  constraint social_profiles_visibility_valid
    check (visibility in ('private', 'public')),
  constraint social_profiles_avatar_url_format
    check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://'))
);

comment on table public.social_profiles is
  'Optional, members-only social identity. Private by default. Basic identity is visible to every active member; posts follow the visibility rules in the social migration.';
comment on column public.social_profiles.avatar_url is
  'Copied by trigger from profiles.avatar_url when use_identity_avatar is true; otherwise null (initials are shown).';

create unique index social_profiles_username_key on public.social_profiles (username);
-- Member search: substring matches on username and display name.
create index social_profiles_username_trgm_idx
  on public.social_profiles using gin (username extensions.gin_trgm_ops);
create index social_profiles_display_name_trgm_idx
  on public.social_profiles using gin (lower(display_name) extensions.gin_trgm_ops);

create trigger social_profiles_set_updated_at
  before update on public.social_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  followee_id uuid not null references public.social_profiles (user_id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,

  constraint follows_pkey primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id),
  constraint follows_status_valid check (status in ('pending', 'accepted')),
  constraint follows_accepted_at_matches_status
    check ((status = 'accepted') = (accepted_at is not null))
);

comment on table public.follows is
  'Who follows whom. pending = a request to a private profile awaiting approval; accepted = following. One row per pair.';

create index follows_followee_status_idx on public.follows (followee_id, status, accepted_at desc);
create index follows_follower_status_idx on public.follows (follower_id, status, accepted_at desc);

-- ---------------------------------------------------------------------------
-- session_posts
-- ---------------------------------------------------------------------------

create table public.session_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  -- The author's session the snapshot was taken from. Provenance only, never
  -- readable through the API; cleared if the session is deleted.
  session_id uuid references public.scheduled_sessions (id) on delete set null,
  caption text not null default '',
  shows_duration boolean not null default false,
  -- The snapshot: copied from the session when the post is created, by the
  -- trigger below. Not writable through the API, so it never changes.
  session_name text not null,
  session_category text not null,
  session_date date not null,
  session_duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,

  constraint session_posts_caption_length
    check (char_length(caption) <= 500),
  constraint session_posts_session_name_length
    check (char_length(btrim(session_name)) between 1 and 200),
  constraint session_posts_session_category_valid
    check (session_category in ('running', 'strength', 'plyometrics', 'other')),
  constraint session_posts_session_duration_range
    check (session_duration_minutes is null or session_duration_minutes between 1 and 1440),
  constraint session_posts_duration_only_when_shown
    check (shows_duration or session_duration_minutes is null)
);

comment on table public.session_posts is
  'A member''s update about one of their own scheduled sessions: a caption and a snapshot of the session (name, category, date, optional duration). Never the session itself.';
comment on column public.session_posts.session_id is
  'Provenance only. Not granted to API roles, so posts never reveal the scheduled session.';

-- Profile timelines and the feed read newest first, by author.
create index session_posts_author_created_idx
  on public.session_posts (author_id, created_at desc, id desc);
create index session_posts_session_id_idx
  on public.session_posts (session_id)
  where session_id is not null;

create trigger session_posts_set_updated_at
  before update on public.session_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Private helpers (definer rights, not reachable through the API)
-- ---------------------------------------------------------------------------

-- Whether a user id belongs to an active (not revoked) member. Members can
-- read only their own profiles row, so this must look past RLS.
create function private.is_active_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = p_user and p.revoked_at is null
  );
$$;

-- Whether the caller may see a profile's posts and connections: their own;
-- an active public profile; or an active private one they follow (accepted).
-- The caller must be an active member themself.
create function private.can_view_content(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and private.is_active_member((select auth.uid()))
     and private.is_active_member(p_owner)
     and (
       p_owner = (select auth.uid())
       or exists (
         select 1 from public.social_profiles sp
          where sp.user_id = p_owner and sp.visibility = 'public'
       )
       or exists (
         select 1 from public.follows f
          where f.follower_id = (select auth.uid())
            and f.followee_id = p_owner
            and f.status = 'accepted'
       )
     );
$$;

-- Accepted followers and following of a member, counting only active
-- members. Counts are basic identity: shown on private profiles too.
create function private.follow_counts(p_user uuid, out followers integer, out following integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer
       from public.follows f
       join public.profiles p on p.id = f.follower_id and p.revoked_at is null
      where f.followee_id = p_user and f.status = 'accepted'),
    (select count(*)::integer
       from public.follows f
       join public.profiles p on p.id = f.followee_id and p.revoked_at is null
      where f.follower_id = p_user and f.status = 'accepted');
$$;

-- Posts are visible on a timeline only; their count is shown like the
-- follow counts, even when the posts themselves are not.
create function private.post_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.session_posts where author_id = p_user;
$$;

revoke all on function private.is_active_member(uuid) from public, anon;
revoke all on function private.can_view_content(uuid) from public, anon;
revoke all on function private.follow_counts(uuid) from public, anon;
revoke all on function private.post_count(uuid) from public, anon;
grant execute on function private.is_active_member(uuid) to authenticated, service_role;
grant execute on function private.can_view_content(uuid) to authenticated, service_role;
grant execute on function private.follow_counts(uuid) to authenticated, service_role;
grant execute on function private.post_count(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- social_profiles: the avatar comes only from the member's own sign-in
-- picture, never from a URL they type.
create function private.social_profiles_fill_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.use_identity_avatar then
    select p.avatar_url into new.avatar_url from public.profiles p where p.id = new.user_id;
  else
    new.avatar_url := null;
  end if;
  return new;
end;
$$;

create trigger social_profiles_fill_avatar
  before insert or update of use_identity_avatar on public.social_profiles
  for each row execute function private.social_profiles_fill_avatar();

-- Going public approves every waiting request: on a public profile anyone may
-- follow without asking, so nobody is left pending.
create function private.social_profiles_accept_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.follows
     set status = 'accepted', accepted_at = now()
   where followee_id = new.user_id and status = 'pending';
  return null;
end;
$$;

create trigger social_profiles_accept_pending
  after update of visibility on public.social_profiles
  for each row
  when (old.visibility = 'private' and new.visibility = 'public')
  execute function private.social_profiles_accept_pending();

-- follows: the status is the database's decision, never the caller's. A
-- follow of a public profile is accepted at once; of a private one, pending.
-- At most 100 new follows per member per 24 hours.
create function private.follows_before_insert()
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

create trigger follows_before_insert
  before insert on public.follows
  for each row execute function private.follows_before_insert();

-- follows: approving a request stamps accepted_at; an accepted follow can
-- never go back to pending.
create function private.follows_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'follow_already_accepted' using errcode = 'P0001';
  end if;
  if old.status = 'pending' and new.status = 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

create trigger follows_before_update
  before update on public.follows
  for each row execute function private.follows_before_update();

-- session_posts: copy the snapshot from the AUTHOR'S OWN session. Security
-- invoker on purpose: the lookup runs under the scheduled_sessions policies,
-- so another member's session is simply not found. The service role (local
-- seeding and support work only; the app never posts with it) may post for a
-- member, but still only from that member's own session. At most 20 posts per
-- member per 24 hours (the service role is not limited).
create function private.session_posts_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source record;
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
  new.shows_duration := new.shows_duration and source.duration_minutes is not null;
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

create trigger session_posts_before_insert
  before insert on public.session_posts
  for each row execute function private.session_posts_before_insert();

-- session_posts: the snapshot is fixed for good (also enforced by grants);
-- editing the caption marks the post as edited.
create function private.session_posts_before_update()
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

create trigger session_posts_before_update
  before update on public.session_posts
  for each row execute function private.session_posts_before_update();

revoke all on function private.social_profiles_fill_avatar() from public, anon, authenticated;
revoke all on function private.social_profiles_accept_pending() from public, anon, authenticated;
revoke all on function private.follows_before_insert() from public, anon, authenticated;
revoke all on function private.follows_before_update() from public, anon, authenticated;
revoke all on function private.session_posts_before_insert() from public, anon, authenticated;
revoke all on function private.session_posts_before_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.social_profiles enable row level security;
alter table public.follows enable row level security;
alter table public.session_posts enable row level security;

-- social_profiles: basic identity of active members, for active members.
create policy social_profiles_select_members
  on public.social_profiles
  for select
  to authenticated
  using ((select public.is_member()) and private.is_active_member(user_id));

create policy social_profiles_insert_own
  on public.social_profiles
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member()));

create policy social_profiles_update_own
  on public.social_profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

create policy social_profiles_delete_own
  on public.social_profiles
  for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));

-- follows: a member sees their own relationships, both ways. Anyone else sees
-- an accepted relationship between active members only when they may view the
-- FOLLOWED profile (it is public, or they follow it). So a private profile's
-- followers never leak through a public follower's "following" list, and a
-- private member's following list shows only profiles the viewer could see
-- anyway.
create policy follows_select_visible
  on public.follows
  for select
  to authenticated
  using (
    (select public.is_member())
    and (
      follower_id = (select auth.uid())
      or followee_id = (select auth.uid())
      or (
        status = 'accepted'
        and private.is_active_member(follower_id)
        and private.can_view_content(followee_id)
      )
    )
  );

-- Follow (or request to follow) another active member, as yourself, from a
-- social profile of your own. The inner reads run under RLS: a revoked or
-- missing profile is not found.
create policy follows_insert_own
  on public.follows
  for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and (select public.is_member())
    and exists (select 1 from public.social_profiles sp where sp.user_id = (select auth.uid()))
    and exists (select 1 from public.social_profiles sp where sp.user_id = follows.followee_id)
  );

-- Only the person followed approves, and only a pending request.
create policy follows_update_approve
  on public.follows
  for update
  to authenticated
  using (followee_id = (select auth.uid()) and status = 'pending' and (select public.is_member()))
  with check (followee_id = (select auth.uid()) and status = 'accepted' and (select public.is_member()));

-- Either side ends a relationship: unfollow or cancel (follower); reject or
-- remove a follower (followee).
create policy follows_delete_either_side
  on public.follows
  for delete
  to authenticated
  using (
    (follower_id = (select auth.uid()) or followee_id = (select auth.uid()))
    and (select public.is_member())
  );

-- session_posts
create policy session_posts_select_visible
  on public.session_posts
  for select
  to authenticated
  using ((select public.is_member()) and private.can_view_content(author_id));

create policy session_posts_insert_own
  on public.session_posts
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.is_member())
    and exists (select 1 from public.social_profiles sp where sp.user_id = (select auth.uid()))
  );

create policy session_posts_update_own
  on public.session_posts
  for update
  to authenticated
  using (author_id = (select auth.uid()) and (select public.is_member()))
  with check (author_id = (select auth.uid()) and (select public.is_member()));

create policy session_posts_delete_own
  on public.session_posts
  for delete
  to authenticated
  using (author_id = (select auth.uid()) and (select public.is_member()));

-- ---------------------------------------------------------------------------
-- Privileges: owners and snapshots are never the caller's to set.
-- ---------------------------------------------------------------------------

revoke all on table public.social_profiles from public, anon, authenticated;
revoke all on table public.follows from public, anon, authenticated;
revoke all on table public.session_posts from public, anon, authenticated;

grant select, delete on table public.social_profiles to authenticated;
grant insert (username, display_name, bio, visibility, use_identity_avatar)
  on table public.social_profiles to authenticated;
grant update (username, display_name, bio, visibility, use_identity_avatar)
  on table public.social_profiles to authenticated;

grant select, delete on table public.follows to authenticated;
grant insert (followee_id) on table public.follows to authenticated;
grant update (status) on table public.follows to authenticated;

-- Every column except session_id.
grant select (
  id, author_id, caption, shows_duration, session_name, session_category, session_date,
  session_duration_minutes, created_at, updated_at, edited_at
) on table public.session_posts to authenticated;
grant insert (session_id, caption, shows_duration) on table public.session_posts to authenticated;
grant update (caption) on table public.session_posts to authenticated;
grant delete on table public.session_posts to authenticated;

grant all on table public.social_profiles to service_role;
grant all on table public.follows to service_role;
grant all on table public.session_posts to service_role;

-- ---------------------------------------------------------------------------
-- Read functions (SECURITY INVOKER: RLS applies to everything they read)
-- ---------------------------------------------------------------------------

-- A profile as one viewer sees it: identity, counts and how the two of them
-- are related. Returns no row for an unknown, revoked or invisible profile.
create function public.social_profile(p_username text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  bio text,
  visibility text,
  avatar_url text,
  created_at timestamptz,
  follower_count integer,
  following_count integer,
  post_count integer,
  is_self boolean,
  -- The viewer's follow of this profile: 'pending', 'accepted' or null.
  viewer_follow text,
  -- This profile's follow of the viewer: 'pending', 'accepted' or null.
  follows_viewer text,
  can_view_posts boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    sp.user_id,
    sp.username,
    sp.display_name,
    sp.bio,
    sp.visibility,
    sp.avatar_url,
    sp.created_at,
    c.followers,
    c.following,
    private.post_count(sp.user_id),
    sp.user_id = (select auth.uid()),
    (select f.status from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = sp.user_id),
    (select f.status from public.follows f
      where f.follower_id = sp.user_id and f.followee_id = (select auth.uid())),
    private.can_view_content(sp.user_id)
  from public.social_profiles sp
  cross join lateral private.follow_counts(sp.user_id) c
  where sp.username = lower(btrim(p_username));
$$;

comment on function public.social_profile(text) is
  'One profile as the caller sees it (identity, counts, relationship). Invoker rights: RLS decides what exists.';

-- Posts, newest first, with keyset pagination on (created_at, id).
--   p_author null: the caller's feed (their own posts and those of members
--                  they follow, accepted).
--   p_author set : that member's timeline, if the caller may view it.
-- Either way the session_posts policies decide what is visible.
create function public.social_posts(
  p_author uuid default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
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
    p.session_duration_minutes, p.created_at, p.edited_at
  from public.session_posts p
  join public.social_profiles a on a.user_id = p.author_id
  where (
      (p_author is not null and p.author_id = p_author)
      or (
        p_author is null
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

comment on function public.social_posts(uuid, timestamptz, uuid, integer) is
  'Feed (p_author null) or one timeline, newest first, keyset-paginated. Invoker rights: the session_posts policies decide visibility.';

-- Member search by username or display name. At most 20 rows, at least two
-- characters; the email address is not searchable or returned.
create function public.search_social_profiles(p_query text, p_limit integer default 20)
returns table (
  user_id uuid,
  username text,
  display_name text,
  bio text,
  visibility text,
  avatar_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select replace(replace(replace(lower(btrim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') as term,
           lower(btrim(coalesce(p_query, ''))) as raw
  )
  select sp.user_id, sp.username, sp.display_name, sp.bio, sp.visibility, sp.avatar_url
    from public.social_profiles sp, q
   where char_length(q.raw) between 2 and 60
     and (sp.username like '%' || ltrim(q.term, '@') || '%' or lower(sp.display_name) like '%' || q.term || '%')
   order by (sp.username = ltrim(q.raw, '@')) desc,
            (sp.username like ltrim(q.term, '@') || '%') desc,
            sp.username
   limit least(greatest(coalesce(p_limit, 20), 1), 20);
$$;

comment on function public.search_social_profiles(text, integer) is
  'Search active members'' social profiles by username or display name (2-60 characters, at most 20 results). Invoker rights.';

revoke all on function public.social_profile(text) from public, anon;
revoke all on function public.social_posts(uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function public.search_social_profiles(text, integer) from public, anon;
grant execute on function public.social_profile(text) to authenticated, service_role;
grant execute on function public.social_posts(uuid, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function public.search_social_profiles(text, integer) to authenticated, service_role;
