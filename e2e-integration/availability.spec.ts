/**
 * e2e-integration/availability.spec.ts — STORY-26: Member views upcoming
 * Sundays and blocks/unblocks with one tap.
 *
 * FIXTURE COLLISION WARNING: this spec and e2e-integration/blocked-dates.spec.ts
 * (STORY-25) both create/delete `people` rows linked to the same fixed
 * MEMBER_ID fixture (supabase/test-users.mjs). Only one active person can be
 * linked to MEMBER_ID at a time (STORY-11's partial unique index on
 * linked_user_id), so a local parallel run across *both* spec files (not
 * within this single file, which Playwright already runs sequentially per
 * describe block) could collide. CI's `integration-test` job runs with
 * `workers: 1` (single-worker), so this is not a blocker there — but do not
 * assume the fixed MEMBER_ID is safe to share across parallel local workers
 * spanning multiple spec files. Follow the worker-isolated fixture pattern
 * below (STORY-14/STORY-25 precedent) regardless.
 *
 * Real local Supabase + real browser (via the memberPage/adminPage
 * fixtures), fully automated, mapped 1:1 to ACs:
 *   AC1 — 12 upcoming Sunday buttons render, pt-PT-formatted, all available.
 *   AC2 — tap blocks/unblocks a date, persisted via the STORY-25 API.
 *   AC3 — pre-existing blocked dates (seeded before goto) render blocked on
 *         first paint.
 *   AC4 — one date's in-flight toggle disables only that date's control.
 *   AC5 — a failed toggle reverts the UI and announces an error via
 *         aria-live="polite" (not role="alert").
 *   AC6 — no horizontal overflow and >= 44px tap targets at 375px.
 *   AC7 — a Member with no linked person sees the no-linked-person message
 *         with a link to /claim.
 *   AC8 — the availability nav entry is visible and routes correctly for
 *         both Member and Admin.
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { MEMBER_ID } from '../supabase/test-users.mjs'

// ---------------------------------------------------------------------------
// Date helpers — reimplement lib/availability/upcoming-sundays.ts's UTC
// day-offset formula rather than importing it, so this helper alone does NOT
// provide independent verification (a bug shared by both implementations
// would go undetected here). The genuine independent check is the AC1 test's
// separate `Intl.DateTimeFormat('pt-PT', ...)` text assertion, which derives
// the expected pt-PT date strings via a different code path than the
// production `formatSunday`/`next-intl` formatter and would catch a
// date-math bug that this mirrored helper would not.
// ---------------------------------------------------------------------------

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function expectedSundays(count: number, from: Date = new Date()): string[] {
  const year = from.getUTCFullYear()
  const month = from.getUTCMonth()
  const day = from.getUTCDate()
  const daysUntilSunday = (7 - new Date(Date.UTC(year, month, day)).getUTCDay()) % 7

  const sundays: string[] = []
  for (let i = 0; i < count; i++) {
    sundays.push(toDateString(new Date(Date.UTC(year, month, day + daysUntilSunday + i * 7))))
  }
  return sundays
}

// ---------------------------------------------------------------------------
// Fixture management — mirrors e2e-integration/blocked-dates.spec.ts.
// ---------------------------------------------------------------------------

interface FixturePerson {
  id: string
}

async function createLinkedPerson(name: string, linkedUserId: string | null): Promise<FixturePerson> {
  const client = serviceClient()
  const { data, error } = await client
    .from('people')
    .insert({ name, linked_user_id: linkedUserId, is_active: true })
    .select('id')
    .single()

  if (error) throw new Error(`failed to create fixture person: ${JSON.stringify(error)}`)
  return { id: data.id as string }
}

async function deletePerson(id: string): Promise<void> {
  const client = serviceClient()
  await client.from('people').delete().eq('id', id)
}

async function readBlockedDates(personId: string): Promise<string[]> {
  const client = serviceClient()
  const { data, error } = await client
    .from('blocked_dates')
    .select('blocked_date')
    .eq('person_id', personId)
  if (error) throw new Error(`failed to read blocked_dates: ${JSON.stringify(error)}`)
  return (data ?? []).map((row) => row.blocked_date as string)
}

// ---------------------------------------------------------------------------
// AC1, AC2, AC4, AC5, AC6: authenticated Member with a linked person, no
// pre-existing blocks.
// ---------------------------------------------------------------------------

test.describe('STORY-26: availability toggle list (Member, linked person, no blocks)', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`STORY-26 QA Person (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('AC1: renders 12 pt-PT-formatted upcoming Sundays, all available', async ({ memberPage }) => {
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const sundays = expectedSundays(12)

    const buttons = memberPage.locator('main ul li button')
    await expect(buttons).toHaveCount(12)

    for (let i = 0; i < sundays.length; i++) {
      await expect(buttons.nth(i)).toHaveAttribute('aria-pressed', 'false')
    }

    // Verify a button's *visible text* is actually pt-PT-formatted — not
    // just that 12 buttons exist 7 days apart. Compute the expected string
    // via Intl.DateTimeFormat('pt-PT', ...) the same way
    // AvailabilityToggleList's format.dateTime(...) call does (weekday,
    // day, month, year, long form, UTC).
    const firstSundayDate = new Date(`${sundays[0]}T00:00:00Z`)
    const expectedText = new Intl.DateTimeFormat('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(firstSundayDate)

    await expect(buttons.first()).toContainText(expectedText)
  })

  test('AC2: tapping an available Sunday blocks it; tapping again unblocks it', async ({
    memberPage,
  }) => {
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const sundays = expectedSundays(12)
    const targetDate = sundays[0]
    const button = memberPage.locator('main ul li button').first()

    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()

    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => (await readBlockedDates(personId)).includes(targetDate))
      .toBe(true)

    await button.click()

    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect
      .poll(async () => (await readBlockedDates(personId)).includes(targetDate))
      .toBe(false)
  })

  test('AC4: an in-flight toggle disables only that date; other dates stay independently tappable', async ({
    memberPage,
  }) => {
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const buttons = memberPage.locator('main ul li button')
    const first = buttons.nth(0)
    const second = buttons.nth(1)

    const sundays = expectedSundays(12)
    const heldDate = sundays[0]

    let releaseHeldRequest: (() => void) | undefined
    const held = new Promise<void>((resolve) => {
      releaseHeldRequest = resolve
    })

    // Only intercept-and-hold the *targeted* date's request (matched by
    // request body); every other date's request continues immediately, so
    // the second button's own toggle is a genuine independent completion,
    // not merely "unrouted before it could ever be intercepted."
    await memberPage.route('**/api/availability/blocks', async (route) => {
      const body = route.request().postDataJSON() as { date?: string }
      if (body?.date === heldDate) {
        await held
      }
      await route.continue()
    })

    await first.click()
    await expect(first).toBeDisabled()

    // A different date's control must remain independently tappable and
    // complete its own toggle while the first is still pending.
    await expect(second).not.toBeDisabled()
    await second.click()
    await expect(second).toHaveAttribute('aria-pressed', 'true')

    releaseHeldRequest?.()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(first).not.toBeDisabled()
  })

  test('AC5: a failed toggle reverts the UI and announces an error via aria-live="polite"', async ({
    memberPage,
  }) => {
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    await memberPage.route('**/api/availability/blocks', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' })
    })

    const button = memberPage.locator('main ul li button').first()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()

    // Reverts to its previous (available) state.
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    const errorRegion = memberPage.locator('[data-testid="availability-error"]')
    await expect(errorRegion).toBeVisible()
    await expect(errorRegion).toHaveAttribute('aria-live', 'polite')
    await expect(errorRegion).not.toHaveAttribute('role', 'alert')

    // Route-announcer collision guard: this element must not be picked up
    // by a role="alert" locator (Next.js's own __next-route-announcer__
    // already occupies that role elsewhere on the page).
    const roleAlertLocator = memberPage.locator('[role="alert"]')
    const roleAlertCount = await roleAlertLocator.count()
    for (let i = 0; i < roleAlertCount; i++) {
      await expect(roleAlertLocator.nth(i)).not.toHaveAttribute(
        'data-testid',
        'availability-error'
      )
    }
  })

  test('AC6: no horizontal overflow and >= 44px tap targets at 375px viewport', async ({
    memberPage,
  }) => {
    await memberPage.setViewportSize({ width: 375, height: 812 })
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const scrollWidth = await memberPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const buttons = memberPage.locator('main ul li button')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      await expect(button).toBeVisible()
      const box = await button.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)

      // QA regression guard: the date span and the state-label span must
      // have visible breathing room between them (gap-2 utility on the flex
      // container) regardless of pt-PT date-string length, otherwise
      // borderline-length dates visually run together at 375px (e.g.
      // "...2026Disponível").
      const gap = await button.evaluate((el) => {
        const spans = el.querySelectorAll('span')
        const first = spans[0].getBoundingClientRect()
        const second = spans[1].getBoundingClientRect()
        return second.left - first.right
      })
      expect(gap).toBeGreaterThanOrEqual(8)
    }
  })
})

