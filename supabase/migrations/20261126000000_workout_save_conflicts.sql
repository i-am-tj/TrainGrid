-- ===========================================================================
-- Workout saves from more than one device
--
-- A workout's progress is one document (sets, unit, notes). Every save
-- replaced the whole document, so when a member had the same workout open on
-- two devices, the later save silently discarded sets logged on the other one
-- (SYSTEM_QUALITY_AUDIT residual risk).
--
-- A save now carries the updated_at the device last saw and the device's id
-- (a random id the browser keeps). It applies if the log is still at that
-- version, or if the device itself made the last save: a save whose reply
-- was lost (no signal, or a reload) still reached the server, and the device
-- holds everything it sent. Otherwise another device saved in between, and
-- the write is refused so the app can ask the member which version to keep.
--
--   * workout_logs.saved_by: the device that last saved the log. Not secret
--     and not trusted for access; RLS still limits every row to its owner.
--   * Plain saves check with a filter on the update.
--   * finish_workout takes p_expected_updated_at and p_device and refuses a
--     stale finish with SQLSTATE 40001. Both default to null (no check), so
--     its security (INVOKER, RLS) and grants are unchanged.
-- ===========================================================================

alter table public.workout_logs add column saved_by uuid;

comment on column public.workout_logs.saved_by is
  'Random id of the device (browser) that last saved this log, so a device''s own earlier save is not mistaken for another device''s. Chosen by the client; not used for access.';

grant insert (saved_by) on table public.workout_logs to authenticated;
grant update (saved_by) on table public.workout_logs to authenticated;

drop function public.finish_workout(uuid, text, jsonb, text, timestamptz, text);

create function public.finish_workout(
  p_session_id uuid,
  p_unit text,
  p_entries jsonb,
  p_notes text,
  p_finished_at timestamptz,
  p_name text default null,
  p_expected_updated_at timestamptz default null,
  p_device uuid default null
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

  -- Saved from another device since the caller last saw it: refuse rather
  -- than overwrite. The row lock above makes this check and the update below
  -- one step.
  if p_expected_updated_at is not null
     and v_log.updated_at <> p_expected_updated_at
     and (p_device is null or v_log.saved_by is distinct from p_device)
  then
    raise exception 'Workout changed since it was loaded' using errcode = '40001';
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
         finished_at = v_finished,
         saved_by = coalesce(p_device, l.saved_by)
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

comment on function public.finish_workout(uuid, text, jsonb, text, timestamptz, text, timestamptz, uuid) is
  'Completes the caller''s workout for a session and, for a quick session given p_name, names it and records the time trained, in one transaction. With p_expected_updated_at, refuses (40001) a log saved since by a device other than p_device. Runs as the caller under RLS.';

revoke execute on function public.finish_workout(uuid, text, jsonb, text, timestamptz, text, timestamptz, uuid) from public, anon;
grant execute on function public.finish_workout(uuid, text, jsonb, text, timestamptz, text, timestamptz, uuid) to authenticated;
