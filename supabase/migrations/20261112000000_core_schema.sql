-- TrainGrid core schema (Epic 1, step 2).
--
-- Tables: profiles, routines, workout_items, scheduled_sessions.
--
-- Row Level Security is enabled on every table here with no policies, so the
-- tables are closed to API roles until the policy migration (step 3) opens
-- exactly what is intended. The invitations table and profile provisioning
-- arrive with the invitation model (step 7).
--
-- These tables describe planned training only. Performed-workout data
-- (weights, reps, completed sets) is deliberately absent and will live in
-- separate tables that reference scheduled_sessions.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: stamps updated_at on every row update.';

-- Only ever invoked by triggers; not callable through the API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 200),
  constraint profiles_avatar_url_length
    check (avatar_url is null or char_length(avatar_url) <= 2048)
);

comment on table public.profiles is
  'One row per TrainGrid member. id is the Supabase Auth user id; the existence of a row means the user is a member.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- routines
-- ---------------------------------------------------------------------------

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  owner_user_id uuid references public.profiles (id) on delete cascade,
  slug text,
  name text not null,
  category text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint routines_scope_valid
    check (scope in ('GLOBAL', 'PERSONAL')),
  -- GLOBAL routines have no owner; PERSONAL routines always have one.
  constraint routines_scope_owner
    check (
      (scope = 'GLOBAL' and owner_user_id is null)
      or (scope = 'PERSONAL' and owner_user_id is not null)
    ),
  -- Slugs identify seeded system content only.
  constraint routines_slug_global_only
    check (slug is null or scope = 'GLOBAL'),
  constraint routines_slug_format
    check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint routines_name_length
    check (char_length(btrim(name)) between 1 and 200),
  constraint routines_category_valid
    check (category in ('running', 'strength', 'plyometrics', 'other')),
  constraint routines_description_length
    check (char_length(description) <= 2000)
);

comment on table public.routines is
  'Reusable workout definitions. GLOBAL routines are shared system content; PERSONAL routines belong to one member.';
comment on column public.routines.slug is
  'Stable identifier for seeded GLOBAL routines, used to keep seeding idempotent.';

create unique index routines_slug_key
  on public.routines (slug)
  where slug is not null;

create index routines_owner_user_id_idx
  on public.routines (owner_user_id)
  where owner_user_id is not null;

create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workout_items
-- ---------------------------------------------------------------------------

create table public.workout_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  name text not null,
  instruction text not null default '',
  rest text not null default '',
  target text not null default '',
  notes text not null default '',
  equipment text[] not null default '{}',
  video_url text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workout_items_name_length
    check (char_length(btrim(name)) between 1 and 200),
  constraint workout_items_instruction_length
    check (char_length(instruction) <= 2000),
  constraint workout_items_rest_length
    check (char_length(rest) <= 200),
  constraint workout_items_target_length
    check (char_length(target) <= 200),
  constraint workout_items_notes_length
    check (char_length(notes) <= 4000),
  constraint workout_items_equipment_valid
    check (
      equipment <@ array[
        'bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'resistance-band',
        'machine', 'cable', 'bench', 'pull-up-bar', 'plyometric-box', 'other'
      ]::text[]
    ),
  constraint workout_items_video_url_format
    check (
      video_url is null
      or (char_length(video_url) <= 2048 and video_url ~ '^https://')
    ),
  constraint workout_items_sort_order_non_negative
    check (sort_order >= 0),
  -- Deferred so items can be reordered within one transaction.
  constraint workout_items_routine_sort_order_key
    unique (routine_id, sort_order) deferrable initially deferred
);

comment on table public.workout_items is
  'Ordered planned steps of a routine. Planned work only; no performed data.';
comment on column public.workout_items.instruction is
  'Planned work to perform, e.g. "4 x 5-6".';
comment on column public.workout_items.rest is
  'Planned recovery instruction, e.g. "2-3 min".';
comment on column public.workout_items.target is
  'Planned intensity target: RPE, pace, heart-rate zone, effort.';

create trigger workout_items_set_updated_at
  before update on public.workout_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- scheduled_sessions
-- ---------------------------------------------------------------------------

create table public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time time,
  name text not null,
  category text not null,
  duration_minutes integer,
  notes text not null default '',
  -- Provenance only. The session's content is its snapshot, so deleting the
  -- routine keeps the session and simply clears this reference.
  source_routine_id uuid references public.routines (id) on delete set null,
  snapshot jsonb not null default '{"version": 1, "items": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scheduled_sessions_name_length
    check (char_length(btrim(name)) between 1 and 200),
  constraint scheduled_sessions_category_valid
    check (category in ('running', 'strength', 'plyometrics', 'other')),
  constraint scheduled_sessions_duration_range
    check (duration_minutes is null or duration_minutes between 1 and 1440),
  constraint scheduled_sessions_notes_length
    check (char_length(notes) <= 4000),
  constraint scheduled_sessions_snapshot_shape
    check (
      jsonb_typeof(snapshot) = 'object'
      and snapshot -> 'version' = '1'::jsonb
      and jsonb_typeof(snapshot -> 'items') = 'array'
    ),
  constraint scheduled_sessions_snapshot_size
    check (octet_length(snapshot::text) <= 200000)
);

comment on table public.scheduled_sessions is
  'A member''s calendar entries. Each row is a self-contained snapshot of the workout as scheduled.';
comment on column public.scheduled_sessions.snapshot is
  'Versioned document: {"version": 1, "items": [...]}. Items carry their own ids and the same planned fields as workout_items.';
comment on column public.scheduled_sessions.source_routine_id is
  'Optional provenance. Never determines session content.';

create index scheduled_sessions_user_id_date_idx
  on public.scheduled_sessions (user_id, date);

create index scheduled_sessions_source_routine_id_idx
  on public.scheduled_sessions (source_routine_id)
  where source_routine_id is not null;

create trigger scheduled_sessions_set_updated_at
  before update on public.scheduled_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: on everywhere, no policies yet (deny by default)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.workout_items enable row level security;
alter table public.scheduled_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges
--
-- Start from nothing and grant only what the application needs. The anon
-- role gets no access to any table. Ownership and identity columns are not
-- updatable by members, so a row can never be reassigned after creation.
-- ---------------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;
revoke all on public.routines from anon, authenticated;
revoke all on public.workout_items from anon, authenticated;
revoke all on public.scheduled_sessions from anon, authenticated;

-- profiles: rows are created by invitation provisioning, not by members.
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

grant select, insert, delete on public.routines to authenticated;
grant update (name, category, description) on public.routines to authenticated;

grant select, insert, delete on public.workout_items to authenticated;
grant update (name, instruction, rest, target, notes, equipment, video_url, sort_order)
  on public.workout_items to authenticated;

grant select, insert, delete on public.scheduled_sessions to authenticated;
grant update (date, start_time, name, category, duration_minutes, notes, snapshot)
  on public.scheduled_sessions to authenticated;

grant all on public.profiles to service_role;
grant all on public.routines to service_role;
grant all on public.workout_items to service_role;
grant all on public.scheduled_sessions to service_role;
