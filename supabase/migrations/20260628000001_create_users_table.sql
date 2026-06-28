-- STORY-03: Provision user as Member on first login
--
-- HOW TO APPLY:
--   This migration is applied automatically by the `migrate` CI job in
--   .github/workflows/ci.yml whenever a PR is merged to main.
--   Manual application via the Supabase dashboard SQL Editor is no longer needed.
--   The migration is idempotent (uses IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE POLICY).
--
-- NOTE: The users_select_own policy is intentional pre-work for STORY-04
-- (authorization enforcement). It is not unused dead code.

CREATE TABLE IF NOT EXISTS public.users (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  display_name TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('admin', 'member')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own record.
-- This policy is pre-work for STORY-04 (authorization enforcement).
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (auth.uid() = id);
