-- Grant SELECT on public.users to the authenticated role so that RLS
-- policies (users_select_own, users_admin_select_all) can be evaluated.
-- Without this table-level privilege, PostgreSQL returns 42501 before
-- RLS is even consulted, causing auth guard role lookups to fail.
GRANT SELECT ON public.users TO authenticated;
