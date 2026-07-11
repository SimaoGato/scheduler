/**
 * e2e/member-gating.spec.ts — Member no-access state & role-gated navigation
 * tests for STORY-06.
 *
 * AC coverage:
 *
 * Automated (CI-safe with placeholder Supabase credentials):
 *   - AC2 (partial): unauthenticated visitor → nav hides "Utilizadores" link.
 *     Because proxy.ts always redirects unauthenticated users to /pt-PT/login,
 *     we cannot reach the authenticated home page in CI. We verify that no
 *     <nav> element is rendered at all for unauthenticated visitors
 *     (redirected to the chrome-less login page per STORY-10). Note: this no
 *     longer mirrors the *authenticated* Member nav state — as of STORY-26
 *     the Member nav renders one link ("Disponibilidade"), not an empty
 *     landmark; only a null/unrecognized role still returns no <nav> at all
 *     (see e2e/app-nav.spec.ts for the Member-nav-has-one-link coverage).
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
 *     1. While logged in as a Member, confirm the nav renders exactly one
 *        link, "Disponibilidade" (STORY-26) — the "Utilizadores" link is
 *        absent.
 *
 *   AC3 — Admin nav shows admin links:
 *     1. Log in with a Google account whose row has role = 'admin'.
 *     2. Confirm the nav shows "Utilizadores" and "Equipa" (see STORY-16).
 *
 *   AC4 — Member blocked from admin route (unauthorized view, not a blank screen):
 *     1. While logged in as a Member, navigate directly to /pt-PT/admin/users.
 *     2. Confirm redirect to home page with a visible "Não tens permissão para
 *        aceder a essa página." banner (driven by ?denied=1 query param).
 *     3. Confirm the admin user table is NOT rendered.
 *
 *   AC5 — Identity visible in shell (updated for STORY-12):
 *     1. Log in as any user (admin or member).
 *     2. Confirm the header shows an avatar circle with the user's initial and
 *        their name (on sm+ viewports). The old "Olá, {name}" span and separate
 *        "Sair" button have been replaced by a single UserWidget (<details>).
 *     3. Click/tap the avatar to open the dropdown. Confirm the display name,
 *        role label ("Administrador" or "Membro"), and a "Sair" button are
 *        visible inside the dropdown.
 *     4. Click "Sair" and confirm redirect to the login page.
 */

import { test, expect } from '@playwright/test';

/**
 * AC2 (partial) — Automated / CI-safe
 *
 * When no user is authenticated (placeholder Supabase creds or genuinely
 * logged out), proxy.ts redirects to /pt-PT/login. After STORY-10 the login
 * page renders a minimal shell with NO AppHeader/nav — so "Utilizadores" is
 * definitively absent (no nav at all, not merely hidden within one).
 */
test('AC2 (partial): nav is absent on login page — unauthenticated users cannot see "Utilizadores"', async ({ page }) => {
  await page.goto('/');
  // proxy.ts redirects to /pt-PT/login; STORY-10 removed AppHeader from the
  // login shell, so there is no nav element at all for unauthenticated users.
  await expect(page).toHaveURL(/\/login/);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toHaveCount(0);
});
