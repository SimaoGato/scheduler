import { test, expect } from '@playwright/test';

test('home route returns HTTP 200', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
});

test('responsive shell: header, nav and main content area present at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
});

test('responsive shell: no horizontal overflow at mobile width (375 px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

test('app name rendered from i18n catalog', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header')).toContainText('Escala');
  await expect(page.locator('main')).toContainText('Bem-vindo');
  await expect(page.locator('nav')).toContainText('Início');
});
