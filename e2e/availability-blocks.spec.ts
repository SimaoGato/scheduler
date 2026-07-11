/**
 * e2e/availability-blocks.spec.ts — STORY-25: Persist blocked dates — data
 * model and self-service API.
 *
 * CI-safe smoke coverage (placeholder-credential `npm run test:e2e` job,
 * always runs). The primary AC coverage for this story lives in
 * e2e-integration/blocked-dates.spec.ts (real local Supabase, every AC
 * requires authenticated writes/reads). This file duplicates only the
 * cheap, auth-independent AC7 (401) case so it's covered even if the
 * integration job is ever skipped, plus best-effort E2E_WITH_AUTH-gated
 * validation checks per the existing auth-gated test pattern
 * (e2e/claim.spec.ts) — these require a real linked person on the
 * developer's own account, which cannot be assumed, so they are a secondary
 * path, not the primary AC5/AC6 coverage.
 */

import { test, expect } from '@playwright/test'

test('AC7-api-get: GET /api/availability/blocks unauthenticated → 401', async ({ request }) => {
  const response = await request.get('/api/availability/blocks')
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body.error).toBeTruthy()
})

test('AC7-api-post: POST /api/availability/blocks unauthenticated → 401', async ({ request }) => {
  const response = await request.post('/api/availability/blocks', { data: { date: '2026-08-02' } })
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body.error).toBeTruthy()
})

test('AC7-api-delete: DELETE /api/availability/blocks/[date] unauthenticated → 401', async ({ request }) => {
  const response = await request.delete('/api/availability/blocks/2026-08-02')
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body.error).toBeTruthy()
})

test.describe('STORY-25: validation checks (auth-gated)', () => {
  test.skip(
    !process.env.E2E_WITH_AUTH,
    'Requires a real Supabase session; see CLAUDE.md auth-gated test pattern.'
  )

  test('AC5: malformed date returns 400 invalid_date', async ({ page }) => {
    const response = await page.request.post('/api/availability/blocks', {
      data: { date: 'not-a-date' },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe('invalid_date')
  })

  test('AC5: a real Monday date returns 400 not_sunday', async ({ page }) => {
    // 2026-08-03 is a Monday (confirmed against 2026-08-02, a Sunday, used
    // as the AC7 fixed-date smoke case above).
    const response = await page.request.post('/api/availability/blocks', {
      data: { date: '2026-08-03' },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe('not_sunday')
  })
})
