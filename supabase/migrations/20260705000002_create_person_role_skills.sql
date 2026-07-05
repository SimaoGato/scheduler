-- STORY-18: Create public.person_role_skills join table recording each
-- person's skill level (1 Beginner / 2 Intermediate / 3 Expert) per role.
--
-- Key design decisions:
--   - Composite PRIMARY KEY (person_id, role_id) enforces "at most one skill
--     level per (person, role) pair" (AC5) at the DB layer, not just via
--     app-layer upsert logic.
--   - level INT CHECK (level BETWEEN 1 AND 3) enforces AC4 as a last line of
--     defense even if app-layer validation is ever bypassed.
--   - Hard delete (row absence), not soft-delete: "no level" for a role can
--     only be represented by the row not existing (AC3). Unlike people/roles,
--     there is no is_active column on this table.
--   - ON DELETE CASCADE on both FKs is defensive only; soft-delete is the
--     actual deletion path for people/roles today.
--   - Reuses public.get_my_role() from migration 20260628000002.
--   - Grants to BOTH authenticated AND service_role in THIS migration
--     (this project has hit the missing-service_role-grant gap twice before:
--     STORY-03 public.users, STORY-14 public.people — do not repeat it here).

CREATE TABLE IF NOT EXISTS public.person_role_skills (
  person_id  UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.roles(id)   ON DELETE CASCADE,
  level      INT  NOT NULL CHECK (level BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, role_id)
);

-- Reverse-lookup index for EPIC-04 ("who is qualified for role X"); cheap,
-- low-risk to add now even though this story only needs the person_id
-- direction (PK already covers that).
CREATE INDEX IF NOT EXISTS person_role_skills_role_id_idx
  ON public.person_role_skills (role_id);

ALTER TABLE public.person_role_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_role_skills_admin_all" ON public.person_role_skills;
CREATE POLICY "person_role_skills_admin_all" ON public.person_role_skills
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Both grants in this migration (STORY-03/STORY-14 gap — do not split
-- into a follow-up fix-up migration).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_role_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_role_skills TO service_role;
