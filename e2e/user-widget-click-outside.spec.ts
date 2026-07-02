/**
 * e2e/user-widget-click-outside.spec.ts — STORY-13
 *
 * AC coverage:
 *
 *  All 5 ACs require an authenticated session (UserWidget only renders for
 *  authenticated users, inside the (app)/ route group). Unauthenticated CI
 *  runs are always redirected to /pt-PT/login, which has no header, so these
 *  tests are gated on E2E_WITH_AUTH and skipped in CI. Each AC is documented
 *  as a manual verification step below to satisfy the Definition of Done's
 *  AC-coverage requirement.
 *
 *  Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC1 — Outside click closes the menu:
 *    1. Log in. Open the identity widget (click data-testid="user-widget-trigger").
 *    2. Confirm data-testid="user-widget-menu" is visible.
 *    3. Click somewhere outside the widget (header background, page body, or
 *       another nav link such as "Início").
 *    4. Confirm data-testid="user-widget-menu" is no longer visible.
 *
 *  AC2 — Trigger click still closes the menu (regression):
 *    1. Open the identity widget.
 *    2. Click data-testid="user-widget-trigger" again.
 *    3. Confirm data-testid="user-widget-menu" is no longer visible.
 *
 *  AC3 — Trigger click still opens the menu (regression):
 *    1. With the menu closed, click data-testid="user-widget-trigger".
 *    2. Confirm data-testid="user-widget-menu" becomes visible.
 *
 *  AC4 — No horizontal overflow at 375 px with menu open:
 *    1. Log in. Set browser to 375 px wide (DevTools device mode).
 *    2. Open the identity widget.
 *    3. Confirm no horizontal scrollbar;
 *       document.documentElement.scrollWidth <= 375.
 *
 *  AC5 — Escape closes the menu:
 *    1. Open the identity widget.
 *    2. Press Escape.
 *    3. Confirm data-testid="user-widget-menu" is no longer visible.
 */

import { test, expect } from '@playwright/test';

// AC1: Clicking outside the open menu (including another nav link) closes it.
test('AC1: clicking outside the open menu closes it', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByTestId('user-widget-menu');
  await expect(menu).toBeVisible();

  // Click on the header background (outside the widget).
  await page.locator('header').click({ position: { x: 10, y: 10 } });
  await expect(menu).not.toBeVisible();
});

// AC1 (nav link case): Clicking another nav link ("Início", a safe no-op
// navigation since we're already on /) closes the menu. AppHeader/UserWidget
// live in a persistent layout, so this won't falsely pass due to unmounting.
test('AC1: clicking another nav link closes the open menu', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByTestId('user-widget-menu');
  await expect(menu).toBeVisible();

  await page.getByRole('link', { name: 'Início' }).click();
  await expect(menu).not.toBeVisible();
});

// AC2: Clicking the trigger again still closes the menu (regression).
test('AC2: clicking the trigger again still closes the menu', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByTestId('user-widget-menu');
  await expect(menu).toBeVisible();

  await trigger.click();
  await expect(menu).not.toBeVisible();
});

// AC3: Clicking the trigger while closed still opens the menu (regression).
test('AC3: clicking the trigger while closed still opens the menu', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  const menu = page.getByTestId('user-widget-menu');
  await expect(menu).not.toBeVisible();

  await trigger.click();
  await expect(menu).toBeVisible();
});

// AC4: No horizontal overflow at 375 px viewport width with the menu open
// (worst case, not covered by STORY-12's closed-state 375px checks).
test('AC4: no horizontal overflow at 375 px viewport width with menu open', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('user-widget-menu')).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

// AC5: Pressing Escape closes the open menu, and returns focus to the trigger.
test('AC5: pressing Escape closes the open menu', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.getByTestId('user-widget-menu');
  await expect(menu).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
