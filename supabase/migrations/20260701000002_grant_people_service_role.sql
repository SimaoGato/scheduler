-- Fix: grant table privileges to service_role so Route Handler service-role client
-- can access public.people. The previous migration only granted to `authenticated`;
-- the service-role client (used in all admin Route Handlers) connects as service_role
-- and PostgreSQL checks table-level privileges before RLS, causing 42501.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO service_role;
