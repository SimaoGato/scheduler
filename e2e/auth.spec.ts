/**
 * e2e/auth.spec.ts — Auth flow tests for STORY-02
 *
 * AC coverage:
 *   AC1 (automated): unauthenticated redirect + login page render
 *   AC2 (manual): see steps below
 *   AC3 (manual): see steps below
 *   AC4 (manual): see steps below
 *   AC5 (automated): error notice display
 *
 * Manual verification steps for AC2, AC3, AC4
 * (requires real Supabase project with Google provider and a filled-in .env.local):
 *
 * 1. Start `npm run dev`. Open http://localhost:3000. Confirm redirect to /pt-PT/login.
 * 2. Click "Continuar com Google". Complete the Google OAuth flow.
 * 3. Confirm return to http://localhost:3000/pt-PT/ showing the home page with the
 *    user's name in the header. (AC2)
 * 4. Reload the page. Confirm still authenticated (no redirect to login). (AC3)
 * 5. Click "Sair". Confirm redirect to /pt-PT/login with no session.
 * 6. Manually navigate to http://localhost:3000/pt-PT/. Confirm redirect to login.
 *    (AC4)
 */

import { test, expect } from '@playwright/test';

// AC1: unauthenticated visit to /pt-PT/ redirects to /pt-PT/login and shows button
test('AC1: unauthenticated visit to /pt-PT/ redirects to login page', async ({ page }) => {
  await page.goto('/pt-PT/');
  await expect(page).toHaveURL(/\/pt-PT\/login/);
  const button = page.getByRole('button', { name: 'Continuar com Google' });
  await expect(button).toBeVisible();
});

// AC1: login page renders without error message by default
test('AC1: login page renders without error message by default', async ({ page }) => {
  await page.goto('/pt-PT/login');
  await expect(page.locator('main')).toBeVisible();
  const button = page.getByRole('button', { name: 'Continuar com Google' });
  await expect(button).toBeVisible();
  // No error notice should be visible.
  // Use data-testid to avoid matching Next.js's __next-route-announcer__ (role="alert").
  await expect(page.locator('[data-testid="auth-error"]')).toHaveCount(0);
});

// AC5: access_denied error shows pt-PT cancellation notice
test('AC5: /pt-PT/login?error=access_denied shows cancellation notice', async ({ page }) => {
  await page.goto('/pt-PT/login?error=access_denied');
  await expect(page.locator('main')).toBeVisible();
  // Use data-testid to avoid strict-mode violation from Next.js's __next-route-announcer__
  const alert = page.locator('[data-testid="auth-error"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Início de sessão cancelado.');
});

// AC5: exchange_failed error shows pt-PT generic error notice
test('AC5: /pt-PT/login?error=exchange_failed shows exchange error notice', async ({ page }) => {
  await page.goto('/pt-PT/login?error=exchange_failed');
  await expect(page.locator('main')).toBeVisible();
  // Use data-testid to avoid strict-mode violation from Next.js's __next-route-announcer__
  const alert = page.locator('[data-testid="auth-error"]');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(
    'Não foi possível completar o início de sessão. Tente novamente.'
  );
});
