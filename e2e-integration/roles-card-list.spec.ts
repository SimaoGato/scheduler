/**
 * e2e-integration/roles-card-list.spec.ts — CHORE-29: redesign the Funções
 * page as card-style list rows (fixes the pre-existing 375px overflow bug,
 * adds a per-role qualified-people count).
 *
 * Real local Supabase + the `adminPage` fixture (e2e-integration/fixtures.ts)
 * and `serviceClient()` (e2e-integration/service-client.ts) for direct
 * fixture seeding. Runs unconditionally in the `integration-test` CI job —
 * no E2E_WITH_AUTH opt-in (BUGFIX-06 pattern).
 *
 * AC coverage:
 *   AC1 — 375px/390px: no horizontal overflow with seeded long pt-PT role
 *         names (the CHORE-24-documented, previously-ticketless bug). Also
 *         captures a screenshot at each width as committed evidence that
 *         the row's nested badge/actions flex-wrap container (CLAUDE.md
 *         BUGFIX-06 lesson) reads as intentional, not incoherently wrapped
 *         — see the inline comment on that container in RoleTable.tsx.
 *   AC2 — each active role renders as a card row: name (display font), a
 *         meta line with the ICU-pluralized qualified-people count (active
 *         people only — a soft-deleted person's skill row does not count),
 *         and the per-Sunday slots badge — asserted in both pt-PT and en
 *         locales, singular (1), plural (2+), and zero counts.
 *   AC4 — every interactive control keeps a >=44px tap target at 375px; the
 *         add-role and inline-edit inputs keep distinct accessible labels
 *         (WCAG SC 1.3.1, STORY-17 pattern).
 */

import { test, expect } from './fixtures'
import { serviceClient } from './service-client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function messagesFor(locale: 'pt-PT' | 'en'): Record<string, Record<string, string>> {
  const raw = readFileSync(join(__dirname, '..', 'messages', `${locale}.json`), 'utf8')
  return JSON.parse(raw)
}

// Same bare-ICU-plural-block parser as e2e-integration/admin-availability.spec.ts
// (no rich-text tags in this story's new keys, so no tag-stripping needed).
function renderPlural(template: string, count: number): string {
  const match = template.match(/^\{count, plural, one \{([^}]*)\} other \{([^}]*)\}\}$/)
  if (!match) throw new Error(`template is not a bare ICU plural block: ${template}`)
  const branch = count === 1 ? match[1] : match[2]
  return branch.replace('#', String(count))
}

interface FixtureRole {
  id: string
}
interface FixturePerson {
  id: string
}

async function createRole(name: string, defaultSlots: number): Promise<FixtureRole> {
  const client = serviceClient()
  const { data, error } = await client
    .from('roles')
    .insert({ name, default_slots: defaultSlots, is_active: true })
    .select('id')
    .single()
  if (error) throw new Error(`failed to create fixture role: ${JSON.stringify(error)}`)
  return { id: data.id as string }
}

async function deleteRole(id: string): Promise<void> {
  await serviceClient().from('person_role_skills').delete().eq('role_id', id)
  await serviceClient().from('roles').delete().eq('id', id)
}

async function createPerson(name: string, isActive: boolean): Promise<FixturePerson> {
  const client = serviceClient()
  const { data, error } = await client
    .from('people')
    .insert({ name, linked_user_id: null, is_active: isActive })
    .select('id')
    .single()
  if (error) throw new Error(`failed to create fixture person: ${JSON.stringify(error)}`)
  return { id: data.id as string }
}

async function deletePerson(id: string): Promise<void> {
  await serviceClient().from('people').delete().eq('id', id)
}

async function assignSkill(personId: string, roleId: string, level: 1 | 2 | 3): Promise<void> {
  const { error } = await serviceClient()
    .from('person_role_skills')
    .insert({ person_id: personId, role_id: roleId, level })
  if (error) throw new Error(`failed to assign fixture skill: ${JSON.stringify(error)}`)
}

