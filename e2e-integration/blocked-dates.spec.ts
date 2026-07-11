/**
 * e2e-integration/blocked-dates.spec.ts — STORY-25: Persist blocked dates —
 * data model and self-service API.
 *
 * Real local Supabase integration suite (see e2e-integration/fixtures.ts and
 * CHORE-05) — runs in the `integration-test` CI job, never in
 * `npm run test:e2e`. Every AC below requires real authenticated writes/reads
 * against public.blocked_dates and public.people, so this is the primary
 * (not secondary) test suite for this story.
 *
 * Fixture lifecycle: the seeded MEMBER_ID (e2e-integration/fixtures.ts) has
 * no `people` row by default. Each test creates its own worker-isolated
 * `people` row linked to MEMBER_ID via the service-role client in
 * `beforeEach`, and hard-deletes it in `afterEach` (which cascades any block
 * rows via ON DELETE CASCADE) — same fixture-isolation discipline as
 * e2e/claim.spec.ts. Only one active person can be linked to MEMBER_ID at a
 * time (STORY-11's partial unique index on linked_user_id), so this
 * beforeEach/afterEach pairing must stay strictly sequential per test, which
 * is Playwright's default within a single spec file.
 *
 * AC coverage:
 *   AC1 — unique (person_id, blocked_date) index exists (assert-by-consequence).
 *   AC2 — POST creates a block; re-POST same date is idempotent (200, one row).
 *   AC3 — DELETE removes a block; repeat DELETE is idempotent (200, no-op).
 *   AC4 — GET lists exactly the caller's own blocked dates.
 *   AC5 — malformed/non-Sunday dates → 400 invalid_date / not_sunday.
 *   AC6 — no linked person → 409 no_linked_person on all three routes.
 *   AC7 — unauthenticated → 401 on all three routes, nothing written.
 *   AC8 — getBlockedDates() query helper is queryable by personIds and by
 *         date range.
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { getBlockedDates } from '../lib/availability/blocked-dates'
import { MEMBER_ID, ADMIN_ID } from '../supabase/test-users.mjs'

// ---------------------------------------------------------------------------
// Date helpers — compute real Sundays/Mondays relative to "now" so the tests
// never depend on a hardcoded calendar date going stale. Design decision 2
// (approved plan) means blocking a "past" Sunday is not itself invalid, so
// these don't need to be strictly in the future to be valid test input —
// they just need to land on the correct weekday.
// ---------------------------------------------------------------------------

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function nextSunday(fromOffsetDays = 0): string {
  const now = new Date()
  const base = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + fromOffsetDays)
  )
  const daysUntilSunday = (7 - base.getUTCDay()) % 7 || 7
  const sunday = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + daysUntilSunday)
  )
  return toDateString(sunday)
}

function mondayAfter(sundayStr: string): string {
  const [y, m, d] = sundayStr.split('-').map(Number)
  const monday = new Date(Date.UTC(y, m - 1, d + 1))
  return toDateString(monday)
}

// ---------------------------------------------------------------------------
// Fixture management
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
  // Hard delete — cascades any blocked_dates rows via ON DELETE CASCADE.
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
// AC2, AC3, AC4: authenticated Member happy-path + idempotency
// ---------------------------------------------------------------------------

test.describe('STORY-25: block/unblock/list own dates (Member, linked person)', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`STORY-25 QA Person (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('AC2: POST blocks a date; re-POST same date is idempotent (200, exactly one row)', async ({
    memberRequest,
  }) => {
    const date = nextSunday()

    const first = await memberRequest.post('/api/availability/blocks', { data: { date } })
    expect(first.status()).toBe(200)
    expect(await first.json()).toEqual({ ok: true })

    // Re-POST the same date must not 500 — this is the idempotency-shape
    // assertion confirming upsert(..., { ignoreDuplicates: true }) returns a
    // falsy error on conflict, per the approved plan's risk note.
    const second = await memberRequest.post('/api/availability/blocks', { data: { date } })
    expect(second.status()).toBe(200)
    expect(await second.json()).toEqual({ ok: true })

    const rows = await readBlockedDates(personId)
    expect(rows).toEqual([date])
  })

  test('AC3: DELETE unblocks a date; repeat DELETE is idempotent (200, no-op)', async ({
    memberRequest,
  }) => {
    const date = nextSunday()

    const blockResponse = await memberRequest.post('/api/availability/blocks', { data: { date } })
    expect(blockResponse.status()).toBe(200)
    expect(await readBlockedDates(personId)).toEqual([date])

    const firstDelete = await memberRequest.delete(`/api/availability/blocks/${date}`)
    expect(firstDelete.status()).toBe(200)
    expect(await firstDelete.json()).toEqual({ ok: true })
    expect(await readBlockedDates(personId)).toEqual([])

    // Unblocking an already-unblocked date is idempotent: still 200, not
    // 404/500.
    const secondDelete = await memberRequest.delete(`/api/availability/blocks/${date}`)
    expect(secondDelete.status()).toBe(200)
    expect(await secondDelete.json()).toEqual({ ok: true })
  })

  test('AC4: GET lists exactly the caller\'s own blocked dates, not another person\'s', async ({
    memberRequest,
  }) => {
    const dateA = nextSunday()
    const dateB = nextSunday(8) // a distinct, later Sunday

    const otherPerson = await createLinkedPerson('STORY-25 QA Other Person', null)
    try {
      // Seed directly via service client for the caller's own two dates and
      // the other person's one date.
      const client = serviceClient()
      const { error: seedError } = await client.from('blocked_dates').insert([
        { person_id: personId, blocked_date: dateA },
        { person_id: personId, blocked_date: dateB },
        { person_id: otherPerson.id, blocked_date: dateA },
      ])
      if (seedError) throw new Error(`seed failed: ${JSON.stringify(seedError)}`)

      const response = await memberRequest.get('/api/availability/blocks')
      expect(response.status()).toBe(200)
      const body = (await response.json()) as { dates: string[] }
      expect(body.dates.slice().sort()).toEqual([dateA, dateB].sort())
    } finally {
      await deletePerson(otherPerson.id)
    }
  })
})

// ---------------------------------------------------------------------------
// AC5: malformed / non-Sunday dates
// ---------------------------------------------------------------------------

test.describe('STORY-25: AC5 date validation', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`STORY-25 QA Validation (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('POST with malformed/missing/non-existent date returns 400 invalid_date', async ({
    memberRequest,
  }) => {
    const cases: Array<Record<string, unknown>> = [
      {}, // missing date key
      { date: 'not-a-date' },
      { date: '2026/08/02' },
      { date: '2026-02-30' }, // rolls over in naive UTC construction
      { date: 12345 },
    ]

    for (const data of cases) {
      const response = await memberRequest.post('/api/availability/blocks', { data })
      expect(response.status(), `case: ${JSON.stringify(data)}`).toBe(400)
      expect((await response.json()).error).toBe('invalid_date')
    }

    expect(await readBlockedDates(personId)).toEqual([])
  })

  test('POST with a real Monday date returns 400 not_sunday', async ({ memberRequest }) => {
    const monday = mondayAfter(nextSunday())
    const response = await memberRequest.post('/api/availability/blocks', { data: { date: monday } })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe('not_sunday')

    expect(await readBlockedDates(personId)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// AC1: uniqueness invariant (assert-by-consequence)
// ---------------------------------------------------------------------------

test.describe('STORY-25: AC1 uniqueness invariant', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const person = await createLinkedPerson(`STORY-25 QA Unique (w${testInfo.workerIndex})`, MEMBER_ID)
    personId = person.id
  })

  test.afterEach(async () => {
    await deletePerson(personId)
  })

  test('a duplicate (person_id, blocked_date) insert via the service-role client fails with 23505', async () => {
    const date = nextSunday()
    const client = serviceClient()

    const first = await client.from('blocked_dates').insert({ person_id: personId, blocked_date: date })
    expect(first.error).toBeNull()

    const second = await client.from('blocked_dates').insert({ person_id: personId, blocked_date: date })
    expect(second.error).not.toBeNull()
    expect(second.error?.code).toBe('23505')
  })
})

// ---------------------------------------------------------------------------
// AC6: no linked person → 409 no_linked_person (admin has no people row)
// ---------------------------------------------------------------------------

test.describe('STORY-25: AC6 no linked person', () => {
  test('GET/POST/DELETE all return 409 no_linked_person for a user with no linked person; nothing written', async ({
    adminRequest,
  }) => {
    const date = nextSunday()

    const getResponse = await adminRequest.get('/api/availability/blocks')
    expect(getResponse.status()).toBe(409)
    expect((await getResponse.json()).error).toBe('no_linked_person')

    const postResponse = await adminRequest.post('/api/availability/blocks', { data: { date } })
    expect(postResponse.status()).toBe(409)
    expect((await postResponse.json()).error).toBe('no_linked_person')

    const deleteResponse = await adminRequest.delete(`/api/availability/blocks/${date}`)
    expect(deleteResponse.status()).toBe(409)
    expect((await deleteResponse.json()).error).toBe('no_linked_person')

    // Confirm no row was written anywhere for ADMIN_ID (which has no linked
    // person, so this should be an empty read regardless).
    const client = serviceClient()
    const { data } = await client
      .from('people')
      .select('id')
      .eq('linked_user_id', ADMIN_ID)
      .eq('is_active', true)
      .maybeSingle()
    expect(data).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AC7: unauthenticated → 401, nothing written
// ---------------------------------------------------------------------------

test.describe('STORY-25: AC7 unauthenticated', () => {
  test('GET/POST/DELETE all return 401 for an unauthenticated request', async ({ request }) => {
    const date = nextSunday()

    const getResponse = await request.get('/api/availability/blocks')
    expect(getResponse.status()).toBe(401)

    const postResponse = await request.post('/api/availability/blocks', { data: { date } })
    expect(postResponse.status()).toBe(401)

    const deleteResponse = await request.delete(`/api/availability/blocks/${date}`)
    expect(deleteResponse.status()).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// AC8: getBlockedDates() query helper — queryable by person and by date range
// ---------------------------------------------------------------------------

test.describe('STORY-25: AC8 getBlockedDates() query helper', () => {
  let personA: FixturePerson
  let personB: FixturePerson

  test.beforeEach(async () => {
    personA = await createLinkedPerson('STORY-25 QA Helper Person A', null)
    personB = await createLinkedPerson('STORY-25 QA Helper Person B', null)

    const client = serviceClient()
    const { error } = await client.from('blocked_dates').insert([
      { person_id: personA.id, blocked_date: '2026-08-02' },
      { person_id: personA.id, blocked_date: '2026-08-16' },
      { person_id: personB.id, blocked_date: '2026-08-09' },
    ])
    if (error) throw new Error(`seed failed: ${JSON.stringify(error)}`)
  })

  test.afterEach(async () => {
    await deletePerson(personA.id)
    await deletePerson(personB.id)
  })

  test('filters by personIds', async () => {
    const client = serviceClient()
    const { data, error } = await getBlockedDates(client, { personIds: [personA.id] })
    expect(error).toBeNull()
    expect(data?.map((r) => r.blocked_date).sort()).toEqual(['2026-08-02', '2026-08-16'])
  })

  test('filters by dateFrom/dateTo range across people', async () => {
    const client = serviceClient()
    const { data, error } = await getBlockedDates(client, {
      personIds: [personA.id, personB.id],
      dateFrom: '2026-08-09',
      dateTo: '2026-08-16',
    })
    expect(error).toBeNull()
    const rows = (data ?? []).map((r) => ({ person_id: r.person_id, blocked_date: r.blocked_date }))
    expect(rows.sort((a, b) => a.blocked_date.localeCompare(b.blocked_date))).toEqual([
      { person_id: personB.id, blocked_date: '2026-08-09' },
      { person_id: personA.id, blocked_date: '2026-08-16' },
    ])
  })
})
