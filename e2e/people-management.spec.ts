/**
 * e2e/people-management.spec.ts — STORY-07: Admin creates person records
 *
 * AC coverage (automated, CI-safe with placeholder Supabase credentials):
 *   AC1 — POST /api/admin/people unauthenticated → 401 (auth gate for create)
 *   AC2 — PATCH /api/admin/people/:id unauthenticated → 401 (auth gate for edit)
 *   AC3 — DELETE /api/admin/people/:id unauthenticated → 401 (auth gate for remove)
 *   AC4 — TypeScript compile: PersonRow.linked_user_id: string | null (structural)
 *   AC5 — No unique constraint on name (structural, migration)
 *   page guard — GET /pt-PT/admin/people unauthenticated → redirect to login
 *   list guard — GET /api/admin/people unauthenticated → 401
 *
 * ACs 1-5 full-flow tests require a real authenticated admin session and are
 * covered by manual verification steps documented in the story file.
 *
 * Review findings fixed (require authenticated session to test in e2e):
 *   BW1 — POST /api/admin/people with invalid JSON body → 400 (not 500).
 *          PATCH /api/admin/people/:id with invalid JSON body → 400 (not 500).
 *          Auth guard fires first for unauthenticated requests so CI sees 401.
 *   BW2 — PATCH /api/admin/people/:uuid with non-UUID id → 400 (not 500).
 *          DELETE /api/admin/people/:uuid with non-UUID id → 400 (not 500).
 *          Auth guard fires first for unauthenticated requests so CI sees 401.
 *   BW3 — PATCH selects only 'id' column (structural, no observable response change).
 *   FW1 — Supabase error logged in AdminPeoplePage (structural, logging only).
 *   FW2 — Add-person input has aria-label="Adicionar pessoa" (WCAG SC 1.3.1).
 *   FW3 — New person inserted in alphabetical (pt) sort order after POST response.
 */

import { test, expect } from '@playwright/test';

test('AC1-api-post: POST /api/admin/people unauthenticated → 401', async ({ request }) => {
  const response = await request.post('/api/admin/people', {
    data: { name: 'Test Person' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC2-api-patch: PATCH /api/admin/people/some-id unauthenticated → 401', async ({ request }) => {
  const response = await request.patch('/api/admin/people/some-id', {
    data: { name: 'Updated Name' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC3-api-delete: DELETE /api/admin/people/some-id unauthenticated → 401', async ({ request }) => {
  const response = await request.delete('/api/admin/people/some-id');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('list-guard: GET /api/admin/people unauthenticated → 401', async ({ request }) => {
  const response = await request.get('/api/admin/people');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('page-guard: GET /pt-PT/admin/people unauthenticated → redirected to login', async ({ page }) => {
  await page.goto('/pt-PT/admin/people');
  // proxy.ts redirects unauthenticated users to /pt-PT/login
  // Playwright follows redirects automatically; final URL must be the login page
  expect(page.url()).toContain('/login');
});
