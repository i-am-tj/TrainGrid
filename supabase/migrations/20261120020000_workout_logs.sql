-- ===========================================================================
-- Workout logs (live workouts)
--
-- TrainGrid now goes to the gym with the member: a scheduled session can be
-- started, its sets ticked off with the weight and reps actually done, and
-- finished. That record is a workout log. This replaces decision D-04A
-- ("plans training; does not log performance").
--
--   * One log per scheduled session (unique session_id). Deleting the session
--     deletes its log; the planned snapshot itself is never changed by logging.
--   * The performed sets live in `entries`, a versioned JSON document like the
--     session snapshot: {"version": 1, "items": [{item_id, name, sets: [...]}]}.
--     Each entry keeps the exercise name, so the log still reads correctly if
--     the session's workout is customised afterwards.
--   * Strictly the member's own rows, and only while their membership is
--     active (is_member()). user_id defaults to the caller and cannot be set
--     or changed through the API; session_id cannot be changed after insert.
-- ===========================================================================

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  session_id uuid not null references public.scheduled_sessions (id) on delete cascade,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unit text not null default 'kg',
  entries jsonb not null default '{"version": 1, "items": []}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workout_logs_session_key unique (session_id),
  constraint workout_logs_status_valid
    check (status in ('in_progress', 'completed')),
  -- A completed workout has a finish time; one in progress does not.
  constraint workout_logs_finished_matches_status
    check ((status = 'completed') = (finished_at is not null)),
  constraint workout_logs_finished_after_start
    check (finished_at is null or finished_at >= started_at),
  constraint workout_logs_unit_valid
    check (unit in ('kg', 'lb')),
  constraint workout_logs_notes_length
    check (char_length(notes) <= 2000),
  constraint workout_logs_entries_shape
    check (
      jsonb_typeof(entries) = 'object'
      and entries -> 'version' = '1'::jsonb
      and jsonb_typeof(entries -> 'items') = 'array'
    ),
  constraint workout_logs_entries_size
    check (octet_length(entries::text) <= 200000)
);

comment on table public.workout_logs is
  'What a member actually did in a scheduled session: sets ticked off with weight and reps. One per session, strictly the member''s own.';
comment on column public.workout_logs.entries is
  'Versioned document: {"version": 1, "items": [{"item_id", "name", "sets": [{"weight", "reps", "done"}]}]}.';
comment on column public.workout_logs.unit is
  'The unit every weight in this log is recorded in.';

create index workout_logs_user_finished_idx
  on public.workout_logs (user_id, finished_at desc);

create trigger workout_logs_set_updated_at
  before update on public.workout_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: the member chooses the session once, and never the owner.
-- ---------------------------------------------------------------------------

alter table public.workout_logs enable row level security;

revoke all on table public.workout_logs from public, anon, authenticated;
grant select, delete on table public.workout_logs to authenticated;
grant insert (session_id, status, started_at, finished_at, unit, entries, notes)
  on table public.workout_logs to authenticated;
grant update (status, started_at, finished_at, unit, entries, notes)
  on table public.workout_logs to authenticated;
grant all on table public.workout_logs to service_role;

-- ---------------------------------------------------------------------------
-- Policies: ownership AND active membership.
-- ---------------------------------------------------------------------------

create policy workout_logs_select_own
  on public.workout_logs
  for select
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));

-- The session must be the caller's own. The inner query runs under the
-- scheduled_sessions policies, so another member's session cannot be logged
-- against or probed for existence.
create policy workout_logs_insert_own
  on public.workout_logs
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_member())
    and exists (
      select 1
        from public.scheduled_sessions s
       where s.id = workout_logs.session_id
         and s.user_id = (select auth.uid())
    )
  );

create policy workout_logs_update_own
  on public.workout_logs
  for update
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()) and (select public.is_member()));

create policy workout_logs_delete_own
  on public.workout_logs
  for delete
  to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()));
