-- STORY-25: Create public.blocked_dates table — a Member's self-reported
-- unavailable Sundays. Hard delete (row absence = available), no soft-delete
-- column, matching person_role_skills' precedent for join/fact tables where
-- "not present" already has clean semantics.

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    UUID        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  blocked_date DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AC1: uniqueness per (person, date) — table-level, not partial, since this
-- table has no soft-delete / is_active column (unlike roles/people).
CREATE UNIQUE INDEX IF NOT EXISTS blocked_dates_person_date_unique_idx
  ON public.blocked_dates (person_id, blocked_date);

-- AC8: reverse-lookup index for "who is blocked on date X" queries
-- (the generator's primary access pattern). The unique index above already
-- covers "blocks for person X" queries left-to-right.
CREATE INDEX IF NOT EXISTS blocked_dates_date_idx
  ON public.blocked_dates (blocked_date);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_dates_admin_all" ON public.blocked_dates;
CREATE POLICY "blocked_dates_admin_all" ON public.blocked_dates
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Both grants in this migration (do not repeat the STORY-03/STORY-14 gap).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_dates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_dates TO service_role;
