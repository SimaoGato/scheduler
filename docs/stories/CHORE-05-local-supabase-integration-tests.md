# CHORE-05: Local Supabase integration tests for authenticated API paths
Epic: maintenance
Status: draft

## Task
Add a CI integration-test job that spins up a local Supabase instance
(`supabase start`), applies migrations, seeds test users, and runs
Playwright tests against the authenticated API paths — so that DB-level
bugs (wrong GRANT, broken RLS, missing column) are caught before code
reaches production.

## Background
STORY-04 shipped with a missing `GRANT SELECT ON public.users TO authenticated`
that caused `42501 permission denied` in production. The bug was invisible in
CI because all e2e tests run against placeholder Supabase credentials and
cannot make real DB queries. AC2 (admin → 200 from `/api/admin/ping`) was
left as a manual verification step because it "required a real Supabase project
with Google OAuth" — but OAuth is not needed for a test user. Any test that
applied the migrations and made an authenticated request would have surfaced the
error immediately.

## Acceptance criteria

1. Given a push to `main` or a PR targeting `main`, when CI runs the new
   `integration-test` job, then it:
   - starts a local Supabase instance (`supabase start`)
   - applies all migrations via `supabase db push`
   - verifies the job exits 0 (migrations applied cleanly)

2. Given the local Supabase is running with migrations applied, when a
   Playwright test signs in with a seeded test admin user (email/password,
   not OAuth) and calls `GET /api/admin/ping`, then the response is
   `200 { ok: true, role: 'admin' }`.

3. Given the local Supabase is running with migrations applied, when a
   Playwright test signs in with a seeded test member user and calls
   `GET /api/admin/ping`, then the response is `403 { error: 'Forbidden' }`.

4. Given the local Supabase is running, when `supabase db push` is run with
   a **new migration that is missing `GRANT SELECT … TO authenticated`**,
   then the integration test in AC2 fails visibly (red CI) — demonstrating
   the regression-guard works.
   _(This AC is verified by temporarily removing the GRANT from the seed
   migration during development, confirming the test fails, then restoring it.)_

5. Given the integration-test job fails, when the PR author looks at CI, then
   the failure message points clearly to which test failed and why (Playwright
   HTML report artifact uploaded).

## Out of scope
- Automating Google OAuth login (test users use Supabase email/password auth)
- Testing non-API routes (those already have smoke tests)
- Running `supabase start` in the existing `lint-build-test` job (keep jobs
  separate to avoid slowing down the main lint/build/test loop)
- Replacing the existing placeholder-credential smoke tests

## Technical notes
- **Local Supabase in CI**: `supabase start` requires Docker. GitHub-hosted
  `ubuntu-22.04` runners have Docker available. The `supabase/setup-cli`
  action is already used in the `migrate` job (pinned to `@v1.7.1`).
- **Seed users**: Create a `supabase/seed.sql` that calls
  `supabase.auth.admin.createUser()` equivalent SQL, or use the Supabase
  Management API after start. Alternatively, use the Supabase CLI's
  `supabase auth user create` command to seed an admin and a member test
  account. Their IDs need to be stable (use fixed UUIDs) so the
  `public.users` INSERT in seed.sql can reference them.
- **Signing in without OAuth**: Use the Supabase anon-key JS client's
  `signInWithPassword({ email, password })` in a Playwright `test.beforeAll`
  or via a custom Playwright fixture. Extract the session's `access_token`
  and `refresh_token`, then inject them as cookies before the API request.
- **App must point at local Supabase**: The integration test job builds the
  app with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (local Supabase
  default) and the local anon/service keys from `supabase status`.
- **Playwright fixture for auth**: A reusable `authenticatedRequest` fixture
  (similar to the Playwright `request` fixture but with the session cookie
  pre-set) keeps test bodies clean.
- **Pin supabase CLI version** to the same version used in the `migrate` job
  (`2.22.6`) so local and CI behaviour are identical.
- **Job ordering**: The new `integration-test` job should run after
  `lint-build-test` passes, in parallel with the `migrate` job (not blocking it).

## Definition of Done
See CLAUDE.md — additionally, the new job must appear green on a PR that
includes both migrations and code changes that exercise the authenticated path.
