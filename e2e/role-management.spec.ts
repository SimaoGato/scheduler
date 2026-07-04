/**
 * e2e/role-management.spec.ts — STORY-17: Manage roles (create / rename /
 * remove) with default slots per Sunday
 *
 * AC coverage:
 *   AC1 — create a role with name + slots; appears in the list showing both.
 *   AC2 — omitted slot count defaults to 1.
 *   AC3 — non-positive-integer slot count rejected on create AND edit, 400,
 *         no row written/changed (explicit re-GET assertions).
 *   AC4 — edit name/slots saved and reflected in the list.
 *   AC5 — remove a not-in-use role; row disappears from the list.
 *   AC6 — non-admin/unauthenticated blocked (page + API). The Member-role
 *         403 case requires a real Member session, which this environment
 *         cannot provide — see the manual verification step below.
 *   AC7 — case-insensitive duplicate name rejected with 409.
 *
 * CI-safe tests (no real Supabase session) run unconditionally below. The
 * E2E_WITH_AUTH-gated tests further down require .env.local + a real
 * Supabase admin session and are skipped in CI (see auth-gated test pattern
 * in CLAUDE.md and e2e/people-table-alignment.spec.ts).
 *
 * Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC6 — Member role is blocked from the roles API:
 *    1. Log in as a Member (role = 'member' in public.users).
 *    2. Open DevTools console and run:
 *       fetch('/api/admin/roles').then(r => console.log(r.status))
 *    3. Confirm the logged status is 403.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// CI-safe: auth-gate tests (no real Supabase session required)
// ---------------------------------------------------------------------------

test('AC6-api-get: GET /api/admin/roles unauthenticated → 401', async ({ request }) => {
  const response = await request.get('/api/admin/roles');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC6-api-post: POST /api/admin/roles unauthenticated → 401', async ({ request }) => {
  const response = await request.post('/api/admin/roles', {
    data: { name: 'Som', default_slots: 1 },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC6-api-patch: PATCH /api/admin/roles/some-id unauthenticated → 401', async ({ request }) => {
  const response = await request.patch('/api/admin/roles/some-id', {
    data: { name: 'Som', default_slots: 2 },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC6-api-delete: DELETE /api/admin/roles/some-id unauthenticated → 401', async ({ request }) => {
  const response = await request.delete('/api/admin/roles/some-id');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC6-page-guard: GET /pt-PT/admin/roles unauthenticated → redirected to login', async ({ page }) => {
  await page.goto('/pt-PT/admin/roles');
  // proxy.ts redirects unauthenticated users to /pt-PT/login
  expect(page.url()).toContain('/login');
});

// ---------------------------------------------------------------------------
// E2E_WITH_AUTH-gated: happy-path/validation tests (require a real admin
// session). Fixture lifecycle mirrors e2e/people-table-alignment.spec.ts:
// unique-per-worker fixture names + afterEach cleanup.
// ---------------------------------------------------------------------------

async function ensureRoleGone(page: Page, name: string): Promise<void> {
  await page.goto('/pt-PT/admin/roles');
  const row = page.locator('tr', { hasText: name });
  if ((await row.count()) === 0) return;

  const cancelButton = row.locator('[data-testid^="rm-cancel-"]');
  if ((await cancelButton.count()) > 0) {
    await cancelButton.click();
  }

  const removeButton = row.locator('[data-testid^="rm-remove-"]');
  if ((await removeButton.count()) > 0) {
    await removeButton.click();
    await expect(page.locator('tr', { hasText: name })).toHaveCount(0);
  }
}

test.describe('STORY-17: role management (auth-gated)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in file header.');

  let roleName: string;

  test.beforeEach(({}, testInfo) => {
    roleName = `STORY-17 QA Role (w${testInfo.workerIndex})`;
  });

  test.afterEach(async ({ page }) => {
    await ensureRoleGone(page, roleName);
    await ensureRoleGone(page, `${roleName} renamed`);
  });

  test('AC1: create a role with name + slots; appears in list showing both', async ({ page }) => {
    await page.goto('/pt-PT/admin/roles');
    await page.getByTestId('rm-add-input').fill(roleName);
    await page.getByTestId('rm-add-slots-input').fill('3');
    await page.getByTestId('rm-add-submit').click();

    const row = page.locator('tr', { hasText: roleName });
    await expect(row).toBeVisible();
    await expect(row).toContainText('3');
  });

  test('AC2: omitted default_slots in a direct POST defaults to 1', async ({ page }) => {
    await page.goto('/pt-PT/admin/roles');
    const response = await page.request.post('/api/admin/roles', {
      data: { name: roleName },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.default_slots).toBe(1);
  });

  test('AC3 (create): 0, -1, blank, "abc" slot values rejected with 400 and no row written', async ({ page }) => {
    await page.goto('/pt-PT/admin/roles');

    const beforeGet = await page.request.get('/api/admin/roles');
    const beforeRoles = (await beforeGet.json()) as Array<{ name: string }>;
    const beforeCount = beforeRoles.length;

    for (const badValue of [0, -1, 'abc']) {
      const response = await page.request.post('/api/admin/roles', {
        data: { name: roleName, default_slots: badValue },
      });
      expect(response.status()).toBe(400);
    }

    // Blank string case, sent as JSON string ''
    const blankResponse = await page.request.post('/api/admin/roles', {
      data: { name: roleName, default_slots: '' },
    });
    expect(blankResponse.status()).toBe(400);

    // No-write assertion: re-GET and confirm the role list is unchanged.
    const afterGet = await page.request.get('/api/admin/roles');
    const afterRoles = (await afterGet.json()) as Array<{ name: string }>;
    expect(afterRoles.length).toBe(beforeCount);
    expect(afterRoles.some((r) => r.name === roleName)).toBe(false);

    // Also exercise the UI path: clear the pre-filled slots field and submit.
    await page.getByTestId('rm-add-input').fill(roleName);
    await page.getByTestId('rm-add-slots-input').fill('');
    await page.getByTestId('rm-add-submit').click();
    await expect(page.getByTestId('rm-error')).toBeVisible();
    await expect(page.locator('tr', { hasText: roleName })).toHaveCount(0);
  });

  test('AC3 (edit/PATCH): 0, -1, blank, "abc" slot values rejected with 400 and row unchanged', async ({ page }) => {
    await page.goto('/pt-PT/admin/roles');
    const createResponse = await page.request.post('/api/admin/roles', {
      data: { name: roleName, default_slots: 2 },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();

    for (const badValue of [0, -1, 'abc', '']) {
      const response = await page.request.patch(`/api/admin/roles/${created.id}`, {
        data: { name: roleName, default_slots: badValue },
      });
      expect(response.status()).toBe(400);
    }

    // No-write assertion: re-GET and confirm the row is unchanged.
    const afterGet = await page.request.get('/api/admin/roles');
    const afterRoles = (await afterGet.json()) as Array<{ id: string; name: string; default_slots: number }>;
    const afterRow = afterRoles.find((r) => r.id === created.id);
    expect(afterRow).toBeTruthy();
    expect(afterRow!.name).toBe(roleName);
    expect(afterRow!.default_slots).toBe(2);

    // Also exercise the UI inline-edit path.
    await page.goto('/pt-PT/admin/roles');
    const row = page.locator('tr', { hasText: roleName });
    await row.locator('[data-testid^="rm-edit-"]').click();
    const slotsInput = row.locator('input').nth(1);
    await slotsInput.fill('');
    await row.locator('[data-testid^="rm-save-"]').click();
    await expect(page.getByTestId('rm-error')).toBeVisible();
  });

  test('AC4: edit an existing role name and slot count via inline edit', async ({ page }) => {
    await page.goto('/pt-PT/admin/roles');
    await page.getByTestId('rm-add-input').fill(roleName);
    await page.getByTestId('rm-add-slots-input').fill('1');
    await page.getByTestId('rm-add-submit').click();
    await expect(page.locator('tr', { hasText: roleName })).toBeVisible();

    const row = page.locator('tr', { hasText: roleName });
    await row.locator('[data-testid^="rm-edit-"]').click();
    const nameInput = row.locator('input').nth(0);
    const slotsInput = row.locator('input').nth(1);
    await nameInput.fill(`${roleName} renamed`);
    await slotsInput.fill('4');
    await row.locator('[data-testid^="rm-save-"]').click();

    const renamedRow = page.locator('tr', { hasText: `${roleName} renamed` });
    await expect(renamedRow).toBeVisible();
    await expect(renamedRow).toContainText('4');
  });

  test('AC5: remove a not-in-use role; row disappears from list', async ({ page }) => {
    await page.goto('/pt-PT/admin/roles');
    await page.getByTestId('rm-add-input').fill(roleName);
    await page.getByTestId('rm-add-slots-input').fill('1');
    await page.getByTestId('rm-add-submit').click();
    await expect(page.locator('tr', { hasText: roleName })).toBeVisible();

    const row = page.locator('tr', { hasText: roleName });
    await row.locator('[data-testid^="rm-remove-"]').click();
    await expect(page.locator('tr', { hasText: roleName })).toHaveCount(0);
  });

  test('AC7: case-insensitive duplicate name rejected with 409', async ({ page }) => {
    await page.goto('/pt-PT/admin/roles');
    const first = await page.request.post('/api/admin/roles', {
      data: { name: roleName, default_slots: 1 },
    });
    expect(first.status()).toBe(201);

    // Case-insensitive collision via UI.
    await page.reload();
    await page.getByTestId('rm-add-input').fill(roleName.toUpperCase());
    await page.getByTestId('rm-add-slots-input').fill('1');
    await page.getByTestId('rm-add-submit').click();
    await expect(page.getByTestId('rm-error')).toBeVisible();

    const rows = page.locator('tr', { hasText: roleName });
    await expect(rows).toHaveCount(1);
  });
});
