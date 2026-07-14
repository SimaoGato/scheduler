# CHORE-15: Pilot a browser-based auth fixture against local Supabase (unblock E2E_WITH_AUTH tests in CI)
Epic: maintenance
Status: done ✅
PR: 51

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

## Implementation Plan

### Key finding from refinement (changes the shape of this story)

The browser-auth fixture this story asks for **already exists**. STORY-26
(commit `b6ef221`, "test(story-26): add memberPage/adminPage browser-auth
fixtures") already extended `e2e-integration/fixtures.ts` with
`createAuthenticatedPage()` + the `memberPage`/`adminPage` fixtures, built
exactly on the `browser.newContext()` + `context.addCookies({ domain, path })`
pattern this story's Background section anticipated (see fixtures.ts lines
96-157). It is already proven in CI: `e2e-integration/availability.spec.ts`
(STORY-26) uses `adminPage`/`memberPage` across 8 passing tests today,
including two (`AC8` describe block, lines 351-373) that already assert
`AppHeader`/`AppNav` render correctly for both roles and that nav links are
visible and clickable — i.e., AC1's given/when/then is already exercised and
green in CI.

This means CHORE-15's real remaining work is narrower than the story text
implies: **no new fixture code is needed**. The task is to (a) migrate the 3
specific `app-nav.spec.ts` assertions (admin wordmark-to-home nav, exact
4-link admin nav count, exact 1-link member nav count — genuinely NOT covered
by the existing STORY-26 assertions, which only check single-link visibility
and click-through) into `e2e-integration/`, reusing the existing fixtures
as-is, and (b) do the CI-runtime measurement and recommendation write-up the
ACs ask for. Flagging this explicitly so Challenge/Review don't expect (or
credit) new fixture-authoring work that isn't actually happening.

### Affected areas

- **infra / test-infra only.** No backend, frontend, ux, ai-ml, or data
  changes. No application code touched. No new migrations. No changes to
  `lib/`, `app/`, `components/`, or `supabase/migrations/`.
- Files touched: new `e2e-integration/app-nav.spec.ts`; delete
  `e2e/app-nav.spec.ts`; story file itself (CI runtime numbers + Recommendation
  section, added at implementation time with real measured data).
- No `.github/workflows/ci.yml` changes needed — `playwright.config.ts`
  (`testDir: './e2e'`) and `playwright.integration.config.ts`
  (`testDir: './e2e-integration'`) already split test discovery by physical
  directory, so moving the file's location is what re-routes it from the
  `lint-build-test`/smoke job to the `integration-test` job. No new CI step,
  env var, or job wiring is required.

### Step-by-step approach

1. **Baseline regression check (test-first sanity, not new code):** before
   touching anything, run `npm run test:integration` locally against a local
   Supabase instance (or trust the last green CI run) to confirm the existing
   `adminPage`/`memberPage` fixtures and `availability.spec.ts` still pass —
   this is the existing proof that AC1 already holds; no new isolated
   fixture-only test is being written for AC1.

2. **Create `e2e-integration/app-nav.spec.ts`.** Port the 3 tests from
   `e2e/app-nav.spec.ts`:
   - `import { test, expect } from './fixtures'` (not `@playwright/test`
     directly — matches `availability.spec.ts`/`blocked-dates.spec.ts`
     convention).
   - Remove every `test.skip(!process.env.E2E_WITH_AUTH, ...)` line — these
     tests now always have a real authenticated session via the fixture, so
     the gate is dead code once migrated.
   - AC2 test → use `adminPage`, `goto('/pt-PT/admin/people')`, click the
     "Escala" wordmark, assert `toHaveURL(/\/pt-PT\/?$/)`. Unchanged
     assertion logic from the original file, just swapping `page` for
     `adminPage`.
   - AC3/original-AC3 test → use `adminPage`, `goto('/pt-PT/')`, assert nav
     has exactly 4 links (Disponibilidade, Utilizadores, Equipa, Funções).
   - Original-AC8 test → use `memberPage`, `goto('/pt-PT/')`, assert nav has
     exactly 1 link (Disponibilidade).
   - Carry over a trimmed header doc-comment (drop the "manual verification /
     requires Google OAuth" section entirely — it's now automated; keep a
     one-line pointer to STORY-16/17/26 history and a note that this file is
     CHORE-15's pilot migration of the previously `E2E_WITH_AUTH`-gated
     `e2e/app-nav.spec.ts`, per the `availability.spec.ts` header-comment
     convention).

