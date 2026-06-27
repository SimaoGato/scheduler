import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    // In CI the `npm run build` step has already run and .next/ exists;
    // use `npm start` here to reuse the artifact. Locally, `reuseExistingServer: true`
    // lets you run `npm run dev` separately and Playwright reuses that process.
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
