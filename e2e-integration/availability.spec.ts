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
 *
 * CHORE-19 additions (redesign availability page visual design — Card-based
 * layout): additive-only, nothing above was modified or removed.
 *   - A new `CHORE-19: AC1 availability summary Card` describe block:
 *     available/blocked ICU-plural counts + next-unavailable-or-no-blocks
 *     line, rendered inside a Card (`availability-card` / `availability-summary`
 *     testids), for both a zero-blocks and a some-blocks fixture. Mirrors
 *     home.spec.ts's STORY-30 AC1 two-scenario pattern.
 *   - A new `CHORE-19: AC4 1280px viewport` describe block, mirroring the
 *     existing AC6 375px block but at 1280px (this story's AC4 requires both
 *     viewports; STORY-26 only covered 375px).
 *   - A new `CHORE-19: AC2/AC5 blocked-row badge at 375px` test extending
 *     AC6's 375px coverage with a seeded blocked date, so the new
 *     solid-fill blocked-state badge's tap target and span-gap are
 *     exercised against a real blocked row (not just available-state rows).
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { MEMBER_ID } from '../supabase/test-users.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// pt-PT messages helper (CHORE-10 / STORY-19 convention), mirrored from
// home.spec.ts.
// ---------------------------------------------------------------------------

function ptMessages(): Record<string, Record<string, string>> {
  const raw = readFileSync(join(__dirname, '..', 'messages', 'pt-PT.json'), 'utf8')
  return JSON.parse(raw)
}

// Renders a `{count, plural, one {...} other {...}}`-only ICU template for a
// given count, substituting `#` with the count. Mirrored from home.spec.ts.
//
// CHORE-26: both plural branches are now wrapped in `<num>...</num>` (the
// t.rich() render-prop tag consumed by the real component to apply
// font-mono) — strip the tags before substituting `#`, since this helper
// does its own raw-string substitution rather than going through t.rich().
function renderPlural(template: string, count: number): string {
  const match = template.match(/^\{count, plural, one \{([^}]*)\} other \{([^}]*)\}\}$/)
  if (!match) throw new Error(`template is not a bare ICU plural block: ${template}`)
  const branch = count === 1 ? match[1] : match[2]
  return branch.replace(/<\/?num>/g, '').replace('#', String(count))
}

function formatPtDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

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

    // CHORE-26 AC2: the row-date span uses the font-mono token.
    await expect(buttons.first().locator('span').first()).toHaveCSS(
      'font-family',
      /JetBrains Mono/
    )
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

// ---------------------------------------------------------------------------
// CHORE-19 AC1: summary (available/blocked counts, next-unavailable date)
// renders inside a Card, live-accurate from the sundays + blockedDates
// state — no new Supabase queries/API routes involved.
// ---------------------------------------------------------------------------

