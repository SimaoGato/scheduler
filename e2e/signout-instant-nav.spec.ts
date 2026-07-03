/**
 * e2e/signout-instant-nav.spec.ts — STORY-15: Make sign-out feel instant
 *
 * AC coverage:
 *   AC1 (automated) — clicking "Sign out" sets the app-signout-pending
 *     marker cookie synchronously (before any network round trip resolves)
 *     and navigates to /login almost immediately.
 *   AC2 (automated, two tests) —
 *     Test A: setting the marker cookie directly (no click) forces
 *       proxy.ts's forward guard to redirect a protected route to /login,
 *       deterministically, independent of real Supabase network timing.
 *     Test B: the full click-driven sign-out flow lands on /login, and a
 *       subsequent visit to a protected route redirects back to /login.
 *   AC3 (manual) — see docs/stories/STORY-15-instant-signout-navigation.md
 *     step 9. The only real `supabase.auth.signOut()` call in this design
 *     runs server-side inside the Server Action, invisible to Playwright's
 *     browser-level network interception (`page.route()` cannot reach it),
 *     so there is no meaningful automated way to force that specific call
 *     to fail from this e2e suite. Not tested here; do not add a misleading
 *     test claiming to cover it.
 *   AC4 (regression) — no new test; covered by running the full existing
 *     e2e suite (see story file step 7) and confirming no assertion
 *     changes were needed in auth.spec.ts, login-redirect.spec.ts,
 *     header-identity-widget.spec.ts, user-widget-click-outside.spec.ts.
 *
 * All tests here require a real authenticated session (the sign-out button
 * only renders inside the authenticated (app)/ route group), which this
 * environment/CI cannot provide (no real Supabase/Google OAuth
 * credentials). Following the established auth-gated test pattern (see
 * e2e/user-widget-click-outside.spec.ts), they are skipped unless
 * E2E_WITH_AUTH is set.
 *
 * Manual verification (requires .env.local + real Supabase + Google OAuth):
 *   See docs/stories/STORY-15-instant-signout-navigation.md, "Step-by-step"
 *   items 8 and 9.
 */

import { test, expect, type Page } from '@playwright/test';
import { SIGNOUT_MARKER_COOKIE } from '../lib/auth/signout-marker';

// Shared "open widget → click sign-out" sequence, used by both AC1 and AC2
// Test B. Extracted so a future change to the widget markup/data-testid
// only needs updating in one place.
async function clickSignOut(page: Page) {
  const trigger = page.getByTestId('user-widget-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const signOutButton = page.getByTestId('sign-out-button');
  await expect(signOutButton).toBeVisible();
  await signOutButton.click();
}

test.describe('STORY-15: instant sign-out navigation', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Sign-out flow requires authentication; see manual steps in file header.');

  test('AC1: clicking sign-out sets the marker cookie synchronously and navigates to /login almost immediately', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await clickSignOut(page);

    // Check the marker cookie FIRST, before awaiting the URL assertion —
    // this proves the cookie was set synchronously on click, not after any
    // network round trip.
    const cookies = await context.cookies();
    const marker = cookies.find((c) => c.name === SIGNOUT_MARKER_COOKIE);
    expect(marker?.value).toBe('1');
    // Also assert the attributes proxy.ts's guard depends on being sent
    // back correctly on subsequent requests, so a future regression in the
    // document.cookie string (e.g. a dropped `path=/` or `SameSite=Lax`)
    // fails this test instead of silently reopening the race.
    expect(marker?.path).toBe('/');
    expect(marker?.sameSite).toBe('Lax');

    await expect(page).toHaveURL(/\/pt-PT\/login/, { timeout: 500 });
  });

  test('AC2 Test A: setting the marker cookie directly (no click) forces a protected route to redirect to /login', async ({
    page,
    context,
  }) => {
    // Genuinely authenticated: confirm we can see the identity widget first.
    await page.goto('/');
    await expect(page.getByTestId('user-widget-trigger')).toBeVisible();

    // Deliberately omits `secure: true`, unlike the real marker cookie set
    // by the click handler (UserWidgetMenu.tsx). This test isolates
    // proxy.ts's guard logic from the cookie-write mechanism itself (AC1
    // already exercises the real Secure write), so the fixture cookie only
    // needs to match what proxy.ts reads, not the full real-world write.
    await context.addCookies([
      {
        name: SIGNOUT_MARKER_COOKIE,
        value: '1',
        url: 'http://localhost:3000',
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/pt-PT/admin/people');
    await expect(page).toHaveURL(/\/pt-PT\/login/);
  });

  test('AC2 Test B: end-to-end sign-out then protected route access redirects to /login', async ({ page }) => {
    await page.goto('/');
    await clickSignOut(page);

    await expect(page).toHaveURL(/\/pt-PT\/login/);

    await page.goto('/pt-PT/admin/people');
    await expect(page).toHaveURL(/\/pt-PT\/login/);
  });
});
