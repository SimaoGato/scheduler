/**
 * e2e-integration/home.spec.ts — STORY-30: Home page becomes a personal
 * availability quick-overview.
 *
 * Real local Supabase integration suite (see e2e-integration/fixtures.ts and
 * CHORE-05) — runs in the `integration-test` CI job, never in
 * `npm run test:e2e`. Mirrors the fixture conventions in
 * e2e-integration/availability.spec.ts and e2e-integration/claim-no-records.spec.ts
 * (worker-isolated fixture names, serviceClient reads/writes, afterEach/
 * finally cleanup).
 *
 * AC coverage:
 *   AC1 — Member with a linked person sees an availability summary (12/0
 *         then 10/2 available/blocked) with the earliest next-blocked date,
 *         and a link to /availability.
 *   AC2 — Member with no linked person sees the reused no-linked-person
 *         guidance instead of a summary.
 *   AC3 — Admin sees active-people/active-roles counts (delta-based) and
 *         three quick links reusing Nav.* labels/routes.
 *   AC4 — the "N pessoas com bloqueios registados nos próximos 30 dias"
 *         metric reflects real DB state and, per revision cycle 1, excludes
 *         soft-deleted people's stale blocks (regression test).
 *   AC5 — 375px viewport: no horizontal overflow, >= 44px tap targets.
 *   AC6 — i18n key parity: covered globally by e2e/i18n-key-parity.spec.ts.
 *
 * CHORE-18 additions (redesign home page visual design — Card-based layout):
 * additive-only, nothing above was modified or removed.
 *   - `data-slot="card"` assertions on member-availability-summary,
 *     admin-team-summary, and admin-quick-links (proves the testid'd element
 *     is Card's own root, not just an ancestor).
 *   - `getByRole('heading', { level: 1|2 })` assertions scoped to each
 *     testid'd container (proves the existing <h1>/<h2> heading elements
 *     survive being nested inside CardTitle, per the story's Design
 *     decision 6 / Challenge cycle 1 CRITICAL fix).
 *   - A new `CHORE-18: AC4 desktop viewport (1280px)` describe block below,
 *     mirroring the existing 375px block (this story's AC4 requires both
 *     375px and 1280px coverage; STORY-30 only had 375px).
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { MEMBER_ID } from '../supabase/test-users.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// pt-PT messages helper (CHORE-10 / STORY-19 convention): extract exact
// strings from messages/pt-PT.json at test-authoring time rather than
// hand-duplicating copy.
// ---------------------------------------------------------------------------

function ptMessages(): Record<string, Record<string, string>> {
  const raw = readFileSync(join(__dirname, '..', 'messages', 'pt-PT.json'), 'utf8')
  return JSON.parse(raw)
}

// Renders a `{count, plural, one {...} other {...}}`-only ICU template
// (the entire string is the plural block, no surrounding text) for a given
// count, substituting `#` with the count. Matches the exact shape of
// Home.adminActivePeopleCount / adminActiveRolesCount / adminBlocksNext30Days
// / memberSummaryAvailableCount / memberSummaryBlockedCount.
function renderPlural(template: string, count: number): string {
  const match = template.match(/^\{count, plural, one \{([^}]*)\} other \{([^}]*)\}\}$/)
  if (!match) throw new Error(`template is not a bare ICU plural block: ${template}`)
  const branch = count === 1 ? match[1] : match[2]
  return branch.replace('#', String(count))
}

// ---------------------------------------------------------------------------
// Date helpers — reimplements lib/availability/upcoming-sundays.ts's UTC
// day-offset formula independently (same precedent as
// e2e-integration/availability.spec.ts), so this file alone is not the only
// verification of the date math.
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

// A date 10 days from now (well within the next-30-days AC4 window and
// distinct from the 12-Sunday-horizon dates used by AC1).
function dateWithinNext30Days(): string {
  const now = new Date()
  return toDateString(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10)))
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

async function setPersonActive(id: string, isActive: boolean): Promise<void> {
  const client = serviceClient()
  const { error } = await client.from('people').update({ is_active: isActive }).eq('id', id)
  if (error) throw new Error(`failed to set is_active on fixture person: ${JSON.stringify(error)}`)
}

async function insertBlockedDate(personId: string, date: string): Promise<void> {
  const client = serviceClient()
  const { error } = await client.from('blocked_dates').insert({ person_id: personId, blocked_date: date })
  if (error) throw new Error(`failed to insert blocked_date: ${JSON.stringify(error)}`)
}

async function deleteBlockedDate(personId: string, date: string): Promise<void> {
  const client = serviceClient()
  await client.from('blocked_dates').delete().eq('person_id', personId).eq('blocked_date', date)
}

async function activePeopleCount(): Promise<number> {
  const client = serviceClient()
  const { count, error } = await client
    .from('people')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  if (error) throw new Error(`failed to count active people: ${JSON.stringify(error)}`)
  return count ?? 0
}

async function activeRolesCount(): Promise<number> {
  const client = serviceClient()
  const { count, error } = await client
    .from('roles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  if (error) throw new Error(`failed to count active roles: ${JSON.stringify(error)}`)
  return count ?? 0
}

async function createRole(name: string): Promise<{ id: string }> {
  const client = serviceClient()
  const { data, error } = await client
    .from('roles')
    .insert({ name, default_slots: 1, is_active: true })
    .select('id')
    .single()
  if (error) throw new Error(`failed to create fixture role: ${JSON.stringify(error)}`)
  return { id: data.id as string }
}

async function deleteRole(id: string): Promise<void> {
  const client = serviceClient()
  await client.from('roles').delete().eq('id', id)
}

// ---------------------------------------------------------------------------
// AC1: Member, linked person — availability summary.
// ---------------------------------------------------------------------------

test.describe('STORY-30: AC1 Member availability summary (linked person)', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`STORY-30 QA Person (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('zero blocks: shows 12 available / 0 blocked and the fully-available line', async ({
    memberPage,
  }) => {
    await memberPage.goto('/pt-PT/')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const messages = ptMessages()
    const summary = memberPage.getByTestId('member-availability-summary')
    await expect(summary).toBeVisible()

    await expect(summary).toContainText(renderPlural(messages.Home.memberSummaryAvailableCount, 12))
    await expect(summary).toContainText(renderPlural(messages.Home.memberSummaryBlockedCount, 0))
    await expect(summary).toContainText(
      messages.Home.memberSummaryNoUpcomingBlocks.replace('{total}', '12')
    )

    const link = summary.getByRole('link', { name: messages.Home.memberSummaryLink })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/pt-PT/availability')

    // CHORE-18 AC2/AC3: member-availability-summary is itself Card's root
    // element (not just an ancestor), and its heading survives the
    // CardTitle wrap as a real <h1>.
    await expect(summary).toHaveAttribute('data-slot', 'card')
    await expect(summary.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('two blocked dates: shows 10 available / 2 blocked and the earliest next-blocked date', async ({
    memberPage,
    memberRequest,
  }) => {
    const sundays = expectedSundays(12)
    const earlier = sundays[2]
    const later = sundays[5]

    // Seed via the real API, mirroring availability.spec.ts's AC3 technique
    // (seed before goto — BUGFIX-03 lesson: server-rendered initial props,
    // not a same-session client interaction).
    for (const date of [later, earlier]) {
      const response = await memberRequest.post('/api/availability/blocks', { data: { date } })
      expect(response.status()).toBe(200)
    }

    await memberPage.goto('/pt-PT/')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const messages = ptMessages()
    const summary = memberPage.getByTestId('member-availability-summary')
    await expect(summary).toBeVisible()

    await expect(summary).toContainText(renderPlural(messages.Home.memberSummaryAvailableCount, 10))
    await expect(summary).toContainText(renderPlural(messages.Home.memberSummaryBlockedCount, 2))

    const expectedNextBlockedText = messages.Home.memberSummaryNextBlocked.replace(
      '{date}',
      formatPtDate(earlier)
    )
    await expect(summary).toContainText(expectedNextBlockedText)
    await expect(summary).not.toContainText(
      messages.Home.memberSummaryNoUpcomingBlocks.replace('{total}', '12')
    )

    // CHORE-18 AC2/AC3: member-availability-summary is itself Card's root
    // element, and its heading survives the CardTitle wrap as a real <h1>.
    await expect(summary).toHaveAttribute('data-slot', 'card')
    await expect(summary.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2: Member, no linked person — reused no-linked-person guidance.
// ---------------------------------------------------------------------------

test.describe('STORY-30: AC2 Member with no linked person', () => {
  test('sees the reused no-linked-person guidance instead of a summary', async ({ memberPage }) => {
    // MEMBER_ID has no linked people row by default (per
    // e2e-integration/availability.spec.ts's "FIXTURE COLLISION WARNING").
    // This test is placed in its own describe block (no beforeEach/afterEach
    // creating a linked person) to avoid ordering interference.
    await memberPage.goto('/pt-PT/')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const messages = ptMessages()
    const block = memberPage.getByTestId('home-no-linked-person')
    await expect(block).toBeVisible()
    await expect(block).toContainText(messages.Availability.noLinkedPersonTitle)
    await expect(block).toContainText(messages.Availability.noLinkedPersonDescription)

    const link = block.getByRole('link', { name: messages.Availability.noLinkedPersonCta })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/pt-PT/claim')

    await expect(memberPage.getByTestId('member-availability-summary')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// AC3: Admin — team counts (delta-based) + quick links.
// ---------------------------------------------------------------------------

test.describe('STORY-30: AC3 Admin team summary and quick links', () => {
  test('shows active-people/active-roles counts and three quick links', async ({
    adminPage,
  }, testInfo) => {
    const baselinePeople = await activePeopleCount()
    const baselineRoles = await activeRolesCount()

    const person = await createPerson(`STORY-30 QA AC3 Person (w${testInfo.workerIndex})`, null)
    const role = await createRole(`STORY-30 QA AC3 Role (w${testInfo.workerIndex})`)

    try {
      await adminPage.goto('/pt-PT/')
      await expect(adminPage).not.toHaveURL(/\/login/)

      const messages = ptMessages()
      const summary = adminPage.getByTestId('admin-team-summary')
      await expect(summary).toBeVisible()
      await expect(summary).toContainText(
        renderPlural(messages.Home.adminActivePeopleCount, baselinePeople + 1)
      )
      await expect(summary).toContainText(
        renderPlural(messages.Home.adminActiveRolesCount, baselineRoles + 1)
      )

      const quickLinks = adminPage.getByTestId('admin-quick-links')
      await expect(quickLinks).toBeVisible()

      const peopleLink = quickLinks.getByRole('link', { name: messages.Nav.people })
      const rolesLink = quickLinks.getByRole('link', { name: messages.Nav.roles })
      const usersLink = quickLinks.getByRole('link', { name: messages.Nav.userManagement })

      await expect(peopleLink).toBeVisible()
      await expect(peopleLink).toHaveAttribute('href', '/pt-PT/admin/people')
      await expect(rolesLink).toBeVisible()
      await expect(rolesLink).toHaveAttribute('href', '/pt-PT/admin/roles')
      await expect(usersLink).toBeVisible()
      await expect(usersLink).toHaveAttribute('href', '/pt-PT/admin/users')

      // CHORE-18 AC1/AC3: both testid'd elements are themselves Card's root
      // element, and their headings survive the CardTitle wrap as real
      // <h1>/<h2> elements.
      await expect(summary).toHaveAttribute('data-slot', 'card')
      await expect(summary.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(quickLinks).toHaveAttribute('data-slot', 'card')
      await expect(quickLinks.getByRole('heading', { level: 2 })).toBeVisible()
    } finally {
      await deletePerson(person.id)
      await deleteRole(role.id)
    }
  })
})

// ---------------------------------------------------------------------------
// AC4: neutral admin metric — wiring correctness + active-people scoping
// regression (revision cycle 1).
// ---------------------------------------------------------------------------

test.describe('STORY-30: AC4 blocks-in-next-30-days metric', () => {
  test('reflects real DB state: increments on a new block, decrements on removal', async ({
    adminPage,
  }, testInfo) => {
    const person = await createPerson(`STORY-30 QA AC4 Person (w${testInfo.workerIndex})`, null)
    const date = dateWithinNext30Days()

    try {
      await adminPage.goto('/pt-PT/')
      await expect(adminPage).not.toHaveURL(/\/login/)

      const messages = ptMessages()
      const metric = adminPage.getByTestId('admin-blocks-next-30-days')
      await expect(metric).toBeVisible()
      const baselineText = await metric.innerText()
      const baselineMatch = baselineText.match(/\d+/)
      if (!baselineMatch) throw new Error(`could not parse baseline count from: ${baselineText}`)
      const baseline = Number(baselineMatch[0])

      await insertBlockedDate(person.id, date)

      await adminPage.goto('/pt-PT/')
      await expect(metric).toContainText(renderPlural(messages.Home.adminBlocksNext30Days, baseline + 1))

      await deleteBlockedDate(person.id, date)

      await adminPage.goto('/pt-PT/')
      await expect(metric).toContainText(renderPlural(messages.Home.adminBlocksNext30Days, baseline))
    } finally {
      await deletePerson(person.id)
    }
  })

  test('excludes a soft-deleted person with a recent block (active-people scoping)', async ({
    adminPage,
  }, testInfo) => {
    const person = await createPerson(`STORY-30 QA AC4 Regression (w${testInfo.workerIndex})`, null)
    // Decoy active person with no blocks: guarantees at least one active
    // person remains after `person` is soft-deleted below, so the metric's
    // "skip query when zero active people" branch (an intentional, spec'd
    // behavior for a genuinely-empty team, not a bug) does not shadow the
    // scoping assertion this test targets.
    const decoy = await createPerson(`STORY-30 QA AC4 Decoy (w${testInfo.workerIndex})`, null)
    const date = dateWithinNext30Days()

    try {
      await insertBlockedDate(person.id, date)

      await adminPage.goto('/pt-PT/')
      await expect(adminPage).not.toHaveURL(/\/login/)

      const messages = ptMessages()
      const metric = adminPage.getByTestId('admin-blocks-next-30-days')
      await expect(metric).toBeVisible()
      const withBlockText = await metric.innerText()
      const withBlockMatch = withBlockText.match(/\d+/)
      if (!withBlockMatch) throw new Error(`could not parse count from: ${withBlockText}`)
      const withBlockCount = Number(withBlockMatch[0])

      // Soft-delete the person — their blocked_dates row is not cascaded
      // away (CLAUDE.md's documented "soft-delete does NOT cascade" gap),
      // so the metric must actively filter by active-person ids to exclude
      // it, not rely on the row disappearing.
      await setPersonActive(person.id, false)

      await adminPage.goto('/pt-PT/')
      await expect(metric).toContainText(
        renderPlural(messages.Home.adminBlocksNext30Days, withBlockCount - 1)
      )
    } finally {
      await deletePerson(person.id)
      await deletePerson(decoy.id)
    }
  })
})

// ---------------------------------------------------------------------------
// AC5: 375px viewport — no horizontal overflow, >= 44px tap targets.
// ---------------------------------------------------------------------------

test.describe('STORY-30: AC5 mobile viewport (375px)', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`STORY-30 QA AC5 Person (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('Member view: no overflow, availability link >= 44px', async ({ memberPage, memberRequest }) => {
    // Seed a block so the longest-case next-blocked-date line is on screen.
    const sundays = expectedSundays(12)
    const response = await memberRequest.post('/api/availability/blocks', { data: { date: sundays[0] } })
    expect(response.status()).toBe(200)

    await memberPage.setViewportSize({ width: 375, height: 812 })
    await memberPage.goto('/pt-PT/')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const scrollWidth = await memberPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const link = memberPage.getByTestId('member-availability-summary').getByRole('link')
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test('Admin view: no overflow, all quick-link tap targets >= 44px', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 375, height: 812 })
    await adminPage.goto('/pt-PT/')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const scrollWidth = await adminPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)

    const links = adminPage.getByTestId('admin-quick-links').getByRole('link')
    const count = await links.count()
    expect(count).toBe(3)
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      await expect(link).toBeVisible()
      const box = await link.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

// ---------------------------------------------------------------------------
// CHORE-18 AC4: desktop viewport (1280px) — no horizontal overflow,
// >= 44px tap targets. Mirrors the 375px block above structurally; the tap
// target floor doesn't shrink at wider viewports, so the same assertion is
// reused at 1280px.
// ---------------------------------------------------------------------------

test.describe('CHORE-18: AC4 desktop viewport (1280px)', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createPerson(`CHORE-18 QA AC4 Person (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('Member view: no overflow, availability link >= 44px', async ({ memberPage, memberRequest }) => {
    // Seed a block so the longest-case next-blocked-date line is on screen.
    const sundays = expectedSundays(12)
    const response = await memberRequest.post('/api/availability/blocks', { data: { date: sundays[0] } })
    expect(response.status()).toBe(200)

    await memberPage.setViewportSize({ width: 1280, height: 800 })
    await memberPage.goto('/pt-PT/')
    await expect(memberPage).not.toHaveURL(/\/login/)

    const scrollWidth = await memberPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(1280)

    const link = memberPage.getByTestId('member-availability-summary').getByRole('link')
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test('Admin view: no overflow, all quick-link tap targets >= 44px', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 1280, height: 800 })
    await adminPage.goto('/pt-PT/')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const scrollWidth = await adminPage.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(1280)

    const links = adminPage.getByTestId('admin-quick-links').getByRole('link')
    const count = await links.count()
    expect(count).toBe(3)
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      await expect(link).toBeVisible()
      const box = await link.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})
