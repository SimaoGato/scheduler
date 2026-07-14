/**
 * e2e-integration/app-nav.spec.ts — CHORE-15: pilot migration of the
 * previously `E2E_WITH_AUTH`-gated `e2e/app-nav.spec.ts` (STORY-16, updated
 * by STORY-17/STORY-26) into the local-Supabase browser-auth fixture
 * (`adminPage`/`memberPage` from `./fixtures`, STORY-26). These tests now run
 * unconditionally in the `integration-test` CI job — no manual
 * `E2E_WITH_AUTH` opt-in or real Google OAuth login required.
 *
 * AC coverage (ported 1:1 from the deleted `e2e/app-nav.spec.ts`):
 *   AC2 — Clicking the "Escala" wordmark from a non-home route (e.g.
 *         /admin/people) navigates back to the home page.
 *   AC3/AC8 — Admin nav shows exactly four links: Disponibilidade,
 *         Utilizadores, Equipa, and Funções (STORY-17 added "Funções";
 *         STORY-26 added "Disponibilidade" as the first item).
 *   AC8 — Member nav shows exactly one link, Disponibilidade (STORY-26).
 */

import { test, expect } from './fixtures'

// AC2: Clicking the "Escala" wordmark from a non-home route (e.g.
// /admin/people) navigates back to the home page. Starting from a
// genuinely different route makes this assertion meaningful — a dead or
// broken link would leave the test on /admin/people and the final
// toHaveURL check would fail.
test('AC2: clicking the Escala wordmark from a non-home route navigates to home', async ({ adminPage }) => {
  await adminPage.goto('/pt-PT/admin/people')
  await expect(adminPage).toHaveURL(/\/pt-PT\/admin\/people/)

  await adminPage.getByRole('link', { name: 'Escala' }).click()
  // Right-anchored (not left-anchored): Playwright's toHaveURL(RegExp) tests
  // against the full URL string including origin (e.g.
  // "http://localhost:3000/pt-PT/"), so a left `^` anchor would never match
  // and would make this assertion silently always fail. The `$` anchor is
  // what makes this assertion meaningful and locale-specific: it requires
  // nothing follows "/pt-PT" (ruling out e.g. "/pt-PT/admin/people"), while
  // still matching the suite's convention of hardcoding the single
  // supported locale (cf. `/\/pt-PT\/login/` in auth.spec.ts).
  await expect(adminPage).toHaveURL(/\/pt-PT\/?$/)
})

// AC3/AC8: Admin nav shows exactly "Disponibilidade", "Utilizadores",
// "Equipa", and "Funções" (STORY-17 added "Funções"; STORY-26 added
// "Disponibilidade" as the first item) — "Início" is gone.
test('AC3/AC8: Admin nav shows exactly Disponibilidade, Utilizadores, Equipa, and Funções', async ({ adminPage }) => {
  await adminPage.goto('/pt-PT/')
  const nav = adminPage.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toHaveCount(1)

  const links = nav.getByRole('link')
  await expect(links).toHaveCount(4)
  await expect(nav.getByRole('link', { name: 'Disponibilidade' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Utilizadores' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Equipa' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Funções' })).toBeVisible()
})

// AC8 (STORY-26): Member nav renders exactly one link, "Disponibilidade" —
// the STORY-16 empty-landmark case no longer applies to members now that
// Availability is a Member-facing nav destination.
test('AC8: Member nav shows exactly one link, Disponibilidade', async ({ memberPage }) => {
  await memberPage.goto('/pt-PT/')
  const nav = memberPage.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toHaveCount(1)

  const links = nav.getByRole('link')
  await expect(links).toHaveCount(1)
  await expect(nav.getByRole('link', { name: 'Disponibilidade' })).toBeVisible()
})
