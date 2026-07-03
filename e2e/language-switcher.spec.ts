/**
 * e2e/language-switcher.spec.ts — CHORE-06: Add English locale and language
 * switcher.
 *
 * AC coverage:
 *   CI-safe:
 *     - AC1: /pt-PT/login renders all-Portuguese text (regression guard).
 *     - AC2: /en/login renders all-English text; app name stays "Escala".
 *     - AC6 (unauth half): unauthenticated GET / with an en-US browser
 *       locale still redirects to /pt-PT/login (proxy.ts's hardcoded
 *       redirect, independent of next-intl's locale negotiation).
 *
 *   E2E_WITH_AUTH-gated (requires .env.local + real Supabase + Google OAuth):
 *     - AC3: language switcher visible on /pt-PT/settings, shows current
 *       locale ("PT") and the link to the other locale ("EN").
 *     - AC4: clicking the switcher on /pt-PT/settings navigates to
 *       /en/settings via client-side (soft) navigation, English text shown.
 *     - AC5: clicking the switcher on /en/settings navigates back to
 *       /pt-PT/settings (same path, other locale).
 *     - AC6 (auth half): authenticated GET / with an en-US browser locale
 *       still lands on /pt-PT/ (exercises intlMiddleware's negotiation path,
 *       which the CI-safe test above does not, since proxy.ts's guard
 *       intercepts unauthenticated requests before intlMiddleware runs).
 *
 *   AC7 (lint/tsc/build): no dedicated test; verified via Definition of Done.
 */

import { test, expect } from '@playwright/test';

// AC1: pt-PT unaffected (regression guard).
test('AC1: /pt-PT/login renders Portuguese text', async ({ page }) => {
  await page.goto('/pt-PT/login');
  await expect(page.getByTestId('google-signin-button')).toHaveText('Continuar com Google');
});

// AC2: /en/* renders English text; brand name stays untranslated.
test('AC2: /en/login renders English text and keeps the "Escala" brand name', async ({ page }) => {
  await page.goto('/en/login');
  await expect(page.getByTestId('google-signin-button')).toHaveText('Continue with Google');
  await expect(page.getByTestId('login-app-name')).toHaveText('Escala');
});

// AC6 (unauth half): en-US browser locale does not change the redirect
// target for unauthenticated visitors — proxy.ts's guard hardcodes
// routing.defaultLocale independently of next-intl's negotiation.
test('AC6: unauthenticated GET / with en-US locale still redirects to /pt-PT/login', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/pt-PT\/login\/?$/);
  await context.close();
});

// AC3: switcher visible on settings, shows current locale + the other locale.
test('AC3: language switcher is visible on /pt-PT/settings and shows PT/EN', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await page.goto('/pt-PT/settings');
  const current = page.getByTestId('language-switcher-current');
  await expect(current).toBeVisible();
  await expect(current).toHaveText('PT');

  const link = page.getByTestId('language-switcher-link');
  await expect(link).toBeVisible();
  await expect(link).toHaveText('EN');
});

// AC4: clicking the switcher on /pt-PT/settings navigates to /en/settings
// without a full page reload.
test('AC4: clicking the switcher on /pt-PT/settings navigates to /en/settings', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await page.goto('/pt-PT/settings');

  // Marker to prove this is a soft (client-side) navigation, not a full
  // reload — a full navigation would reset window state.
  await page.evaluate(() => {
    (window as unknown as { __marker: string }).__marker = 'still-here';
  });

  await page.getByTestId('language-switcher-link').click();

  await expect(page).toHaveURL(/\/en\/settings\/?$/);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const marker = await page.evaluate(() => (window as unknown as { __marker?: string }).__marker);
  expect(marker).toBe('still-here');
});

// AC5: clicking the switcher on /en/settings navigates back to
// /pt-PT/settings (same path, other locale).
test('AC5: clicking the switcher on /en/settings navigates to /pt-PT/settings', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await page.goto('/en/settings');
  await page.getByTestId('language-switcher-link').click();
  await expect(page).toHaveURL(/\/pt-PT\/settings\/?$/);
});

// AC6 (auth half): authenticated visitor with en-US browser locale still
// lands on /pt-PT/ — exercises intlMiddleware's negotiation path directly.
test('AC6: authenticated GET / with en-US locale still lands on /pt-PT/', async ({ browser }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Requires an authenticated session.');
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/pt-PT\/?$/);
  await context.close();
});
