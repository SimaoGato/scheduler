/**
 * e2e-integration/header-recolor.spec.ts — CHORE-28: Header recolor +
 * desktop nav design-language rollout.
 *
 * Auth-gated via the existing adminPage/memberPage fixtures (./fixtures),
 * runs unconditionally in the `integration-test` CI job (STORY-26/CHORE-15
 * pattern). Theme-invariant class assertions only for AC1/AC2/AC3 (the
 * static suite in e2e/header-surface-tokens.spec.ts already covers
 * cross-theme color correctness) except for the hover-regression test,
 * which does toggle dark mode via `page.addInitScript` +
 * `localStorage.setItem('theme', 'dark')`, matching the established pattern
 * in e2e/dark-mode.spec.ts (this repo's e2e-integration fixtures do not
 * expose a separate theme-cookie helper).
 *
 * AC coverage:
 *   AC1 — <header> has bg-header and text-header-foreground classes.
 *   AC2 — the current route's nav item has bg-brand/text-brand-foreground
 *         and aria-current="page"; other items have neither. Includes the
 *         sub-route prefix-match regression case (worker-isolated fixture
 *         person, per STORY-14/25/27 pattern). The hover-regression case
 *         (active item's computed background-color stays --brand on hover,
 *         in both light and dark theme) lives in the sibling file
 *         e2e-integration/header-recolor-hover.spec.ts — see that file's
 *         header comment for why it needs its own file.
 *   AC3 — wordmark still navigates home and has font-bold/tracking-wider
 *         classes.
 *   AC4 — the user-widget dropdown panel has text-foreground (Design
 *         decision 3's required inherited-color fix).
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'

interface FixturePerson {
  id: string
}

async function createPerson(name: string): Promise<FixturePerson> {
  const client = serviceClient()
  const { data, error } = await client
    .from('people')
    .insert({ name, linked_user_id: null, is_active: true })
    .select('id')
    .single()

  if (error) throw new Error(`failed to create fixture person: ${JSON.stringify(error)}`)
  return { id: data.id as string }
}

async function deletePerson(id: string): Promise<void> {
  const client = serviceClient()
  await client.from('people').delete().eq('id', id)
}

// ---------------------------------------------------------------------------
// AC1: header surface classes.
// ---------------------------------------------------------------------------

test('AC1: <header> has bg-header and text-header-foreground classes', async ({ adminPage }) => {
  await adminPage.goto('/pt-PT/')
  const header = adminPage.locator('header')
  await expect(header).toBeVisible()
  const className = await header.getAttribute('class')
  expect(className).toMatch(/\bbg-header\b/)
  expect(className).toMatch(/\btext-header-foreground\b/)
})

// ---------------------------------------------------------------------------
// AC2: active-item brand fill + aria-current, inactive items have neither.
// ---------------------------------------------------------------------------

test('AC2: on /pt-PT/admin/people (admin), the Equipa link is active; other links are not', async ({
  adminPage,
}) => {
  await adminPage.goto('/pt-PT/admin/people')
  const nav = adminPage.getByRole('navigation', { name: 'Navegação principal' })

  // Note: Button's `asChild` renders via Radix `Slot`, which merges props
  // (including className) directly onto the child <Link>/<a> — there is no
  // separate wrapper element. The active-state classes therefore live on
  // the <a> itself, not a parent node.
  const activeLink = nav.getByRole('link', { name: 'Equipa' })
  await expect(activeLink).toHaveAttribute('aria-current', 'page')
  const activeClass = await activeLink.getAttribute('class')
  expect(activeClass).toMatch(/\bbg-brand\b/)
  expect(activeClass).toMatch(/\btext-brand-foreground\b/)

  for (const label of ['Disponibilidade', 'Utilizadores', 'Funções']) {
    const link = nav.getByRole('link', { name: label })
    await expect(link).not.toHaveAttribute('aria-current', 'page')
    const className = await link.getAttribute('class')
    expect(className).not.toMatch(/\bbg-brand\b/)
  }
})

test('AC2: on /pt-PT/availability (member), the sole Disponibilidade link is active', async ({
  memberPage,
}) => {
  // The member's only nav destination is /availability, not / — visiting
  // home (/) leaves no nav item active, so this test navigates to the
  // link's own target to exercise the active-state match.
  await memberPage.goto('/pt-PT/availability')
  const nav = memberPage.getByRole('navigation', { name: 'Navegação principal' })

  const activeLink = nav.getByRole('link', { name: 'Disponibilidade' })
  await expect(activeLink).toHaveAttribute('aria-current', 'page')
  const activeClass = await activeLink.getAttribute('class')
  expect(activeClass).toMatch(/\bbg-brand\b/)
})

test.describe('AC2: sub-route prefix-match regression', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`CHORE-28 QA Sub-route Person (w${testInfo.workerIndex})`)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('on a /admin/people/<id>/skills sub-route (admin), Equipa is still marked active', async ({
    adminPage,
  }) => {
    await adminPage.goto(`/pt-PT/admin/people/${personId}/skills`)
    await expect(adminPage).not.toHaveURL(/\/login/)

    const nav = adminPage.getByRole('navigation', { name: 'Navegação principal' })
    const activeLink = nav.getByRole('link', { name: 'Equipa' })
    await expect(activeLink).toHaveAttribute('aria-current', 'page')
  })
})

// AC2's hover-regression case (Challenge cycle-1 CRITICAL fix) lives in its
// own file, e2e-integration/header-recolor-hover.spec.ts — it needs a
// file-level `test.use({ channel: 'chromium' })`, which Playwright forbids
// inside a `describe` block (it forces a new worker). See that file's
// header comment for why the channel override is required for the
// assertion to be meaningful at all.

// ---------------------------------------------------------------------------
// AC3: wordmark navigates home, has font-bold/tracking-wider classes.
// ---------------------------------------------------------------------------

test('AC3: wordmark still navigates home and has font-bold/tracking-wider classes', async ({
  adminPage,
}) => {
  await adminPage.goto('/pt-PT/admin/people')
  const wordmark = adminPage.getByRole('link', { name: 'Escala' })
  const className = await wordmark.getAttribute('class')
  expect(className).toMatch(/\bfont-bold\b/)
  expect(className).toMatch(/\btracking-wider\b/)

  await wordmark.click()
  await expect(adminPage).toHaveURL(/\/pt-PT\/?$/)
})

// ---------------------------------------------------------------------------
// AC4: dropdown panel text-foreground regression test (Design decision 3).
// ---------------------------------------------------------------------------

test('AC4: the open user-widget dropdown panel has text-foreground (not inherited navy text)', async ({
  adminPage,
}) => {
  await adminPage.goto('/pt-PT/')
  const trigger = adminPage.getByTestId('user-widget-trigger')
  await trigger.click()

  const panel = adminPage.getByTestId('user-widget-menu')
  await expect(panel).toBeVisible()
  const className = await panel.getAttribute('class')
  expect(className).toMatch(/\btext-foreground\b/)
})
