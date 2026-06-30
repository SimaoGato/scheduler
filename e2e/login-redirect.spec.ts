/**
 * e2e/login-redirect.spec.ts — STORY-09: Redirect authenticated users away from login
 *
 * AC coverage:
 *   AC1 (manual): logged-in user visiting /pt-PT/login is redirected to /pt-PT/
 *   AC2 (automated): unauthenticated user visiting /pt-PT/login sees login page (regression guard)
 *   AC3 (manual): signed-out user sees login page normally after sign-out
 *   AC4 (manual): redirected user lands on home showing correct role view
 *
 * Manual verification steps for AC1, AC3, AC4
 * (requires real Supabase project with Google provider and a filled-in .env.local):
 *
 *   AC1: Sign in via Google OAuth. After landing on /pt-PT/, manually navigate to
 *        /pt-PT/login. Confirm immediate redirect to /pt-PT/ without seeing the login form.
 *
 *   AC3: Sign in, then sign out (click "Sair"). Navigate to /pt-PT/login.
 *        Confirm the login form renders normally (no redirect back to home).
 *
 *   AC4: While signed in, visit /pt-PT/login. Confirm redirect to /pt-PT/ and that
 *        the home page shows the correct member or admin view (no blank or error state).
 *
 * --- CI coverage notes ---
 *
 * AC1 has no automated coverage because supabase.auth.getUser() returns null in CI
 * with placeholder credentials. HTTP-level tests have the same limitation — they also
 * go through the same middleware that receives placeholder creds and returns null.
 * A future improvement would be a Jest/Vitest unit test with @supabase/ssr mocked,
 * which could simulate a valid session and assert the 307 Location header without
 * needing a live Supabase project.
 *
 * AC5 tests in auth.spec.ts (?error=… params) are unaffected by STORY-09 because
 * user = null in CI means the new `if (user && isLoginPath)` branch is never taken.
 * The ?error param pass-through behaviour is unchanged.
 */

import { test, expect } from '@playwright/test';

// AC2: unauthenticated visit to /pt-PT/login renders the login page normally (regression guard).
// In CI, supabase.auth.getUser() returns null (placeholder creds), so the new
// `user && isLoginPath` branch is never taken — the existing pass-through is unchanged.
// This test confirms the pass-through still works after the STORY-09 change.
test('AC2: unauthenticated user visiting /pt-PT/login sees the login page', async ({ page }) => {
  await page.goto('/pt-PT/login');
  // Must remain on /pt-PT/login — no redirect to home
  await expect(page).toHaveURL(/\/pt-PT\/login/);
  // Login button must be visible — the form is rendered
  const button = page.getByRole('button', { name: 'Continuar com Google' });
  await expect(button).toBeVisible();
});
