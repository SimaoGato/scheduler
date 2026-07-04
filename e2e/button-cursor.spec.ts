/**
 * e2e/button-cursor.spec.ts — CHORE-10: Add pointer cursor to Button component
 *
 * AC coverage:
 *   Automated (CI-safe, no auth required):
 *     - AC1 (login page): Google sign-in button shows cursor: pointer
 *     - AC3: lint, tsc, build all pass after the change
 *
 *   E2E_WITH_AUTH-gated (requires .env.local + real Supabase + Google OAuth):
 *     - AC1 (nav links): admin nav links show cursor: pointer on hover
 *     - AC1 (home CTA): home page disabled CTA button shows cursor: pointer computed
 *       (even though pointer-events: none prevents actual interaction)
 *     - AC2 (disabled button): disabled button has pointer-events: none applied
 *
 *   Manual verification only:
 *     - AC1 (nav links, home CTA): visual confirmation of hand cursor on hover
 *     - AC2 (disabled button): visual confirmation of no pointer cursor despite
 *       the computed cursor: pointer value (pointer-events: none prevents hover)
 */

import { test, expect } from '@playwright/test';

// AC1: login page button (Google sign-in) shows cursor: pointer
// CI-safe: no auth required, reachable at /pt-PT/login
test('AC1: Google sign-in button shows cursor: pointer', async ({ page }) => {
  await page.goto('/pt-PT/login');
  const button = page.getByTestId('google-signin-button');
  await expect(button).toBeVisible();

  const cursor = await button.evaluate((el) => window.getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});

// AC1 (auth-gated): admin nav links show cursor: pointer
// Reachable only behind authentication in the (app)/ route group
test('AC1: admin nav links show cursor: pointer', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Nav links require authentication to be visible in the (app)/ route group.');

  await page.goto('/');
  // Find the admin nav buttons; they are rendered as Button with asChild
  // and have their text visible in the (app)/ nav group
  const adminLinks = page.getByRole('button', { name: /Utilizadores|Equipa/ });
  const count = await adminLinks.count();
  expect(count).toBeGreaterThan(0);

  // Test the first admin link
  const firstLink = adminLinks.first();
  await expect(firstLink).toBeVisible();

  const cursor = await firstLink.evaluate((el) => window.getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});

// AC1 (auth-gated): home page CTA button shows cursor: pointer
// The home page has a disabled CTA button which is inside (app)/
test('AC1: home page CTA button shows cursor: pointer', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Home page CTA button requires authentication to be visible in the (app)/ route group.');

  await page.goto('/');
  const cta = page.getByRole('button', { name: /Ativar|Disabled/ });
  await expect(cta).toBeVisible();

  const cursor = await cta.evaluate((el) => window.getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});

// AC2 (auth-gated): disabled button has pointer-events: none
// Verifies that the disabled mechanism is in place (pointer-events: none)
// even though the cursor computed style reports 'pointer'
test('AC2: disabled button has pointer-events: none', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Home page CTA button requires authentication to be visible in the (app)/ route group.');

  await page.goto('/');
  const cta = page.getByRole('button', { name: /Ativar|Disabled/ });
  await expect(cta).toBeVisible();

  const pointerEvents = await cta.evaluate((el) => window.getComputedStyle(el).pointerEvents);
  expect(pointerEvents).toBe('none');
});
