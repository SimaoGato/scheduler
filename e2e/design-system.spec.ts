import { test, expect } from '@playwright/test';

// AC1: a <button> rendered by the shadcn Button component is present on the login page
test('design-system AC1: shadcn Button is rendered on the home page', async ({ page }) => {
  // Unauthenticated requests are redirected to /pt-PT/login where a shadcn Button renders.
  await page.goto('/pt-PT/login');
  // Use getByRole for a specific, future-proof locator that won't collide with
  // other buttons added in later stories.
  const cta = page.getByRole('button', { name: 'Continuar com Google' });
  await expect(cta).toBeVisible();
});

// AC1: navigation uses library component (rendered as <a> inside the nav)
test('design-system AC1: nav contains anchor links (asChild renders button as <a>)', async ({ page }) => {
  await page.goto('/');
  const navLink = page.locator('nav a').first();
  await expect(navLink).toBeVisible();
  // When Button asChild is working, the nav renders <a> directly — not <button><a>
  const invalidNesting = page.locator('nav button a');
  await expect(invalidNesting).toHaveCount(0);
});

// AC5: nav tap targets are at least 44 px tall on mobile
test('design-system AC5: nav tap targets meet 44 px minimum at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const navLink = page.locator('nav a').first();
  await expect(navLink).toBeVisible();
  const box = await navLink.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

// Note: the no-horizontal-overflow assertion at 375 px is already covered by
// e2e/smoke.spec.ts ("responsive shell: no horizontal overflow at mobile width").
// Do not duplicate it here to avoid double-failure noise in CI.
