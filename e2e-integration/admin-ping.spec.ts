/**
 * e2e-integration/admin-ping.spec.ts — CHORE-05 local Supabase integration
 * tests for GET /api/admin/ping.
 *
 * This spec only runs in the `integration-test` CI job (via its own
 * playwright.integration.config.ts), never in `npm run test:e2e` (the
 * placeholder-credential smoke job — see e2e/role-enforcement.spec.ts for
 * that job's CI-safe 401 coverage). It requires a real local Supabase
 * instance (`supabase start`) with migrations applied and the CI-only test
 * users seeded via supabase/seed-test-users.mjs.
 *
 * See docs/stories/CHORE-05-local-supabase-integration-tests.md for the
 * "why" — STORY-04 shipped with a missing GRANT that caused 42501 in
 * production and was invisible in CI because the smoke suite only ever runs
 * against placeholder Supabase credentials.
 */

import { test, expect } from './fixtures'

// AC2: admin → 200 { ok: true, role: 'admin' }
test('AC2: admin GET /api/admin/ping returns 200', async ({ adminRequest }) => {
  const response = await adminRequest.get('/api/admin/ping')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body).toEqual({ ok: true, role: 'admin' })
})

// AC3: member → 403 { error: 'Forbidden' }
test('AC3: member GET /api/admin/ping returns 403', async ({ memberRequest }) => {
  const response = await memberRequest.get('/api/admin/ping')
  expect(response.status()).toBe(403)
  const body = await response.json()
  expect(body).toEqual({ error: 'Forbidden' })
})
