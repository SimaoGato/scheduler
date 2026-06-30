-- STORY-07: Create public.people table for person records (no login required)
--
-- Key design decisions:
--   - linked_user_id is nullable FK (ON DELETE SET NULL) — satisfies AC4
--   - No UNIQUE constraint on name — satisfies AC5 (duplicate names allowed)
--   - is_active boolean for soft-delete — satisfies AC3
--   - Reuses public.get_my_role() from migration 20260628000002

CREATE TABLE IF NOT EXISTS public.people (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  linked_user_id UUID        NULL
                             REFERENCES public.users(id) ON DELETE SET NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No UNIQUE constraint on name (AC5: duplicate names are allowed)

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all people rows.
-- Defense-in-depth: service-role client (used in Route Handlers) bypasses RLS,
-- but this policy covers future anon-key access patterns.
DROP POLICY IF EXISTS "people_admin_all" ON public.people;
CREATE POLICY "people_admin_all" ON public.people
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Table-level grants so PostgreSQL evaluates RLS policies at all.
-- (PostgreSQL checks table-level privileges before RLS; missing GRANT causes 42501.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
