import { defineConfig } from '@playwright/test';

// CHORE-05: local Supabase integration tests. Separate config/testDir from
// playwright.config.ts so the existing placeholder-credential smoke suite
// (npm run test:e2e) is untouched — these tests require a real local
// Supabase instance with migrations applied and seeded test users (see
// supabase/seed-test-users.mjs and the `integration-test` CI job).
export default defineConfig({
  testDir: './e2e-integration',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Distinct artifact locations from the lint-build-test job's
  // playwright-report/test-results — GitHub Actions artifact names are
  // unique per workflow run, not per job, so a second `playwright-report`
  // artifact name in the same run would collide.
  reporter: [['html', { outputFolder: 'playwright-report-integration' }], ['list']],
  outputDir: 'test-results-integration',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    // The integration-test CI job builds the app itself (its own `npm run
    // build`, pointed at local Supabase env vars) then reuses that build via
    // `npm start`, same pattern as playwright.config.ts.
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
