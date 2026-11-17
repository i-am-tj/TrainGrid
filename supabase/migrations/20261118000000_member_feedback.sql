-- ===========================================================================
-- Member feedback (v1.0.0)
--
-- Members send feedback from the header's Feedback dialog. A row is written by
-- the member themself, through RLS, and is never readable through the API:
-- the owner reads it in the Supabase dashboard (and, when configured, gets an
-- email copy from the server).
--
--   * Insert only, and only the member's own row: user_id defaults to the
--     caller and the policy checks it, plus active membership (is_member()).
--   * Column-level grant: a member can set kind, message and page_path only.
--   * At most 10 messages per member in 24 hours (trigger, which counts with
--     definer rights because members cannot read the table).
-- ===========================================================================

create table public.member_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null,
  message text not null,
  page_path text,
  created_at timestamptz not null default now(),

  constraint member_feedback_kind_valid
    check (kind in ('idea', 'problem', 'praise')),
  constraint member_feedback_message_length
    check (char_length(btrim(message)) between 1 and 2000),
  constraint member_feedback_page_path_valid
    check (page_path is null or (char_length(page_path) <= 200 and page_path like '/%'))
);

comment on table public.member_feedback is
  'Feedback sent by members from the app. Members may insert their own rows only; nobody reads it through the API.';

create index member_feedback_user_created_idx
  on public.member_feedback (user_id, created_at desc);

alter table public.member_feedback enable row level security;

revoke all on table public.member_feedback from public, anon, authenticated;
grant insert (kind, message, page_path) on table public.member_feedback to authenticated;

create policy member_feedback_insert_own
  on public.member_feedback
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member()));

-- ---------------------------------------------------------------------------
-- Rate limit: 10 messages per member per 24 hours.
-- ---------------------------------------------------------------------------

create function public.member_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
      from public.member_feedback f
     where f.user_id = new.user_id
       and f.created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'feedback_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function public.member_feedback_rate_limit() is
  'Before-insert trigger on member_feedback: refuses an 11th message from the same member within 24 hours.';

revoke execute on function public.member_feedback_rate_limit() from public, anon, authenticated;

create trigger member_feedback_rate_limit
  before insert on public.member_feedback
  for each row execute function public.member_feedback_rate_limit();
