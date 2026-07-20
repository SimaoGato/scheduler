/**
 * e2e-integration/users-card-list.spec.ts — CHORE-30: redesign the
 * Utilizadores page as avatar card-list rows with role badges.
 *
 * Real local Supabase + the `adminPage` fixture (e2e-integration/fixtures.ts)
 * and `serviceClient()` (e2e-integration/service-client.ts) for direct
 * fixture seeding. Runs unconditionally in the `integration-test` CI job —
 * no E2E_WITH_AUTH opt-in (BUGFIX-06 pattern).
 *
 * AC coverage:
 *   AC1 — each user renders as a card row: initials avatar, display name
 *         (display font), email (mono font), role badge (admin = solid
 *         `bg-header`/`text-header-foreground` fill, member = outline pill).
 *         Asserted against the already-seeded ADMIN_ID/MEMBER_ID rows (no
 *         role mutation, to avoid colliding with self-demotion.spec.ts /
 *         admin-crud.spec.ts's assumptions about seeded admin count).
 *   AC2 — existing promote/demote testids/handler still work end-to-end in
 *         the new markup: click um-promote-<id> on a throwaway member
 *         fixture and confirm the optimistic role change renders
 *         um-demote-<id> in its place.
 *   AC3 — 375px/390px: no horizontal overflow with a seeded long
 *         name/email, truncation actually engages (not just "happened to
 *         fit"), plus committed screenshot evidence (BUGFIX-06 convention)
 *         referenced in the PR description for human visual confirmation.
 *   AC4 — promote/demote button keeps a >=44px tap target.
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { ADMIN_EMAIL, MEMBER_EMAIL, TEST_PASSWORD } from '../supabase/test-users.mjs'

interface FixtureUser {
  id: string
  email: string
}

async function createUser(
  id: string,
  email: string,
  displayName: string,
  role: 'admin' | 'member'
): Promise<FixtureUser> {
  const client = serviceClient()
  const { error: authError } = await client.auth.admin.createUser({
    id,
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (authError) throw new Error(`failed to create fixture auth user: ${JSON.stringify(authError)}`)

  const { error: upsertError } = await client
    .from('users')
    .upsert({ id, email, display_name: displayName, role })
  if (upsertError) {
    throw new Error(`failed to upsert fixture public.users row: ${JSON.stringify(upsertError)}`)
  }

  return { id, email }
}

async function deleteUser(id: string): Promise<void> {
  // Cascades the public.users row automatically (ON DELETE CASCADE FK to
  // auth.users) — no separate public.users delete needed.
  await serviceClient().auth.admin.deleteUser(id)
}

// ---------------------------------------------------------------------------
// AC1: card row content — avatar initials, name, email, role badge.
// ---------------------------------------------------------------------------

test.describe('CHORE-30: AC1 card row content (avatar, name, email, role badge)', () => {
  test('admin row renders solid role badge with header tokens', async ({ adminPage }) => {
    await adminPage.goto('/pt-PT/admin/users')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const list = adminPage.getByTestId('um-list')
    await expect(list).toBeVisible()

    const row = list.locator('li', { hasText: ADMIN_EMAIL })
    await expect(row).toBeVisible()
    await expect(row).toContainText('CI Admin')
    await expect(row).toContainText(ADMIN_EMAIL)
    await expect(row).toContainText('Administrador')

    const badge = row.locator('span', { hasText: 'Administrador' })
    await expect(badge).toHaveClass(/bg-header/)
    await expect(badge).toHaveClass(/text-header-foreground/)

    // Avatar initials derived from "CI Admin" -> "CA".
    const avatar = row.locator('span[aria-hidden="true"]').first()
    await expect(avatar).toHaveText('CA')
  })

  test('member row renders outline role badge', async ({ adminPage }) => {
    await adminPage.goto('/pt-PT/admin/users')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const list = adminPage.getByTestId('um-list')
    const row = list.locator('li', { hasText: MEMBER_EMAIL })
    await expect(row).toBeVisible()
    await expect(row).toContainText('CI Member')
    await expect(row).toContainText(MEMBER_EMAIL)
    await expect(row).toContainText('Membro')

    const badge = row.locator('span', { hasText: 'Membro' })
    await expect(badge).toHaveClass(/border/)
    await expect(badge).toHaveClass(/text-muted-foreground/)
    await expect(badge).not.toHaveClass(/bg-header/)
  })
})

// ---------------------------------------------------------------------------
// AC2: promote/demote testids still wired to real behavior in the new markup.
// ---------------------------------------------------------------------------

test.describe('CHORE-30: AC2 promote/demote flow preserved', () => {
  let tempUser: FixtureUser

  test.beforeEach(async ({}, testInfo) => {
    tempUser = await createUser(
      `00000000-0000-4000-9000-0000000000${String(10 + testInfo.workerIndex).padStart(2, '0')}`,
      `chore-30-promote-w${testInfo.workerIndex}@example.test`,
      `CHORE-30 Promote Fixture (w${testInfo.workerIndex})`,
      'member'
    )
  })

  test.afterEach(async () => {
    await deleteUser(tempUser.id)
  })

  test('clicking um-promote flips the row to um-demote (admin badge)', async ({ adminPage }) => {
    await adminPage.goto('/pt-PT/admin/users')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const promoteButton = adminPage.getByTestId(`um-promote-${tempUser.id}`)
    await expect(promoteButton).toBeVisible()
    await promoteButton.click()

    const demoteButton = adminPage.getByTestId(`um-demote-${tempUser.id}`)
    await expect(demoteButton).toBeVisible()
    await expect(promoteButton).toHaveCount(0)

    const list = adminPage.getByTestId('um-list')
    const row = list.locator('li', { hasText: tempUser.email })
    await expect(row).toContainText('Administrador')
  })
})

// ---------------------------------------------------------------------------
// AC3: 375px/390px overflow + truncation with long name/email; AC4: tap target.
// ---------------------------------------------------------------------------

const WIDTHS = [375, 390]

test.describe('CHORE-30: AC3 no horizontal overflow, truncation engages; AC4 tap targets', () => {
  let longUser: FixtureUser

  test.beforeEach(async ({}, testInfo) => {
    longUser = await createUser(
      `00000000-0000-4000-9000-0000000000${String(50 + testInfo.workerIndex).padStart(2, '0')}`,
      `chore.30.very.long.email.address.fixture.w${testInfo.workerIndex}@some-extremely-long-example-domain.example.test`,
      `Maria da Conceição Fernandes de Sousa e Silva Nogueira (w${testInfo.workerIndex})`,
      'member'
    )
  })

  test.afterEach(async () => {
    await deleteUser(longUser.id)
  })

  for (const width of WIDTHS) {
    test(`admin sees no horizontal overflow at ${width}px with a long name/email (screenshot captured)`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/admin/users')
      await expect(adminPage).not.toHaveURL(/\/login/)

      const scrollWidth = await adminPage.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width)

      const list = adminPage.getByTestId('um-list')
      const row = list.locator('li', { hasText: longUser.email.slice(0, 20) })
      await expect(row).toBeVisible()

      // Truncation must actually engage — the rendered text node's
      // scrollWidth must exceed its own clientWidth (CSS text-overflow:
      // ellipsis only clips visually; both values are non-zero here iff
      // the container is narrower than the intrinsic text width).
      const emailNode = row.locator('p.truncate', { hasText: '@' })
      const isTruncating = await emailNode.evaluate(
        (el) => el.scrollWidth > el.clientWidth
      )
      expect(isTruncating).toBe(true)

      await adminPage.screenshot({
        path: `test-results-integration/chore-30-users-card-list-${width}.png`,
        fullPage: true,
      })
    })
  }

  test('promote/demote button keeps a >=44px tap target at 375px', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 375, height: 812 })
    await adminPage.goto('/pt-PT/admin/users')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const list = adminPage.getByTestId('um-list')
    const row = list.locator('li', { hasText: longUser.email.slice(0, 20) })
    const actionButton = row.locator('[data-testid^="um-promote-"], [data-testid^="um-demote-"]')
    await expect(actionButton).toBeVisible()
    const box = await actionButton.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})
