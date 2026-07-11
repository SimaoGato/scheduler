# CHORE-05: Local Supabase integration tests for authenticated API paths
Epic: maintenance
Status: implemented (PR open, pending CI/review)

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

---

## Implementation Plan

### Findings from codebase exploration (corrections to the Technical notes above)

1. **`app/api/admin/ping` already exists** (shipped in STORY-04,
   `app/api/admin/ping/route.ts`). It calls `requireAdmin(request)` from
   `lib/auth/guard.ts` and returns 401/403/`200 { ok: true, role: 'admin' }`
   exactly as AC2/AC3 expect. **No route work needed** — this story is
   CI/test-infra only. `e2e/role-enforcement.spec.ts` already has the
   CI-safe 401 case; its file header documents AC1/AC2 (member 403, admin
   200) as manual-only today — this story replaces those manual steps with
   real automated coverage.
2. **`supabase auth user create` does not exist** in the current CLI
   (`npx supabase@2.109.1 --help` has no such subcommand; confirmed by
   listing all commands). Use the **Admin API** instead:
   `supabase.auth.admin.createUser({ id, email, password, email_confirm: true })`
   via a service-role JS client. `AdminUserAttributes.id` is a documented,
   supported override (`node_modules/@supabase/auth-js/dist/module/lib/types.d.ts`
   line ~477: "Allows you to overwrite the default `id` set for the user."),
   so **fixed UUIDs are viable** this way. `seed.sql` cannot do this itself
   (no Node runtime inside a SQL migration) — seeding must be a script step
   that runs after `supabase start`, not `supabase/seed.sql`.
3. **`supabase db push --project-ref ...` is wrong for local.** CLI 2.x's
   `db push` flags are `--local | --linked | --db-url` (no `--project-ref`;
   that flag only exists on `db push`'s sibling `link` command, already used
   correctly in the `migrate` job). For this job use `supabase db push --local`.
   No `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF`/`SUPABASE_DB_PASSWORD`
   secrets are needed — local start/push requires **no GitHub secrets at
   all**, which keeps this job's config surface small.
4. **`supabase start` already auto-applies `supabase/migrations/*.sql` and
   `supabase/seed.sql`** on a fresh local stack. The explicit
   `supabase db push --local` step after `start` is still worth keeping (it
   makes AC1's "applies migrations via `supabase db push`" literal and
   mirrors the `migrate` job's own command), but it will be a no-op per the
   migration-idempotency note in CLAUDE.md (already-applied migrations
   tracked in `supabase_migrations.schema_migrations` are skipped). This is
   expected, not a bug.
5. **`public.users.id` has an FK to `auth.users(id)`** (see
   `20260628000001_create_users_table.sql`), and provisioning normally only
   happens in `app/auth/callback/route.ts`'s `provisionUser()` (OAuth-only,
   not exported/reusable). Since the seeded test users never go through
   OAuth, the seed script must **explicitly INSERT/UPSERT into
   `public.users`** itself (id, email, display_name, role), after creating
   the matching `auth.users` row via the Admin API, using the real returned
   `user.id` (== the fixed UUID we passed in).
6. **This sandbox already has an unrelated local Supabase stack running**
   on the default ports (54321 API / 54322 DB / 54323 Studio, project ref
   `wyaxpaadihzugelnluyj`) — confirmed via `docker ps`. This repo's
   `supabase/config.toml` uses a different `project_id`
   (`your-dev-project-ref`), so `supabase start` here would try to bind the
   **same default ports**, which are already taken in this sandbox. This
   is a sandbox-specific fact (not a CI concern — GitHub-hosted runners are
   single-tenant and start clean), but it means **I could not empirically
   run `supabase start`/`db push`/Admin API calls end-to-end in this
   refinement session** without risking port conflicts with another
   process. The plan below is therefore based on CLI `--help` output,
   `@supabase/ssr`/`@supabase/auth-js` source inspection (not guesswork),
   and documented CLI conventions — but the exact variable names produced
   by `supabase status -o env` must be **empirically confirmed
   by the implementer** in their own environment (or a fresh CI run) before
   the workflow YAML is considered final. This is a mechanical
   verification step, not a design ambiguity, so it isn't listed as a
   blocking question.
