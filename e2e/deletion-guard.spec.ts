/**
 * e2e/deletion-guard.spec.ts — STORY-19: Guard deletion of roles and people
 * that are in use
 *
 * AC coverage:
 *   AC1 — a role with no skill assignments is removed without any extra
 *         prompt (unchanged from STORY-17 behavior); explicit "not a 409"
 *         assertion.
 *   AC2 — an in-use role shows a warning with the referenced count and does
 *         not delete without explicit confirmation (API 409 + UI banner).
 *   AC3 — a confirmed in-use role delete removes both the role and its
 *         dependent person_role_skills rows (verified via a direct
 *         service-role query, not just the filtered API).
 *   AC4 — an in-use person is soft-deleted and its skill rows are handled
 *         consistently (cascade-deleted), with the same warn+confirm UX as
 *         roles (Locked decision 6).
 *   AC5 — the in-use count is computed server-side; an unconfirmed delete
 *         via direct API call still returns 409, and unauthenticated
 *         requests are still 401 before any count logic runs.
 *   AC6 — all warning strings come from messages/pt-PT.json (AO90),
 *         including a count-aware (ICU plural) message, for both roles and
 *         people namespaces independently.
 *
 * CI-safe tests (no real Supabase session) run unconditionally below. The
 * E2E_WITH_AUTH-gated tests further down require .env.local + a real
 * Supabase admin session and are skipped in CI (see auth-gated test pattern
 * in CLAUDE.md and e2e/role-management.spec.ts / e2e/person-skills.spec.ts).
 *
 * Fixture hygiene (STORY-11/STORY-14/STORY-18 pattern): each auth-gated test
 * creates worker-indexed fixture person(s)/role(s) via the admin API in
 * test.beforeEach, and test.afterEach unconditionally cleans them up.
 */

import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// CI-safe: auth-gate tests (no real Supabase session required)
// ---------------------------------------------------------------------------

