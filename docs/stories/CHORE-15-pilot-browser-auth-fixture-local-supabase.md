# CHORE-15: Pilot a browser-based auth fixture against local Supabase (unblock E2E_WITH_AUTH tests in CI)
Epic: maintenance
Status: draft

## Task
CHORE-05 built a local-Supabase-backed CI job with real seeded admin/member
test users authenticated via email/password (`e2e-integration/fixtures.ts`),
proving Google OAuth is not actually required for a valid authenticated
session in this app. Separately, 91 tests across 18 files in `e2e/` (58% of
the entire e2e suite) are permanently skipped in CI via
`test.skip(!process.env.E2E_WITH_AUTH, ...)` because they were written
assuming OAuth login was unavoidable and CI has never had real credentials.

Pilot extending the local-Supabase auth pattern to full **browser** sessions
(not just API requests) and use it to un-skip exactly one existing gated
file in CI, proving the approach before committing to migrating the other
17.

## Background
`e2e-integration/fixtures.ts` already contains a forward-looking comment
(lines 16-20) noting that browser-based auth testing would need
`browser.newContext({ storageState: { cookies: [...] } })` instead of the
raw `Cookie` header used for `APIRequestContext`, since `BrowserContext`
does domain-scoped cookie matching that a flat request header doesn't need.
Today, all 91 `E2E_WITH_AUTH`-gated tests only run when a developer manually
sets `E2E_WITH_AUTH=1` with real `.env.local` credentials and has previously
completed a real Google OAuth login — meaning regressions in any
authenticated UI flow (nav, claim, settings, role management, people
management, etc.) are invisible to CI and rely entirely on a human
remembering to run them locally.

## Acceptance criteria
1. Given the local Supabase instance and seeded test users from CHORE-05,
   when a new browser-auth fixture (e.g. `authenticatedPage` in
   `e2e-integration/fixtures.ts` or a sibling file) signs in via
   `signInWithPassword()` and constructs a `BrowserContext` with
   `storageState: { cookies: [...] }` (domain/path set correctly for
   `localhost`), then a page navigated in that context is recognized as
   signed-in by the app (e.g. `AppHeader` shows the seeded user's identity,
   not a login redirect).
2. Given the new fixture, when `e2e/app-nav.spec.ts` (currently 3 tests, all
   gated on `E2E_WITH_AUTH`) is adapted to use it instead of requiring a
   manually-provided real session, then those 3 tests run and pass in the
   `integration-test` CI job (not the placeholder-credential
   `lint-build-test`/smoke job) without `E2E_WITH_AUTH` being set.
3. Given the migrated `app-nav.spec.ts` tests now run in CI, when a
   reviewer looks at the CI job list, then the job's total runtime is
   documented (before/after) so a follow-up chore migrating the remaining
   17 files can budget CI time realistically.
4. Given this is a pilot, when the story is complete, then a short
   recommendation is added to the story or a follow-up chore stub
   describing whether the pattern is worth extending to the other 17 gated
   files as-is, or needs adjustment first (e.g. per-file fixture
   isolation, parallel-worker safety, seed-data collisions).

## Out of scope
- Migrating all 91 gated tests / 17 remaining files — this is a pilot on
  one file only. A follow-up chore (or several, split by file/feature area)
  should do the rest once this proves the pattern works.
- Any test that depends on real Google OAuth UI itself (there don't appear
  to be any per the existing `E2E_WITH_AUTH` doc comments, but confirm
  during refinement) — those remain genuinely out of reach without OAuth
  automation, which is explicitly out of scope per CHORE-05's own
  Out-of-scope section.
- Changing the existing placeholder-credential smoke suite (`npm run
  test:e2e` / `lint-build-test` job) — migrated tests move to run under
  `npm run test:integration` in the `integration-test` job instead.

## Technical notes
- Extend `e2e-integration/fixtures.ts` per its own existing forward-looking
  comment; keep the "test-only, do not reuse for production auth flows"
  framing.
- `app-nav.spec.ts` was chosen as the pilot target because it's the
  smallest gated file (3 tests) with straightforward assertions (nav link
  visibility/count), minimizing pilot risk while still proving the pattern
  end-to-end.
- Watch for worker-isolation issues if tests run in parallel against the
  same two seeded users (CHORE-05's seed script creates exactly one admin
  and one member) — may need per-worker fixture users or serial execution
  for the migrated suite, similar to the STORY-14 worker-isolated-fixture
  pattern but for auth sessions rather than data rows.
- Affected area: test infra only (`e2e-integration/`, possibly
  `e2e/app-nav.spec.ts` moved/adapted), no application code changes
  expected.

## Definition of Done
See CLAUDE.md.
