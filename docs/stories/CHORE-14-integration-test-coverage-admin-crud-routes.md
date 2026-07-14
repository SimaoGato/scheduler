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

## Implementation Plan

### Affected areas
- **Test infra only** (`e2e-integration/`) — no application code changes.
  Same shape as CHORE-05. No frontend/ux/ai-ml/data/infra changes; the CI
  workflow (`.github/workflows/ci.yml`) is read-only reference and does not
  need to change (the existing `integration-test` job already runs
  `npm run test:integration` against every `*.spec.ts` in `e2e-integration/`,
  so a new spec file is picked up automatically).

### Files
- **New**: `e2e-integration/admin-crud.spec.ts` — single file, four
  `test.describe` blocks (one per resource GET pair, one for the write
  round-trip). A single file is chosen over a per-resource split: the three
  GET/403 checks are short and share the same `adminRequest`/`memberRequest`
  fixtures with no resource-specific setup complexity that would justify
  separate files (unlike `blocked-dates.spec.ts` vs `availability.spec.ts`,
  which split along Member vs. STORY-25-specific validation concerns). If
  review pushes back on file length, splitting into
  `admin-crud-people.spec.ts` / `admin-crud-roles.spec.ts` /
  `admin-crud-users.spec.ts` is a mechanical follow-up, not a design change.
- **No changes** to `e2e-integration/fixtures.ts`, `service-client.ts`,
  `playwright.integration.config.ts`, `.github/workflows/ci.yml`,
  `supabase/seed-test-users.mjs`, or any `app/api/admin/**` route file.

### Step-by-step approach (test-first, since this story *is* the tests)

1. **GET /api/admin/people (AC1 + AC2)**
   - `test.describe('CHORE-14: GET /api/admin/people')`
   - `beforeEach`: create one fixture person via `serviceClient()` —
     `{ name: 'CHORE-14 QA Person (w${workerIndex})', linked_user_id: null, is_active: true }`
     (mirrors `admin-availability.spec.ts`'s `createPerson` helper; reuse that
     exact insert shape).
   - `afterEach`: hard-delete the fixture person by id.
   - AC1 test: `adminRequest.get('/api/admin/people')` → `expect(status).toBe(200)`;
     assert the response array contains an entry with the fixture's `id` and
     `name` (proves a genuine round-trip, not a shape-only check per AC1's
     wording).
   - AC2 test: `memberRequest.get('/api/admin/people')` → `expect(status).toBe(403)`;
     `expect(body).toEqual({ error: 'Forbidden' })` (confirmed as the fixed
     shape from `lib/auth/guard.ts`'s `requireAdmin`, same as
     `admin-ping.spec.ts`'s AC3 test — identical across all `requireAdmin`
     routes since the 403 is emitted by the shared guard, not per-route code).

2. **GET /api/admin/roles (AC1 + AC2)** — identical shape to (1), but the
   fixture is a role: `serviceClient().from('roles').insert({ name: 'CHORE-14 QA Role (w${workerIndex})', default_slots: 1, is_active: true })`.
   Same beforeEach/afterEach/AC1/AC2 test pairing.

3. **GET /api/admin/users (AC1 + AC2)** — **no new fixture rows**. The
   seeded `ci-admin@example.test` / `ci-member@example.test` rows already
   exist in `public.users` from `supabase/seed-test-users.mjs` (which the CI
   job runs before every integration-test run, per AC4 — reusing this,
   rather than inserting throwaway `users` rows, avoids the complexity of
   creating/cleaning up `auth.users` + `public.users` pairs, which would
   require the Admin API, not just a service-role table insert).
   - AC1 test: `adminRequest.get('/api/admin/users')` → `200`; assert the
     array contains entries with `email: 'ci-admin@example.test'` and
     `email: 'ci-member@example.test'` (this is "real data" — genuine rows
     read back through RLS/GRANT — without needing extra fixture writes).
   - AC2 test: `memberRequest.get('/api/admin/users')` → `403` / `{ error: 'Forbidden' }`.