// ---------------------------------------------------------------------------
// AC1: no horizontal overflow at 375px/390px with long pt-PT role names.
// ---------------------------------------------------------------------------

const WIDTHS = [375, 390]

test.describe('CHORE-29: AC1 no horizontal overflow with long role names', () => {
  let roleIds: string[] = []
  let confirmPersonId: string

  test.beforeEach(async ({}, testInfo) => {
    const longNames = [
      `Coordenador de Louvor e Adoração Dominical (w${testInfo.workerIndex})`,
      `Responsável pela Receção e Acolhimento de Visitantes (w${testInfo.workerIndex})`,
      `Técnico de Som e Projeção Audiovisual (w${testInfo.workerIndex})`,
    ]
    roleIds = []
    for (const name of longNames) {
      const role = await createRole(name, 2)
      roleIds.push(role.id)
    }

    // Role removal only enters the confirm-remove state (STORY-19) when the
    // role is "in use" (409 role_in_use) — a role with zero assigned people
    // deletes immediately on first click with no confirm UI. Assign a
    // fixture person to roleIds[0] so the confirm-remove overflow check
    // below actually reaches that state.
    const person = await createPerson(`CHORE-29 AC1 Confirm Person (w${testInfo.workerIndex})`, true)
    confirmPersonId = person.id
    await assignSkill(confirmPersonId, roleIds[0], 1)
  })

  test.afterEach(async () => {
    await deletePerson(confirmPersonId)
    for (const id of roleIds) await deleteRole(id)
  })

  for (const width of WIDTHS) {
    test(`admin sees no horizontal overflow at ${width}px (screenshot captured)`, async ({
      adminPage,
    }) => {
      await adminPage.setViewportSize({ width, height: 812 })
      await adminPage.goto('/pt-PT/admin/roles')
      await expect(adminPage).not.toHaveURL(/\/login/)

      const scrollWidth = await adminPage.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width)

      // PR #64 review WARNING: the row's action area (badge + Edit/Remove
      // pills) is a nested flex-wrap container inside the row's own
      // flex-wrap (CLAUDE.md BUGFIX-06 lesson — scrollWidth alone can pass
      // per-context while the combined visual layout still wraps
      // incoherently). Capture a real screenshot as committed evidence,
      // not just a manual claim, alongside the scrollWidth assertion above
      // — same evidence pattern as
      // e2e-integration/header-nav-mobile-overflow.spec.ts (BUGFIX-06).
      await adminPage.screenshot({
        path: `test-results-integration/chore-29-roles-card-list-${width}.png`,
        fullPage: true,
      })

      // PR #64 re-review cycle 2 CRITICAL: the confirm-remove state
      // (badge + "Remover mesmo assim" + "Cancelar") is wider than the
      // default state and previously overflowed at 375px/390px because the
      // actions wrapper was `flex-shrink-0` — its own internal flex-wrap
      // never got a chance to engage. Re-assert no overflow after entering
      // that state, not just the default render.
      await adminPage.getByTestId(`rm-remove-${roleIds[0]}`).click()
      await expect(adminPage.getByTestId(`rm-remove-confirm-${roleIds[0]}`)).toBeVisible()

      const confirmScrollWidth = await adminPage.evaluate(
        () => document.documentElement.scrollWidth,
      )
      expect(confirmScrollWidth).toBeLessThanOrEqual(width)

      await adminPage.screenshot({
        path: `test-results-integration/chore-29-roles-card-list-confirm-${width}.png`,
        fullPage: true,
      })
    })
  }
})

// ---------------------------------------------------------------------------
// AC2: card row content — name, qualified-people count meta line (ICU
// plural, both locales, active-people-only), slots badge.
// ---------------------------------------------------------------------------

