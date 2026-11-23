-- ===========================================================================
-- Quick workouts: start and finish in one transaction each
--
-- Starting a quick workout inserted the session, then its workout log, as two
-- API calls; finishing one completed the log, then renamed the session, as
-- two more. A failure between the two left an empty quick session, or a
-- finished workout still called "Quick lift", and retrying the start made a
-- second session (PRODUCT_AUDIT F18).
--
--   * start_quick_workout: the session and its log together. The session id
--     comes from the caller (the form makes one per Home visit), so sending
--     the same request again returns the same workout instead of a new one.
--   * finish_workout: completes any workout and, for a quick one, records the
--     name given at the finish and the time trained, together.
--
-- SECURITY INVOKER, like save_personal_routine: every statement runs as the
-- caller under the same grants and Row Level Security as a direct query. The
-- functions add atomicity, not privileges, and the owner is always the
-- caller, never a parameter. Input shape (entries, names) is validated by the
-- app first and constrained by the tables' own checks.
-- ===========================================================================

create function public.start_quick_workout(
  p_session_id uuid,
  p_date date,
  p_category text,
  p_name text,
  p_unit text,
  p_entries jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_caller_id uuid := (select auth.uid());
begin
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_session_id is null then
    raise exception 'session id is required' using errcode = '22023';
  end if;

  insert into public.scheduled_sessions (id, user_id, date, name, category, origin, snapshot)
  values (p_session_id, v_caller_id, p_date, p_name, p_category, 'quick', '{"version": 1, "items": []}'::jsonb)
  on conflict (id) do nothing;

  -- Already there: a retry of this request. It must be the caller's own
  -- quick session (another member's id is invisible here and reads as
  -- missing).
  if not exists (
    select 1
      from public.scheduled_sessions s
     where s.id = p_session_id
       and s.user_id = v_caller_id
       and s.origin = 'quick'
  ) then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  -- A retry after the workout was saved, or even finished, keeps it as is.
  insert into public.workout_logs (session_id, unit, entries, notes)
  values (p_session_id, p_unit, p_entries, '')
  on conflict (session_id) do nothing;

  return p_session_id;
end;
$$;

comment on function public.start_quick_workout(uuid, date, text, text, text, jsonb) is
  'Creates the caller''s quick session (id chosen by the caller, so a retry returns the same one) and starts its workout, in one transaction. Runs as the caller under RLS.';

create function public.finish_workout(
  p_session_id uuid,
  p_unit text,
  p_entries jsonb,
  p_notes text,
  p_finished_at timestamptz,
  p_name text default null
)
returns public.workout_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_log public.workout_logs;
  v_finished timestamptz;
begin
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_log
    from public.workout_logs l
   where l.session_id = p_session_id
     and l.user_id = v_caller_id
     for update;
  if not found then
    raise exception 'Workout not found' using errcode = 'P0002';
  end if;

  -- The moment the member tapped Finish (it may arrive later, after a dropped
  -- connection), kept within (started, now]. Finishing again after editing
  -- keeps the first finish time.
  v_finished := coalesce(
    v_log.finished_at,
    greatest(
      v_log.started_at + interval '1 millisecond',
      least(coalesce(p_finished_at, now()), now())
    )
  );

  update public.workout_logs l
     set unit = p_unit,
         entries = p_entries,
         notes = p_notes,
         status = 'completed',
         finished_at = v_finished
   where l.session_id = p_session_id
     and l.user_id = v_caller_id
  returning * into v_log;

  -- A quick workout takes the name given at the finish and the time actually
  -- trained. Planned sessions keep their own name and planned duration.
  if p_name is not null then
    update public.scheduled_sessions s
       set name = p_name,
           duration_minutes = least(1440, greatest(1,
             round(extract(epoch from (v_log.finished_at - v_log.started_at)) / 60)::integer))
     where s.id = p_session_id
       and s.user_id = v_caller_id
       and s.origin = 'quick';
  end if;

  return v_log;
end;
$$;

comment on function public.finish_workout(uuid, text, jsonb, text, timestamptz, text) is
  'Completes the caller''s workout for a session and, for a quick session given p_name, names it and records the time trained, in one transaction. Runs as the caller under RLS.';

revoke execute on function public.start_quick_workout(uuid, date, text, text, text, jsonb) from public, anon;
grant execute on function public.start_quick_workout(uuid, date, text, text, text, jsonb) to authenticated;

revoke execute on function public.finish_workout(uuid, text, jsonb, text, timestamptz, text) from public, anon;
grant execute on function public.finish_workout(uuid, text, jsonb, text, timestamptz, text) to authenticated;
