/**
 * e2e/app-nav.spec.ts — STORY-16: logo-as-home-link, "Início" nav removal.
 * Updated by STORY-26 (AC8): the availability nav entry is now the first
 * item for both Admin and Member — Admin count bumped 3 → 4, Member nav no
 * longer renders as an empty landmark (it now has exactly one link).
 *
 * AC coverage:
 *
 *  AC2 and AC3 require an authenticated session (AppHeader/AppNav only
 *  render for authenticated users, inside the (app)/ route group).
 *  Unauthenticated CI runs are always redirected to /pt-PT/login, which has
 *  no header, so these tests are gated on E2E_WITH_AUTH and skipped in CI.
 *  Each AC is documented as a manual verification step below to satisfy the
 *  Definition of Done's AC-coverage requirement. STORY-26's own
 *  e2e-integration/availability.spec.ts (AC8) gives full automated,
 *  non-gated coverage of the same nav-entry behaviour against a real local
 *  Supabase instance — see that file for the primary AC8 coverage; this
 *  file's assertions remain the manual/E2E_WITH_AUTH-gated fallback for
 *  local developer verification.
 *
 *  Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC2 — Clicking "Escala" from a non-home route navigates home:
 *    1. Log in as an admin. Navigate to /pt-PT/admin/people.
 *    2. Confirm the "Equipa" admin page is showing (not the home page).
 *    3. Click the "Escala" wordmark in the header.
 *    4. Confirm the browser lands back on the home page (/pt-PT/).
 *
 *  AC3/AC8 — Admin nav shows exactly four links: Disponibilidade,
 *  Utilizadores, Equipa, and Funções (STORY-17 added "Funções"; STORY-26
 *  added "Disponibilidade" as the first item):
 *    1. Log in as an admin.
 *    2. Confirm the "Navegação principal" nav landmark is present and
 *       contains exactly four links: "Disponibilidade", "Utilizadores",
 *       "Equipa", and "Funções" — no "Início" link.
 *
 *  AC8 — Member nav renders exactly one link, "Disponibilidade" (STORY-26):
 *    1. Log in as a member (role = 'member' in public.users).
 *    2. Confirm the "Navegação principal" nav landmark is present and
 *       contains exactly one link, "Disponibilidade" (the empty-landmark
 *       case from STORY-16 no longer applies to members as of STORY-26).
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

// AC3/AC8: Admin nav shows exactly "Disponibilidade", "Utilizadores",
// "Equipa", and "Funções" (STORY-17 added "Funções"; STORY-26 added
// "Disponibilidade" as the first item) — "Início" is gone.
test('AC3/AC8: Admin nav shows exactly Disponibilidade, Utilizadores, Equipa, and Funções', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toHaveCount(1);

  const links = nav.getByRole('link');
  await expect(links).toHaveCount(4);
  await expect(nav.getByRole('link', { name: 'Disponibilidade' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Utilizadores' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Equipa' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Funções' })).toBeVisible();
});

// AC8 (STORY-26): Member nav renders exactly one link, "Disponibilidade" —
// the STORY-16 empty-landmark case no longer applies to members now that
// Availability is a Member-facing nav destination.
test('AC8: Member nav shows exactly one link, Disponibilidade', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication; see manual steps in file header.');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toHaveCount(1);

  const links = nav.getByRole('link');
  await expect(links).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Disponibilidade' })).toBeVisible();
});
