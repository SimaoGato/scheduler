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
  // Wait for the page to be loaded before calling boundingBox() (CLAUDE.md: visibility guard required)
  await expect(page.getByTestId('login-centering-root')).toBeVisible();
  // Measure <main> which is constrained to max-w-sm (384 px) — a reliable centering signal.
  // login-centering-root is min-h-screen and always fills the full viewport (x=0,y=0,w=1280,h=720),
  // so its centre is always viewport centre regardless of CSS — measuring it would be tautological.
  const mainBox = await page.locator('main').boundingBox();
  const viewportWidth = 1280;
  const viewportHeight = 720;
  // Horizontal centre of <main> must be within ±10 px of viewport centre
  const centerX = mainBox!.x + mainBox!.width / 2;
  expect(Math.abs(centerX - viewportWidth / 2)).toBeLessThan(10);
  // Vertical centre of <main> is offset from viewport centre because the app-name span sits
  // above it inside the flex-col container — ±120 px tolerance covers this layout.
  const centerY = mainBox!.y + mainBox!.height / 2;
  expect(Math.abs(centerY - viewportHeight / 2)).toBeLessThan(120);
});