// ---------------------------------------------------------------------------
// AC3: pre-existing blocked dates render blocked on first paint (seed
// before goto, per the BUGFIX-03 lesson).
// ---------------------------------------------------------------------------

test.describe('STORY-26: AC3 pre-existing blocked dates render on first paint', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`STORY-26 QA AC3 (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('a date blocked before navigation renders as blocked on the first render', async ({
    memberPage,
    memberRequest,
  }) => {
    const sundays = expectedSundays(12)
    const preBlockedDate = sundays[1]

    const response = await memberRequest.post('/api/availability/blocks', {
      data: { date: preBlockedDate },
    })
    expect(response.status()).toBe(200)

    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const buttons = memberPage.locator('main ul li button')
    await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true')
    // All other dates remain available.
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false')
  })
})

// ---------------------------------------------------------------------------
// AC7: a Member with no linked person sees the no-linked-person message.
// ---------------------------------------------------------------------------

test.describe('STORY-26: AC7 no linked person', () => {
  test('a Member with no linked person sees the explanatory message and a link to /claim', async ({
    adminPage,
  }) => {
    // ADMIN_ID has no linked people row by default (see
    // e2e-integration/blocked-dates.spec.ts's AC6 test for the same
    // precedent) — reused here deliberately instead of creating a new
    // fixture, since this test's whole point is "no linked person exists".
    await adminPage.goto('/pt-PT/availability')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const claimLink = adminPage.locator('main').getByRole('link', { name: 'Associar conta' })
    await expect(claimLink).toBeVisible()
    await expect(claimLink).toHaveAttribute('href', '/pt-PT/claim')
  })
})

// ---------------------------------------------------------------------------
// AC8: availability nav entry visible and routes correctly for both roles.
// ---------------------------------------------------------------------------

test.describe('STORY-26: AC8 availability nav entry', () => {
  test('Member: nav shows Disponibilidade and routes to /availability', async ({ memberPage }) => {
    await memberPage.goto('/pt-PT/')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const nav = memberPage.getByRole('navigation', { name: 'Navegação principal' })
    const link = nav.getByRole('link', { name: 'Disponibilidade' })
    await expect(link).toBeVisible()
    await link.click()
    await expect(memberPage).toHaveURL(/\/pt-PT\/availability\/?$/)
  })

  test('Admin: nav shows Disponibilidade and routes to /availability', async ({ adminPage }) => {
    await adminPage.goto('/pt-PT/')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const nav = adminPage.getByRole('navigation', { name: 'Navegação principal' })
    const link = nav.getByRole('link', { name: 'Disponibilidade' })
    await expect(link).toBeVisible()
    await link.click()
    await expect(adminPage).toHaveURL(/\/pt-PT\/availability\/?$/)
  })
})