7. **Cookie format for the Playwright auth fixture is derived, not
   hand-rolled.** `lib/auth/guard.ts`'s `requireAuth()` builds a
   `createServerClient` (from `@supabase/ssr`) using `request.cookies`
   directly (API routes are outside the `proxy.ts` matcher, so the
   middleware auth flow is irrelevant here — the Route Handler's own guard
   is what's under test). `@supabase/ssr`'s default cookie **name** is
   `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token` (derived
   from `node_modules/@supabase/supabase-js/dist/umd/supabase.js`), which
   for `http://127.0.0.1:54321` resolves to `sb-127-auth-token` — and the
   cookie **value** is a base64url-encoded JSON blob, optionally split into
   `.0`/`.1`/... chunks above ~3180 bytes
   (`node_modules/@supabase/ssr/dist/module/utils/chunker.js`). Rather than
   hand-reconstruct this undocumented, chunkable format, the fixture should
   **reuse the library itself**: construct a `createServerClient` in the
   Playwright fixture with a `cookies.setAll` that just records whatever
   cookies the library produces, call `signInWithPassword()`, and use the
   recorded `{ name, value }` pairs verbatim as the `Cookie` header for the
   API request. This is guaranteed correct because it's the exact same code
   path `guard.ts` reads from, and it survives any future encoding/chunking
   changes in `@supabase/ssr` without the test needing to track them.

### Affected areas
- **infra / CI** (`.github/workflows/ci.yml`): new `integration-test` job.
- **data** (`supabase/`): new seed script (Admin API + `public.users` upsert),
  no new migrations expected (existing schema already supports this).
- **backend / test tooling**: new Playwright config + fixtures + spec file
  under a dedicated directory (kept separate from `e2e/` so the existing
  placeholder-credential smoke suite is untouched, per Out-of-scope).
- No application code changes (`app/api/admin/ping` and `lib/auth/guard.ts`
  are consumed as-is, not modified).

### Step-by-step approach

**1. Seed script — `supabase/seed-test-users.mjs` (plain Node ESM, no new
   devDependency; `@supabase/supabase-js` is already a dependency)**
   - **Fail-closed host guard (CRITICAL — required, per Challenge review):**
     this script is **permanent repo tooling**, not a CI-only throwaway —
     any developer can run `node supabase/seed-test-users.mjs` locally. It
     creates a real, privileged admin account with a fixed UUID and a
     **committed, publicly-known password**
     (`ci-integration-test-password-local-only`). That is only safe against
     an ephemeral, job-scoped local Docker Supabase instance. This repo's
     documented dev convention (CHORE-03) is a **shared cloud dev Supabase
     project**, not local Docker — if a developer's `.env.local` happens to
     point at that shared project (or, worse, prod), running this script
     would silently create a real privileged account with a public
     password there. This is the same class of "config-mistake-becomes-
     incident" this story exists to catch (STORY-04's missing GRANT),
     just relocated to a new script, so the script must refuse to run
     against anything but a local instance. Add this as the **first thing
     the script does**, before any Supabase client is constructed:
     ```js
     const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
     if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
       console.error(
         '[seed-test-users] refusing to run against non-local Supabase URL:',
         url,
         '\nThis script creates a privileged admin account with a committed,',
         'publicly-known password and must only ever run against a local',
         '`supabase start` instance (127.0.0.1/localhost), never the shared',
         'dev Supabase project (see CHORE-03) or production.'
       );
       process.exit(1);
     }
     ```
   - **Fold in the CHORE-03 divergence note as a concrete artifact, not an
     aside**: add a comment block atop `supabase/seed-test-users.mjs`
     (right next to the guard above) stating plainly: *"This script is CI
     integration-test infra only. CHORE-03 already decided local dev does
     NOT use Docker Supabase — it uses a separate shared cloud dev project.
     Do not run this script against that project or any non-local URL; the
     guard above enforces this at runtime."* Add the same one-line pointer
     as a comment in `supabase/config.toml` near `project_id` (e.g. `# CI
     integration tests (CHORE-05) run \`supabase start\` locally against this
     config; this is unrelated to day-to-day dev, which uses a shared cloud
     project per CHORE-03 — see supabase/seed-test-users.mjs`), so a reader
     of either file finds the other.
   - Fixed UUIDs + fixed local-only credentials (not secrets — the
     Supabase instance is destroyed at the end of the CI job, so a
     non-magic constant password is fine and needs no `GITHUB_ENV`/secret
     plumbing, and is only ever reachable because of the host guard above):
     ```js
     const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
     const MEMBER_ID = '00000000-0000-4000-8000-000000000002'
     const ADMIN_EMAIL = 'ci-admin@example.test'
     const MEMBER_EMAIL = 'ci-member@example.test'
     const TEST_PASSWORD = 'ci-integration-test-password-local-only'
     ```
   - For each user: `admin.auth.admin.createUser({ id, email, password: TEST_PASSWORD, email_confirm: true })`,
     then `admin.from('users').upsert({ id, email, display_name, role })`
     using a service-role client (`createClient(url, serviceRoleKey)` from
     `@supabase/supabase-js`, same pattern as `lib/supabase/service.ts` but
     inline since this runs outside the Next.js app).
   - Read `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from
     `process.env` (set by the CI step from `supabase status -o env`,
     Finding 6 above — including the "Verify local Supabase env vars were
     resolved" fail-fast check that now runs before this script, per the
     Challenge review's second WARNING).
   - Idempotent: if `createUser` fails with "already been registered",
     treat as success (supports local re-runs during development against a
     persisted local stack); any other error throws and fails the script
     (`process.exit(1)`).
   - Export the two constants (id/email/password) from a small sibling
     module (e.g. `supabase/test-users.mjs`) so the Playwright fixture can
     import the same values instead of duplicating them.

**2. Playwright fixture — `e2e-integration/fixtures.ts`**
   - Add a one-line comment at the top of the file: *"Test-only pattern —
     do not reuse for production auth flows. This constructs a
     `createServerClient` the same way `lib/auth/guard.ts` does, purely to
     capture session cookies for API test requests."*
   - `signInAndGetCookies(email, password)`: builds a throwaway
     `createServerClient` from `@supabase/ssr` with a `cookies.setAll` that
     just collects `{ name, value }` pairs, calls
     `supabase.auth.signInWithPassword({ email, password })`, throws on
     `error`, returns the collected cookies (see Finding 7 — this is the
     "reuse the library" approach, not a hand-rolled cookie format).
   - `test.extend<{ adminRequest: APIRequestContext; memberRequest: APIRequestContext }>`:
     each fixture signs in once, creates a `playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: '<name>=<value>; ...' } })`,
     `use(context)`, then `context.dispose()`. Using `APIRequestContext`
     (not a full browser `Page`) is the minimal-surface choice since
     AC2/AC3 only need `GET /api/admin/ping` — no page rendering. Note in
     a code comment: if a future story in this directory needs
     full-page/browser-based auth testing, switch to
     `browser.newContext({ storageState: { cookies: [...] } })` with
     `domain`/`path` set instead of the raw `Cookie` header, since
     `APIRequestContext` doesn't do domain-scoped cookie matching the way a
     `BrowserContext` does.
   - Re-export `expect` from `@playwright/test` alongside the extended
     `test`.

**3. New spec — `e2e-integration/admin-ping.spec.ts`**
   - AC2: `adminRequest.get('/api/admin/ping')` → `expect(res.status()).toBe(200)`;
     body `{ ok: true, role: 'admin' }`.
   - AC3: `memberRequest.get('/api/admin/ping')` → `expect(res.status()).toBe(403)`;
     body `{ error: 'Forbidden' }`.
   - File header documents that this spec only runs in the
     `integration-test` CI job (via its own Playwright config), never in
     `npm run test:e2e` (the placeholder-credential smoke job), and links
     back to this story for the "why".

**4. New Playwright config — `playwright.integration.config.ts`** (repo root,
   sibling to `playwright.config.ts`)
   - `testDir: './e2e-integration'`.
   - Same `webServer` pattern as the existing config (`command: 'npm start'`,
     `port: 3000`, `reuseExistingServer: !process.env.CI`) — the
     integration job builds the app itself (own `npm run build`, pointed at
     local Supabase env vars) then reuses that build via `npm start`.
   - **Distinct artifact locations** to avoid colliding with the
     `lint-build-test` job's `playwright-report/`/`test-results/` (GitHub
     Actions artifact names are unique per **workflow run**, not per job —
     uploading a second `playwright-report` artifact name in the same run
     fails with a conflict):
     `reporter: [['html', { outputFolder: 'playwright-report-integration' }], ['list']]`,
     `outputDir: 'test-results-integration'`.
   - `retries: process.env.CI ? 2 : 0`, `workers: process.env.CI ? 1 : undefined`
     (same convention as the existing config).

**5. `package.json` script**: add
   `"test:integration": "playwright test --config=playwright.integration.config.ts"`.

**6. New CI job in `.github/workflows/ci.yml`** — `integration-test`,
   `needs: lint-build-test`, runs on `pull_request` and `push` to `main`
   (unlike `migrate`, which is `push`-to-`main`-only), in parallel with
   `migrate`:
   ```yaml
   integration-test:
     name: Local Supabase integration tests
     runs-on: ubuntu-22.04
     needs: lint-build-test
     steps:
       - uses: actions/checkout@v4

       - uses: actions/setup-node@v4
         with:
           node-version: 24
           cache: npm

       - name: Install dependencies
         run: npm ci

       # Pin to immutable release tag — same pinning as the `migrate` job.
       - name: Install Supabase CLI
         uses: supabase/setup-cli@v1.7.1
         with:
           version: 2.22.6

       - name: Start local Supabase
         run: supabase start
         # No GitHub secrets required — local start/push needs none.

       - name: Apply migrations (supabase db push --local)
         run: supabase db push --local
         # Expected to be a no-op: `supabase start` already applies
         # supabase/migrations/*.sql on a fresh stack. Kept explicit so
         # AC1's "applies migrations via supabase db push" is literally
         # exercised and mirrors the `migrate` job's command shape.

       - name: Export local Supabase env vars
         run: supabase status -o env >> "$GITHUB_ENV"
         # VERIFY AT IMPLEMENTATION TIME (Finding 6): confirm the exact
         # variable names this prints (expected: API_URL, ANON_KEY,
         # SERVICE_ROLE_KEY, DB_URL, ...) and map them explicitly below —
         # do not assume without checking a real run's logs first.

       - name: Map local Supabase vars to app env names
         run: |
           echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL" >> "$GITHUB_ENV"
           echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY" >> "$GITHUB_ENV"
           echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" >> "$GITHUB_ENV"

       # Fail fast with a clear message if `supabase status -o env`'s
       # variable names ever drift (Finding 6 — unverified in this
       # refinement session), instead of cascading into an opaque later
       # failure (e.g. the seed script's own host guard rejecting an empty
       # URL, or `npm run build` failing on a missing env var, several
       # steps downstream of the real cause).
       - name: Verify local Supabase env vars were resolved
         run: |
           : "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL was not set — check the exact variable names printed by 'supabase status -o env' and update the mapping step above}"
           : "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY was not set — check 'supabase status -o env' variable names}"
           : "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY was not set — check 'supabase status -o env' variable names}"

       - name: Seed test users (admin + member)
         run: node supabase/seed-test-users.mjs

       - name: Build app against local Supabase
         run: npm run build

       - name: Install Playwright browsers
         run: npx playwright install --with-deps chromium

       - name: Run integration tests
         run: npm run test:integration

       - name: Upload integration Playwright report
         uses: actions/upload-artifact@v4
         if: always()
         with:
           name: integration-playwright-report
           path: playwright-report-integration/
           retention-days: 30
           if-no-files-found: error

       - name: Upload integration test results
         uses: actions/upload-artifact@v4
         if: always()
         with:
           name: integration-test-results
           path: test-results-integration/
           retention-days: 30
           if-no-files-found: error
   ```
   - Note the artifact `name:` values (`integration-playwright-report`,
     `integration-test-results`) are deliberately distinct from the
     `lint-build-test` job's `playwright-report`/`test-results` names.
   - Optional perf follow-up (not required for AC pass, safe to skip if it
     risks breaking something): `supabase start --exclude analytics,edge-runtime,functions,imgproxy,inbucket,meta,realtime,storage,studio,vector`
     to skip unused Docker services and speed up cold image pulls — verify
     `supabase status`/`db push`/Admin API still work with these excluded
     before relying on it.

**7. AC4 (regression-guard demonstration) — one-time manual verification,
   not permanent tooling**, per the story's own note. During
   implementation:
   - Temporarily comment out the `GRANT SELECT ON public.users TO authenticated;`
     line in `supabase/migrations/20260628000003_grant_users_select_to_authenticated.sql`.
   - Run the full job locally (`supabase start` → `db push --local` → seed
     → build → `npm run test:integration`) or push to a scratch branch/PR
     and watch the `integration-test` job.
   - Confirm the AC2 admin-ping test fails visibly (expect a 401 from
     `requireAuth`'s role lookup failing with `42501`, surfaced via
     `console.error('[requireAuth] unexpected error:', err)` — or the
     Supabase query error path — rather than the expected 200).
   - Restore the GRANT line, re-run, confirm green again.
   - Paste the before/after result (pass/fail + relevant log line) into
     this story file as a dated note under a new "QA verification" heading,
     satisfying CLAUDE.md DoD #5 ("documented manual verification step")
     for AC4 specifically. Do **not** build a permanent script/CI toggle for
     this — it is demonstrated once and recorded.

### Test plan (AC → verification)

| AC | Verification |
|----|--------------|
| AC1 (job starts local Supabase, applies migrations, exits 0) | The `integration-test` job's `supabase start` + `supabase db push --local` steps themselves; job going green on a normal PR is the automated proof. |
| AC2 (admin → 200) | `e2e-integration/admin-ping.spec.ts` `adminRequest` test, run via `npm run test:integration` in the new CI job. |
| AC3 (member → 403) | Same spec file, `memberRequest` test. |
| AC4 (regression-guard demonstrated) | One-time manual verification per Step 7 above; result recorded in this story file, not a permanent automated test (matches the story's own AC4 wording). |
| AC5 (failure points to which test + why; HTML report artifact) | `reporter: [['html', ...], ['list']]` in `playwright.integration.config.ts` + the `Upload integration Playwright report`/`Upload integration test results` steps with `if: always()` and `if-no-files-found: error`. |

### Risks and rollback

- **CI runtime cost**: `supabase start` pulls ~8-10 Docker images on a cold
  cache; this could add 2-5 minutes to every PR. Mitigated by the optional
  `--exclude` flag (Step 6) and by running in parallel with `migrate`
  rather than blocking `lint-build-test`. If this proves too slow in
  practice, a follow-up could cache the Docker layer or restrict the job to
  `pull_request` only when files under `supabase/` or `app/api/` change
  (`paths:` filter) — out of scope for this story but worth flagging.
- **Flakiness from Docker-in-CI**: local Supabase startup can occasionally
  be slow/flaky on shared runners. `retries: 2` (existing convention) and a
  generous `webServer.timeout` mitigate this; if `supabase start` itself
  times out, that's a job failure independent of Playwright retries — no
  special handling proposed beyond letting the job fail and re-running.
- **Divergence from CHORE-03's "no local Supabase for dev" decision**:
  CHORE-03 explicitly says not to use local Supabase via Docker for
  day-to-day development (dev/prod cloud project split instead). This
  story does not reverse that — the local Supabase stack here is
  CI-only, ephemeral per job run, and never touches a developer's machine
  unless they choose to run these tests locally too. This is no longer
  just a documentation aside: Step 1's fail-closed host guard in
  `supabase/seed-test-users.mjs` makes the boundary a runtime enforcement,
  not just a comment, and Step 1 also requires the explanatory comment in
  both `supabase/seed-test-users.mjs` and `supabase/config.toml` (near
  `project_id`) so a reader of either file finds the other and understands
  why. See Step 1 above (Challenge review finding, fix cycle 1).
- **Rollback**: the new job is additive and `needs: lint-build-test` without
  being a dependency of `migrate` or a required check by default — if it
  proves unreliable, it can be disabled by removing the job from
  `ci.yml` (or marking it non-required in branch protection) without
  affecting any other job. No schema/migration changes are introduced, so
  there's nothing to roll back on the data side.
- **Cookie-format fragility**: mitigated by design (Finding 7 — reusing
  `@supabase/ssr`'s own `setAll` output instead of hand-rolling the cookie
  name/encoding), but if `@supabase/ssr` is upgraded in the future and
  changes its storage key derivation or chunking, this fixture adapts
  automatically since it never hardcodes the format — flagged here so a
  future implementer doesn't reintroduce a hardcoded cookie name "for
  simplicity."

### Complexity tag: **complex**

Justification: touches CI/infra config, auth (real Supabase sessions via a
non-trivial, previously-unused-in-this-repo cookie/session fixture design),
and multiple interacting systems (Docker/local Supabase stack, Admin API
user provisioning, `public.users` seeding, a new Playwright project/config,
and GitHub Actions artifact handling). Per CLAUDE.md's classification rubric
this is well above `standard` — it's exactly the kind of "three or more
interacting systems" + auth story the rubric calls out as `complex`, even
though no production application code changes.

---

## Implementation notes (2026-07-11)

### Deviation from the plan: `supabase status -o env` quoting bug

Finding 6 flagged that the exact variable **names** printed by
`supabase status -o env` needed empirical confirmation before the workflow
YAML was final. This sandbox happened to have Docker available (with an
unrelated local Supabase stack already occupying the default ports —
exactly as Finding 6 predicted), so a real `supabase start` was run here
against alternate ports (`55321`/`55322`/etc., configured via a
local-only, never-committed edit to `supabase/config.toml`, fully reverted
afterwards) to verify empirically rather than relying on CI as the first
real run.

The variable **names** matched the plan exactly (`API_URL`, `ANON_KEY`,
`SERVICE_ROLE_KEY`). However, empirical testing surfaced an additional,
previously-unflagged bug: `supabase status -o env` prints each value
**wrapped in literal double quotes** (e.g. `ANON_KEY="eyJhbGci..."`).
`$GITHUB_ENV` does no unquoting — a line appended via
`supabase status -o env >> "$GITHUB_ENV"` would have set
`NEXT_PUBLIC_SUPABASE_ANON_KEY` to a value that literally starts and ends
with a `"` character, corrupting the JWT and breaking every downstream
Supabase client call. This was caught before it reached CI by running the
seed script and the app build against the real captured value and noticing
the extra quote characters.