test.describe('CHORE-29: AC2 card row content (plural count, active-people-only)', () => {
  let roleId: string
  let personId1: string
  let personId2: string
  let inactivePersonId: string

  test.beforeEach(async ({}, testInfo) => {
    const role = await createRole(`CHORE-29 QA Role (w${testInfo.workerIndex})`, 3)
    roleId = role.id

    const person1 = await createPerson(`CHORE-29 QA Person 1 (w${testInfo.workerIndex})`, true)
    personId1 = person1.id
    const person2 = await createPerson(`CHORE-29 QA Person 2 (w${testInfo.workerIndex})`, true)
    personId2 = person2.id
    // Soft-deleted person with a skill row for the same role — proves the
    // active-only filter (people!inner(is_active) + .eq('people.is_active', true)).
    const inactivePerson = await createPerson(
      `CHORE-29 QA Inactive Person (w${testInfo.workerIndex})`,
      false
    )
    inactivePersonId = inactivePerson.id

    await assignSkill(personId1, roleId, 1)
    await assignSkill(personId2, roleId, 2)
    await assignSkill(inactivePersonId, roleId, 3)
  })

  test.afterEach(async () => {
    await deleteRole(roleId)
    await deletePerson(personId1)
    await deletePerson(personId2)
    await deletePerson(inactivePersonId)
  })

  test('pt-PT: meta line shows 2 people (not 3), slots badge shows 3', async ({ adminPage }) => {
    await adminPage.goto('/pt-PT/admin/roles')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const messages = messagesFor('pt-PT')
    const row = adminPage.locator('li', {
      hasText: `CHORE-29 QA Role (w${test.info().workerIndex})`,
    })
    await expect(row).toBeVisible()
    await expect(row).toContainText(renderPlural(messages.RoleManagement.peopleCanServeCount, 2))
    await expect(row).toContainText(renderPlural(messages.RoleManagement.slotsPerSundayBadge, 3))
  })

  test('en: meta line shows 2 people (not 3), slots badge shows 3', async ({ adminPage }) => {
    await adminPage.goto('/en/admin/roles')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const messages = messagesFor('en')
    const row = adminPage.locator('li', {
      hasText: `CHORE-29 QA Role (w${test.info().workerIndex})`,
    })
    await expect(row).toBeVisible()
    await expect(row).toContainText(renderPlural(messages.RoleManagement.peopleCanServeCount, 2))
    await expect(row).toContainText(renderPlural(messages.RoleManagement.slotsPerSundayBadge, 3))
  })
})

test.describe('CHORE-29: AC2 singular qualified-people count', () => {
  let roleId: string
  let personId: string

  test.beforeEach(async ({}, testInfo) => {
    const role = await createRole(`CHORE-29 QA Singular Role (w${testInfo.workerIndex})`, 1)
    roleId = role.id
    const person = await createPerson(`CHORE-29 QA Singular Person (w${testInfo.workerIndex})`, true)
    personId = person.id
    await assignSkill(personId, roleId, 1)
  })

  test.afterEach(async () => {
    await deleteRole(roleId)
    await deletePerson(personId)
  })

  test('pt-PT: meta line and slots badge use the singular ICU branch', async ({ adminPage }) => {
    await adminPage.goto('/pt-PT/admin/roles')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const messages = messagesFor('pt-PT')
    const row = adminPage.locator('li', {
      hasText: `CHORE-29 QA Singular Role (w${test.info().workerIndex})`,
    })
    await expect(row).toBeVisible()
    await expect(row).toContainText(renderPlural(messages.RoleManagement.peopleCanServeCount, 1))
    await expect(row).toContainText(renderPlural(messages.RoleManagement.slotsPerSundayBadge, 1))
  })
})

