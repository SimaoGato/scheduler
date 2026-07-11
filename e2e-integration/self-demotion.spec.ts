/**
 * e2e-integration/self-demotion.spec.ts — STORY-08: single-admin
 * self-demotion coverage (review finding, PR #42 rework).
 *
 * AC2 requires that PATCH /api/admin/users/:id with an admin's own id and
 * `role: 'member'` returns 400 { error: 'self_demotion' } "regardless of how
 * many admins exist" — including the single-remaining-admin edge case. The
 * placeholder-credential smoke suite (e2e/user-management.spec.ts) can only
 * cover this against whatever admin count a real dev Supabase project
 * happens to have (usually 2+), so the single-admin edge case had no
 * automated coverage — only a manual-verification step.
 *
 * This spec runs against the real, ephemeral, job-scoped local Supabase
 * instance seeded by supabase/seed-test-users.mjs (see e2e-integration/
 * fixtures.ts and CHORE-05). That seed script creates exactly one admin
 * (ADMIN_ID) and one member — no migration or seed step creates any other
 * `public.users` row with role 'admin' — so a fresh instance is naturally
 * in the single-admin state this test needs, with no extra setup/teardown.
 *
 * Only runs in the `integration-test` CI job (via
 * playwright.integration.config.ts), never in `npm run test:e2e`.
 */

import { test, expect } from './fixtures'
import { ADMIN_ID } from '../supabase/test-users.mjs'

test('AC2 (single-admin edge case): self-demote is blocked with 400, not 409, when only one admin exists', async ({
  adminRequest,
}) => {
  // Sanity check this test is actually exercising the single-admin edge
  // case it claims to — if a future change to the seed script adds a
  // second admin, this test would silently stop covering the edge case it
  // was written for, so fail loudly instead.
  const usersResponse = await adminRequest.get('/api/admin/users')
  expect(usersResponse.status()).toBe(200)
  const users = (await usersResponse.json()) as Array<{ id: string; role: string }>
  const adminCount = users.filter((u) => u.role === 'admin').length
  expect(adminCount, 'expected exactly one admin in the seeded local Supabase instance').toBe(1)

  const response = await adminRequest.patch(`/api/admin/users/${ADMIN_ID}`, {
    data: { role: 'member' },
  })

  // Must be 400 self_demotion, never 409 last_admin — the self-demotion
  // guard runs before the last-admin count query specifically so this
  // precedence holds even when count === 1.
  expect(response.status()).toBe(400)
  expect((await response.json()).error).toBe('self_demotion')

  // Confirm no state change: role is re-read fresh from public.users by
  // requireAdmin on every request, so a stale 200 here would mean the PATCH
  // above silently succeeded despite the 400 response.
  const pingResponse = await adminRequest.get('/api/admin/ping')
  expect(pingResponse.status()).toBe(200)
  expect((await pingResponse.json()).role).toBe('admin')
})
