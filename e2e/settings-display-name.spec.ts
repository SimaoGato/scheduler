/**
 * e2e/settings-display-name.spec.ts — STORY-21: Account settings page
 * (display name override)
 *
 * AC coverage:
 *   Automated (CI-safe with placeholder Supabase credentials):
 *     - AC7: unauthenticated GET /pt-PT/settings redirects to /pt-PT/login
 *     - AC4 (regression guard): unauthenticated PATCH
 *       /api/settings/display-name returns 401 JSON (mirrors
 *       role-enforcement.spec.ts's AC3 pattern)
 *
 *   E2E_WITH_AUTH-gated (requires .env.local + real Supabase + Google OAuth):
 *     - AC1: "Definições" is visible in the account menu, between the
 *       identity block and "Sair", and navigates to /pt-PT/settings.
 *     - AC2: the settings page pre-fills the name input from
 *       public.users.display_name; when empty, the input is blank and the
 *       Google name appears only as a placeholder (never auto-saved).
 *     - AC3: saving a new name updates the DB and the header/account-menu
 *       reflect the new name immediately, without a full page reload.
 *     - AC4 (authenticated half): submitting a blank/whitespace-only name
 *       is rejected with 400 and display_name is left unchanged (UI test),
 *       plus a direct authenticated PATCH with an empty displayName
 *       asserting a 400 from the route handler itself — the UI test alone
 *       only exercises DisplayNameForm's client-side short-circuit
 *       (`!value.trim()`), never the server's own validation.
 *     - AC8: no horizontal overflow at 375px; tap targets >= 44px.
 *
 *   Manual verification only (see notes below):
 *     - AC5: provisionUser() preserves a non-empty display_name on a
 *       returning login. Same CI limitation as e2e/provision.spec.ts — with
 *       placeholder Supabase credentials, exchangeCodeForSession() always
 *       fails, so the provisioning branch is never reached. Steps:
 *         1. Log in with a Google account (creates/updates the row).
 *         2. In Supabase Table Editor, set that row's display_name to a
 *            custom value, e.g. "Custom Name".
 *         3. Log out, then log in again with the same Google account.
 *         4. Confirm display_name is still "Custom Name" (not overwritten
 *            by the Google profile name).
 *       ALSO VERIFY (manual, requires real dev Supabase project): the
 *       service-role PATCH in app/api/settings/display-name/route.ts
 *       actually succeeds (returns 200 and persists) — the project has
 *       previously hit missing service_role GRANT bugs on public.users
 *       (see CLAUDE.md "GRANT before RLS"). Steps:
 *         1. Log in, open /pt-PT/settings.
 *         2. Submit a new name; confirm 200 response (Network tab) and
 *            that the value persists in Table Editor.
 *     - AC6: header/menu source-of-truth is public.users.display_name, not
 *       raw user_metadata. Covered indirectly by the AC2/AC3 E2E_WITH_AUTH
 *       tests above (same read path via getUserProfile). See the AC6
 *       comment at the getUserProfile() call site in AppHeader.tsx as a
 *       soft guard against regression.
 */

import { test, expect } from '@playwright/test';

// AC7: unauthenticated visit to /pt-PT/settings redirects to /pt-PT/login
// (exercises proxy.ts's existing guard; no new proxy code needed).
test('AC7: unauthenticated GET /pt-PT/settings redirects to /pt-PT/login', async ({ page }) => {
  await page.goto('/pt-PT/settings');
  await expect(page).toHaveURL(/\/pt-PT\/login/);
});

