# ADR-002: Playwright Screenshot Capture and CI Artifact Upload

**Date:** 2026-06-28  
**Status:** accepted  
**Deciders:** Simão, Agent  

## Context

The test suite needs to produce visual evidence during CI runs so that agents (qa-verifier, /verify) and reviewers can see what the UI looks like without running the app locally. Screenshots must be captured during test runs and persisted as GitHub Actions artifacts for post-run inspection.

## Decision

### 1. Multi-Reporter Pattern
Configure Playwright with two reporters: `html` and `list`.

```typescript
reporter: [['html'], ['list']]
```

- **html**: Generates a detailed interactive report with all test results, timelines, and screenshots attached to each test.
- **list**: Preserves console output and test names in CI logs for quick debugging without downloading artifacts.

Using both reporters provides full traceability: the HTML report for visual inspection and the list output for fast CI log scanning.

### 2. Screenshot Capture Configuration
Enable screenshot capture on all test runs:

```typescript
use: {
  screenshot: 'on'
}
```

Screenshots are saved to `test-results/` on disk. The `html` reporter automatically embeds them in the generated report at `playwright-report/`.

### 3. Artifact Upload with Deterministic-Output Gating
Use `actions/upload-artifact@v4` with `if-no-files-found: error` for directories known to always exist:

```yaml
- name: Upload Playwright report
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
    if-no-files-found: error
```

- `if-no-files-found: error` creates a real CI gate: if `playwright-report/` doesn't exist, the job fails. This catches silent misconfigurations.
- `if: always()` at the **step level** (same indent as `uses:`) ensures artifacts upload even when tests fail, enabling failure diagnosis.
- `test-results/` also uses `error` because `screenshot: 'on'` guarantees it will be written.

## Rationale

**Multi-reporter:** A single reporter (e.g. `html` only) is silent in CI logs. Developers and agents checking the CI run must download the artifact to see any output. The `list` reporter provides immediate feedback without downloading, reducing friction.

**`if-no-files-found: error`:** These directories are deterministic—they always exist when the config is correct. Using `error` prevents misconfiguration from going unnoticed. Reserve `warn` for truly optional outputs.

**`if: always()` placement:** GitHub Actions requires `if:` at the step level for conditional step execution. Placing it at the job level does not apply to individual steps and is ignored. Step-level placement is the correct pattern.

## Consequences

- CI artifacts always include both raw screenshots (`test-results/`) and an interactive report (`playwright-report/`). This allows agents to read individual PNGs directly or open the full report in a browser.
- If Playwright configuration is broken (e.g. reporter not set, screenshot not enabled), the job explicitly fails during artifact upload, preventing silent data loss.
- CI logs show immediate test results even without downloading artifacts, improving developer experience.
- Screenshot storage is subject to the 30-day GitHub Actions retention window. If historical screenshots are needed longer, configure branch-specific retention or migrate to external storage (out of scope for this ADR).

## Alternatives Considered

1. **Single reporter only (`html`)**: Silent in CI logs; developers must download artifact. Rejected because it reduces visibility.
2. **`if-no-files-found: warn`**: Would allow CI to pass even if outputs are missing, hiding configuration errors. `error` is safer for deterministic outputs.
3. **`if: always()` at job level**: Does not work; GitHub Actions only supports conditional step execution at the step level.
4. **Screenshot capture `'only-on-failure'`**: Would reduce storage but agents cannot capture screenshots of passing tests. `'on'` is preferred for full visibility.

## Related

- CHORE-02: Configure Playwright screenshot capture and CI artifact upload
- Next iteration: monitor artifact size; switch to `'only-on-failure'` if storage becomes a concern
