// AC4 (manual): Sign in via Google OAuth, then visit /pt-PT/login.
// Confirm immediate redirect to /pt-PT/ without seeing the login form
// (identical to login-redirect.spec.ts AC1).

import { test, expect } from '@playwright/test';

test('AC1: AppHeader is not rendered on the login page', async ({ page }) => {
  await page.goto('/pt-PT/login');
  await expect(page.locator('main')).toBeVisible();
  // No <header> element — login layout does not include AppHeader
  await expect(page.locator('header')).toHaveCount(0);
  // Sign-out button absent (it lives inside AppHeader)
  await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0);
});

test('AC2: app name is visible on the login page', async ({ page }) => {
  await page.goto('/pt-PT/login');
  const appName = page.getByTestId('login-app-name');
  await expect(appName).toBeVisible();
  await expect(appName).toContainText('Escala');
});

test('AC3: sign-in form is horizontally and vertically centered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/pt-PT/login');
  // Measure the centering container (W1 fix: use login-centering-root, not main)
  const root = page.getByTestId('login-centering-root');
  await expect(root).toBeVisible();
  const box = await root.boundingBox();
  const viewportWidth = 1280;
  const viewportHeight = 720;
  // Center of the centering root must be within ±10 px of viewport center
  const centerX = box!.x + box!.width / 2;
  expect(Math.abs(centerX - viewportWidth / 2)).toBeLessThan(10);
  const centerY = box!.y + box!.height / 2;
  expect(Math.abs(centerY - viewportHeight / 2)).toBeLessThan(10);
});
