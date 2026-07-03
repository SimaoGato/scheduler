/**
 * e2e/app-nav.spec.ts — STORY-16: logo-as-home-link, "Início" nav removal
 *
 * AC coverage:
 *
 *  AC2 and AC3 require an authenticated session (AppHeader/AppNav only
 *  render for authenticated users, inside the (app)/ route group).
 *  Unauthenticated CI runs are always redirected to /pt-PT/login, which has
 *  no header, so these tests are gated on E2E_WITH_AUTH and skipped in CI.
 *  Each AC is documented as a manual verification step below to satisfy the
 *  Definition of Done's AC-coverage requirement.
 *
 *  Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC2 — Clicking "Escala" from a non-home route navigates home:
 *    1. Log in as an admin. Navigate to /pt-PT/admin/people.
 *    2. Confirm the "Equipa" admin page is showing (not the home page).
 *    3. Click the "Escala" wordmark in the header.
 *    4. Confirm the browser lands back on the home page (/pt-PT/).
 *
 *  AC3 — Admin nav shows exactly "Utilizadores" and "Equipa":
 *    1. Log in as an admin.
 *    2. Confirm the "Navegação principal" nav landmark is present and
 *       contains exactly two links: "Utilizadores" and "Equipa" — no
 *       "Início" link.
 *
 *  AC3 — Member nav renders no <nav> element:
 *    1. Log in as a member (role = 'member' in public.users).
 *    2. Confirm no "Navegação principal" nav landmark is rendered at all
 *       (not an empty <nav>, but no <nav> element in the DOM).
 *
 *  TODO when auth fixtures added: log in as admin/member before running
 *  these assertions. This codebase has no role-selectable auth fixture yet,
 *  so these tests can only exercise the page.goto()/getByRole() assertions
 *  once a real session cookie is already present (e.g. via manual browser
 *  login + E2E_WITH_AUTH locally); they do not themselves perform sign-in.
 */

import { test, expect } from '@playwright/test';

// AC2: Clicking the "Escala" wordmark from a non-home route (e.g.
// /admin/people) navigates back to the home page. Starting from a
// genuinely different route makes this assertion meaningful — a dead or
// broken link would leave the test on /admin/people and the final
// toHaveURL check would fail.
test('AC2: clicking the Escala wordmark from a non-home route navigates to home', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/pt-PT/admin/people');
  await expect(page).toHaveURL(/\/pt-PT\/admin\/people/);

  await page.getByRole('link', { name: 'Escala' }).click();
  // Right-anchored (not left-anchored): Playwright's toHaveURL(RegExp) tests
  // against the full URL string including origin (e.g.
  // "http://localhost:3000/pt-PT/"), so a left `^` anchor would never match
  // and would make this assertion silently always fail. The `$` anchor is
  // what makes this assertion meaningful and locale-specific: it requires
  // nothing follows "/pt-PT" (ruling out e.g. "/pt-PT/admin/people"), while
  // still matching the suite's convention of hardcoding the single
  // supported locale (cf. `/\/pt-PT\/login/` in auth.spec.ts).
  await expect(page).toHaveURL(/\/pt-PT\/?$/);
});

// AC3: Admin nav shows exactly "Utilizadores" and "Equipa" — "Início" is
// gone.
test('AC3: Admin nav shows exactly Utilizadores and Equipa', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toHaveCount(1);

  const links = nav.getByRole('link');
  await expect(links).toHaveCount(2);
  await expect(nav.getByRole('link', { name: 'Utilizadores' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Equipa' })).toBeVisible();
});

// AC3: Member nav renders no <nav> element at all — not an empty one.
test('AC3: Member nav renders no nav element', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toHaveCount(0);
});
