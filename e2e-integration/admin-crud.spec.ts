/**
 * e2e-integration/admin-crud.spec.ts — CHORE-14: local-Supabase integration
 * coverage for the admin CRUD API routes (`/api/admin/people`,
 * `/api/admin/roles`, `/api/admin/users`) that, until this story, had no
 * real-database test coverage — only placeholder-credential smoke tests
 * (which cannot make real DB queries against `public.people`/`public.roles`/
 * `public.users`) or manual verification. This project has hit the
 * missing-`GRANT ... TO authenticated/service_role` bug class twice already
 * (`public.users` in STORY-03, `public.people` in STORY-14) — see CLAUDE.md's
 * "GRANT before RLS" section.
 *
 * Reuses the `adminRequest`/`memberRequest` fixtures from
 * e2e-integration/fixtures.ts and the `serviceClient()` helper from
 * e2e-integration/service-client.ts exactly as-is (test-infra only; no
 * changes to either file, no application-code changes, no CI workflow
 * changes — see CHORE-14's out-of-scope list). AC4 (time budget): this file
 * reuses the already-running local Supabase instance and already-seeded
 * `ci-admin@example.test` / `ci-member@example.test` users started by the
 * `integration-test` CI job (CHORE-05) — no new `supabase start` call and no
 * new seed-script invocation are added by this story.
 *
 * IMPORTANT — what these tests actually prove (Challenge review WARNING
 * fix #1): all three GET routes under test (`app/api/admin/people/route.ts`,
 * `app/api/admin/roles/route.ts`, `app/api/admin/users/route.ts`) query via
 * `createServiceClient()` (service-role client), which BYPASSES RLS by
 * design (per each route's own doc comment). So a 200-with-real-data result
 * (AC1) proves the `service_role` GRANT on the underlying table is present
 * and correct — NOT that a SELECT RLS policy is being enforced (there is no
 * RLS check in this code path at all). What DOES exercise real RLS is the
 * `requireAdmin` → `requireAuth` guard's own read of `public.users` via the
 * anon-key `createServerClient` (see `lib/auth/guard.ts` lines ~27-59, which
 * runs as the authenticated caller under RLS, not service-role) — that guard
 * read is what determines admin vs. member, and its rejection of the member
 * test user is what AC2's 403 assertions actually prove. Test titles below
 * are worded to reflect this precisely rather than claiming blanket "RLS"
 * coverage for the GET response bodies.
 *
 * Test count: 7 (2 GET tests [admin-200 / member-403] x 3 resources, plus
 * 1 write round-trip test for AC3).
 *
 * AC coverage:
 *   AC1 — admin GET /api/admin/{people,roles,users} -> 200 with real
 *         seeded/fixture data (genuine round-trip, not shape-only).
 *   AC2 — member GET on the same three endpoints -> 403 { error: 'Forbidden' }.
 *   AC3 — POST /api/admin/roles as admin -> 201 with echoed fields, then a
 *         follow-up GET /api/admin/roles proves the row is readable back.
 *   AC4 — no dedicated test; see header comment above and the story's
 *         Implementation Plan (non-functional CI-job-runtime constraint,
 *         verified by observing this PR's `integration-test` job duration
 *         stays in the same range as pre-change runs).
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { ADMIN_EMAIL, MEMBER_EMAIL } from '../supabase/test-users.mjs'

// ---------------------------------------------------------------------------
// AC1/AC2: GET /api/admin/people
// ---------------------------------------------------------------------------

test.describe('CHORE-14: GET /api/admin/people', () => {
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const client = serviceClient()
    const { data, error } = await client
      .from('people')
      .insert({
        name: `CHORE-14 QA Person (w${testInfo.workerIndex})`,
        linked_user_id: null,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) throw new Error(`failed to create fixture person: ${JSON.stringify(error)}`)
    personId = data.id as string
  })

  test.afterEach(async () => {
    await serviceClient().from('people').delete().eq('id', personId)
  })

  test('AC1: admin GET /api/admin/people returns 200 with the fixture person present (proves the service_role GRANT on public.people)', async ({
    adminRequest,
  }, testInfo) => {
    const response = await adminRequest.get('/api/admin/people')
    expect(response.status()).toBe(200)

    const body = (await response.json()) as Array<{ id: string; name: string }>
    expect(Array.isArray(body)).toBe(true)
    expect(
      body.some(
        (row) => row.id === personId && row.name === `CHORE-14 QA Person (w${testInfo.workerIndex})`
      )
    ).toBe(true)
  })

  test('AC2: member GET /api/admin/people returns 403 (proves requireAdmin\'s RLS-backed public.users role read rejects a non-admin)', async ({
    memberRequest,
  }) => {
    const response = await memberRequest.get('/api/admin/people')
    expect(response.status()).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })
})

// ---------------------------------------------------------------------------
// AC1/AC2: GET /api/admin/roles
// ---------------------------------------------------------------------------

test.describe('CHORE-14: GET /api/admin/roles', () => {
  let roleId: string

  test.beforeEach(async ({}, testInfo) => {
    const client = serviceClient()
    const { data, error } = await client
      .from('roles')
      .insert({
        name: `CHORE-14 QA Role (w${testInfo.workerIndex})`,
        default_slots: 1,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) throw new Error(`failed to create fixture role: ${JSON.stringify(error)}`)
    roleId = data.id as string
  })

  test.afterEach(async () => {
    await serviceClient().from('roles').delete().eq('id', roleId)
  })

  test('AC1: admin GET /api/admin/roles returns 200 with the fixture role present (proves the service_role GRANT on public.roles)', async ({
    adminRequest,
  }, testInfo) => {
    const response = await adminRequest.get('/api/admin/roles')
    expect(response.status()).toBe(200)

    const body = (await response.json()) as Array<{ id: string; name: string }>
    expect(Array.isArray(body)).toBe(true)
    expect(
      body.some(
        (row) => row.id === roleId && row.name === `CHORE-14 QA Role (w${testInfo.workerIndex})`
      )
    ).toBe(true)
  })

  test('AC2: member GET /api/admin/roles returns 403 (proves requireAdmin\'s RLS-backed public.users role read rejects a non-admin)', async ({
    memberRequest,
  }) => {
    const response = await memberRequest.get('/api/admin/roles')
    expect(response.status()).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })
})

// ---------------------------------------------------------------------------
// AC1/AC2: GET /api/admin/users — no new fixture rows; asserts against the
// already-seeded ci-admin@example.test / ci-member@example.test rows.
// ---------------------------------------------------------------------------

test.describe('CHORE-14: GET /api/admin/users', () => {
  test('AC1: admin GET /api/admin/users returns 200 with both seeded test users present (proves the service_role GRANT on public.users)', async ({
    adminRequest,
  }) => {
    const response = await adminRequest.get('/api/admin/users')
    expect(response.status()).toBe(200)

    const body = (await response.json()) as Array<{ email: string }>
    expect(Array.isArray(body)).toBe(true)
    expect(body.some((row) => row.email === ADMIN_EMAIL)).toBe(true)
    expect(body.some((row) => row.email === MEMBER_EMAIL)).toBe(true)
  })

  test('AC2: member GET /api/admin/users returns 403 (proves requireAdmin\'s RLS-backed public.users role read rejects a non-admin)', async ({
    memberRequest,
  }) => {
    const response = await memberRequest.get('/api/admin/users')
    expect(response.status()).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })
})

// ---------------------------------------------------------------------------
// AC3: write round-trip — POST /api/admin/roles, then a follow-up GET proves
// the created row is readable back (INSERT + SELECT GRANTs both work).
// ---------------------------------------------------------------------------

test.describe('CHORE-14: POST /api/admin/roles write round-trip', () => {
  let createdRoleId: string | undefined

  test.afterEach(async () => {
    if (createdRoleId) {
      await serviceClient().from('roles').delete().eq('id', createdRoleId)
      createdRoleId = undefined
    }
  })

  test('AC3: admin POST /api/admin/roles creates a role (201, echoed fields), and a follow-up GET proves it is persisted and readable back', async ({
    adminRequest,
  }, testInfo) => {
    const roleName = `CHORE-14 QA Write Role (w${testInfo.workerIndex})`

    const postResponse = await adminRequest.post('/api/admin/roles', {
      data: { name: roleName, default_slots: 2 },
    })
    expect(postResponse.status()).toBe(201)

    const created = (await postResponse.json()) as {
      id: string
      name: string
      default_slots: number
      is_active: boolean
    }
    expect(created.name).toBe(roleName)
    expect(created.default_slots).toBe(2)
    expect(created.is_active).toBe(true)
    createdRoleId = created.id

    const getResponse = await adminRequest.get('/api/admin/roles')
    expect(getResponse.status()).toBe(200)

    const roles = (await getResponse.json()) as Array<{
      id: string
      name: string
      default_slots: number
    }>
    expect(
      roles.some(
        (row) => row.id === created.id && row.name === roleName && row.default_slots === 2
      )
    ).toBe(true)
  })
})
