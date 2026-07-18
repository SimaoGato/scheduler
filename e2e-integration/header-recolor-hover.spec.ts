/**
 * e2e-integration/header-recolor-hover.spec.ts — CHORE-28: Header recolor +
 * desktop nav design-language rollout.
 *
 * AC2 (Challenge cycle-1 CRITICAL fix): hovering the active nav item must
 * keep its `--brand` background, not fall back to ghost's `--accent` hover.
 * This is the regression test for the twMerge/Slot merge fight the story's
 * Design decision 4 documents — resting-state class presence alone (covered
 * in header-recolor.spec.ts) does not prove the hover override actually
 * wins.
 *
 * Split into its own file (not a `describe` block inside
 * header-recolor.spec.ts) because it needs a file-level
 * `test.use({ channel: 'chromium' })` override, which Playwright forbids
 * inside a `describe` (it forces a new worker — must be top-level in the
 * file or the config).
 *
 * WHY `channel: 'chromium'` is required (not optional polish): Playwright's
 * default headless Chromium project resolves to `chromium_headless_shell`,
 * whose emulated primary pointer defaults to touch. Tailwind v4 compiles
 * every `hover:` utility inside `@media (hover: hover)` (a real CSS feature
 * query, not just the `:hover` pseudo-class), which does NOT match under a
 * touch-primary pointer — even though `element.matches(':hover')` still
 * reports true after a synthetic `page.hover()`. Verified locally: without
 * this override, the hover-regression assertion is trivially true (both
 * resting and hover backgrounds read as fully transparent, because no
 * `hover:` utility — ghost's OR the active override's — ever applies) even
 * against a deliberately unfixed `AppNav.tsx`, i.e. the test would give a
 * false pass with zero regression protection. `channel: 'chromium'`
 * launches the full Chromium binary (already installed by
 * `npx playwright install --with-deps chromium`, which bundles both
 * variants), whose default pointer/hover capabilities match a real desktop
 * browser and make `(hover: hover)` match, so `hover:` utilities actually
 * apply and this test is meaningful.
 *
 * Uses `page.addInitScript` + `localStorage.setItem('theme', 'dark')` to
 * force dark mode, matching the established pattern in
 * e2e/dark-mode.spec.ts (this repo's e2e-integration fixtures do not expose
 * a separate theme-cookie helper).
 */

import { test, expect } from './fixtures'

test.use({ channel: 'chromium' })

for (const theme of ['light', 'dark'] as const) {
  test(`AC2: hovering the active link keeps --brand background, not --accent (${theme} theme)`, async ({
    adminPage,
  }) => {
    if (theme === 'dark') {
      await adminPage.addInitScript(() => {
        window.localStorage.setItem('theme', 'dark')
      })
    }
    await adminPage.goto('/pt-PT/admin/people')

    const nav = adminPage.getByRole('navigation', { name: 'Navegação principal' })
    // Note: Button's `asChild` renders via Radix `Slot`, which merges props
    // (including className) directly onto the child <Link>/<a> — the
    // resting/hover classes live on the <a> itself, not a parent node.
    const activeLink = nav.getByRole('link', { name: 'Equipa' })

    const restingColor = await activeLink.evaluate((el) => getComputedStyle(el).backgroundColor)

    await activeLink.hover()

    const hoverColor = await activeLink.evaluate((el) => getComputedStyle(el).backgroundColor)

    expect(hoverColor).toBe(restingColor)
  })
}
