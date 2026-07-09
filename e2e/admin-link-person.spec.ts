/**
 * e2e/admin-link-person.spec.ts — STORY-20: Admin links a person record to a
 * user account.
 *
 * AC coverage:
 *   AC1 — link an unlinked person to an unlinked user; UI reflects it.
 *   AC2 — unlink a linked person; UI reverts to "no account".
 *   AC3 — linking a user already linked to a *different* person is rejected
 *         (409 user_already_linked); no silent overwrite on either row.
 *   AC4 — linking an already-linked person is rejected (409
 *         person_already_linked); no silent overwrite.
 *   AC5 — unauthenticated calls to the link/unlink API are blocked (401).
 *         The Member-role 403 case requires a real Member session, which
 *         this environment cannot provide — see the manual verification
 *         step below (same limitation as e2e/person-skills.spec.ts AC7).
 *   AC6 — covered structurally by e2e/i18n-key-parity.spec.ts (existing,
 *         automatic) plus a button-text spot check below (per CLAUDE.md's
 *         button-text-extraction discipline: exact strings taken from
 *         messages/pt-PT.json at test-write time, not guessed).
 *   Design decision 5 — the link picker's client-side proactive exclusion of
 *         already-linked users (components/PeopleTable.tsx's `unlinkedUsers`)
 *         is covered separately from AC3/AC4's server-side 409 checks by the
 *         "picker excludes a user already linked to a different person" test.
 *
 * CI-safe tests (no real Supabase session) run unconditionally below. The
 * E2E_WITH_AUTH-gated tests further down require .env.local + a real
 * Supabase admin session and are skipped in CI.
 *
 * Fixture hygiene: each auth-gated test creates its own worker-indexed
 * fixture person(s) and user(s) inline, at the top of the test body (no
 * shared `test.beforeEach`/`test.afterEach` — every test's fixtures and
 * cleanup are self-contained). Person fixtures are created via the admin API
 * (createPerson); user fixtures are created via a direct service-role
 * Supabase client (createThrowawayLinkedUser/deleteThrowawayLinkedUser,
 * adapted from e2e/claim.spec.ts lines ~179-211 — there is no public
 * "create user" API, so tests seed a real auth user + matching public.users
 * row directly). Cleanup runs in a per-test `try/finally` block immediately
 * wrapping the fixture's usage, so it always runs whether the test passes or
 * throws. AC1's UI-reflection step creates a *second*, nested pair of
 * fixtures (secondPerson/secondUser) with their own nested try/finally,
 * cleaned up before the outer person/user pair.
 *
 * Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC5 — Member role is blocked from the link API:
 *    1. Log in as a Member (role = 'member' in public.users).
 *    2. Open DevTools console and run:
 *       fetch('/api/admin/people/<any-id>/link', { method: 'PUT', headers:
 *       { 'Content-Type': 'application/json' }, body: JSON.stringify({
 *       user_id: '<any-uuid>' }) }).then(r => console.log(r.status))
 *    3. Confirm the logged status is 403.
 */

import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// --- Fixture helpers ------------------------------------------------------

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

function uniqueSuffix(testInfo: TestInfo): string {
  return `w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

async function deletePerson(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/admin/people/${id}`);
}

// Creates a real, isolated auth user + matching public.users row, following
// e2e/claim.spec.ts's createThrowawayLinkedUser pattern — there is no public
// "create user" API (users are provisioned only via real OAuth login).
async function createThrowawayLinkedUser(
  client: SupabaseClient,
  label: string
): Promise<{ id: string; displayName: string; email: string }> {
  const email = `story20-qa-${label}-${randomUUID()}@example.invalid`;
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomUUID(),
  });

  if (error || !data.user) {
    throw new Error(`Failed to create throwaway user fixture "${label}": ${error?.message}`);
  }

  const userId = data.user.id;
  const displayName = `STORY-20 QA ${label}`;
  const { error: usersError } = await client.from('users').insert({
    id: userId,
    email,
    display_name: displayName,
    role: 'member',
  });

  if (usersError) {
    throw new Error(`Failed to insert public.users row for "${label}" fixture: ${usersError.message}`);
  }

  return { id: userId, displayName, email };
}

async function deleteThrowawayLinkedUser(client: SupabaseClient, userId: string): Promise<void> {
  await client.auth.admin.deleteUser(userId);
}

// ---------------------------------------------------------------------------
// CI-safe: auth-gate tests (no real Supabase session required)
// ---------------------------------------------------------------------------