4. **Write round-trip (AC3): `POST /api/admin/roles`** — chosen over
   `PATCH /api/admin/people/[id]` per the story's technical notes ("prefer
   whichever needs the least fixture complexity"): POST /api/admin/roles
   needs **zero pre-existing fixture row** (the request itself creates the
   row), whereas PATCH /api/admin/people/[id] would require a person fixture
   to exist first *before* the write under test even runs, adding an extra
   moving part for no additional GRANT/RLS coverage (both are plain
   `service_role` UPDATE/INSERT paths gated by the same `requireAdmin`
   guard). POST also gives a cleaner 201-with-full-row response to assert
   against (vs. PATCH's `{ ok: true }`).
   - `test.describe('CHORE-14: POST /api/admin/roles write round-trip')`,
     with an outer-scope `let createdRoleId: string | undefined` (no
     `beforeEach` — the fixture is created *by* the test itself, following
     the same "test creates, afterEach cleans up conditionally" shape as
     `blocked-dates.spec.ts`'s validation-error tests where no row may end
     up existing).
   - `afterEach`: `if (createdRoleId) { await serviceClient().from('roles').delete().eq('id', createdRoleId); createdRoleId = undefined }`.
   - Test body:
     a. `POST /api/admin/roles` with `{ name: 'CHORE-14 QA Write Role (w${workerIndex})', default_slots: 2 }` as `adminRequest` → expect `201`; capture `id` from the JSON body into `createdRoleId`; assert `name`/`default_slots` echo back correctly.
     b. Follow-up `GET /api/admin/roles` as `adminRequest` → expect `200`; assert the array contains an entry matching `createdRoleId` + the same name/slots — this is the "readable back via a follow-up GET" proof AC3 requires, demonstrating both `INSERT` and `SELECT` GRANTs work under `service_role`/RLS.

5. **AC4 (time budget)** — no new `supabase start`, no new seed script
   invocation, no new CI job/step. The new spec file runs inside the
   existing `npm run test:integration` step against the same already-running
   local Supabase instance and already-seeded users. Total added test count
   is ~8 tests (2 GET tests × 3 resources + 1 write round-trip test), each
   doing at most one extra insert/delete — negligible runtime addition
   (same order of magnitude as `admin-availability.spec.ts`'s existing
   per-test fixture overhead).

### Test plan mapped to acceptance criteria

| AC | Test(s) |
|----|---------|
| AC1 | `admin-crud.spec.ts`: "AC1: admin GET /api/admin/people returns 200 with real data", "AC1: admin GET /api/admin/roles returns 200 with real data", "AC1: admin GET /api/admin/users returns 200 with real data" — each asserts the fixture/seeded row is present in the response body, not just that the response is an array. |
| AC2 | `admin-crud.spec.ts`: "AC2: member GET /api/admin/people returns 403", "...roles...", "...users..." — each asserts `403` + `{ error: 'Forbidden' }`. |
| AC3 | `admin-crud.spec.ts`: "AC3: POST /api/admin/roles creates a role, persisted and readable via a follow-up GET" — asserts `201` on create, then `200` + presence in a follow-up `GET /api/admin/roles`. |
| AC4 | No dedicated test (this AC is about CI job shape/runtime, not app behavior). Verified manually by observing the `integration-test` job's total duration in the CI run for this PR stays in the same range as pre-change runs (informational, not a hard gate) — document this as a manual verification note per CLAUDE.md's "AC coverage" DoD item, since AC4 is a non-functional constraint on job runtime that isn't meaningfully expressible as a Playwright assertion. **Completed observation** (checked via `gh run view` against PR #50, commit `0ffa308`): the `Local Supabase integration tests` job ran in **4m 06s** (18:14:20Z–18:18:26Z, run [29356927292](https://github.com/SimaoGato/scheduler/actions/runs/29356927292/job/87167165038)). Compared against the three most recent prior runs of the same job on `main`/other PRs: 4m 17s (run 29355484376), 4m 27s (run 29279885021), 4m 05s (run 29188867560). CHORE-14's 7 new tests land within this pre-existing 4:05–4:27 range, confirming no meaningful CI job time-budget regression. |

### Fixture / cleanup approach
Follows the STORY-14 worker-isolated-fixture + `afterEach` cleanup pattern,
already adapted for `e2e-integration/` by `admin-availability.spec.ts`,
`availability.spec.ts`, `blocked-dates.spec.ts`, and `home.spec.ts`:
- Fixture names include `(w${testInfo.workerIndex})` to avoid cross-worker
  collisions in local parallel runs (CI itself runs `workers: 1`, per
  `playwright.integration.config.ts`).
- All fixture creation/deletion goes through `e2e-integration/service-client.ts`'s
  `serviceClient()` (bypasses RLS, same as production service-role client,
  but constructed without the `server-only` import per the pattern already
  established for this directory).
- `afterEach` (not `finally`-in-test) is used for the `beforeEach`-created
  fixtures (people, roles GET tests); the write-round-trip test uses a
  conditional `afterEach` guard on a `let` variable since the fixture is
  created inside the test body rather than a `beforeEach`.
- No new seed users, no new columns/tables — reuses `ADMIN_EMAIL` /
  `MEMBER_EMAIL` from `supabase/test-users.mjs` exactly as CHORE-05 and all
  subsequent `e2e-integration/*.spec.ts` files already do.

### Risks and rollback
- **Risk**: fixture cleanup failure (e.g. a test fails mid-way before
  `afterEach` runs, or `afterEach` itself throws) could leave orphan
  `CHORE-14 QA *` rows in the local Supabase instance. Low impact: the local
  Supabase instance is ephemeral per CI job run (`supabase start` inside the
  job, torn down when the runner is recycled), so orphans do not persist
  across CI runs. For local developer runs against a persisted local stack,
  orphans are cosmetic (distinctly named, easy to manually clean via
  `supabase db reset` or a manual delete) — same accepted risk profile as
  every other fixture in this directory.
- **Risk**: asserting on array contents (not just status/shape) makes tests
  slightly more brittle to unrelated seed data changes. Mitigated by using
  distinctive, story-prefixed fixture names (`CHORE-14 QA ...`) that cannot
  collide with real or other-story seed data, and asserting `.some(...)`
  membership rather than exact array equality/length.
- **Rollback**: this story adds one new test file with no application code
  or CI workflow changes. Rollback is `git revert` of the single new file;
  zero blast radius on production code, migrations, or other test suites.
- **No regressions**: this story does not modify `fixtures.ts`,
  `service-client.ts`, or any existing spec file, so the existing
  `admin-ping.spec.ts`, `admin-availability.spec.ts`, `availability.spec.ts`,
  `blocked-dates.spec.ts`, `claim-no-records.spec.ts`, and `home.spec.ts`
  suites are untouched and expected to keep passing unmodified.

### Out of scope (confirmed, matching the story)
- `app/api/people/claim/route.ts` and `app/api/settings/display-name/route.ts` — not touched.
- `app/api/admin/people/[id]/link/route.ts` and the skills sub-routes
  (`.../skills/route.ts`, `.../skills/[roleId]/route.ts`) — not touched.
- No migration of any `E2E_WITH_AUTH`-gated browser test (CHORE-15's concern).
- No `DELETE` verb coverage for people/roles, no `PATCH` coverage for
  people/roles/users, no `POST` coverage for people or users — AC3 requires
  only "at least one" write endpoint round-trip; `POST /api/admin/roles` is
  it. Expanding to full CRUD across all six route files is an explicit
  candidate follow-up, not this story.
- No CI workflow (`.github/workflows/ci.yml`) changes — the existing
  `integration-test` job's `npm run test:integration` step already discovers
  any new `e2e-integration/*.spec.ts` file with no config change needed.

### Complexity tag

**Complexity: standard**

Justification: this is test-infra-only work (no application code, no CSS,
no auth-guard/routing/env-var changes — none of the CLAUDE.md
reasoning-risk-override signals apply), which would argue for `trivial`.
However, per CLAUDE.md's own guidance ("when in doubt, do NOT mark as
trivial" and "standard — multi-file, requires understanding of at least two
modules; default"), this story requires correctly understanding and
threading together: (a) the `requireAdmin` guard's shared 403 shape across
three different route files, (b) the GRANT/RLS model this project has
already shipped two real production bugs around (STORY-03, STORY-14, per
CLAUDE.md's "GRANT before RLS" section) — the entire point of this story is
to catch a *third* instance of that class of bug, so correctness of the
assertions (asserting genuine row presence, not shape-only) is
load-bearing, not cosmetic, (c) three distinct route files' response shapes
(`PersonRow`, `RoleRow`, `UserRow`) plus a fourth (write) response shape,
and (d) the existing worker-isolated-fixture + `afterEach` convention
established across four other files in the same directory, which must be
followed precisely to avoid flaky/colliding tests. This is more reasoning
risk than a single mechanical edit, so `standard` (not `trivial`) is the
conservative and correct call.
