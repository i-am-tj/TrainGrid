-- The server (secret key, service_role) lists and resolves invite requests on
-- the admin Invitations page. Newer Supabase projects no longer grant new
-- tables to the API roles automatically, so grant it explicitly, as every
-- other table does. Visitors (anon) and members (authenticated) still get nothing.
grant select, insert, update, delete on table public.invite_requests to service_role;
