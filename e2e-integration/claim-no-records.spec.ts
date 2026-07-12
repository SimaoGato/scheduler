/**
 * e2e-integration/claim-no-records.spec.ts — STORY-29: Give unlinked Members
 * clear guidance when there's nothing to claim.
 *
 * Real local Supabase integration suite (see e2e-integration/fixtures.ts and
 * CHORE-05) — runs in the `integration-test` CI job, never in
 * `npm run test:e2e`.
 *
 * Uses the `adminPage` fixture (STORY-26 precedent, see
 * e2e-integration/availability.spec.ts's "AC7 no linked person" describe
 * block): the seeded ADMIN_ID account has no linked `people` row by default.
 * This is a deliberate, documented substitution for the literal Member role
 * — /claim's page-level guard (app/[locale]/claim/page.tsx) has no role
 * branching, so any logged-in user with no linked person exercises the same
 * code path. Not a gap; the same rationale STORY-26 used for its AC7 test.
 *
 * AC coverage:
 *   AC1 — the happy-path list/select/confirm/skip flow still renders when
 *         unclaimed+active people exist (regression check).
 *   AC2 — no unclaimed+active people exist -> the "nothing to claim yet"
 *         message renders in place (no redirect).
 *   AC3 — an already-linked user visiting /claim directly is still
 *         redirected home (regression check — this story only changes the
 *         "nothing to claim" branch, not the "already linked" branch).
 *   AC4 — the auth callback's first-login redirect decision (STORY-11 AC4)
 *         is unchanged. Not automatable here: this suite's adminPage/
 *         memberPage fixtures sign in via signInWithPassword + captured
 *         cookies, which never invokes app/auth/callback/route.ts. See
 *         e2e/claim.spec.ts's file-header manual verification step 2, which
 *         already fully covers this scenario via real Google OAuth.
 *   AC5 — the new message's strings come from messages/pt-PT.json (AO90
 *         spelling) and is announced via aria-live="polite", not
 *         role="alert" (route-announcer collision precedent, CLAUDE.md).
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { ADMIN_ID } from '../supabase/test-users.mjs'

// ---------------------------------------------------------------------------
// Fixture helpers
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

interface UnlinkedActiveSnapshot {
  ids: string[]
}

// Snapshots every currently unlinked+active person, temporarily deactivates
// them (reversible, mirrors the real deactivation flow rather than deleting
// real data), and returns the snapshot so the caller can restore it in a
// `finally` block. Same technique as e2e/claim.spec.ts's (renamed) AC2 test.
async function snapshotAndDeactivateUnlinkedActive(): Promise<UnlinkedActiveSnapshot> {
  const client = serviceClient()
  const { data, error } = await client
    .from('people')
    .select('id')
    .is('linked_user_id', null)
    .eq('is_active', true)

  if (error) {
    throw new Error(`failed to read unlinked+active people: ${JSON.stringify(error)}`)
  }

  const ids = (data ?? []).map((row) => row.id as string)

  if (ids.length > 0) {
    const { error: deactivateError } = await client
      .from('people')
      .update({ is_active: false })
      .in('id', ids)
    if (deactivateError) {
      throw new Error(`failed to deactivate unlinked+active people: ${JSON.stringify(deactivateError)}`)
    }
  }

  return { ids }
}

async function restoreUnlinkedActive(snapshot: UnlinkedActiveSnapshot): Promise<void> {
  if (snapshot.ids.length === 0) return
  const client = serviceClient()
  await client.from('people').update({ is_active: true }).in('id', snapshot.ids)
}

// ---------------------------------------------------------------------------
// AC2/AC5: no unclaimed+active people exist -> "nothing to claim yet" state.
// ---------------------------------------------------------------------------

test.describe('STORY-29: AC2/AC5 no unclaimed people to claim', () => {
  test('a logged-in user with no linked person and no unclaimed people sees the no-records message', async ({
    adminPage,
  }) => {
    const snapshot = await snapshotAndDeactivateUnlinkedActive()

    try {
      await adminPage.goto('/pt-PT/claim')
      // Right-anchored regex (STORY-16 toHaveURL guidance): toHaveURL tests
      // against the full href including origin, so a left `^` anchor would
      // never match. No redirect should happen — the page must stay on
      // /pt-PT/claim.
      await expect(adminPage).toHaveURL(/\/pt-PT\/claim\/?$/)

      const region = adminPage.getByTestId('claim-no-records')
      await expect(region).toBeVisible()
      await expect(region).toHaveAttribute('aria-live', 'polite')
      await expect(region).not.toHaveAttribute('role', 'alert')

      await expect(region.getByText('Ainda não há nada para associares')).toBeVisible()
      await expect(
        region.getByText(
          'Ainda não existe um registo de equipa para ti. Fala com um administrador para te adicionar à equipa (Equipa) ou associar a tua conta a um registo existente.'
        )
      ).toBeVisible()

      const homeLink = adminPage.getByTestId('claim-no-records-home-link')
      await expect(homeLink).toBeVisible()
      await expect(homeLink).toHaveAttribute('href', '/pt-PT')

      // AC1 regression (negative half): the happy-path form must not render.
      await expect(adminPage.getByTestId('claim-person-list')).toHaveCount(0)
    } finally {
      await restoreUnlinkedActive(snapshot)
    }
  })
})

// ---------------------------------------------------------------------------
// AC1: happy path unaffected when unclaimed+active people exist.
// ---------------------------------------------------------------------------

test.describe('STORY-29: AC1 happy path unchanged', () => {
  test('a logged-in user still sees the claim list when unclaimed people exist', async ({
    adminPage,
  }, testInfo) => {
    const name = `STORY-29 QA AC1 (w${testInfo.workerIndex})`
    const person = await createPerson(name, null)

    try {
      await adminPage.goto('/pt-PT/claim')
      await expect(adminPage).toHaveURL(/\/pt-PT\/claim\/?$/)

      const list = adminPage.getByTestId('claim-person-list')
      await expect(list).toBeVisible()
      await expect(list.getByText(name, { exact: true })).toBeVisible()

      // The new "nothing to claim" branch must not render on this path.
      await expect(adminPage.getByTestId('claim-no-records')).toHaveCount(0)
    } finally {
      await deletePerson(person.id)
    }
  })
})

// ---------------------------------------------------------------------------
// AC3: already-linked user is still redirected home, unchanged.
// ---------------------------------------------------------------------------

test.describe('STORY-29: AC3 already-linked branch unchanged', () => {
  test('an already-linked user visiting /claim directly is still redirected home', async ({
    adminPage,
  }, testInfo) => {
    const name = `STORY-29 QA AC3 (w${testInfo.workerIndex})`
    const person = await createPerson(name, ADMIN_ID)

    try {
      await adminPage.goto('/pt-PT/claim')
      await expect(adminPage).toHaveURL(/\/pt-PT\/?$/)
    } finally {
      await deletePerson(person.id)
    }
  })
})