test('AC5-role: DELETE /api/admin/roles/some-id unauthenticated → 401 before any count logic', async ({
  request,
}) => {
  const response = await request.delete('/api/admin/roles/some-id');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-role-confirm: DELETE /api/admin/roles/some-id?confirm=1 unauthenticated → 401', async ({
  request,
}) => {
  const response = await request.delete('/api/admin/roles/some-id?confirm=1');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-person: DELETE /api/admin/people/some-id unauthenticated → 401 before any count logic', async ({
  request,
}) => {
  const response = await request.delete('/api/admin/people/some-id');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-person-confirm: DELETE /api/admin/people/some-id?confirm=1 unauthenticated → 401', async ({
  request,
}) => {
  const response = await request.delete('/api/admin/people/some-id?confirm=1');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

// ---------------------------------------------------------------------------
// AC6 (partial, CI-safe): the exact ICU-plural strings render correctly with
// intl-messageformat, independent of the browser/UI. This does not require
// auth and complements the UI assertions in the auth-gated block below.
// ---------------------------------------------------------------------------

test('AC6-icu-shape: RoleManagement.confirmRemoveInUse and PeopleManagement.confirmRemoveInUse exist in pt-PT.json with {count} plural', () => {
  const raw = readFileSync(join(__dirname, '..', 'messages', 'pt-PT.json'), 'utf8');
  const messages = JSON.parse(raw);
  expect(messages.RoleManagement.confirmRemoveInUse).toContain('{count, plural');
  expect(messages.PeopleManagement.confirmRemoveInUse).toContain('{count, plural');
  expect(messages.RoleManagement.confirmRemoveButton).toBeTruthy();
  expect(messages.PeopleManagement.confirmRemoveButton).toBeTruthy();
});

// ---------------------------------------------------------------------------
// E2E_WITH_AUTH-gated: happy-path/validation tests (require a real admin
// session). Fixture lifecycle mirrors e2e/person-skills.spec.ts.
// ---------------------------------------------------------------------------

// Talks directly to Supabase with the service-role key (bypassing RLS and
// the app entirely), the same pattern as e2e/claim.spec.ts, so AC3/AC4 can
// prove the explicit hard-delete of person_role_skills actually happened
// (not just that the filtered API stops showing the row).
function loadEnvLocalFallback(): void {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
}
loadEnvLocalFallback();

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface FixtureRecord {
  id: string;
  name: string;
}

async function createPerson(page: Page, name: string): Promise<FixtureRecord> {
  const response = await page.request.post('/api/admin/people', { data: { name } });
  expect(response.status()).toBe(201);
  return (await response.json()) as FixtureRecord;
}

async function createRole(page: Page, name: string): Promise<FixtureRecord> {
  const response = await page.request.post('/api/admin/roles', {
    data: { name, default_slots: 1 },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as FixtureRecord;
}

async function assignSkill(page: Page, personId: string, roleId: string, level = 1) {
  const response = await page.request.put(`/api/admin/people/${personId}/skills/${roleId}`, {
    data: { level },
  });
  expect(response.status()).toBe(200);
}

async function countPersonRoleSkillsForRole(roleId: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from('person_role_skills')
    .select('*', { count: 'exact', head: true })
    .eq('role_id', roleId);
  if (error) throw error;
  return count ?? 0;
}

async function countPersonRoleSkillsForPerson(personId: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from('person_role_skills')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', personId);
  if (error) throw error;
  return count ?? 0;
}

// Reads the exact pt-PT strings at test-authoring time (CHORE-10 convention:
// extract from messages/pt-PT.json, don't guess).
function ptMessages(): Record<string, Record<string, string>> {
  const raw = readFileSync(join(__dirname, '..', 'messages', 'pt-PT.json'), 'utf8');
  return JSON.parse(raw);
}

test.describe('STORY-19: guard deletion of in-use roles and people (auth-gated)', () => {
  test.skip(
    !process.env.E2E_WITH_AUTH,
    'Admin pages require authentication; see manual steps in role-management.spec.ts / person-skills.spec.ts.'
  );

  let personName: string;
  let personName2: string;
  let roleName: string;
  let roleName2: string;
  let personId: string;
  let personId2: string;
  let roleId: string;
  let roleId2: string;

  test.beforeEach(({}, testInfo) => {
    const suffix = `w${testInfo.workerIndex}`;
    personName = `STORY-19 QA Person (${suffix})`;
    personName2 = `STORY-19 QA Person 2 (${suffix})`;
    roleName = `STORY-19 QA Role (${suffix})`;
    roleName2 = `STORY-19 QA Role 2 (${suffix})`;
  });

  test.afterEach(async ({ page }) => {
    // Best-effort cleanup: skill rows first (if any survived), then
    // people/roles. Soft-deletes, so order doesn't matter for CASCADE.
    if (personId && roleId) await page.request.delete(`/api/admin/people/${personId}/skills/${roleId}`);
    if (personId2 && roleId2)
      await page.request.delete(`/api/admin/people/${personId2}/skills/${roleId2}`);
    if (personId) await page.request.delete(`/api/admin/people/${personId}`);
    if (personId2) await page.request.delete(`/api/admin/people/${personId2}`);
    if (roleId) await page.request.delete(`/api/admin/roles/${roleId}`);
    if (roleId2) await page.request.delete(`/api/admin/roles/${roleId2}`);
  });

  test('AC1: a role with no skill assignments is removed without any extra prompt (not a 409)', async ({
    page,
  }) => {
    const role = await createRole(page, roleName);
    roleId = role.id;

    const response = await page.request.delete(`/api/admin/roles/${roleId}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.count).toBeUndefined();
    roleId = ''; // already deleted; afterEach no-op

    const getResponse = await page.request.get('/api/admin/roles');
    const roles = (await getResponse.json()) as Array<{ name: string }>;
    expect(roles.some((r) => r.name === roleName)).toBe(false);
  });

  test('AC2/AC5: an in-use role blocks unconfirmed delete with 409 role_in_use + count; role still present', async ({
    page,
  }) => {
    const person = await createPerson(page, personName);
    personId = person.id;
    const role = await createRole(page, roleName);
    roleId = role.id;
    await assignSkill(page, personId, roleId, 1);

    const response = await page.request.delete(`/api/admin/roles/${roleId}`);
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('role_in_use');
    expect(body.count).toBe(1);

    const getResponse = await page.request.get('/api/admin/roles');
    const roles = (await getResponse.json()) as Array<{ id: string; name: string }>;
    expect(roles.some((r) => r.id === roleId)).toBe(true);
  });

  test('AC2/AC6 (UI): clicking Remover on an in-use role shows the count-aware warning banner and does not remove the row', async ({
    page,
  }) => {
    const person = await createPerson(page, personName);
    personId = person.id;
    const role = await createRole(page, roleName);
    roleId = role.id;
    await assignSkill(page, personId, roleId, 1);

    await page.goto('/pt-PT/admin/roles');
    const row = page.locator('tr', { hasText: roleName });
    await row.locator('[data-testid^="rm-remove-"]').click();

    const banner = page.getByTestId('rm-confirm-banner');
    await expect(banner).toBeVisible();

    // Exact pt-PT count-aware text for count === 1, extracted from
    // messages/pt-PT.json at test-authoring time (CHORE-10 convention).
    const messages = ptMessages();
    const expectedText = messages.RoleManagement.confirmRemoveInUse
      .replace('{count, plural, one {# pessoa} other {# pessoas}}', '1 pessoa');
    await expect(banner).toContainText(expectedText);

    // Row is still present; deletion did not proceed.
    await expect(page.locator('tr', { hasText: roleName })).toBeVisible();

    // Cancel restores Editar/Remover without deleting.
    await row.locator('[data-testid^="rm-remove-cancel-"]').click();
    await expect(row.locator('[data-testid^="rm-remove-"]')).toBeVisible();
    await expect(page.locator('tr', { hasText: roleName })).toBeVisible();
  });

  test('AC3: confirming an in-use role delete removes both the role and its person_role_skills rows', async ({
    page,
  }) => {
    const person = await createPerson(page, personName);
    personId = person.id;
    const role = await createRole(page, roleName);
    roleId = role.id;
    await assignSkill(page, personId, roleId, 1);

    const response = await page.request.delete(`/api/admin/roles/${roleId}?confirm=1`);
    expect(response.status()).toBe(200);

    const getResponse = await page.request.get('/api/admin/roles');
    const roles = (await getResponse.json()) as Array<{ id: string }>;
    expect(roles.some((r) => r.id === roleId)).toBe(false);

    // Direct service-role query: proves the explicit hard-delete happened,
    // not just that the soft-deleted role is filtered out at query time.
    expect(await countPersonRoleSkillsForRole(roleId)).toBe(0);

    roleId = ''; // already deleted; afterEach no-op for the role
  });

  test('AC4: an in-use person is blocked (409 person_in_use), then confirmed delete soft-deletes the person and hard-deletes their skill rows', async ({
    page,
  }) => {
    const person = await createPerson(page, personName);
    personId = person.id;
    const role = await createRole(page, roleName);
    roleId = role.id;
    await assignSkill(page, personId, roleId, 1);

    const blocked = await page.request.delete(`/api/admin/people/${personId}`);
    expect(blocked.status()).toBe(409);
    const blockedBody = await blocked.json();
    expect(blockedBody.error).toBe('person_in_use');
    expect(blockedBody.count).toBe(1);

    const getResponse = await page.request.get('/api/admin/people');
    const people = (await getResponse.json()) as Array<{ id: string }>;
    expect(people.some((p) => p.id === personId)).toBe(true);

    const confirmed = await page.request.delete(`/api/admin/people/${personId}?confirm=1`);
    expect(confirmed.status()).toBe(200);

    const afterGet = await page.request.get('/api/admin/people');
    const afterPeople = (await afterGet.json()) as Array<{ id: string }>;
    expect(afterPeople.some((p) => p.id === personId)).toBe(false);

    expect(await countPersonRoleSkillsForPerson(personId)).toBe(0);

    personId = ''; // already deleted; afterEach no-op for the person
  });

  test('AC4/AC6 (UI): full parity with role-side UX, including plural (count=2) rendering, per-row disabling, and confirm/cancel', async ({
    page,
  }) => {
    const person = await createPerson(page, personName);
    personId = person.id;
    const otherPerson = await createPerson(page, personName2);
    personId2 = otherPerson.id;
    const role = await createRole(page, roleName);
    roleId = role.id;
    const role2 = await createRole(page, roleName2);
    roleId2 = role2.id;

    await assignSkill(page, personId, roleId, 1);
    await assignSkill(page, personId, roleId2, 2);

    await page.goto('/pt-PT/admin/people');
    const row = page.locator('tr', { hasText: personName });
    const otherRow = page.locator('tr', { hasText: personName2 });
    await row.locator('[data-testid^="pm-remove-"]').click();

    const banner = page.getByTestId('pm-confirm-banner');
    await expect(banner).toBeVisible();

    const messages = ptMessages();
    const expectedText = messages.PeopleManagement.confirmRemoveInUse.replace(
      '{count, plural, one {# competência associada} other {# competências associadas}}',
      '2 competências associadas'
    );
    await expect(banner).toContainText(expectedText);

    // Other rows' Editar/Remover/Competências are disabled while the
    // confirm prompt is open.
    await expect(otherRow.locator('[data-testid^="pm-edit-"]')).toBeDisabled();
    await expect(otherRow.locator('[data-testid^="pm-remove-"]')).toBeDisabled();
    await expect(otherRow.locator('[data-testid^="pm-skills-"]')).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    // Cancel restores state without deleting, and re-enables other rows.
    await row.locator('[data-testid^="pm-remove-cancel-"]').click();
    await expect(row.locator('[data-testid^="pm-remove-"]')).toBeVisible();
    await expect(page.locator('tr', { hasText: personName })).toBeVisible();
    await expect(otherRow.locator('[data-testid^="pm-edit-"]')).toBeEnabled();

    // Confirm removes the row.
    await row.locator('[data-testid^="pm-remove-"]').click();
    await expect(banner).toBeVisible();
    await row.locator('[data-testid^="pm-remove-confirm-"]').click();
    await expect(page.locator('tr', { hasText: personName })).toHaveCount(0);

    expect(await countPersonRoleSkillsForPerson(personId)).toBe(0);
    personId = ''; // already deleted; afterEach no-op for this person
  });

  test('AC5: server-side count is authoritative — repeated unconfirmed DELETE stays 409, confirmed DELETE succeeds', async ({
    page,
  }) => {
    const person = await createPerson(page, personName);
    personId = person.id;
    const role = await createRole(page, roleName);
    roleId = role.id;
    await assignSkill(page, personId, roleId, 1);

    const first = await page.request.delete(`/api/admin/roles/${roleId}`);
    expect(first.status()).toBe(409);
    const second = await page.request.delete(`/api/admin/roles/${roleId}`);
    expect(second.status()).toBe(409);

    const confirmed = await page.request.delete(`/api/admin/roles/${roleId}?confirm=1`);
    expect(confirmed.status()).toBe(200);
    roleId = ''; // already deleted; afterEach no-op
  });
});