Fix: the CI job uses `supabase status -o json` + `jq -r` (jq is
preinstalled on GitHub-hosted `ubuntu-22.04` runners) instead of `-o env`,
which returns clean unquoted string values. This replaces the plan's
two-step "Export local Supabase env vars" / "Map local Supabase vars to
app env names" steps with a single step. The fail-fast
`${VAR:?msg}` verification step is unchanged.

### AC4 — regression-guard demonstration (manual verification, one-time)

Per the story's own AC4 wording, this is a one-time manual verification,
not permanent tooling. Performed locally against the real local Supabase
instance described above (same session as the quoting-bug finding):

1. **Before (GRANT removed):** commented out
   `GRANT SELECT ON public.users TO authenticated;` in
   `supabase/migrations/20260628000003_grant_users_select_to_authenticated.sql`,
   ran `supabase db reset` (full re-apply of all migrations from a clean
   DB), re-ran `node supabase/seed-test-users.mjs`, then ran
   `npm run test:integration`.

   Result: **both tests failed**, as expected —
   `AC2: admin GET /api/admin/ping returns 200` received **401** instead
   of 200 (member also received 401 instead of 403, since the missing
   GRANT breaks the role lookup for every authenticated user, not just
   admins — this is correct behaviour of `requireAuth`/`requireAdmin`, not
   a test bug). Root cause confirmed directly by querying `public.users`
   with the authenticated client and inspecting the Supabase error object:
   ```
   error: {
     code: '42501',
     message: 'permission denied for table users',
     hint: 'Grant the required privileges to the current role with: GRANT SELECT ON public.users TO authenticated;'
   }
   ```
   This is the exact STORY-04 production bug shape the story exists to
   catch, reproduced and caught locally by the new suite.

