/**
 * e2e-integration/header-nav-mobile-overflow.spec.ts — BUGFIX-06
 *
 * Closes the AC4 coverage gap: STORY-23 (PR 28) fixed a 375px horizontal-
 * overflow bug in AppHeader.tsx/AppNav.tsx/UserWidget.tsx, but its only
 * regression coverage lived in e2e/header-identity-widget.spec.ts's AC4/AC5,
 * both gated behind `test.skip(!process.env.E2E_WITH_AUTH, ...)` and never
 * run in CI. STORY-17 and STORY-26 each added an admin nav link after that
 * fix landed, and neither re-verified the no-overflow guarantee — the bug
 * regressed twice, undetected by CI.
 *
 * This suite runs unconditionally in the `integration-test` CI job (real
 * local Supabase, real admin/member browser sessions via
 * `adminPage`/`memberPage` from ./fixtures — STORY-26/CHORE-15 pattern,
 * see e2e-integration/app-nav.spec.ts for the precedent this file follows).
 *
 * AC coverage:
 *   AC1 — admin: no horizontal overflow AND a coherent layout (no nav
 *         content wrapping above the logo, avatar stays on the logo's row)
 *         at 375px AND 390px, on `/pt-PT/` and `/pt-PT/admin/people`
 *         (STORY-23 precedent: admin nav's widest page).
 *   AC2 — member: same shape, on `/pt-PT/` and `/pt-PT/settings` (STORY-23
 *         precedent: a member-accessible page beyond home).
 *   AC3 — every nav `<li>` and the avatar trigger have a tap target
 *         >= 44px; a screenshot is captured at both widths as a CI artifact
 *         for the human "stranded last item" visual check documented in the
 *         story's Design decision 1 ("AppNav's justify-end and the stranded
 *         last item" subsection) and Manual Verification notes — this is
 *         NOT an automated pass/fail gate (no pixel-snapshot-diffing
 *         convention exists in this repo), only the positional assertions
 *         above are.
 *   AC4 — this spec file itself, running unconditionally in the
 *         `integration-test` CI job (no E2E_WITH_AUTH gate), IS the AC4
 *         deliverable.
 *
 * Both 375px and 390px (the real device width the bug was reported at) are
 * parametrized via the `WIDTHS` loop below — CI-enforced on every PR, not a
 * manual spot-check, per the story's cycle-1 revision (Challenger CRITICAL
 * #2).
 */

import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

const WIDTHS = [375, 390]

// Shared positional assertions for AC1/AC2: no horizontal overflow, no nav
// content above the logo, avatar stays on the logo's row. Reused across
// admin/member and across pages.
async function assertHeaderLayoutCoherent(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(width)

  const logo = page.getByRole('link', { name: 'Escala' })
  await expect(logo).toBeVisible()
  const logoBox = await logo.boundingBox()
  expect(logoBox).not.toBeNull()

  // The bug's signature: a nav <li> rendering ABOVE the logo (strictly
  // smaller y). A coordinated single wrap keeps every nav item on the
  // logo's row or below it.
  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(nav).toHaveCount(1)
  const links = nav.getByRole('link')
  const linkCount = await links.count()
  for (let i = 0; i < linkCount; i++) {
    const linkBox = await links.nth(i).boundingBox()
    expect(linkBox).not.toBeNull()
    expect(linkBox!.y).toBeGreaterThanOrEqual(logoBox!.y)
  }

  // The avatar must stay on the same row as the logo (mirrors the
  // same-row-assertion pattern in people-table-alignment.spec.ts) — the
  // bug's other signature was the avatar dropping to a third row.
  const avatarTrigger = page.getByTestId('user-widget-trigger')
  await expect(avatarTrigger).toBeVisible()
  const avatarBox = await avatarTrigger.boundingBox()
  expect(avatarBox).not.toBeNull()
  expect(Math.abs(avatarBox!.y - logoBox!.y)).toBeLessThanOrEqual(2)
}

// Shared tap-target assertions for AC3, plus a captured screenshot for the
// human "stranded last item" visual check (Design decision 1's
// justify-end/stranded-item subsection). boundingBox() is not auto-retried
// (CLAUDE.md), so every element is asserted visible first.
async function assertTapTargetsAndCaptureScreenshot(
  page: Page,
  width: number,
  screenshotPath: string
) {
  const nav = page.getByRole('navigation', { name: 'Navegação principal' })
  const links = nav.getByRole('link')
  const linkCount = await links.count()
  for (let i = 0; i < linkCount; i++) {
    const link = links.nth(i)
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  const avatarTrigger = page.getByTestId('user-widget-trigger')
  await expect(avatarTrigger).toBeVisible()
  const avatarBox = await avatarTrigger.boundingBox()
  expect(avatarBox).not.toBeNull()
  expect(avatarBox!.height).toBeGreaterThanOrEqual(44)

  await page.screenshot({ path: screenshotPath, fullPage: false })
}

for (const width of WIDTHS) {
  test.describe(`BUGFIX-06: header/nav mobile overflow at ${width}px`, () => {
    // AC1: admin, /pt-PT/ and /pt-PT/admin/people (STORY-23 precedent: the
    // admin nav's widest page).
    test(`AC1: admin header has no overflow and a coherent layout at ${width}px on /`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/')
      await assertHeaderLayoutCoherent(adminPage, width)
    })

    test(`AC1: admin header has no overflow and a coherent layout at ${width}px on /admin/people`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/admin/people')
      await assertHeaderLayoutCoherent(adminPage, width)
    })

    // AC2: member, /pt-PT/ and /pt-PT/settings (STORY-23 precedent: a
    // member-accessible page beyond home). Member nav has only 1 link
    // (Disponibilidade, STORY-26), so this mainly guards against a future
    // regression once more member-facing nav links are added.
    test(`AC2: member header has no overflow at ${width}px on /`, async ({ memberPage }) => {
      await memberPage.setViewportSize({ width, height: 812 })
      await memberPage.goto('/pt-PT/')
      await assertHeaderLayoutCoherent(memberPage, width)
    })

    test(`AC2: member header has no overflow at ${width}px on /settings`, async ({
      memberPage,
    }) => {
      await memberPage.setViewportSize({ width, height: 812 })
      await memberPage.goto('/pt-PT/settings')
      await assertHeaderLayoutCoherent(memberPage, width)
    })

    // AC3: tap targets >= 44px + screenshot capture. Admin's 4-link nav is
    // the case that exercises the "stranded last item" pattern (Funções
    // wraps alone) — see the story's Manual Verification notes for the
    // human review of this screenshot.
    test(`AC3: admin nav tap targets are >= 44px at ${width}px (screenshot captured)`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/')
      await assertTapTargetsAndCaptureScreenshot(
        adminPage,
        width,
        `test-results-integration/bugfix-06-admin-${width}.png`
      )
    })

    test(`AC3: member nav tap targets are >= 44px at ${width}px (screenshot captured)`, async ({
      memberPage,
    }) => {
      await memberPage.setViewportSize({ width, height: 812 })
      await memberPage.goto('/pt-PT/')
      await assertTapTargetsAndCaptureScreenshot(
        memberPage,
        width,
        `test-results-integration/bugfix-06-member-${width}.png`
      )
    })
  })
}