3. **Delete `e2e/app-nav.spec.ts` outright** (not just gut its tests — the
   whole file, including its now-superseded header comment). Design decision,
   made here rather than left open: STORY-26 kept a dual-file pattern
   (automated `e2e-integration/availability.spec.ts` AC8 test + a
   still-gated, doc-comment-only manual fallback in the original file) because
   that fallback covered scenarios not yet reachable another way. Here, once
   migrated, every original assertion has a fully-automated, always-running
   equivalent in CI — a leftover `E2E_WITH_AUTH`-gated stub would be pure dead
   weight with no incremental verification value. Full deletion is the
   simpler, honest state. (If Review disagrees and wants a documentation-only
   stub retained pointing to the new location, that's a small, low-risk
   follow-up, not a blocker.)
   - Note for future stories: CLAUDE.md's "E2E test count assertions on nav
     links (STORY-17)" convention (updating a `toHaveCount(N)` assertion when
     a nav link is added/removed) now applies to
     `e2e-integration/app-nav.spec.ts`, not the old path. Worth a one-line
     addition to that CLAUDE.md bullet at implementation time, but treat as
     optional documentation hygiene, not an AC.

4. **Confirm no smoke-suite regression:** after deletion, run `npm run
   test:e2e` (smoke/`lint-build-test` config) locally or via CI and confirm no
   reference to `app-nav.spec.ts` remains and the smoke suite's test count
   drops by 3 with no failures.

5. **AC3 — CI runtime documentation (before/after).** Use `gh run view
   <run-id> --json jobs -q '.jobs[] | select(.name == "Local Supabase
   integration tests")'` to extract `startedAt`/`completedAt` for:
   - **Before:** the most recent green `integration-test` job run on `main`
     prior to this story's changes. Measured during refinement as a concrete
     baseline: run `29358768711` (2026-07-14, branch
     `story/CHORE-14-admin-crud-integration-tests`, merged to main lineage) —
     job "Local Supabase integration tests" ran `18:41:51`–`18:46:01`, i.e.
     **4m10s**. Re-verify against the actual latest green `main` run
     immediately before implementation starts, since CI timing drifts run to
     run; use whichever is most recent at that time as the recorded
     "before" baseline (note the run ID and timestamp used).
   - **After:** the same extraction against the CI run triggered by this
     story's own PR, once green.
   - Record both numbers + the delta (seconds, not just "similar") in a new
     "CI runtime" subsection of this story file at implementation time. Do
     not guess the after-number — measure the real PR's CI run.

6. **AC4 — Recommendation deliverable.** Add a "Recommendation" section to
   this story (see draft content below in this plan, to be finalized with
   real AC3 numbers once measured) covering:
   - The fixture pattern is not net-new R&D — it already exists and is
     proven across 8+ tests in `availability.spec.ts`. Migrating the
     remaining 17 files is expected to be mechanical, file-by-file port work
     (swap `page` → `adminPage`/`memberPage`, drop `E2E_WITH_AUTH` gates, move
     file to `e2e-integration/`), not fixture engineering.
   - Confirmed during refinement (see below) that none of the 18 originally
     gated files drive real Google/OAuth UI — safe to migrate all of them
     with the existing email/password fixture; the out-of-scope carve-out for
     "real OAuth automation" never actually applies to any of the 17
     remaining files.
   - Worker-isolation: `playwright.integration.config.ts` already forces
     `workers: process.env.CI ? 1 : undefined`, i.e. CI always runs this suite
     serially. Read-only/navigation-only files (like the migrated
     `app-nav.spec.ts`) need zero additional isolation. Files that create or
     mutate rows tied to the two fixed seeded users (`ADMIN_ID`/`MEMBER_ID`)
     must follow the already-established worker-isolated-fixture + cleanup
     pattern (STORY-14/STORY-25/STORY-26: names keyed by
     `testInfo.workerIndex`, unconditional `afterEach` cleanup) — this is
     precedent, not new design work, for each subsequent migration.
   - Recommendation: **worth extending as-is**, one file (or small related
     group) per follow-up chore, in order of highest regression-value /
     lowest migration risk first (e.g. read-only nav/gating checks before
     data-mutating flows like `claim.spec.ts`/`role-management.spec.ts`).
     Budget each follow-up chore's CI-time cost using the AC3 before/after
     delta measured here as a per-file rate estimate.

### Test plan mapped to acceptance criteria

