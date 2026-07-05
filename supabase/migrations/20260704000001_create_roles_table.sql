-- STORY-17: Create public.roles table for configurable roles + default
-- slots per Sunday.
--
-- Key design decisions:
--   - default_slots INT NOT NULL DEFAULT 1 CHECK (default_slots >= 1) — AC2, AC3
--   - Case-insensitive uniqueness on active role names via partial unique
--     index (soft-deleted roles do not block reuse of their name) — AC7
--   - is_active boolean for soft-delete, consistent with public.people — AC5
--   - Reuses public.get_my_role() from migration 20260628000002
--   - Grants to BOTH authenticated AND service_role in THIS migration
--     (STORY-07's people migration initially only granted `authenticated`
--     and needed a follow-up fix-up migration 20260701000002 once the
--     service-role client hit 42501; avoid repeating that gap here)

CREATE TABLE IF NOT EXISTS public.roles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  default_slots  INT         NOT NULL DEFAULT 1 CHECK (default_slots >= 1),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_active_name_lower_idx
  ON public.roles (lower(name))
  WHERE is_active;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_admin_all" ON public.roles;
CREATE POLICY "roles_admin_all" ON public.roles
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO service_role;
