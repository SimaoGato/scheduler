# CHORE-14: Extend local-Supabase integration tests to admin CRUD API routes
Epic: maintenance
Status: draft

## Task
CHORE-05 added a local-Supabase-backed `integration-test` CI job and proved
the pattern on a single route (`GET /api/admin/ping`). Extend the same
`e2e-integration/` suite to cover the admin CRUD routes that carry the same
RLS/GRANT risk as the route that caused the STORY-04 production incident
(missing `GRANT SELECT ... TO authenticated`), but currently have **no**
real-database test coverage at all — only placeholder-credential smoke tests
(which cannot make real DB queries) or manual verification.

## Background
`app/api/admin/people/route.ts`, `app/api/admin/people/[id]/route.ts`,
`app/api/admin/roles/route.ts`, `app/api/admin/roles/[id]/route.ts`,
`app/api/admin/users/route.ts`, and `app/api/admin/users/[id]/route.ts` all
read/write tables gated by RLS policies and depend on `GRANT`s to
`authenticated` and `service_role` (per CLAUDE.md's "GRANT before RLS"
section, this project has hit the missing-GRANT bug twice already:
`public.users` in STORY-03, `public.people` in STORY-14). None of these
routes have a test that exercises them against a real Postgres instance with
real RLS/GRANT enforcement — CHORE-05 closed this gap for exactly one route
(`/api/admin/ping`) and left the rest open.

## Acceptance criteria
1. Given the local-Supabase `integration-test` job from CHORE-05, when a new
   `e2e-integration/admin-crud.spec.ts` (or split per-resource files) runs,
   then it exercises at minimum: `GET /api/admin/people`, `GET
   /api/admin/roles`, `GET /api/admin/users` as the seeded admin test user
   and asserts `200` with real data (not just a shape check — a genuine
   round-trip through RLS).
2. Given the same setup, when the seeded **member** test user calls any of
   the above admin-only endpoints, then the response is `403` (or the
   route's documented non-200 status), proving the RLS/route guard actually
   rejects non-admins against a real database, not just in unit-tested
   guard logic.
3. Given a write endpoint (pick at least one, e.g. `POST /api/admin/roles`
   or `PATCH /api/admin/people/[id]`), when the admin test user performs the
   write, then the row is persisted and readable back via a follow-up GET —
   proving `service_role`/`authenticated` GRANTs cover write verbs, not
   just SELECT.
4. Given the integration-test job, when it completes, then it still finishes
   in a reasonable time budget (do not let this story balloon the job
   runtime — reuse the existing seeded users and local Supabase instance
   from CHORE-05, don't add a second `supabase start`).

## Out of scope
- `app/api/people/claim/route.ts` and `app/api/settings/display-name/route.ts`
  (non-admin, lower risk — candidate for a follow-up chore if this pattern
  proves valuable).
- `app/api/admin/people/[id]/link/route.ts` and the skills sub-routes
  (`.../skills/route.ts`, `.../skills/[roleId]/route.ts`) — more complex
  fixture setup (need a seeded person + role first); candidate follow-up.
- Migrating any of the 91 `E2E_WITH_AUTH`-gated browser tests — that's a
  separate concern (see CHORE-15).
- Full CRUD coverage of every verb on every route — start with GET
  (read-path RLS) and one representative write, expand later if valuable.

## Technical notes
- Reuse `e2e-integration/fixtures.ts`'s `adminRequest`/`memberRequest`
  fixtures as-is — they're already generic `APIRequestContext` fixtures, not
  specific to `/api/admin/ping`.
- Reuse the seeded admin/member users from `supabase/seed-test-users.mjs` —
  do not add new seed users unless a write-path test needs a disposable
  fixture row (in which case, follow the STORY-14 worker-isolated-fixture +
  `afterEach` cleanup pattern already established for the placeholder e2e
  suite, adapted for `e2e-integration/`).
- Affected area: test infra only (`e2e-integration/`), no application code
  changes expected — same shape as CHORE-05.

## Definition of Done
See CLAUDE.md.