test.describe('CHORE-19: AC1 availability summary Card', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`CHORE-19 QA Person (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('zero blocks: shows 12 available / 0 blocked and the no-upcoming-blocks line', async ({
    memberPage,
  }) => {
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const messages = ptMessages()

    const card = memberPage.getByTestId('availability-card')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('data-slot', 'card')
    await expect(card.getByRole('heading', { level: 1 })).toBeVisible()

    const summary = memberPage.getByTestId('availability-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryAvailableCount, 12))
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryBlockedCount, 0))
    await expect(summary).toContainText(
      messages.Availability.summaryNoUpcomingBlocks.replace('{total}', '12')
    )

    // WARNING 2 (PR #55 review): summaryIntro ("Nos próximos {total}
    // domingos:") is a CardDescription sibling of availability-summary, not
    // inside it — assert it on the Card itself so a typo or a dropped
    // {total} interpolation is caught.
    await expect(card).toContainText(
      messages.Availability.summaryIntro.replace('{total}', '12')
    )

    // CHORE-26 AC1: the available/blocked count numerals use font-mono.
    await expect(memberPage.getByTestId('availability-available-numeral')).toHaveCSS(
      'font-family',
      /JetBrains Mono/
    )
    await expect(memberPage.getByTestId('availability-blocked-numeral')).toHaveCSS(
      'font-family',
      /JetBrains Mono/
    )
  })

  test('two blocked dates: shows 10 available / 2 blocked and the earliest next-unavailable date', async ({
    memberPage,
    memberRequest,
  }) => {
    const sundays = expectedSundays(12)
    const earlier = sundays[2]
    const later = sundays[5]

    for (const date of [later, earlier]) {
      const response = await memberRequest.post('/api/availability/blocks', { data: { date } })
      expect(response.status()).toBe(200)
    }

    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const messages = ptMessages()
    const summary = memberPage.getByTestId('availability-summary')
    await expect(summary).toBeVisible()

    await expect(summary).toContainText(renderPlural(messages.Availability.summaryAvailableCount, 10))
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryBlockedCount, 2))

    // CHORE-26: summaryNextUnavailable's {date} placeholder is now wrapped in
    // <num>...</num> in the source template — strip the tags before
    // substituting, since this comparison is built by hand rather than
    // through t.rich().
    const expectedNextUnavailableText = messages.Availability.summaryNextUnavailable
      .replace(/<\/?num>/g, '')
      .replace('{date}', formatPtDate(earlier))
    await expect(summary).toContainText(expectedNextUnavailableText)
    await expect(summary).not.toContainText(
      messages.Availability.summaryNoUpcomingBlocks.replace('{total}', '12')
    )

    // CHORE-26 AC3: the next-blocked-Sunday date value uses font-mono.
    await expect(memberPage.getByTestId('availability-next-blocked-date')).toHaveCSS(
      'font-family',
      /JetBrains Mono/
    )
  })

  test('toggling a Sunday live-updates the summary counts without reloading', async ({
    memberPage,
  }) => {
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const messages = ptMessages()
    const summary = memberPage.getByTestId('availability-summary')
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryAvailableCount, 12))
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryBlockedCount, 0))

    const button = memberPage.locator('main ul li button').first()
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')

    await expect(summary).toContainText(renderPlural(messages.Availability.summaryAvailableCount, 11))
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryBlockedCount, 1))
  })
})

// ---------------------------------------------------------------------------
// CHORE-19 AC4: no horizontal overflow and >= 44px tap targets at 1280px
// (STORY-26's AC6 only covered 375px).
// ---------------------------------------------------------------------------

test.describe('CHORE-19: AC4 1280px viewport', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`CHORE-19 QA 1280 (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('no horizontal overflow and >= 44px tap targets at 1280px viewport', async ({ memberPage }) => {
    await memberPage.setViewportSize({ width: 1280, height: 900 })
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const scrollWidth = await memberPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(1280)

    const card = memberPage.getByTestId('availability-card')
    await expect(card).toBeVisible()
    const summary = memberPage.getByTestId('availability-summary')
    await expect(summary).toBeVisible()

    const buttons = memberPage.locator('main ul li button')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      await expect(button).toBeVisible()
      const box = await button.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

// ---------------------------------------------------------------------------
// CHORE-19 AC2/AC5: the blocked-state badge (bg-destructive
// text-destructive-foreground on the stateLabel span) at 375px, against a
// real seeded blocked date — the pre-existing AC6 375px test only exercised
// available-state rows.
// ---------------------------------------------------------------------------

test.describe('CHORE-19: AC2/AC5 blocked-row badge at 375px', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`CHORE-19 QA Blocked (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('a blocked row keeps >= 44px tap target, >= 8px span gap, and no horizontal overflow at 375px', async ({
    memberPage,
    memberRequest,
  }) => {
    const sundays = expectedSundays(12)
    const blockedDate = sundays[0]

    const response = await memberRequest.post('/api/availability/blocks', { data: { date: blockedDate } })
    expect(response.status()).toBe(200)

    await memberPage.setViewportSize({ width: 375, height: 812 })
    await memberPage.goto('/pt-PT/availability')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const scrollWidth = await memberPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const blockedButton = memberPage.locator('main ul li button').first()
    await expect(blockedButton).toHaveAttribute('aria-pressed', 'true')
    await expect(blockedButton).toBeVisible()

    const box = await blockedButton.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)

    const gap = await blockedButton.evaluate((el) => {
      const spans = el.querySelectorAll('span')
      const first = spans[0].getBoundingClientRect()
      const second = spans[1].getBoundingClientRect()
      return second.left - first.right
    })
    expect(gap).toBeGreaterThanOrEqual(8)

    // WARNING 1 (PR #55 review): assert the blocked-row state-label span
    // actually carries the solid-fill destructive badge classes, so a future
    // refactor that silently drops them fails this test instead of only the
    // CSS-token-only e2e/availability-destructive-contrast.spec.ts check.
    const stateLabel = blockedButton.locator('span').nth(1)
    await expect(stateLabel).toHaveClass(/bg-destructive/)
    await expect(stateLabel).toHaveClass(/text-destructive-foreground/)

    // CHORE-26 AC2/AC4: the badge span must NOT pick up the font-mono
    // treatment on an actual blocked row (not just the available-state
    // default) — proves the numeral/date-vs-badge split holds in the
    // solid-fill blocked state too.
    await expect(stateLabel).not.toHaveCSS('font-family', /JetBrains Mono/)
  })
})
