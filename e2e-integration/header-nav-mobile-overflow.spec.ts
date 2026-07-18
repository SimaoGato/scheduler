/**
 * e2e-integration/header-nav-mobile-overflow.spec.ts — BUGFIX-06, superseded
 * on mobile by CHORE-22.
 *
 * BUGFIX-06 fixed a 375px horizontal-overflow bug caused by AppNav wrapping
 * above the logo on mobile. CHORE-22 removes the inline AppNav entirely on
 * mobile (`hidden sm:block`) in favor of a fixed bottom tab bar
 * (`components/BottomNav.tsx`), so the specific bug this file originally
 * guarded against — an AppNav `<li>` rendering above the logo — is now
 * structurally impossible: there is no more inline nav in the mobile DOM to
 * wrap. This file is repurposed (same filename, same `WIDTHS = [375, 390]`
 * parametrization, same `adminPage`/`memberPage` fixtures) to assert no
 * horizontal overflow with the bottom bar present, and to capture the same
 * tap-target + screenshot evidence, now against BottomNav's tabs instead of
 * AppNav's links.
 *
 * This suite runs unconditionally in the `integration-test` CI job (real
 * local Supabase, real admin/member browser sessions via
 * `adminPage`/`memberPage` from ./fixtures).
 *
 * AC coverage (CHORE-22):
 *   AC1/AC4 — admin and member: no horizontal overflow at 375px AND 390px, on
 *         `/pt-PT/` and a content-heavy page (`/pt-PT/admin/people` for
 *         admin, `/pt-PT/settings` for member), with the bottom bar present.
 *   AC4 — the fixed bar does not cover the last content when scrolled to the
 *         bottom (bottom padding applied).
 *   AC1 — every BottomNav tab has a tap target >= 44px; a screenshot is
 *         captured at both widths as a CI artifact for the human visual
 *         check (bar and indicator read as intentional, not broken), per the
 *         BUGFIX-06 evidence pattern.
 */

import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const WIDTHS = [375, 390]

// Shared positional assertion: no horizontal overflow with the bottom bar
// present.
async function assertNoOverflow(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(width)

  const logo = page.getByRole('link', { name: 'Escala' })
  await expect(logo).toBeVisible()

  const bar = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(bar).toHaveCount(1)
  await expect(bar).toBeVisible()
}

// AC4: scrolled to the bottom of a long page, the fixed bar does not cover
// the last visible content (content's bottom edge is above the bar's top
// edge).
async function assertBarDoesNotCoverContent(page: Page) {
  const bar = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(bar).toBeVisible()
  const barBox = await bar.boundingBox()
  expect(barBox).not.toBeNull()

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

  const main = page.locator('main')
  await expect(main).toBeVisible()
  const mainBox = await main.boundingBox()
  expect(mainBox).not.toBeNull()
  expect(mainBox!.y + mainBox!.height).toBeLessThanOrEqual(barBox!.y + 1)
}

// Shared tap-target assertions, plus a captured screenshot for the human
// "bar reads as intentional" visual check. boundingBox() is not
// auto-retried (CLAUDE.md), so every element is asserted visible first.
async function assertTapTargetsAndCaptureScreenshot(
  page: Page,
  width: number,
  screenshotPath: string
) {
  const bar = page.getByRole('navigation', { name: 'Navegação principal' })
  const links = bar.getByRole('link')
  const linkCount = await links.count()
  for (let i = 0; i < linkCount; i++) {
    const link = links.nth(i)
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  await page.screenshot({ path: screenshotPath, fullPage: false })
}

for (const width of WIDTHS) {
  test.describe(`CHORE-22: bottom bar layout at ${width}px`, () => {
    test(`AC1: admin has no overflow at ${width}px on /`, async ({ adminPage }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/')
      await assertNoOverflow(adminPage, width)
    })

    test(`AC1: admin has no overflow at ${width}px on /admin/people`, async ({ adminPage }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/admin/people')
      await assertNoOverflow(adminPage, width)
    })

    test(`AC1: member has no overflow at ${width}px on /`, async ({ memberPage }) => {
      await memberPage.setViewportSize({ width, height: 812 })
      await memberPage.goto('/pt-PT/')
      await assertNoOverflow(memberPage, width)
    })

    test(`AC1: member has no overflow at ${width}px on /settings`, async ({ memberPage }) => {
      await memberPage.setViewportSize({ width, height: 812 })
      await memberPage.goto('/pt-PT/settings')
      await assertNoOverflow(memberPage, width)
    })

    test(`AC4: bottom bar does not cover content at the bottom of a long page at ${width}px`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/admin/people')
      await assertBarDoesNotCoverContent(adminPage)
    })

    test(`AC1: admin bottom bar tap targets are >= 44px at ${width}px (screenshot captured)`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/')
      await assertTapTargetsAndCaptureScreenshot(
        adminPage,
        width,
        `test-results-integration/chore-22-bottom-nav-admin-${width}.png`
      )
    })

    test(`AC1: member bottom bar tap targets are >= 44px at ${width}px (screenshot captured)`, async ({
      memberPage,
    }) => {
      await memberPage.setViewportSize({ width, height: 812 })
      await memberPage.goto('/pt-PT/')
      await assertTapTargetsAndCaptureScreenshot(
        memberPage,
        width,
        `test-results-integration/chore-22-bottom-nav-member-${width}.png`
      )
    })
  })
}
