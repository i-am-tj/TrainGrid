-- ===========================================================================
-- Invite requests: delete them on schedule, not only on the next request
--
-- The privacy notice says requests are deleted 180 days after they are made.
-- Until now the deletion ran inside request_invite(), so in a quiet,
-- invite-only service nobody's details were removed until someone else
-- asked for an invite (PRODUCT_AUDIT F7). A daily pg_cron job now does it,
-- whether or not anyone asks. The cleanup in request_invite() stays as a
-- second line.
--
-- The function lives in `private`, which the Data API does not expose, and
-- only the job (as the database owner) runs it.
-- ===========================================================================

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;

create or replace function private.purge_expired_invite_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.invite_requests where created_at < now() - interval '180 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function private.purge_expired_invite_requests() is
  'Deletes invite requests older than 180 days (privacy notice). Run daily by pg_cron.';

revoke all on function private.purge_expired_invite_requests() from public, anon, authenticated;

-- Every day at 03:17 UTC. cron.schedule with a name replaces a job of the
-- same name, so applying this again does not add a second job.
select cron.schedule(
  'purge-expired-invite-requests',
  '17 3 * * *',
  $$select private.purge_expired_invite_requests()$$
);
