/**
 * e2e/user-management.spec.ts — STORY-05: Admin user management
 *                                STORY-08: Block admin self-demotion
 *
 * AC coverage (automated, CI-safe with placeholder Supabase credentials):
 *   AC5 (STORY-05) — Members/unauthenticated users denied access to:
 *     - GET  /api/admin/users  → 401
 *     - PATCH /api/admin/users/:id → 401
 *     - GET  /pt-PT/admin/users → redirect to login
 *
 * ACs 1-4 (STORY-05) require a real authenticated admin session and are
 * covered by manual verification steps documented in the story file.
 *
 * STORY-08 (E2E_WITH_AUTH-gated, require a real authenticated admin session):
 *   AC1 — own row hides the promote/demote button.
 *   AC2 — PATCH own id with role: 'member' → 400 { error: 'self_demotion' },
 *         regardless of admin count.
 *   AC3 — PATCH own id with role: 'admin' (no-op) → 200.
 *
 * Manual verification (requires .env.local + real Supabase + Google OAuth),
 * in case a reviewer doesn't run E2E_WITH_AUTH locally:
 *
 *  STORY-08 AC1 — own row hides the action button:
 *    1. Log in as an Admin.
 *    2. Open /pt-PT/admin/users.
 *    3. Locate the row matching your own name/email in the table.
 *    4. Confirm the actions column for that row is empty (no "Rebaixar a
 *       Membro" / "Promover a Administrador" button), while other rows
 *       still show their action button.
 *
 *  STORY-08 AC2 — self-demote is blocked with 400, regardless of admin count:
 *    1. Log in as an Admin. Note your own user id (via GET /api/admin/users,
 *       cross-referencing your email/display name).
 *    2. Open DevTools console and run:
 *       fetch('/api/admin/users/<your-own-id>', {
 *         method: 'PATCH',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ role: 'member' }),
 *       }).then(r => r.json()).then(console.log)
 *    3. Confirm the response is `{ error: 'self_demotion' }` and the request
 *       resolves with HTTP status 400 (check the Network tab).
 *    4. Repeat with only one Admin remaining in the DB (or reason about it):
 *       confirm the response is still 400 self_demotion, not 409 last_admin.
 *
 *  STORY-08 AC3 — self-promote (no-op) succeeds:
 *    1. While logged in as an Admin, run the same fetch as above but with
 *       `role: 'admin'` in the body.
 *    2. Confirm the request resolves with HTTP status 200 and your role is
 *       unchanged (still Administrador after reload).
 */

import { test, expect, type Page } from '@playwright/test';

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

// ---------------------------------------------------------------------------
// STORY-08 (E2E_WITH_AUTH-gated): self-demotion guard
// ---------------------------------------------------------------------------

type AdminUserRow = { id: string; email: string; display_name: string | null };

/**
 * Resolve the logged-in user's own row from GET /api/admin/users.
 *
 * Primary match: display_name against the header widget's [data-testid="user-identity"]
 * text (populated from public.users.display_name via the OAuth-provisioning
 * fallback chain — STORY-21 — so it should match the table's display_name
 * column for a real logged-in account in almost all dev environments).
 *
 * Fallback match: if no display_name match is found (e.g. display_name was
 * cleared and the header falls back to showing a Google name/email that
 * differs from the DB column), match by email instead, using the
 * E2E_ADMIN_EMAIL env var (set to the developer's known admin login email
 * in .env.local when running E2E_WITH_AUTH=1 locally).
 *
 * Does not hand-decode the Supabase session cookie/JWT — only uses fields
 * already returned by GET /api/admin/users, per this repo's convention of
 * not hand-rolling @supabase/ssr's cookie encoding in tests.
 */
async function findSelf(page: Page): Promise<AdminUserRow> {
  const identityText = (await page.locator('[data-testid="user-identity"]').textContent())?.trim();
  expect(identityText).toBeTruthy();

  const listResponse = await page.request.get('/api/admin/users');
  expect(listResponse.status()).toBe(200);
  const users = (await listResponse.json()) as AdminUserRow[];

  let self = users.find((u) => u.display_name === identityText);

  if (!self && process.env.E2E_ADMIN_EMAIL) {
    self = users.find((u) => u.email === process.env.E2E_ADMIN_EMAIL);
  }

  expect(self, 'Could not resolve own user row by display_name or E2E_ADMIN_EMAIL fallback').toBeTruthy();
  return self!;
}

test('STORY-08 AC1: own row hides the promote/demote button', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in file header.');
  await page.goto('/pt-PT/admin/users');
  const self = await findSelf(page);

  const ownRow = page.locator('tbody tr', { hasText: self.email });
  await expect(ownRow).toHaveCount(1);
  await expect(
    ownRow.locator('[data-testid^="um-promote-"], [data-testid^="um-demote-"]')
  ).toHaveCount(0);
});

test('STORY-08 AC2: PATCH own id with role member → 400 self_demotion', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Requires an authenticated admin session; see manual steps in file header.');
  await page.goto('/pt-PT/admin/users');
  const self = await findSelf(page);

  const response = await page.request.patch(`/api/admin/users/${self.id}`, {
    data: { role: 'member' },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toBe('self_demotion');
});

test('STORY-08 AC3: PATCH own id with role admin (no-op) → 200', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Requires an authenticated admin session; see manual steps in file header.');
  await page.goto('/pt-PT/admin/users');
  const self = await findSelf(page);

  const response = await page.request.patch(`/api/admin/users/${self.id}`, {
    data: { role: 'admin' },
  });
  expect(response.status()).toBe(200);
});