test('AC5-api-put: PUT /api/admin/people/some-id/link unauthenticated → 401', async ({ request }) => {
  const response = await request.put('/api/admin/people/some-id/link', {
    data: { user_id: '00000000-0000-0000-0000-000000000000' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC5-api-delete: DELETE /api/admin/people/some-id/link unauthenticated → 401', async ({ request }) => {
  const response = await request.delete('/api/admin/people/some-id/link');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

// ---------------------------------------------------------------------------
// E2E_WITH_AUTH-gated: happy-path/validation tests (require a real admin
// session). Fixture lifecycle mirrors e2e/person-skills.spec.ts /
// e2e/claim.spec.ts.
// ---------------------------------------------------------------------------

test.describe('STORY-20: admin links/unlinks a person to a user account (auth-gated)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in file header.');

  test('AC1: linking an unlinked person to an unlinked user sets linked_user_id; UI reflects it', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const personName = `STORY-20 QA AC1 Person (${suffix})`;
    const person = await createPerson(page, personName);
    const user = await createThrowawayLinkedUser(client, `ac1-${suffix}`);

    try {
      const putResponse = await page.request.put(`/api/admin/people/${person.id}/link`, {
        data: { user_id: user.id },
      });
      expect(putResponse.status()).toBe(200);

      const getResponse = await page.request.get('/api/admin/people');
      const rows = (await getResponse.json()) as Array<{ id: string; linked_user_id: string | null }>;
      const row = rows.find((r) => r.id === person.id);
      expect(row?.linked_user_id).toBe(user.id);

      // UI: link a second fixture person through the picker to verify the
      // "Conta" column updates without a page reload.
      const secondPerson = await createPerson(page, `STORY-20 QA AC1 UI Person (${suffix})`);
      const secondUser = await createThrowawayLinkedUser(client, `ac1-ui-${suffix}`);
      try {
        await page.goto('/pt-PT/admin/people');
        const row2 = page.locator('tr', { hasText: secondPerson.name });
        await row2.getByTestId(`pm-link-${secondPerson.id}`).click();
        await row2.getByTestId(`pm-link-select-${secondPerson.id}`).selectOption(secondUser.id);
        await row2.getByTestId(`pm-link-confirm-${secondPerson.id}`).click();
        await expect(row2).toContainText(secondUser.displayName);
      } finally {
        await deletePerson(page, secondPerson.id);
        await deleteThrowawayLinkedUser(client, secondUser.id);
      }
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, user.id);
    }
  });

  test('AC2: unlinking a linked person sets linked_user_id to null; UI reverts to unlinked label', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const personName = `STORY-20 QA AC2 Person (${suffix})`;
    const person = await createPerson(page, personName);
    const user = await createThrowawayLinkedUser(client, `ac2-${suffix}`);

    try {
      const putResponse = await page.request.put(`/api/admin/people/${person.id}/link`, {
        data: { user_id: user.id },
      });
      expect(putResponse.status()).toBe(200);

      await page.goto('/pt-PT/admin/people');
      const row = page.locator('tr', { hasText: personName });
      await expect(row).toContainText(user.displayName);
      await row.getByTestId(`pm-unlink-${person.id}`).click();

      // Extracted from messages/pt-PT.json's PeopleManagement.unlinkedLabel.
      await expect(row).toContainText('Sem conta');

      const getResponse = await page.request.get('/api/admin/people');
      const rows = (await getResponse.json()) as Array<{ id: string; linked_user_id: string | null }>;
      const dbRow = rows.find((r) => r.id === person.id);
      expect(dbRow?.linked_user_id).toBeNull();
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, user.id);
    }
  });

  test('AC3: linking a user already linked to a different person is rejected (409 user_already_linked); no overwrite', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const person1 = await createPerson(page, `STORY-20 QA AC3 Person1 (${suffix})`);
    const person2 = await createPerson(page, `STORY-20 QA AC3 Person2 (${suffix})`);
    const user = await createThrowawayLinkedUser(client, `ac3-${suffix}`);

    try {
      const first = await page.request.put(`/api/admin/people/${person1.id}/link`, {
        data: { user_id: user.id },
      });
      expect(first.status()).toBe(200);

      const second = await page.request.put(`/api/admin/people/${person2.id}/link`, {
        data: { user_id: user.id },
      });
      expect(second.status()).toBe(409);
      expect((await second.json()).error).toBe('user_already_linked');

      const getResponse = await page.request.get('/api/admin/people');
      const rows = (await getResponse.json()) as Array<{ id: string; linked_user_id: string | null }>;
      expect(rows.find((r) => r.id === person1.id)?.linked_user_id).toBe(user.id);
      expect(rows.find((r) => r.id === person2.id)?.linked_user_id).toBeNull();
    } finally {
      await deletePerson(page, person1.id);
      await deletePerson(page, person2.id);
      await deleteThrowawayLinkedUser(client, user.id);
    }
  });

  test('AC4: linking an already-linked person to a different user is rejected (409 person_already_linked); no overwrite', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const person = await createPerson(page, `STORY-20 QA AC4 Person (${suffix})`);
    const userA = await createThrowawayLinkedUser(client, `ac4-a-${suffix}`);
    const userB = await createThrowawayLinkedUser(client, `ac4-b-${suffix}`);

    try {
      const first = await page.request.put(`/api/admin/people/${person.id}/link`, {
        data: { user_id: userA.id },
      });
      expect(first.status()).toBe(200);

      const second = await page.request.put(`/api/admin/people/${person.id}/link`, {
        data: { user_id: userB.id },
      });
      expect(second.status()).toBe(409);
      expect((await second.json()).error).toBe('person_already_linked');

      const getResponse = await page.request.get('/api/admin/people');
      const rows = (await getResponse.json()) as Array<{ id: string; linked_user_id: string | null }>;
      expect(rows.find((r) => r.id === person.id)?.linked_user_id).toBe(userA.id);
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, userA.id);
      await deleteThrowawayLinkedUser(client, userB.id);
    }
  });

  // Design decision 5 (component doc comment in components/PeopleTable.tsx,
  // `unlinkedUsers`): a user already linked to *any* person — including a
  // person soft-deleted after linking — must not appear as a picker option
  // for a *different* person. AC3/AC4 above only exercise the server-side
  // 409 guard; this test exercises the client-side proactive exclusion that
  // keeps a user from even being selectable in the first place.
  test('picker excludes a user already linked to a different person', async ({ page }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const linkedPerson = await createPerson(page, `STORY-20 QA Picker LinkedPerson (${suffix})`);
    const otherPerson = await createPerson(page, `STORY-20 QA Picker OtherPerson (${suffix})`);
    const user = await createThrowawayLinkedUser(client, `picker-${suffix}`);

    try {
      const putResponse = await page.request.put(`/api/admin/people/${linkedPerson.id}/link`, {
        data: { user_id: user.id },
      });
      expect(putResponse.status()).toBe(200);

      await page.goto('/pt-PT/admin/people');
      const otherRow = page.locator('tr', { hasText: otherPerson.name });
      await otherRow.getByTestId(`pm-link-${otherPerson.id}`).click();

      const select = otherRow.getByTestId(`pm-link-select-${otherPerson.id}`);
      await expect(select).toBeVisible();

      // The already-linked user must not appear as an option by value or by
      // display text (proactive exclusion via `unlinkedUsers` in PeopleTable.tsx).
      await expect(select.locator(`option[value="${user.id}"]`)).toHaveCount(0);
      const optionTexts = await select.locator('option').allTextContents();
      expect(optionTexts).not.toContain(user.displayName);
    } finally {
      await deletePerson(page, linkedPerson.id);
      await deletePerson(page, otherPerson.id);
      await deleteThrowawayLinkedUser(client, user.id);
    }
  });

  test('AC6: link/unlink button text matches messages/pt-PT.json exactly (both states)', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const personName = `STORY-20 QA AC6 Person (${suffix})`;
    const person = await createPerson(page, personName);
    const user = await createThrowawayLinkedUser(client, `ac6-${suffix}`);

    try {
      await page.goto('/pt-PT/admin/people');
      const row = page.locator('tr', { hasText: personName });
      // Extracted from messages/pt-PT.json's PeopleManagement.linkAccountButton.
      await expect(row.getByTestId(`pm-link-${person.id}`)).toHaveText('Ligar conta');

      // Actually link the fixture (via the API, mirroring AC1/AC2's setup)
      // so the unlink button actually renders, then reload to check its text.
      const putResponse = await page.request.put(`/api/admin/people/${person.id}/link`, {
        data: { user_id: user.id },
      });
      expect(putResponse.status()).toBe(200);

      await page.goto('/pt-PT/admin/people');
      // Extracted from messages/pt-PT.json's PeopleManagement.unlinkButton.
      await expect(row.getByTestId(`pm-unlink-${person.id}`)).toHaveText('Desligar conta');
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, user.id);
    }
  });
});
