-- STORY-04: RLS helper function and admin-read policy for public.users
--
-- HOW TO APPLY:
--   Applied automatically by the `migrate` CI job on merge to main.
--   Idempotent: uses CREATE OR REPLACE (function) and
--   DROP POLICY IF EXISTS + CREATE POLICY (policies).

-- -----------------------------------------------------------------------
-- Helper function: read the current user's role bypassing RLS.
-- SECURITY DEFINER runs as the function owner (postgres), preventing
-- infinite recursion when this function is called from an RLS policy on
-- the same table.
-- SET search_path = '' prevents search-path injection.
-- -----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_role();
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- Restrict execute permission: revoke from PUBLIC (which includes unauthenticated),
-- grant only to authenticated users.
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- -----------------------------------------------------------------------
-- Admins can SELECT all rows in public.users.
-- Members are limited to their own row by the existing users_select_own
-- policy (applied in migration 20260628000001).
-- No UPDATE/DELETE policy is added: mutations go only through the
-- service-role client (callback route), which bypasses RLS. This is the
-- defense-in-depth guarantee — anon-key clients cannot mutate user rows.
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "users_admin_select_all" ON public.users;
CREATE POLICY "users_admin_select_all" ON public.users
  FOR SELECT
  USING (public.get_my_role() = 'admin');
