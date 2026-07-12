/**
 * e2e/admin-availability.spec.ts — STORY-27: Admin views and edits anyone's
 * blocked dates.
 *
 * CI-safe tests (no real Supabase session required) — unauthenticated
 * requests to the admin availability routes/page must be rejected, never
 * 500. Mirrors e2e/person-skills.spec.ts's AC7-api-get / AC7-page-guard
 * tests: a cheap duplicate of the auth-guard behavior so this coverage survives
 * even if the `integration-test` CI job (which has the real, auth-gated
 * AC1-AC7 coverage in e2e-integration/admin-availability.spec.ts) is ever
 * skipped.
 */

import { test, expect } from '@playwright/test';

test('AC5-api-get: GET /api/admin/people/some-id/availability unauthenticated → 401', async ({ request }) => {
  const response = await request.get('/api/admin/people/some-id/availability');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-api-post: POST /api/admin/people/some-id/availability unauthenticated → 401', async ({ request }) => {
  const response = await request.post('/api/admin/people/some-id/availability', {
    data: { date: '2026-08-02' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-api-delete: DELETE /api/admin/people/some-id/availability/2026-08-02 unauthenticated → 401', async ({ request }) => {
  const response = await request.delete('/api/admin/people/some-id/availability/2026-08-02');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-page-guard: GET /pt-PT/admin/people/some-id/availability unauthenticated → redirected to login', async ({ page }) => {
  await page.goto('/pt-PT/admin/people/some-id/availability');
  // proxy.ts redirects unauthenticated users to /pt-PT/login
  expect(page.url()).toContain('/login');
});