| AC | Verification |
|----|--------------|
| AC1 (fixture produces a recognized signed-in session) | Already covered by existing, currently-green `e2e-integration/availability.spec.ts` (STORY-26) fixture usage; additionally re-proven implicitly by every migrated test's `not.toHaveURL(/\/login/)` / nav-visibility assertions in the new `app-nav.spec.ts`. No new isolated fixture test authored — would be redundant with existing coverage. |
| AC2 (3 tests run/pass in `integration-test` CI job, not smoke, without `E2E_WITH_AUTH`) | New `e2e-integration/app-nav.spec.ts`, 3 automated tests, verified green in the `integration-test` CI job on this story's PR; verified absent from the smoke job's test count. |
| AC3 (CI runtime documented before/after) | Manual verification step: `gh run view` job-duration extraction before and after, recorded as a "CI runtime" subsection in this story file with concrete numbers (not automated — this is a documentation AC). |
| AC4 (recommendation on extending to remaining 17 files) | Manual verification step: "Recommendation" section added to this story file (not automated — this is a documentation AC). |

### Risks and rollback

- **Risk:** deleting `e2e/app-nav.spec.ts` removes the doc-comment-based
  manual-fallback pattern used elsewhere in the suite. Mitigated by: (a) full
  automated equivalence in the new file (no coverage gap), (b) git history
  preserves the old file if anyone wants to reference it, (c) explicitly
  flagged above as a made design decision, reversible in review if disputed.
- **Risk:** CI job-runtime measurement is inherently noisy (Docker
  image-pull caching, GitHub-hosted runner variance run-to-run). Mitigated
  by recording the actual run IDs/timestamps used (not just a number) so the
  measurement is falsifiable/reproducible, and by treating the delta as an
  order-of-magnitude budgeting input for the follow-up chore, not a precise
  SLA.
- **Rollback:** trivial. This is test-only code with no schema, application,
  or CI-workflow-file changes — reverting the PR fully restores the prior
  (skipped-in-CI) state with zero risk to production behavior.

### Complexity tag: **standard**

Justification: this is test-infra-only work with no application code, no
auth-guard/routing-regex/env-var-contract changes, and it reuses an
already-shipped, already-proven fixture rather than authoring new auth/cookie
logic — so it does not trip CLAUDE.md's explicit reasoning-risk override
signals (which call out auth guards, routing regexes, and env-var contracts
specifically). However, it is not `trivial` either: CLAUDE.md reserves
`trivial` for "genuinely mechanical work with low reasoning risk (copy/text
change, config tweak, a single small pure function, a one-line bug fix with
an obvious cause)." This story involves a judgment call on file
retirement/deletion, a multi-file test migration with assertion-level
porting, real investigative work (confirming via grep that none of 18 files
depend on real OAuth UI), and an analytical recommendation write-up spanning
17 other files' migration risk. That's more reasoning surface than the
`trivial` bar is meant for, even though the blast radius is small and fully
reversible. Per CLAUDE.md, "when in doubt, do NOT mark it trivial" — `standard`
is the correct, conservative classification.

### Out-of-scope confirmation (re-verified during refinement)

- No application code changes: confirmed — every file touched is under
  `e2e/` or `e2e-integration/`, plus this story file.
- No migration of the other 17 gated files: confirmed — this plan only
  creates one new spec file (`app-nav.spec.ts`) and deletes its
  now-superseded predecessor; the Recommendation section is documentation
  only, not a partial migration.
- No real Google OAuth automation: confirmed via `grep -in
  "accounts.google\|signInWithOAuth\|google.com\|OAuth UI\|Google login"
  e2e/*.spec.ts` across all 18 originally-gated files — zero matches. Every
  "google"/"oauth" mention in those files is a doc-comment describing the
  manual `.env.local` + real-Supabase + real-Google-login setup a developer
  needs to run them by hand today, not an automated interaction with Google's
  login UI. This confirms the out-of-scope carve-out is precautionary, not
  actually blocking any of the 17 remaining files in the eventual follow-up.

## CI runtime

