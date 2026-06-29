/**
 * e2e/member-gating.spec.ts — Member no-access state & role-gated navigation
 * tests for STORY-06.
 *
 * AC coverage:
 *
 * Automated (CI-safe with placeholder Supabase credentials):
 *   - AC2 (partial): unauthenticated visitor → nav hides "Utilizadores" link.
 *     Because proxy.ts always redirects unauthenticated users to /pt-PT/login,
 *     we cannot reach the authenticated home page in CI. We verify the nav
 *     renders with "Início" and without "Utilizadores" — which mirrors the
 *     role=null / member state the nav adopts when no admin role is present.
 *
 * Manual verification steps (requires real Supabase credentials in .env.local,
 * Google OAuth configured, and at least one admin + one member account):
 *
 *   AC1 — Member "no access yet" view:
 *     1. Log in with a Google account whose row has role = 'member' in
 *        public.users.
 *     2. Confirm the home page shows "Bem-vindo ao Escala!" and the
 *        no-access description, and does NOT show the "Ver escala" button.
 *
 *   AC2 — Member nav hides admin links:
 *     1. While logged in as a Member, confirm the nav shows "Início" only —
 *        the "Utilizadores" link is absent.
 *
 *   AC3 — Admin nav shows admin links:
 *     1. Log in with a Google account whose row has role = 'admin'.
 *     2. Confirm the nav shows both "Início" and "Utilizadores".
 *
 *   AC4 — Member blocked from admin route (unauthorized view, not a blank screen):
 *     1. While logged in as a Member, navigate directly to /pt-PT/admin/users.
 *     2. Confirm redirect to home page with a visible "Não tens permissão para
 *        aceder a essa página." banner (driven by ?denied=1 query param).
 *     3. Confirm the admin user table is NOT rendered.
 *
 *   AC5 — Identity visible in shell:
 *     1. Log in as any user (admin or member).
 *     2. Confirm the header shows the user's name (via "Olá, {name}"), their
 *        role label ("Administrador" or "Membro"), and a "Sair" button.
 *     3. Click "Sair" and confirm redirect to login page.
 */

import { test, expect } from '@playwright/test';

/**
 * AC2 (partial) — Automated / CI-safe
 *
 * When no user is authenticated (placeholder Supabase creds or genuinely
 * logged out), proxy.ts redirects to /pt-PT/login. The nav is still rendered
 * in the shell. We assert:
 *   - "Início" IS visible (always-shown link)
 *   - "Utilizadores" is NOT visible (admin-only link; role=null → hidden)
 *
 * This is the CI-safe proxy for the member experience: role=null produces the
 * same nav as role='member' — the admin link is absent.
 */
test('AC2 (partial): nav hides "Utilizadores" for unauthenticated users (role=null)', async ({ page }) => {
  await page.goto('/');
  // proxy.ts redirects to login; the shell (header+nav) is still present
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('nav')).toContainText('Início');
  // The admin-only link must NOT appear when role is null / member
  await expect(page.locator('nav')).not.toContainText('Utilizadores');
});
