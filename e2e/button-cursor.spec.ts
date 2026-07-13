/**
 * e2e/button-cursor.spec.ts — CHORE-10: Add pointer cursor to Button component
 *
 * AC coverage:
 *   Automated (CI-safe, no auth required):
 *     - AC1 (login page): Google sign-in button shows cursor: pointer
 *     - AC2 (disabled button, STORY-30 replacement): a CI-safe static-source
 *       check that `disabled:pointer-events-none` is present in
 *       components/ui/button.tsx's buttonVariants, replacing the two
 *       E2E_WITH_AUTH-gated live-button tests removed below (see note).
 *     - AC3: lint, tsc, build all pass after the change
 *
 *   E2E_WITH_AUTH-gated (requires .env.local + real Supabase + Google OAuth):
 *     - AC1 (nav links): admin nav links show cursor: pointer on hover
 *
 *   Manual verification only:
 *     - AC1 (nav links): visual confirmation of hand cursor on hover
 *     - AC2 (disabled button): visual confirmation of no pointer cursor despite
 *       the computed cursor: pointer value (pointer-events: none prevents hover)
 *
 * STORY-30 removal note: the two tests previously here — "AC1: home page CTA
 * button shows cursor: pointer" and "AC2: disabled button has pointer-events:
 * none" — targeted the static, permanently-disabled "Ver escala" home CTA
 * button (Home.cta), which STORY-30 removed entirely in favor of a real
 * availability summary / team-composition dashboard with no disabled
 * button. There is no longer a reachable disabled button on the home page to
 * assert against, so both tests were deleted rather than left permanently
 * skipped. AC2's underlying regression coverage (the `disabled:pointer-
 * events-none` Tailwind class staying present on Button) is preserved below
 * via a CI-safe static-source check (BUGFIX-02 pattern), so the behavior
 * this file's whole point is to catch does not go fully unguarded.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// AC1: login page button (Google sign-in) shows cursor: pointer
// CI-safe: no auth required, reachable at /pt-PT/login
test('AC1: Google sign-in button shows cursor: pointer', async ({ page }) => {
  await page.goto('/pt-PT/login');
  const button = page.getByTestId('google-signin-button');
  await expect(button).toBeVisible();

  const cursor = await button.evaluate((el) => window.getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});

// AC1 (auth-gated): admin nav links show cursor: pointer
// Reachable only behind authentication in the (app)/ route group
test('AC1: admin nav links show cursor: pointer', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Nav links require authentication to be visible in the (app)/ route group.');

  await page.goto('/');
  // Admin nav links are rendered as `<Button asChild><Link ...></Button>`;
  // `asChild` swaps the rendered element for the Link (an `<a>`), whose ARIA
  // role is "link", not "button". Match the exact pt-PT strings from
  // messages/pt-PT.json (Nav.userManagement, Nav.people).
  const firstLink = page.getByRole('link', { name: 'Utilizadores' });
  await expect(firstLink).toBeVisible();

  const cursor = await firstLink.evaluate((el) => window.getComputedStyle(el).cursor);
  expect(cursor).toBe('pointer');
});

// AC2 (CI-safe, STORY-30 replacement): static-source check that
// `disabled:pointer-events-none` remains in buttonVariants — see the
// STORY-30 removal note in the file header for why this replaces the
// previous two E2E_WITH_AUTH-gated tests against the now-deleted home CTA
// button. Reads the file directly (BUGFIX-02 pattern) rather than requiring
// a live reachable disabled button.
test('AC2: Button component keeps disabled:pointer-events-none in buttonVariants', () => {
  const source = readFileSync(join(__dirname, '..', 'components', 'ui', 'button.tsx'), 'utf8');
  expect(source).toMatch(/disabled:pointer-events-none/);
});
