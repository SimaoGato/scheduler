/**
 * e2e/header-identity-widget.spec.ts — STORY-12
 *
 * AC coverage:
 *
 *  All 5 ACs require an authenticated session. AppHeader lives in the
 *  (app)/ route group — unauthenticated CI runs are always redirected to
 *  /pt-PT/login, which has no header. Each AC is documented as a manual
 *  verification step below.
 *
 *  Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC1 — Interactive widget, pointer cursor:
 *    1. Log in. Inspect the header identity area.
 *    2. Hover over the avatar/name (data-testid="user-widget-trigger").
 *       Confirm cursor becomes pointer.
 *    3. Confirm it is a single <details> element — no plain text span or
 *       separate sign-out button outside it.
 *
 *  AC2 — Sign-out accessible from widget:
 *    1. Click/tap the identity widget to open the dropdown.
 *    2. Confirm data-testid="sign-out-button" ("Sair") is visible.
 *    3. Click "Sair". Confirm redirect to /pt-PT/login.
 *    Note: as of STORY-13, the dropdown also closes on outside click and
 *    Escape — see e2e/user-widget-click-outside.spec.ts for that coverage.
 *
 *  AC3 — Name and role visible in widget:
 *    1. Open the widget dropdown.
 *    2. Confirm data-testid="user-identity" shows the display name.
 *    3. Confirm data-testid="user-role-label" shows the role
 *       ("Administrador" or "Membro").
 *
 *  AC4 — Admin, 375 px, no overflow (STORY-23 extends this to the admin nav's
 *  widest page, `/pt-PT/admin/people`, not just `/`):
 *    1. Log in as an admin (3 nav links visible: Utilizadores, Equipa,
 *       Funções; see STORY-16, extended by STORY-17).
 *    2. Set browser to 375 px wide (DevTools device mode).
 *    3. Confirm no horizontal scrollbar;
 *       document.documentElement.scrollWidth <= 375.
 *       (The avatar-only trigger on narrow viewports — name hidden below sm
 *       breakpoint — keeps the header compact enough to fit. As of STORY-23,
 *       `AppNav.tsx`'s `<ul>` also wraps admin nav links onto additional
 *       rows via `flex-wrap` + `min-w-0` when they don't fit on one line —
 *       see CLAUDE.md's Playwright section for the resolved pattern.)
 *
 *  AC5 — Member, 375 px, no overflow (STORY-23 extends this to
 *  `/pt-PT/settings`, a member-accessible page beyond `/`):
 *    1. Log in as a member (0 nav links visible; no <nav> element rendered
 *       for Members, see STORY-16).
 *    2. Set browser to 375 px wide.
 *    3. Confirm no horizontal scrollbar;
 *       document.documentElement.scrollWidth <= 375.
 */

import { test, expect } from '@playwright/test';

// AC1: Header identity area is a single interactive element with pointer cursor.
test('AC1: header identity widget is a single interactive element (cursor-pointer)', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  const cursor = await trigger.evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});

// AC2: Activating the widget makes the sign-out action accessible.
// Note: as of STORY-13, the widget also closes on outside click and Escape —
// see e2e/user-widget-click-outside.spec.ts for that coverage.
test('AC2: activating the identity widget makes sign-out accessible', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const signOutButton = page.getByTestId('sign-out-button');
  await expect(signOutButton).toBeVisible();
});

// AC3: Display name and role label are visible inside the open widget.
test('AC3: display name and role label are visible inside the identity widget', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('user-identity')).toBeVisible();
  await expect(page.getByTestId('user-role-label')).toBeVisible();
});

// AC4: Admin header renders without horizontal overflow at 375 px viewport width.
// STORY-23/AC1: also checks /admin/people, the admin nav's widest page
// (Utilizadores + Equipa + Funções links), not just the home page.
test('AC4: admin header has no horizontal overflow at 375 px viewport width', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  // TODO when auth fixtures added: log in as admin (3 nav links) before checking overflow
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/');
  const homeScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(homeScrollWidth).toBeLessThanOrEqual(375);

  await page.goto('/admin/people');
  const peopleScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(peopleScrollWidth).toBeLessThanOrEqual(375);
});

// AC5: Member header renders without horizontal overflow at 375 px viewport width.
// STORY-23/AC2: also checks /settings, a member-accessible page beyond home.
test('AC5: member header has no horizontal overflow at 375 px viewport width', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  // TODO when auth fixtures added: log in as member (0 nav links) before checking overflow
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/');
  const homeScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(homeScrollWidth).toBeLessThanOrEqual(375);

  await page.goto('/settings');
  const settingsScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(settingsScrollWidth).toBeLessThanOrEqual(375);
});
