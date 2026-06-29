/**
 * e2e/user-management.spec.ts — STORY-05: Admin user management
 *
 * AC coverage (automated, CI-safe with placeholder Supabase credentials):
 *   AC5 — Members/unauthenticated users denied access to:
 *     - GET  /api/admin/users  → 401
 *     - PATCH /api/admin/users/:id → 401
 *     - GET  /pt-PT/admin/users → redirect to login
 *
 * ACs 1-4 require a real authenticated admin session and are covered by
 * manual verification steps documented in the story file.
 */

import { test, expect } from '@playwright/test';

test('AC5-api-list: GET /api/admin/users unauthenticated → 401', async ({ request }) => {
  const response = await request.get('/api/admin/users');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-api-patch: PATCH /api/admin/users/some-id unauthenticated → 401', async ({ request }) => {
  const response = await request.patch('/api/admin/users/some-id', {
    data: { role: 'member' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-page: GET /pt-PT/admin/users unauthenticated → redirected to login', async ({ page }) => {
  await page.goto('/pt-PT/admin/users');
  // proxy.ts redirects unauthenticated users to /pt-PT/login
  // Playwright follows redirects automatically; final URL must be the login page
  expect(page.url()).toContain('/login');
});
