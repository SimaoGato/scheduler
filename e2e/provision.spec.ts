/**
 * e2e/provision.spec.ts — Callback route tests for STORY-03
 *
 * AC coverage:
 *   Automated (CI-safe with placeholder Supabase credentials):
 *     - /auth/callback with no params → redirects to /pt-PT/login
 *     - /auth/callback?error=access_denied → redirects to /pt-PT/login?error=access_denied
 *     - /auth/callback?code=badcode → redirects to /pt-PT/login?error=exchange_failed
 *       (Supabase rejects any code when using placeholder creds; provisioning is
 *       never reached, which also confirms the try/catch does not block the
 *       exchange_failed redirect)
 *
 *   Manual verification steps for AC1–AC4
 *   (requires real Supabase project with Google provider and a filled-in .env.local
 *    AND the migration 20260628000001_create_users_table.sql applied via SQL Editor):
 *
 *   AC1 — New Google identity → Member record:
 *     1. Ensure public.users is empty (TRUNCATE public.users; in SQL Editor).
 *        Then add a dummy row so it is no longer "first user" (INSERT INTO public.users
 *        (id, email, display_name, role) VALUES (gen_random_uuid(), 'seed@example.com',
 *        'Seed', 'admin');).
 *     2. Log in with a Google account that has no existing row in public.users.
 *     3. In Supabase Table Editor → public.users: confirm 1 new row with
 *        role = 'member', email and display_name populated, created_at set.
 *
 *   AC2 — Existing user logs in again → no duplicate, role preserved:
 *     1. In Table Editor, manually set the user's role to 'admin'.
 *     2. Log out and log in again with the same Google account.
 *     3. Confirm Table Editor still shows exactly 1 row for that user.
 *     4. Confirm role remains 'admin' (was not overwritten).
 *
 *   AC3 — First-ever user → Admin (bootstrap):
 *     1. TRUNCATE public.users; in SQL Editor.
 *     2. Log in with any Google account.
 *     3. Confirm the newly created row has role = 'admin'.
 *
 *   AC4 — Record stores id, email, display_name, role, created_at:
 *     1. After any login, open Table Editor → public.users.
 *     2. Confirm all five columns are non-null for the logged-in user's row.
 */

import { test, expect } from '@playwright/test';

// Fallback: /auth/callback with no code and no error redirects to login
test('provision: /auth/callback with no params redirects to /pt-PT/login', async ({ page }) => {
  await page.goto('/auth/callback');
  await expect(page).toHaveURL(/\/pt-PT\/login/);
});

// Error passthrough: access_denied is forwarded to login page
test('provision: /auth/callback?error=access_denied redirects to login with error', async ({
  page,
}) => {
  await page.goto('/auth/callback?error=access_denied');
  await expect(page).toHaveURL(/\/pt-PT\/login\?error=access_denied/);
});

// Bad code: exchange fails with placeholder creds, redirects with exchange_failed
test('provision: /auth/callback?code=badcode redirects to login with exchange_failed', async ({
  page,
}) => {
  await page.goto('/auth/callback?code=badcode');
  await expect(page).toHaveURL(/\/pt-PT\/login\?error=exchange_failed/);
});