2. **After (GRANT restored):** restored the GRANT line (confirmed
   zero diff against the committed migration file), ran
   `supabase db reset` again, re-seeded, and re-ran
   `npm run test:integration`.

   Result: **both tests passed** —
   `AC2: admin GET /api/admin/ping returns 200` → 200
   `{ ok: true, role: 'admin' }`; `AC3: member GET /api/admin/ping
   returns 403` → 403 `{ error: 'Forbidden' }`.

AC4 is satisfied: the regression-guard demonstrably fails red for the
right reason when the GRANT is missing, and passes green when it is
present. No permanent script or CI toggle was added for this, per the
story's own instruction.

### What was verified locally vs. deferred to CI

Verified locally, end-to-end, against a real local Supabase instance
(Docker was available in this sandbox environment): `supabase start`,
`supabase db push --local` (confirmed no-op per Finding 4), the seed
script, `npm run build` pointed at local Supabase, and
`npm run test:integration` (both AC2 and AC3 passing), plus the AC4
red/green demonstration above. The local stack was fully torn down
(`supabase stop`) afterwards and `supabase/config.toml` /
`supabase/migrations/20260628000003_...sql` were restored to their
committed state (verified via `git diff` showing no changes) so none of
this local experimentation leaked into the committed diff.

Not verified locally (deferred to the real GitHub Actions run): the exact
GitHub-hosted `ubuntu-22.04` runner environment (Docker image pull speed,
`jq` availability — expected preinstalled but not independently confirmed
outside this sandbox), the `actions/upload-artifact@v4` steps, and the
job running correctly in parallel with `migrate` under the real
`needs: lint-build-test` DAG.

