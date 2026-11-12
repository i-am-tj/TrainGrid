-- Atomic save of a personal routine and its ordered items (Epic 1, step 10).
--
-- Saving a routine means changing the routine row and replacing its item list
-- (add, edit, reorder, remove). Doing that as several API calls could leave a
-- half-saved routine, so it is one function call and therefore one
-- transaction.
--
-- SECURITY INVOKER: every statement runs as the caller, under the same Row
-- Level Security policies as a direct query. The function adds atomicity, not
-- privileges. Ownership is always the caller; it is never a parameter.
--
-- Item ids are kept stable (D-04B): an item that arrives with the id of an
-- existing item of THIS routine is updated in place; anything else gets a new
-- id, so an id from another routine cannot be hijacked.

create function public.save_personal_routine(
  p_routine_id uuid,
  p_name text,
  p_category text,
  p_description text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_routine_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_position integer := 0;
  v_kept uuid[] := '{}';
begin
  if v_caller_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;

  if p_routine_id is null then
    insert into public.routines (scope, owner_user_id, name, category, description)
    values ('PERSONAL', v_caller_id, p_name, p_category, coalesce(p_description, ''))
    returning id into v_routine_id;
  else
    update public.routines
       set name = p_name,
           category = p_category,
           description = coalesce(p_description, '')
     where id = p_routine_id
       and scope = 'PERSONAL'
       and owner_user_id = v_caller_id
    returning id into v_routine_id;

    if v_routine_id is null then
      raise exception 'Routine not found' using errcode = 'P0002';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'each item must be an object' using errcode = '22023';
    end if;

    v_item_id := null;
    if (v_item ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select wi.id
        into v_item_id
        from public.workout_items wi
       where wi.id = (v_item ->> 'id')::uuid
         and wi.routine_id = v_routine_id;
    end if;

    if v_item_id is null then
      insert into public.workout_items
        (routine_id, name, instruction, rest, target, notes, equipment, video_url, sort_order)
      values (
        v_routine_id,
        v_item ->> 'name',
        coalesce(v_item ->> 'instruction', ''),
        coalesce(v_item ->> 'rest', ''),
        coalesce(v_item ->> 'target', ''),
        coalesce(v_item ->> 'notes', ''),
        coalesce(
          array(select jsonb_array_elements_text(coalesce(v_item -> 'equipment', '[]'::jsonb))),
          '{}'
        ),
        nullif(v_item ->> 'video_url', ''),
        v_position
      )
      returning id into v_item_id;
    else
      update public.workout_items
         set name = v_item ->> 'name',
             instruction = coalesce(v_item ->> 'instruction', ''),
             rest = coalesce(v_item ->> 'rest', ''),
             target = coalesce(v_item ->> 'target', ''),
             notes = coalesce(v_item ->> 'notes', ''),
             equipment = coalesce(
               array(select jsonb_array_elements_text(coalesce(v_item -> 'equipment', '[]'::jsonb))),
               '{}'
             ),
             video_url = nullif(v_item ->> 'video_url', ''),
             sort_order = v_position
       where id = v_item_id;
    end if;

    v_kept := v_kept || v_item_id;
    v_position := v_position + 1;
  end loop;

  delete from public.workout_items wi
   where wi.routine_id = v_routine_id
     and not (wi.id = any (v_kept));

  return v_routine_id;
end;
$$;

comment on function public.save_personal_routine(uuid, text, text, text, jsonb) is
  'Creates (p_routine_id null) or updates the caller''s PERSONAL routine and replaces its ordered items, in one transaction. Runs as the caller under RLS.';

revoke execute on function public.save_personal_routine(uuid, text, text, text, jsonb)
  from public, anon;
grant execute on function public.save_personal_routine(uuid, text, text, text, jsonb)
  to authenticated;