Per AC3, measuring the `integration-test` job ("Local Supabase integration
tests") duration before and after this story's changes.

- **Before:** re-verified against the latest green `main` run at
  implementation time (superseding the `29358768711` / 4m10s figure recorded
  during refinement, since CI timing drifts run to run). Run
  [`29359207224`](https://github.com/SimaoGato/scheduler/actions/runs/29359207224)
  (2026-07-14, commit `48169cb`, merged to `main`): job "Local Supabase
  integration tests" ran `18:47:56`–`18:52:19` UTC, i.e. **4m23s**.
- **After:** measured against this story's own PR
  ([#51](https://github.com/SimaoGato/scheduler/pull/51)) CI run
  [`29360390376`](https://github.com/SimaoGato/scheduler/actions/runs/29360390376)
  (branch `story/CHORE-15-pilot-browser-auth-fixture-local-supabase`): job
  "Local Supabase integration tests" ran `19:05:35`–`19:11:55` UTC, i.e.
  **6m20s**.
- **Delta:** +1m57s (4m23s → 6m20s). Breaking down by step, almost all of
  the delta is attributable to `Start local Supabase` (2m46s before vs.
  4m35s after — Docker image-pull/runner variance, a known noise source per
  this story's own "Risks and rollback" section), not to the added tests
  themselves: the `Run integration tests` step itself only grew from 15s to
  19s (+4s) despite 3 new tests being added, consistent with the
  "Recommendation" section's expectation that per-file test-execution cost
  is small relative to the job's fixed overhead (starting local Supabase,
  installing Playwright browsers).

Locally (outside CI timing, for reference only): the 3 migrated tests in
`e2e-integration/app-nav.spec.ts` ran in 2.3s in isolation, and the full
`npm run test:integration` suite (54 tests, `--workers=1` to match CI's
serial mode) ran in 19.7s — both against a live local Supabase instance with
seeded admin/member users. Adding 3 read-only navigation tests is not
expected to move the CI job's wall-clock time meaningfully; the job's
duration is dominated by `Start local Supabase` (~2m46s) and `Install
Playwright browsers` (~44s), not by the test execution step itself
(~15s for the whole suite in the baseline run above).

## Recommendation

**Worth extending as-is.** This pilot confirms the pattern is not net-new
R&D — `adminPage`/`memberPage` (STORY-26) were already proven across 8
passing tests in `availability.spec.ts` before this story even started, and
migrating `app-nav.spec.ts` required zero fixture changes, only:
swap `page` → `adminPage`/`memberPage`, drop the `test.skip(!process.env
.E2E_WITH_AUTH, ...)` gate, move the file into `e2e-integration/`. That is
mechanical, file-by-file port work for the remaining 17 files, not fixture
engineering.

Key findings that de-risk the remaining migration:

- **No real OAuth UI dependency anywhere.** `grep -in
  "accounts.google\|signInWithOAuth\|google.com\|OAuth UI\|Google login"
  e2e/*.spec.ts` across all 18 originally-gated files returned zero matches
  on real Google-UI automation — every hit is a doc-comment describing the
  manual setup a developer needs today. The `E2E_WITH_AUTH` gate on all 17
  remaining files can be safely dropped once each is migrated to the
  fixture; none of them are structurally blocked on OAuth automation.
- **Worker isolation is already solved precedent, not new design work.**
  `playwright.integration.config.ts` already forces `workers:
  process.env.CI ? 1 : undefined`, so CI always runs `e2e-integration/`
  serially — read-only/navigation-only files (like the migrated
  `app-nav.spec.ts`) need zero additional isolation work. Files that create
  or mutate rows tied to the two fixed seeded users (`ADMIN_ID`/`MEMBER_ID`)
  must follow the already-established worker-isolated-fixture + unconditional
  cleanup pattern (STORY-14/STORY-25/STORY-26: names keyed by
  `testInfo.workerIndex`, `afterEach`/`finally` cleanup) — this repo has
  three prior worked examples to copy from, not something to invent per
  file.
- **CI-time budgeting:** the before/after delta measured in this story (see
  "CI runtime" above) gives a concrete per-batch cost estimate. Since the
  job's fixed overhead (starting local Supabase, installing Playwright
  browsers) dominates over incremental test-execution time, batching several
  related files into one follow-up chore (rather than one file per chore)
  is likely more CI-time-efficient than doing all 17 as 17 separate PRs —
  worth weighing against the "small, reviewable PR" tradeoff at planning
  time for the follow-up.

**Sequencing recommendation:** proceed file-by-file (or in small related
batches) starting with the lowest-risk/highest-value files first — read-only
nav/gating/visibility checks (e.g. any remaining files similar in shape to
the migrated `app-nav.spec.ts`) before data-mutating flows (e.g.
`claim.spec.ts`, `role-management.spec.ts`, `user-management.spec.ts`),
since data-mutating files require the worker-isolated-fixture-and-cleanup
pattern to be applied correctly and carry more regression risk if a cleanup
step is missed.