## Rework cycle 1 (PR #41 review findings)

### WARNING — `seed-test-users.mjs` host guard URL-userinfo bypass

The fail-closed host guard used a string-prefix regex
(`/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/`) that a reviewer found
bypassable: `http://127.0.0.1:1234@evil.com/` matches the regex (the `:`
right after `127.0.0.1` satisfies the terminator group, since that
substring is actually the URL's **userinfo** segment, not its host) even
though `fetch`/URL machinery connects to `evil.com`. Since this guard is
the sole runtime control preventing the script's fixed-UUID,
publicly-known-password admin account from being created against a
real/shared/prod Supabase project, this was a real gap.

Fixed by parsing the URL with `new URL(url)` and checking `.hostname`
against an exact allow-list (`127.0.0.1` / `localhost`) instead of a
regex — `.hostname` never includes the userinfo subcomponent, so the
bypass class is structurally eliminated, not just patched for this one
case. The check still runs first, before any Supabase client is
constructed.

Verified with:
- A standalone Node script exercising the userinfo-bypass URL, several
  other non-local URLs, an invalid URL string, and the two legitimate
  cases (`127.0.0.1`, `localhost`) — all passed with the new logic.
- A persisted regression test,
  `supabase/seed-test-users.host-guard.test.mjs` (Node's built-in
  `node --test` runner, zero new dependencies), which spawns the real
  script as a child process for each case and asserts on exit code +
  stderr. Wired into `npm run test:unit` and into the `lint-build-test`
  CI job (`.github/workflows/ci.yml`) so it runs on every PR.
- The full local Docker Supabase stack (`supabase start`, `db push
  --local`, the fixed seed script, `npm run build`, and
  `npm run test:integration`) end-to-end in this session — both AC2 and
  AC3 integration tests still pass against a real local instance with the
  new guard in place.

### SUGGESTIONs addressed

1. `e2e-integration/fixtures.ts` `signInAndGetCookies` now throws if the
   captured cookies array is empty, so a future `@supabase/ssr` change
   that stops calling `setAll` fails clearly instead of a confusing 401
   downstream.
2. Extracted the near-identical `adminRequest`/`memberRequest` fixture
   bodies into a shared `createAuthenticatedRequestContext` helper.
3. The idempotency check in `createAuthUser` now prefers GoTrue's stable
   `error.code === 'email_exists'` over the free-text message match,
   keeping the message-substring check only as a fallback for
   older/self-hosted GoTrue versions that don't set `code`.
4. Removed the no-op `screenshot: 'on'` from
   `playwright.integration.config.ts` (API-only suite never renders a
   page).

### Status
All CRITICAL/WARNING findings fixed; all SUGGESTIONs addressed (none were
skipped). `npm run lint`, `npx tsc --noEmit`, `npm run build`,
`npm run test:unit`, `npm run test:e2e` (29 passed / 46 auth-gated
skipped / 0 failed), and `npm run test:integration` (2/2 passed against a
real local Supabase instance) all green in this session. Ready for
re-review.
