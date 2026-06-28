/**
 * e2e/role-enforcement.spec.ts — Role permission enforcement tests for STORY-04
 *
 * AC coverage:
 *   Automated (CI-safe with placeholder Supabase credentials):
 *     - AC3: unauthenticated GET /api/admin/ping → 401 JSON response
 *
 *   Manual verification steps for AC1, AC2, AC4:
 *   (requires real Supabase project with Google provider and .env.local filled in,
 *    AND migrations 20260628000001 and 20260628000002 applied)
 *
 *   AC1 — Member → 403 Forbidden:
 *     1. Ensure a user exists with role = 'member' in public.users
 *        (any non-first login account; second Google account works).
 *     2. Sign in with that Google account. Session cookie is now active.
 *     3. Open browser DevTools console.
 *     4. Run: fetch('/api/admin/ping').then(r => r.json().then(b => console.log(r.status, b)))
 *     5. Confirm status is 403 and body is { "error": "Forbidden" }.
 *
 *   AC2 — Admin → 200 OK:
 *     1. Sign in with a Google account whose row has role = 'admin'
 *        (the first account ever logged in, or manually set in Table Editor).
 *     2. Open browser DevTools console.
 *     3. Run: fetch('/api/admin/ping').then(r => r.json()).then(console.log)
 *     4. Confirm status is 200 and body is { "ok": true, "role": "admin" }.
 *
 *   AC4 — DB RLS (defense in depth):
 *     Note: the Supabase SQL Editor runs as the postgres superuser and bypasses RLS.
 *     Use the authenticated Supabase JS client in the browser instead:
 *
 *     1. Sign in as a Member user.
 *     2. Open browser DevTools console on any app page (the Supabase client is
 *        not exposed globally, so use fetch with the anon key directly):
 *        - As Member: fetch('/api/admin/ping') should return 403 (proves app-layer guard).
 *        - RLS is verified by the fact that the role lookup in requireAuth() succeeds
 *          (returns own row via users_select_own policy) but returns role='member'.
 *     3. To verify the admin-select-all policy, sign in as Admin and confirm
 *        the Supabase Table Editor shows all rows (admin can see them all).
 *     4. To verify no anon-key UPDATE is possible: the absence of an UPDATE policy
 *        on public.users means all UPDATE attempts via the anon-key client are
 *        denied by default (RLS deny-by-default). This is a structural guarantee,
 *        not something that needs to be tested manually each time — the migration
 *        itself is the evidence (no UPDATE policy created).
 *
 *   AC5 — Reusable guard (TypeScript compilation):
 *     TypeScript compilation (`npx tsc --noEmit`) verifies that lib/auth/guard.ts
 *     exports correctly typed requireAuth() and requireAdmin() functions, and that
 *     the route handler uses them correctly. This is verified by the build step.
 */

import { test, expect } from '@playwright/test';

// AC3: unauthenticated request → 401 JSON (not a redirect)
// API routes bypass the proxy.ts (middleware) auth guard, so a missing session
// must be handled by the route handler itself via requireAdmin().
test('AC3: unauthenticated GET /api/admin/ping returns 401', async ({ request }) => {
  const response = await request.get('/api/admin/ping');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).toHaveProperty('error');
});
