# CHORE-09: Upgrade CI Node.js target off EOL Node 20
Epic: maintenance
Status: done ✅
PR: 21

## Task
Bump the Node.js version used in CI (and documented for local dev) from
Node 20 to a currently supported LTS line (Node 22 or Node 24), because
Node.js 20 reached end-of-life on 2026-04-30 and no longer receives security
patches or bug fixes.

## Context
`.github/workflows/ci.yml` pins `node-version: 20` in `actions/setup-node`.
As of today (2026-07-02), Node.js 20 has been end-of-life for over two
months. Per the Node.js release schedule: Node 22 is now Maintenance LTS
(supported until April 2027) and Node 24 is Active LTS (supported until
April 2028).

`next@16.2.9`'s own `package.json` only requires `"node": ">=20.9.0"`, so
nothing in the app forces staying on Node 20 — this is a supply-chain/
security hygiene gap, not a compatibility blocker. Nothing about this is
urgent (no known active exploit), but running an unsupported runtime in CI
indefinitely is the kind of gap that's cheap to close now and progressively
more annoying to close later once other dependencies start requiring a
newer Node floor.

This surfaced during the codebase-health assessment requested alongside the
user's original questions in this triage — it was not one of the reported
symptoms.

## Acceptance criteria
1. Given `.github/workflows/ci.yml`, when updated, then `node-version`
   targets a currently supported LTS line (22 or 24 — Refine picks one and
   records the reasoning, e.g. "24 for the longer support runway").
2. Given the updated CI, when the full pipeline runs (lint, build, smoke
   test, and the `migrate` job), then all steps pass on the new Node
   version.
3. Given the version bump, when any local-dev setup docs are checked
   (README or equivalent, if they document a Node version), then they are
   updated to match — so a new contributor doesn't install an EOL version.
4. Given `package.json`, when reviewed, then an `"engines": { "node":
   ">=22.0.0" }` (or chosen version) field is present, so `npm install`
   warns on a mismatched local Node version.

## Out of scope
- Upgrading the other packages flagged by `npm outdated` (all are minor/
  patch gaps as of 2026-07-02 — `@supabase/supabase-js`, `next`, `eslint`,
  `next-intl`, `react`, `react-dom`, `tailwindcss`, `lucide-react`,
  `typescript` — none urgent; not actioned in this chore).
- Changing the `ubuntu-22.04` CI runner image (separate concern; not EOL).

## Technical notes
- `actions/setup-node@v4` already supports Node 22/24 — only the
  `node-version` value needs to change, not the action version.
- Verify locally with `nvm install 24 && nvm use 24` (or 22) and re-run the
  full local quality gate before pushing.
- Priority: low-medium — no active vulnerability confirmed, but this is a
  proactive hygiene fix worth closing rather than deferring further.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Decision: Node 24 (Active LTS)

Chosen version: **Node 24.x** (`node-version: 24` in CI, `"node": ">=24.0.0"`
in `package.json` engines).

Reasoning:
- Node 22 is already in **Maintenance LTS** (supported to April 2027); Node
  24 is **Active LTS** (supported to April 2028). Picking 24 now buys ~1 extra
  year before this chore needs to be repeated, and this is a low-traffic
  volunteer project with infrequent maintenance windows — minimizing the
  number of future forced upgrades matters more here than staying on the
  more conservative Maintenance line.
- No compatibility blocker: `next@16.2.9` only requires `"node": ">=20.9.0"`
  (no upper bound). Checked the other tools in the toolchain that declare an
  `engines.node` field — `@playwright/test` requires `>=18`, `typescript`
  requires `>=14.17`; neither caps the ceiling. `eslint@9` requires
  `^18.18.0 || ^20.9.0 || >=21.1.0`, which Node 24 satisfies via the
  `>=21.1.0` clause.
- `actions/setup-node@v4` (already pinned in CI) supports Node 24 out of the
  box — no action-version bump needed.
- Confirmed no `.nvmrc`, `.node-version`, or `vercel.json` exists in the repo
  that would need a matching update. Vercel's own build image Node version is
  a separate dashboard/project setting (not code) and is out of scope here —
  flagging as a manual follow-up in Risks below.

### Affected areas
- **infra** — `.github/workflows/ci.yml` (CI Node version)
- **data/config** — `package.json` (`engines` field, `@types/node` devDependency)
- **docs** — `README.md` (documented local Node prerequisite)

No application code changes. Confirmed via grep across `*.md`, `*.json`,
`*.yml`/`*.yaml` (excluding `node_modules`/`.git`) that only `README.md`,
`package.json`(-lock, generated), and `.github/workflows/ci.yml` reference a
Node version — no other docs (ADRs, epics, other stories) mention it.

### Step-by-step approach