test.describe('CHORE-29: AC2 zero qualified people (new role, no skill rows)', () => {
  let roleId: string

  test.beforeEach(async ({}, testInfo) => {
    const role = await createRole(`CHORE-29 QA Zero Role (w${testInfo.workerIndex})`, 1)
    roleId = role.id
  })

  test.afterEach(async () => {
    await deleteRole(roleId)
  })

  test('pt-PT: meta line shows the zero-count plural branch (map miss defaults to 0)', async ({
    adminPage,
  }) => {
    await adminPage.goto('/pt-PT/admin/roles')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const messages = messagesFor('pt-PT')
    const row = adminPage.locator('li', {
      hasText: `CHORE-29 QA Zero Role (w${test.info().workerIndex})`,
    })
    await expect(row).toBeVisible()
    await expect(row).toContainText(renderPlural(messages.RoleManagement.peopleCanServeCount, 0))
  })

  test('en: meta line shows the zero-count plural branch (map miss defaults to 0)', async ({
    adminPage,
  }) => {
    await adminPage.goto('/en/admin/roles')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const messages = messagesFor('en')
    const row = adminPage.locator('li', {
      hasText: `CHORE-29 QA Zero Role (w${test.info().workerIndex})`,
    })
    await expect(row).toBeVisible()
    await expect(row).toContainText(renderPlural(messages.RoleManagement.peopleCanServeCount, 0))
  })
})

// ---------------------------------------------------------------------------
// AC4: tap targets >= 44px, distinct accessible labels on add/edit inputs.
// ---------------------------------------------------------------------------

test.describe('CHORE-29: AC4 tap targets and accessible labels', () => {
  let roleId: string

  test.beforeEach(async ({}, testInfo) => {
    const role = await createRole(`CHORE-29 QA Tap Target Role (w${testInfo.workerIndex})`, 1)
    roleId = role.id
  })

  test.afterEach(async () => {
    await deleteRole(roleId)
  })

  test('add-role controls and row Edit button are >= 44px at 375px, with distinct aria-labels', async ({
    adminPage,
  }) => {
    await adminPage.setViewportSize({ width: 375, height: 812 })
    await adminPage.goto('/pt-PT/admin/roles')
    await expect(adminPage).not.toHaveURL(/\/login/)

    const nameInput = adminPage.getByTestId('rm-add-input')
    const slotsInput = adminPage.getByTestId('rm-add-slots-input')
    const addButton = adminPage.getByTestId('rm-add-submit')

    for (const control of [nameInput, slotsInput, addButton]) {
      await expect(control).toBeVisible()
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    const nameLabel = await nameInput.getAttribute('aria-label')
    const slotsLabel = await slotsInput.getAttribute('aria-label')
    expect(nameLabel).toBeTruthy()
    expect(slotsLabel).toBeTruthy()
    expect(nameLabel).not.toBe(slotsLabel)

    // Locate the row's Edit button by its stable data-testid (not a
    // hasText-filtered <li>): once edit mode replaces the name text with an
    // <input>, a hasText-based locator would stop matching, since Playwright's
    // hasText only inspects textContent, not <input>/<textarea> `value`
    // (confirmed empirically against both the old <tr> and new <li> markup —
    // a pre-existing latent gotcha in this pattern, out of scope for this
    // chore to fix in the legacy e2e/role-management.spec.ts suite, which
    // this new spec avoids by keying off role.id directly instead).
    const editButton = adminPage.getByTestId(`rm-edit-${roleId}`)
    await expect(editButton).toBeVisible()
    const editBox = await editButton.boundingBox()
    expect(editBox).not.toBeNull()
    expect(editBox!.height).toBeGreaterThanOrEqual(44)

    await editButton.click()
    // The edit <form> is identified by containing the now-visible Save
    // button for this role id — robust regardless of input values.
    const editForm = adminPage.locator('form', {
      has: adminPage.getByTestId(`rm-save-${roleId}`),
    })
    const editNameInput = editForm.locator('input').nth(0)
    const editSlotsInput = editForm.locator('input').nth(1)
    for (const control of [editNameInput, editSlotsInput]) {
      await expect(control).toBeVisible()
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    const editNameLabel = await editNameInput.getAttribute('aria-label')
    const editSlotsLabel = await editSlotsInput.getAttribute('aria-label')
    expect(editNameLabel).toBeTruthy()
    expect(editSlotsLabel).toBeTruthy()
    expect(editNameLabel).not.toBe(editSlotsLabel)
  })
})
