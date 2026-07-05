-- STORY-11: Enforce "at most one active person-link per user" as a DB-level
-- invariant (AC6 concurrency guard, layer 2 — the atomic claim UPDATE in
-- app/api/people/claim/route.ts is layer 1).
--
-- Partial unique index (not a table-level UNIQUE constraint) so multiple
-- rows with linked_user_id IS NULL never collide with each other — only
-- non-null values are covered by the index.
--
-- Pre-deploy check (manual, not automatable from a migration): confirm this
-- returns zero rows before applying, in case pre-existing test/manual data
-- already violates the invariant:
--   SELECT linked_user_id, count(*) FROM public.people
--     WHERE linked_user_id IS NOT NULL
--     GROUP BY linked_user_id HAVING count(*) > 1;
--
-- Rollback: DROP INDEX IF EXISTS idx_people_linked_user_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_people_linked_user_id_unique
  ON public.people (linked_user_id)
  WHERE linked_user_id IS NOT NULL;