#### Step 1 — `.github/workflows/ci.yml`
Change the single `node-version` line under `actions/setup-node@v4` (used
once, in the `lint-build-test` job; the `migrate` job doesn't set up Node):
```diff
       - uses: actions/setup-node@v4
         with:
-          node-version: 20
+          node-version: 24
           cache: npm
```

#### Step 2 — `package.json`
Add an `engines` field (top-level, alongside `"private": true`) and bump the
`@types/node` devDependency major to track the runtime:
```diff
   "name": "scheduler",
   "version": "0.1.0",
   "private": true,
+  "engines": {
+    "node": ">=24.0.0"
+  },
   "scripts": {
```
```diff
-    "@types/node": "^20",
+    "@types/node": "^24",
```
Run `npm install` after editing (not `npm ci`) so `package-lock.json`
regenerates with the new `@types/node` resolution. Commit the updated
lockfile.

#### Step 3 — `README.md`
Update the local-dev prerequisite line:
```diff
-**Prerequisites:** Node 20+, npm, a Supabase project.
+**Prerequisites:** Node 24+, npm, a Supabase project.
```

#### Step 4 — Local verification (manual, per Technical notes)
```bash
nvm install 24 && nvm use 24
npm ci
npm run lint
npx tsc --noEmit
npm run build
npx playwright install --with-deps chromium   # if not already installed for Node 24
npm run test:e2e
```
This is the closest local approximation of the CI pipeline job order; it is
also the manual verification step satisfying AC2 (CI itself will confirm the
same thing once pushed, but running it locally first avoids burning CI
minutes on an avoidable failure).

### Test plan (AC → verification)

| AC | Verification |
|----|--------------|
| AC1 — `node-version` targets a supported LTS, reasoning recorded | Manual: diff review of `.github/workflows/ci.yml` line change; reasoning recorded in this file's "Decision" section above. No automated test possible for a CI config value — this is a docs/config assertion. |
| AC2 — full pipeline (lint, build, smoke test, migrate) passes on new Node version | Automated: the CI run itself, triggered by pushing this change (the `lint-build-test` job runs lint/build/smoke on Node 24; `migrate` doesn't depend on Node version but runs after `lint-build-test` succeeds — its dependency graph is unaffected). Pre-flight manual local run (Step 4) before pushing, since a CI-only failure would burn a review cycle. |
| AC3 — local-dev docs updated to match | Manual: confirmed via repo-wide grep (done during refinement) that `README.md` is the only doc mentioning a Node version besides `CLAUDE.md`/`AGENTS.md` (process docs, not a dev-setup doc, and don't mention a version) and the story file itself. `README.md` updated in Step 3. |
| AC4 — `package.json` has `engines.node` field | Automated-adjacent: `npm install` will emit an `EBADENGINE` warning (not a hard failure, since npm defaults `engine-strict` to false) if run on a mismatched local Node version — this is npm's built-in enforcement, no custom test needed. Manual: confirm the field is present and matches the chosen version after Step 2. |

No new Playwright spec is needed — this chore has no user-facing behavior to
assert; the existing smoke suite re-running green on Node 24 (AC2) is the
functional regression check.

### Risks and rollback

- **Risk**: a transitive dependency has an undeclared Node-24 incompatibility
  that only surfaces at runtime (not caught by `engines` fields). Mitigation:
  Step 4's full local run before pushing; CI will also catch it on push since
  `lint-build-test` must pass before `migrate` runs.
- **Risk**: Vercel's deployment build image Node version is configured
  separately (Vercel project settings → General → Node.js Version) and is
  NOT touched by this change. If left on an older version, prod builds and
  CI could diverge. **Flagging as a manual follow-up for Simão**: check the
  Vercel dashboard setting after this chore merges and align it to Node 24
  (or the closest available option — Vercel may not offer every Node minor).
  This is a dashboard-only, non-code change, consistent with how other
  operator-side settings (e.g. "Require CI to pass before deploying") are
  handled in this repo's CI docs.
- **Rollback**: trivial — revert the single commit. No data migration, no
  irreversible state; the three edits are independent config/doc lines.

### Complexity tag: **trivial**

Justification: three small, independent, mechanical edits (one CI YAML
value, one added JSON field + one version bump, one README line) across
three files, no application code touched, no auth/data/concurrency/security
surface, fully reversible with a single revert. Confirmed scope is narrow by
grepping the whole repo for other Node-version references before writing
this plan — nothing else needs to change. The only manual-judgment step
(picking 22 vs 24) is already resolved above with recorded reasoning, so the
implementer has no open decisions left to make.

### Open questions
None — this is unambiguous, low-risk config/docs work with all AC-relevant
files identified and no material technical decision left unresolved.
