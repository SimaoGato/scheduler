# CHORE-02: Configure Playwright screenshot capture and CI artifact upload
Epic: maintenance
Status: draft

## Task
Configure Playwright to capture screenshots during test runs and upload them as
CI artifacts, so that the `qa-verifier` agent and the `/verify` skill can
produce visual evidence of the UI — and so pull-request reviewers (human or
agent) can see what the app looks like without running it locally.

## Context
Currently `playwright.config.ts` has no `screenshot` setting, so no images are
produced when tests run. The CI workflow also has no artifact-upload step, so
any output files would be lost after the job completes. As a result, agents that
exercise the app (qa-verifier, /verify) can only assert structural/functional
behavior; they cannot show what a page actually looks like. The user should not
need to manually take and share screenshots to verify UI correctness.

## Acceptance criteria
1. Given a Playwright test run completes (pass or fail), when the test finishes, then a screenshot of the final page state is saved to `test-results/` on disk.
2. Given a screenshot file exists at a known path, when an agent calls the `Read` tool on that path, then Claude receives the image and can describe the visual UI state (verifiable manually by running `/verify` after this chore is done).
3. Given the CI pipeline runs and tests complete, when the job finishes, then a GitHub Actions artifact named `playwright-report` is uploaded and accessible from the PR "Checks" tab — containing the HTML report and all screenshots.
4. Given tests produce a Playwright HTML report, when an agent or reviewer opens the artifact, then individual test results show an attached screenshot for each test.

## Out of scope
- Visual regression / pixel-diff baselines (e.g. `toHaveScreenshot()`).
- Video recording of test runs.
- Automatic screenshot diffing between branches.
- Uploading screenshots to any external service (Slack, S3, etc.).

## Technical notes
- `playwright.config.ts`: add `screenshot: 'on'` (or `'only-on-failure'`) to the `use` block. `'on'` is preferred so agents always have an image to read, not just on failure.
- `playwright.config.ts`: ensure `reporter` includes `'html'` (Playwright's default; make it explicit so it's not dropped accidentally).
- `.github/workflows/ci.yml`: add an `actions/upload-artifact@v4` step after the Smoke test step. Upload path: `playwright-report/`. Set `if: always()` so artifacts upload even when tests fail.
- Optionally add a `test-results/` upload as a second artifact for raw screenshots.
- No changes to individual test files are required — screenshot capture is configured globally.
- The `qa-verifier` and `/verify` agents already have access to the `Read` tool and can read `.png` files at known paths; no agent-side changes needed once screenshots are being produced.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Affected areas
- **infra / config** — `playwright.config.ts` (Playwright settings)
- **infra / CI** — `.github/workflows/ci.yml` (GitHub Actions workflow)

No frontend, backend, AI/ML, or data files are touched.

### Complexity tag
`trivial` — two config files, no logic changes, no new modules, no reasoning risk.

---

### Step-by-step changes

#### 1. `playwright.config.ts`

Add an explicit `reporter` array and extend the `use` block with `screenshot: 'on'`.

Current `use` block (line 7):
```
use: { baseURL: 'http://localhost:3000' },
```

Replace with:
```typescript
reporter: [['html']],
use: {
  baseURL: 'http://localhost:3000',
  screenshot: 'on',
},
```

The full updated file becomes:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html']],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
  },
  webServer: {
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

#### 2. `.github/workflows/ci.yml`

Append two artifact-upload steps after the existing "Smoke test" step (currently the last step in the job). Both use `if: always()` so they run even when tests fail.

```yaml
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload test results (raw screenshots)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 30
```

---

### Test plan (mapped 1:1 to acceptance criteria)

**AC1** — Screenshot saved to `test-results/` on disk.
- After `npm run test:e2e` completes locally, assert that `test-results/` contains at least one `.png` file.
- Automated check: can be verified in CI by listing `test-results/**/*.png` in a shell step, but the artifact upload already implicitly validates this (an empty upload produces a warning, not a pass).
- Manual verification: `ls test-results/**/*.png` after a local run.

**AC2** — Agent can read the PNG via the `Read` tool.
- Manual verification only (as noted in the story): run `/verify` after this chore is merged. The `qa-verifier` agent reads a known path such as `test-results/<test-name>/<browser>/test-finished-1.png` and describes the visual state. No automated test can assert "Claude received the image correctly."

**AC3** — GitHub Actions artifact named `playwright-report` uploaded and accessible from the PR Checks tab.
- Verification: open the CI run for the PR that merges this chore; confirm the "Artifacts" section lists `playwright-report`. This is a post-merge manual check; it cannot be tested from within the test suite itself.

**AC4** — HTML report shows an attached screenshot for each test.
- Download the `playwright-report` artifact from a CI run, open `index.html` in a browser, and confirm each test result row shows a screenshot thumbnail.
- Alternatively, open `playwright-report/index.html` locally after `npm run test:e2e`.

---

### Risks and rollback

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `screenshot: 'on'` increases test-result directory size significantly in CI | Low (smoke suite is tiny) | Monitor artifact size; switch to `'only-on-failure'` if storage becomes a concern |
| YAML indentation error in `ci.yml` breaks CI entirely | Low | Keep the two new steps at the same 6-space indent as existing steps; validate with `yamllint` or GitHub's YAML linter |
| Playwright writes `playwright-report/` only when `reporter: [['html']]` is set | Resolved | Made explicit in the config change above; Playwright's default is html but explicit is safer |
| `test-results/` directory may not exist if all tests pass and Playwright prunes it | Low | `actions/upload-artifact@v4` with `if-no-files-found: warn` (default) will warn but not fail the job |

**Rollback:** revert the two config files to their pre-change state. No database migrations, no deployed assets, no secrets involved — rollback is a single-commit revert.
