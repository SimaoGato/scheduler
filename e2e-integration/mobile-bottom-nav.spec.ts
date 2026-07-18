/**
 * e2e-integration/mobile-bottom-nav.spec.ts — CHORE-22: mobile bottom tab bar
 * (`components/BottomNav.tsx`), replacing the inline AppNav on mobile.
 *
 * Runs unconditionally in the `integration-test` CI job (real local
 * Supabase, real admin/member browser sessions via `adminPage`/`memberPage`
 * from ./fixtures — STORY-26/CHORE-15 pattern).
 *
 * AC coverage:
 *   AC1 — bottom bar visible at 375px with the role-appropriate tab set
 *         (member: Início/Disponibilidade/Definições; admin: +Gerir), i18n'd
 *         real pt-PT strings, each tab's tap target >= 44px.
 *   AC2 — active-tab indicator (`aria-current="page"`) matches the current
 *         route, including Team/Roles/Users all mapping to the Manage tab.
 *   AC5 — at >=1280px (desktop), the bottom bar is absent (not matched by
 *         getByRole, since `sm:hidden` removes it from the a11y tree).
 *   AC6 — exactly one `<nav aria-label="Navegação principal">` landmark
 *         exists at any one viewport (mobile: BottomNav; desktop: AppNav —
 *         mutually exclusive via CSS, so never both at once); bar tabs are
 *         keyboard-reachable in a small, bounded number of Tab presses from
 *         the top of a content-heavy page (proves BottomNav is mounted right
 *         after AppHeader, not after {children}).
 */

import { test, expect } from './fixtures'

// --- AC1: bottom bar visible at 375px, role-appropriate tab set ------------

test('AC1: admin bottom bar shows Início, Disponibilidade, Gerir, Definições at 375px, each >= 44px', async ({
  adminPage,
}) => {
  await adminPage.setViewportSize({ width: 375, height: 812 })
  await adminPage.goto('/pt-PT/')

  const bar = adminPage.getByRole('navigation', { name: 'Navegação principal' })
  await expect(bar).toBeVisible()

  const links = bar.getByRole('link')
  await expect(links).toHaveCount(4)

  for (const name of ['Início', 'Disponibilidade', 'Gerir', 'Definições']) {
    const link = bar.getByRole('link', { name })
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})

test('AC1: member bottom bar shows Início, Disponibilidade, Definições at 375px, each >= 44px', async ({
  memberPage,
}) => {
  await memberPage.setViewportSize({ width: 375, height: 812 })
  await memberPage.goto('/pt-PT/')

  const bar = memberPage.getByRole('navigation', { name: 'Navegação principal' })
  await expect(bar).toBeVisible()

  const links = bar.getByRole('link')
  await expect(links).toHaveCount(3)

  for (const name of ['Início', 'Disponibilidade', 'Definições']) {
    const link = bar.getByRole('link', { name })
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  // A member never sees the Manage tab.
  await expect(bar.getByRole('link', { name: 'Gerir' })).toHaveCount(0)
})

// --- AC2: active-tab matching, incl. Team/Roles/Users -> Manage ------------

const AC2_ROUTES: Array<{ path: string; expectedActiveTab: string }> = [
  { path: '/pt-PT/', expectedActiveTab: 'Início' },
  { path: '/pt-PT/availability', expectedActiveTab: 'Disponibilidade' },
  { path: '/pt-PT/admin/people', expectedActiveTab: 'Gerir' },
  { path: '/pt-PT/admin/roles', expectedActiveTab: 'Gerir' },
  { path: '/pt-PT/admin/users', expectedActiveTab: 'Gerir' },
  { path: '/pt-PT/settings', expectedActiveTab: 'Definições' },
]

for (const { path, expectedActiveTab } of AC2_ROUTES) {
  test(`AC2: ${path} marks ${expectedActiveTab} as the active bottom-bar tab`, async ({
    adminPage,
  }) => {
    await adminPage.setViewportSize({ width: 375, height: 812 })
    await adminPage.goto(path)

    const bar = adminPage.getByRole('navigation', { name: 'Navegação principal' })
    await expect(bar).toBeVisible()

    const activeLink = bar.locator('a[aria-current="page"]')
    await expect(activeLink).toHaveCount(1)
    await expect(activeLink).toHaveText(expectedActiveTab)
  })
}

// --- AC5: desktop absence --------------------------------------------------

test('AC5: at 1280px the bottom bar is absent from the accessibility tree', async ({
  adminPage,
}) => {
  await adminPage.setViewportSize({ width: 1280, height: 800 })
  await adminPage.goto('/pt-PT/')

  // At >=sm, BottomNav is `sm:hidden` (display: none), so getByRole excludes
  // it from the accessibility tree by default; only AppNav's <nav> (visible,
  // `hidden sm:block`) is matched.
  const nav = adminPage.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toHaveCount(1)

  // The exact desktop link count (AppNav's Disponibilidade/Utilizadores/
  // Equipa/Funções set) is owned by e2e-integration/app-nav.spec.ts per
  // CLAUDE.md's "E2E test count assertions on nav links" convention — do not
  // duplicate that count assertion here. Asserting the bottom-bar-only labels
  // (Início, Gerir) are absent is sufficient to prove this <nav> is AppNav,
  // not BottomNav.
  await expect(nav.getByRole('link', { name: 'Início' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Gerir' })).toHaveCount(0)
})

// --- AC6: single landmark at both breakpoints, no duplicate announcement ---

test('AC6: exactly one "Navegação principal" landmark exists at 375px', async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 375, height: 812 })
  await adminPage.goto('/pt-PT/')
  await expect(
    adminPage.getByRole('navigation', { name: 'Navegação principal' })
  ).toHaveCount(1)
})

test('AC6: exactly one "Navegação principal" landmark exists at 1280px', async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 1280, height: 800 })
  await adminPage.goto('/pt-PT/')
  await expect(
    adminPage.getByRole('navigation', { name: 'Navegação principal' })
  ).toHaveCount(1)
})

// --- AC6: bounded keyboard reachability -------------------------------------

test('AC6: at 375px, BottomNav is reachable within a small, bounded number of Tab presses on a content-heavy page', async ({
  adminPage,
}) => {
  await adminPage.setViewportSize({ width: 375, height: 812 })
  await adminPage.goto('/pt-PT/admin/people')

  const bar = adminPage.getByRole('navigation', { name: 'Navegação principal' })
  await expect(bar).toBeVisible()

  // Header has two focusable controls ahead of BottomNav (the wordmark Link,
  // then the avatar/user-menu trigger). Allow a small bound (5 presses) —
  // this proves BottomNav is mounted right after <AppHeader />, not after
  // {children}: if a future regression moved <BottomNav> back to being the
  // last DOM child, this assertion would fail on a content-heavy page like
  // /admin/people (many focusable rows before reaching the bar).
  let foundWithinBar = false
  for (let i = 0; i < 5; i++) {
    await adminPage.keyboard.press('Tab')
    // `bar` resolves to the visible match only (AppNav's <nav> is `hidden` at
    // 375px, so getByRole's default visible-only matching already excludes
    // it) — evaluating .contains() on this specific locator's element avoids
    // any ambiguity from a plain document.querySelector picking up the
    // hidden AppNav <nav> that precedes BottomNav in DOM order.
    const isInsideBar = await bar.evaluate((el) => el.contains(document.activeElement))
    if (isInsideBar) {
      foundWithinBar = true
      break
    }
  }
  expect(foundWithinBar).toBe(true)
})
