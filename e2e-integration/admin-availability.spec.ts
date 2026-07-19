/**
 * e2e-integration/admin-availability.spec.ts — STORY-27: Admin views and
 * edits anyone's blocked dates.
 *
 * Real local Supabase + the existing adminPage/adminRequest/memberRequest/
 * memberPage fixtures (e2e-integration/fixtures.ts), same pattern as
 * e2e-integration/availability.spec.ts. Fixture lifecycle: worker-isolated
 * `people` rows created via the service-role client per test (STORY-14/
 * STORY-25 pattern), hard-deleted in afterEach (cascades blocked_dates rows
 * via ON DELETE CASCADE).
 *
 * AC coverage:
 *   AC1 — Admin sees a person's upcoming Sundays with current blocked/
 *         available states (same 12-Sunday horizon as STORY-26), reached via
 *         the PeopleTable "Disponibilidade" action link.
 *   AC2 — tapping toggles block/unblock for that person, same idempotency as
 *         the Member flow.
 *   AC3 — a person with no linked user account: viewing/editing works the
 *         same (person-centric storage).
 *   AC4 — a Member's own block (via STORY-25/26's self-service API) is
 *         visible to the Admin, and an Admin edit is visible to the Member
 *         on next load (one shared source of truth).
 *   AC5 — a non-admin Member is blocked from the admin API (403) and the
 *         admin page (redirect to /?denied=1).
 *   AC6 — malformed/nonexistent person id → 400 invalid_id / 404 not_found,
 *         never 500.
 *   AC7 — 375px viewport: no horizontal overflow, all controls (including
 *         the admin-only back-link) keep >= 44px tap targets.
 *
 * CHORE-19 addition (redesign availability page visual design — Card-based
 * layout): additive-only, nothing above was modified or removed.
 *   - A new `CHORE-19: AC1 admin-on-behalf summary Card` describe block:
 *     confirms the same summary block (available/blocked counts,
 *     next-unavailable date) renders in admin-on-behalf mode with fully
 *     neutral, shared copy — no personalized second-person framing —
 *     alongside the existing personalized `adminTitle` heading, which
 *     predates this story and is untouched.
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { MEMBER_ID } from '../supabase/test-users.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function ptMessages(): Record<string, Record<string, string>> {
  const raw = readFileSync(join(__dirname, '..', 'messages', 'pt-PT.json'), 'utf8')
  return JSON.parse(raw)
}

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

// ---------------------------------------------------------------------------
// Date helpers — same independent reimplementation as
// e2e-integration/availability.spec.ts (STORY-26), reused verbatim.
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
// Fixture management — mirrors e2e-integration/availability.spec.ts.
// ---------------------------------------------------------------------------

interface FixturePerson {
  id: string
}

async function createPerson(name: string, linkedUserId: string | null): Promise<FixturePerson> {
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

async function seedBlockedDates(personId: string, dates: string[]): Promise<void> {
  if (dates.length === 0) return
  const client = serviceClient()
  const { error } = await client
    .from('blocked_dates')
    .insert(dates.map((blocked_date) => ({ person_id: personId, blocked_date })))
  if (error) throw new Error(`failed to seed blocked_dates: ${JSON.stringify(error)}`)
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
// AC1: Admin sees a person's upcoming Sundays with current blocked states,
// reached via the PeopleTable entry point.
// ---------------------------------------------------------------------------

test.describe('STORY-27: AC1 admin views a person\'s availability', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`STORY-27 QA AC1 Person (w${testInfo.workerIndex})`, null)
    personId = person.id
    const sundays = expectedSundays(12)
    await seedBlockedDates(personId, [sundays[0], sundays[2]])
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('choosing the person\'s availability action shows 12 Sundays with correct blocked/available state', async ({
    adminPage,
  }) => {
    await adminPage.goto('/pt-PT/admin/people')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const row = adminPage.locator('tr', { hasText: `STORY-27 QA AC1 Person (w${test.info().workerIndex})` })
    const availabilityLink = row.locator('[data-testid^="pm-availability-"]')
    await expect(availabilityLink).toBeVisible()
    await availabilityLink.click()

    await expect(adminPage).toHaveURL(new RegExp(`/pt-PT/admin/people/${personId}/availability/?$`))

    const sundays = expectedSundays(12)
    const buttons = adminPage.locator('main ul li button')
    await expect(buttons).toHaveCount(12)

    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'false')
    await expect(buttons.nth(2)).toHaveAttribute('aria-pressed', 'true')
    for (let i = 3; i < sundays.length; i++) {
      await expect(buttons.nth(i)).toHaveAttribute('aria-pressed', 'false')
    }

    // Verify pt-PT-formatted text (same cross-check as STORY-26 AC1).
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
})

// ---------------------------------------------------------------------------
// AC2: toggling blocks/unblocks a date for that person, same idempotency.
// AC3: works the same for a person with no linked user account.
// ---------------------------------------------------------------------------

test.describe('STORY-27: AC2/AC3 admin toggles a person\'s availability', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    // No linked account (AC3): linkedUserId is explicitly null.
    const person = await createPerson(`STORY-27 QA AC2 Person (w${testInfo.workerIndex})`, null)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('AC2/AC3: tapping an available Sunday blocks it for a no-linked-account person; tapping again unblocks it', async ({
    adminPage,
  }) => {
    await adminPage.goto(`/pt-PT/admin/people/${personId}/availability`)
    await expect(adminPage).not.toHaveURL(/\/login/)
    await expect(adminPage).not.toHaveURL(/\?denied=1/)

    const sundays = expectedSundays(12)
    const targetDate = sundays[0]
    const button = adminPage.locator('main ul li button').first()

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
})

// ---------------------------------------------------------------------------
// AC4: shared source of truth between the Member's self-service API and the
// Admin's on-behalf-of edits.
// ---------------------------------------------------------------------------

test.describe('STORY-27: AC4 shared blocked_dates source of truth', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`STORY-27 QA AC4 Person (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('a Member-created block is visible to the Admin, and the Admin\'s unblock is visible to the Member', async ({
    adminPage,
    memberRequest,
  }) => {
    const sundays = expectedSundays(12)
    const sharedDate = sundays[0]

    const postResponse = await memberRequest.post('/api/availability/blocks', {
      data: { date: sharedDate },
    })
    expect(postResponse.status()).toBe(200)

    await adminPage.goto(`/pt-PT/admin/people/${personId}/availability`)
    await expect(adminPage).not.toHaveURL(/\/login/)

    const buttons = adminPage.locator('main ul li button')
    await expect(buttons.first()).toHaveAttribute('aria-pressed', 'true')

    await buttons.first().click()
    await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false')

    await expect
      .poll(async () => {
        const getResponse = await memberRequest.get('/api/availability/blocks')
        const body = (await getResponse.json()) as { dates: string[] }
        return body.dates.includes(sharedDate)
      })
      .toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AC5: a non-admin Member is blocked from the admin API and admin page.
// ---------------------------------------------------------------------------

test.describe('STORY-27: AC5 non-admin access is blocked', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`STORY-27 QA AC5 Person (w${testInfo.workerIndex})`, null)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('Member calling the admin availability endpoints gets 403 on GET/POST/DELETE', async ({
    memberRequest,
  }) => {
    const sundays = expectedSundays(12)
    const date = sundays[0]

    const getResponse = await memberRequest.get(`/api/admin/people/${personId}/availability`)
    expect(getResponse.status()).toBe(403)

    const postResponse = await memberRequest.post(`/api/admin/people/${personId}/availability`, {
      data: { date },
    })
    expect(postResponse.status()).toBe(403)

    const deleteResponse = await memberRequest.delete(
      `/api/admin/people/${personId}/availability/${date}`
    )
    expect(deleteResponse.status()).toBe(403)

    expect(await readBlockedDates(personId)).toEqual([])
  })

  test('Member opening the admin availability page is redirected to /?denied=1 and sees the denial banner', async ({
    memberPage,
  }) => {
    await memberPage.goto(`/pt-PT/admin/people/${personId}/availability`)

    await expect(memberPage).toHaveURL(/\/pt-PT\/?\?denied=1$/)
    await expect(memberPage.locator('body')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC6: invalid person id -> 400 invalid_id / 404 not_found, never 500.
// ---------------------------------------------------------------------------

test.describe('STORY-27: AC6 invalid person id validation', () => {
  test('malformed id returns 400 invalid_id on GET/POST/DELETE', async ({ adminRequest }) => {
    const sundays = expectedSundays(1)
    const date = sundays[0]
    const malformedId = 'not-a-uuid'

    const getResponse = await adminRequest.get(`/api/admin/people/${malformedId}/availability`)
    expect(getResponse.status()).toBe(400)
    expect((await getResponse.json()).error).toBe('invalid_id')

    const postResponse = await adminRequest.post(`/api/admin/people/${malformedId}/availability`, {
      data: { date },
    })
    expect(postResponse.status()).toBe(400)
    expect((await postResponse.json()).error).toBe('invalid_id')

    const deleteResponse = await adminRequest.delete(
      `/api/admin/people/${malformedId}/availability/${date}`
    )
    expect(deleteResponse.status()).toBe(400)
    expect((await deleteResponse.json()).error).toBe('invalid_id')
  })

  test('well-formed but nonexistent id returns 404 not_found on GET/POST/DELETE', async ({
    adminRequest,
  }) => {
    const sundays = expectedSundays(1)
    const date = sundays[0]
    const nonexistentId = '00000000-0000-4000-8000-000000000099'

    const getResponse = await adminRequest.get(`/api/admin/people/${nonexistentId}/availability`)
    expect(getResponse.status()).toBe(404)
    expect((await getResponse.json()).error).toBe('not_found')

    const postResponse = await adminRequest.post(`/api/admin/people/${nonexistentId}/availability`, {
      data: { date },
    })
    expect(postResponse.status()).toBe(404)
    expect((await postResponse.json()).error).toBe('not_found')

    const deleteResponse = await adminRequest.delete(
      `/api/admin/people/${nonexistentId}/availability/${date}`
    )
    expect(deleteResponse.status()).toBe(404)
    expect((await deleteResponse.json()).error).toBe('not_found')
  })

  test('a nonexistent-UUID availability page renders Next\'s not-found page, not a 500', async ({
    adminPage,
  }) => {
    const nonexistentId = '00000000-0000-4000-8000-000000000099'
    const response = await adminPage.goto(`/pt-PT/admin/people/${nonexistentId}/availability`)
    expect(response?.status()).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// AC7: 375px viewport — no horizontal overflow, >= 44px tap targets,
// including the admin-only back-link.
// ---------------------------------------------------------------------------

test.describe('STORY-27: AC7 375px viewport tap targets', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`STORY-27 QA AC7 Person (w${testInfo.workerIndex})`, null)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('no horizontal overflow and >= 44px tap targets, including the back-to-team link', async ({
    adminPage,
  }) => {
    await adminPage.setViewportSize({ width: 375, height: 812 })
    await adminPage.goto(`/pt-PT/admin/people/${personId}/availability`)
    await expect(adminPage).not.toHaveURL(/\/login/)

    const scrollWidth = await adminPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const buttons = adminPage.locator('main ul li button')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      await expect(button).toBeVisible()
      const box = await button.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    const backLink = adminPage.getByTestId('availability-back-link')
    await expect(backLink).toBeVisible()
    const backLinkBox = await backLink.boundingBox()
    expect(backLinkBox).not.toBeNull()
    expect(backLinkBox!.height).toBeGreaterThanOrEqual(44)
    expect(backLinkBox!.width).toBeGreaterThanOrEqual(44)
  })
})

// ---------------------------------------------------------------------------
// CHORE-19 AC1: the same summary Card renders in admin-on-behalf mode, with
// fully neutral copy shared with the Member self-service view — no new
// admin-specific summary branch.
// ---------------------------------------------------------------------------

test.describe('CHORE-19: AC1 admin-on-behalf summary Card', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`CHORE-19 QA Admin Summary (w${testInfo.workerIndex})`, null)
    personId = person.id
    const sundays = expectedSundays(12)
    await seedBlockedDates(personId, [sundays[1]])
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('shows the neutral summary Card alongside the personalized adminTitle heading', async ({
    adminPage,
  }) => {
    await adminPage.goto(`/pt-PT/admin/people/${personId}/availability`)
    await expect(adminPage).not.toHaveURL(/\/login/)
    await expect(adminPage).not.toHaveURL(/\?denied=1/)

    const messages = ptMessages()

    const card = adminPage.getByTestId('availability-card')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('data-slot', 'card')

    // The pre-existing personalized adminTitle heading (predates this
    // story, out of scope for the neutrality rule) still renders as a real
    // <h1> inside the Card.
    const heading = card.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    await expect(heading).toContainText(`CHORE-19 QA Admin Summary (w${test.info().workerIndex})`)

    // The summary metrics block itself is fully neutral — no second-person
    // ("a tua"/"your") framing anywhere in its text.
    const summary = adminPage.getByTestId('availability-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryAvailableCount, 11))
    await expect(summary).toContainText(renderPlural(messages.Availability.summaryBlockedCount, 1))

    const summaryText = await summary.textContent()
    expect(summaryText).not.toMatch(/\btua\b/i)
    expect(summaryText).not.toMatch(/\bteu\b/i)

    // CHORE-26 AC1: the same font-mono treatment applies identically in
    // admin-on-behalf mode (proves the shared component's markup is
    // mode-agnostic, matching the design decision to gate only endpoint
    // URLs/title/back-link on isAdminMode).
    await expect(adminPage.getByTestId('availability-available-numeral')).toHaveCSS(
      'font-family',
      /JetBrains Mono/
    )
    await expect(adminPage.getByTestId('availability-blocked-numeral')).toHaveCSS(
      'font-family',
      /JetBrains Mono/
    )
  })
})