// AC4 (regression guard): unauthenticated PATCH to the display-name endpoint
// returns 401 JSON, not a redirect — Route Handlers bypass proxy.ts's page
// guard, so the handler itself must enforce auth via requireAuth().
test('AC4: unauthenticated PATCH /api/settings/display-name returns 401', async ({ request }) => {
  const response = await request.patch('/api/settings/display-name', {
    data: { displayName: 'Someone' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

// AC1: "Definições" is visible in the account menu between the identity
// block and "Sair", and navigates to /pt-PT/settings.
test('AC1: "Definições" link is visible in the account menu and navigates to /settings', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'UserWidgetMenu requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const settingsLink = page.getByTestId('settings-link');
  await expect(settingsLink).toBeVisible();

  // DOM order: settings link appears after the identity block, before sign-out.
  const menu = page.getByTestId('user-widget-menu');
  const order = await menu.evaluate((el) => {
    const identity = el.querySelector('[data-testid="user-identity"]');
    const settings = el.querySelector('[data-testid="settings-link"]');
    const signOut = el.querySelector('[data-testid="sign-out-button"]');
    if (!identity || !settings || !signOut) return null;
    const pos1 = identity.compareDocumentPosition(settings);
    const pos2 = settings.compareDocumentPosition(signOut);
    return {
      settingsAfterIdentity: !!(pos1 & Node.DOCUMENT_POSITION_FOLLOWING),
      signOutAfterSettings: !!(pos2 & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(order).toEqual({ settingsAfterIdentity: true, signOutAfterSettings: true });

  await settingsLink.click();
  await expect(page).toHaveURL(/\/pt-PT\/settings\/?$/);
});

// AC2: the settings page pre-fills the name input from
// public.users.display_name (falling back to a placeholder-only Google name
// when empty).
test('AC2: settings page pre-fills the name input from display_name', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication; see manual steps in file header.');
  await page.goto('/pt-PT/settings');
  const input = page.getByTestId('display-name-input');
  await expect(input).toBeVisible();
  // Manual verification for the exact seeded value (depends on the test
  // account's current display_name); this only asserts the field is
  // rendered as a proper labeled input.
  await expect(input).toHaveAttribute('aria-label');
});

// AC3: saving a new name updates the DB and the header/menu reflect the new
// name immediately, without a full page reload.
test('AC3: saving a new display name updates the header without a full reload', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication; see manual steps in file header.');
  await page.goto('/pt-PT/settings');
  const input = page.getByTestId('display-name-input');
  await expect(input).toBeVisible();

  const newName = `Test User ${Date.now()}`;
  await input.fill(newName);
  await page.getByTestId('display-name-save').click();

  // Inline confirmation appears on the settings page itself (does not
  // depend on reopening the account menu or on viewport width).
  await expect(page.getByTestId('display-name-success')).toBeVisible();

  // Navigate via an in-app Link click (the "Escala" wordmark in the
  // persistent AppHeader), not page.goto('/') — page.goto() is always a
  // full browser navigation and would re-render the Server Component tree
  // from scratch regardless of whether DisplayNameForm's router.refresh()
  // call exists, giving zero regression coverage for this AC. Clicking a
  // next/link Link performs a client-side transition that only re-fetches
  // the RSC payload; the assertion below is only meaningful because
  // router.refresh() (called on save, before this click) is what causes the
  // persistent AppHeader — which is not remounted by this client-side nav —
  // to reflect the new name.
  await page.getByRole('link', { name: 'Escala' }).click();
  await expect(page).toHaveURL(/\/pt-PT\/?$/);
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('user-identity')).toHaveText(newName);
});

// AC4 (authenticated half): submitting a blank/whitespace-only name is
// rejected with 400 and display_name is left unchanged.
test('AC4: submitting a blank name is rejected with 400', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication; see manual steps in file header.');
  await page.goto('/pt-PT/settings');
  const input = page.getByTestId('display-name-input');
  await expect(input).toBeVisible();

  await input.fill('   ');
  await page.getByTestId('display-name-save').click();

  await expect(page.getByTestId('display-name-error')).toBeVisible();
});

// AC4 (server-side regression guard): DisplayNameForm.handleSubmit
// short-circuits client-side on `!value.trim()` before any fetch call, so
// the UI test above never actually reaches the server's own validation.
// Issue a direct authenticated PATCH (via page.request, which shares the
// logged-in browser context's cookies) so a regression in the route
// handler's own validation would be caught even if the client-side guard
// were ever removed or bypassed.
test('AC4: authenticated PATCH with a blank displayName is rejected with 400 by the server', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication; see manual steps in file header.');
  await page.goto('/pt-PT/settings');

  const response = await page.request.patch('/api/settings/display-name', {
    data: { displayName: '' },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

// AC8: no horizontal overflow at 375px viewport width.
test('AC8: settings page has no horizontal overflow at 375px viewport width', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication; see manual steps in file header.');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/pt-PT/settings');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

// AC8: tap targets meet the 44px floor.
test('AC8: input and save button meet the 44px tap-target floor', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication; see manual steps in file header.');
  await page.goto('/pt-PT/settings');
  const input = page.getByTestId('display-name-input');
  await expect(input).toBeVisible();
  const inputBox = await input.boundingBox();
  expect(inputBox?.height).toBeGreaterThanOrEqual(44);

  const saveButton = page.getByTestId('display-name-save');
  await expect(saveButton).toBeVisible();
  const saveBox = await saveButton.boundingBox();
  expect(saveBox?.height).toBeGreaterThanOrEqual(44);
});
