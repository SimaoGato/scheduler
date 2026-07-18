/**
 * e2e-integration/admin-manage-hub.spec.ts — CHORE-22: the Manage hub page
 * (`app/[locale]/(app)/admin/manage/page.tsx`), the destination of
 * BottomNav's Manage tab.
 *
 * Runs unconditionally in the `integration-test` CI job (real local
 * Supabase, real admin/member browser sessions via `adminPage`/`memberPage`
 * from ./fixtures).
 *
 * AC coverage:
 *   AC3 — hub lists Team, Roles, Users as full-width card link rows
 *         (i18n'd title + description), each >= 44px tap target, navigating
 *         to the existing routes; a member hitting the hub directly follows
 *         the existing per-page admin-guard convention (?denied=1 redirect).
 */

import { test, expect } from './fixtures'

test('AC3: admin Manage hub lists Team, Roles, and Users as card links navigating to the right routes', async ({
  adminPage,
}) => {
  await adminPage.goto('/pt-PT/admin/manage')
  await expect(adminPage).toHaveURL(/\/pt-PT\/admin\/manage\/?$/)

  const cards = [
    { title: 'Equipa', description: 'Gerir pessoas da equipa', href: '/pt-PT/admin/people' },
    {
      title: 'Funções',
      description: 'Gerir funções e vagas por domingo',
      href: '/pt-PT/admin/roles',
    },
    {
      title: 'Utilizadores',
      description: 'Gerir contas de utilizador',
      href: '/pt-PT/admin/users',
    },
  ] as const

  // Scoped to <main>: at the default 1280x720 viewport, AppNav's desktop
  // inline nav (also visible on this page's header) has its own "Equipa"
  // link, which would otherwise collide in a strict-mode match.
  const main = adminPage.locator('main')

  for (const card of cards) {
    const link = main.getByRole('link', { name: new RegExp(card.title) })
    await expect(link).toBeVisible()
    await expect(link).toContainText(card.description)
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  // Clicking each card navigates to the right existing route (verified one
  // at a time, re-navigating to the hub between clicks).
  for (const card of cards) {
    await adminPage.goto('/pt-PT/admin/manage')
    await adminPage.locator('main').getByRole('link', { name: new RegExp(card.title) }).click()
    await expect(adminPage).toHaveURL(new RegExp(`${card.href}\\/?$`))
  }
})

test('AC3: a member visiting /admin/manage directly is redirected with ?denied=1', async ({
  memberPage,
}) => {
  await memberPage.goto('/pt-PT/admin/manage')
  // The redirect target string is `/${routing.defaultLocale}/?denied=1`, but
  // the actual browser URL observed is "/pt-PT?denied=1" (no trailing slash
  // survives). Match with an optional slash so the assertion doesn't depend
  // on that framework-internal detail, following the same sibling pattern
  // already used in e2e-integration/admin-availability.spec.ts:317.
  await expect(memberPage).toHaveURL(/\/pt-PT\/?\?denied=1$/)
  await expect(memberPage.getByTestId('access-denied-banner')).toBeVisible()
})
