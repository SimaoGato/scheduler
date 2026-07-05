/**
 * e2e/claim.spec.ts — STORY-11: Claim existing person record on first login
 *
 * AC coverage:
 *   Automated (CI-safe with placeholder Supabase credentials):
 *     - Regression: unauthenticated POST /api/people/claim returns 401 JSON
 *       (mirrors settings-display-name.spec.ts's AC4 401 pattern).
 *     - Regression: invalid JSON body / non-UUID person_id return 400 even
 *       when unauthenticated would otherwise short-circuit first — these are
 *       checked in dedicated E2E_WITH_AUTH tests below since the guard runs
 *       before body/param validation (requireAuth first, per project
 *       convention), so validation-error coverage requires an authenticated
 *       session.
 *
 *   E2E_WITH_AUTH-gated (requires .env.local + real Supabase + Google OAuth):
 *     Every test below that needs person-record state creates its own
 *     worker-isolated fixture(s) via a service-role Supabase client
 *     (constructed directly in this file from NEXT_PUBLIC_SUPABASE_URL +
 *     SUPABASE_SERVICE_ROLE_KEY, same env vars lib/supabase/service.ts uses)
 *     and cleans them up in a `finally` block, so the suite is repeatable
 *     and no test leaves state that affects another test or a real
 *     E2E_WITH_AUTH account. See the fixture helpers below
 *     (createPerson/deletePerson/createThrowawayLinkedUser/
 *     deleteThrowawayLinkedUser), which follow the worker-isolated fixture +
 *     cleanup pattern from e2e/people-table-alignment.spec.ts (STORY-14),
 *     adapted for direct DB access since the claim flow needs to construct
 *     linked/inactive states not reachable via any admin UI.
 *
 *     - AC2: select + confirm links the record, redirects home, and the
 *       link is verified to be persisted in the DB (not just the redirect).
 *     - AC3: skip → no link, redirect home as member, no fetch to the claim
 *       API.
 *     - AC4 (page-level defense-in-depth half): direct navigation to
 *       /pt-PT/claim when no unlinked+active people exist redirects home.
 *       Since we cannot know ahead of time what other unlinked people exist
 *       in this Supabase project, this test snapshots every currently
 *       unlinked+active person, temporarily deactivates them all for the
 *       duration of the test, then restores them exactly as they were in a
 *       `finally` block.
 *     - AC5 (page-level defense-in-depth half): the test's own account is
 *       linked (via the real claim API, so the link is tied to whatever
 *       user id the E2E_WITH_AUTH session actually has) to a dedicated
 *       fixture person, then direct navigation to /pt-PT/claim is asserted
 *       to redirect home. The fixture is deleted afterward, returning the
 *       account to "not linked" for other tests.
 *     - AC6: claiming a person that's already linked (to a throwaway
 *       fixture user, simulating "someone else already claimed it") returns
 *       409 already_claimed.
 *     - Regression (WARNING #5, backend area): claiming a second, different,
 *       unlinked person while the account is already linked to a first one
 *       returns 409 already_linked — this exercises the partial-unique-index
 *       concurrency guard (migration 20260705000001), which previously had
 *       zero test coverage.
 *     - AC7: only unlinked + active people render in the list. Seeds three
 *       fixtures (one unlinked-active, one already-linked-to-someone-else,
 *       one inactive) and asserts only the unlinked-active one appears.
 *     - Validation regressions: invalid JSON body -> 400 invalid_json;
 *       non-UUID person_id -> 400 invalid_id.
 *
 *   Manual verification only (see notes below — same CI limitation as
 *   e2e/provision.spec.ts: placeholder Supabase credentials always fail
 *   exchangeCodeForSession before reaching provisionUser, so the auth
 *   callback halves of AC1/AC4/AC5 cannot be exercised end-to-end in CI):
 *
 *   1. AC1 — first login with unlinked people present -> redirected to /claim:
 *      1. In Supabase Table Editor, ensure at least one public.people row has
 *         linked_user_id IS NULL and is_active = true (add one via the
 *         "Equipa" admin screen if needed, e.g. name "Claim Test Person").
 *      2. Ensure the Google account you are about to log in with has no
 *         existing row in public.users (delete it first if it does, e.g.
 *         DELETE FROM public.users WHERE email = '...';).
 *      3. Log in with that Google account.
 *      4. Confirm the browser lands on /pt-PT/claim (not /pt-PT/), and the
 *         unlinked person name(s) from step 1 appear in the list.
 *
 *   2. AC4 — first login with NO unlinked people -> straight to home:
 *      1. In Table Editor, confirm no public.people rows have
 *         linked_user_id IS NULL AND is_active = true (either link or
 *         deactivate all of them for this check).
 *      2. Ensure the test Google account has no existing row in public.users
 *         (delete it first if it does).
 *      3. Log in with that Google account.
 *      4. Confirm the browser lands directly on /pt-PT/ — /claim is never shown.
 *
 *   3. AC5 — returning login never shows the claim page:
 *      1. Log in once with a fresh Google account (this creates its
 *         public.users row — per AC1/AC4 above it may or may not see /claim
 *         depending on unlinked-people state; either skip or claim to
 *         finish the first login).
 *      2. Ensure at least one unlinked+active public.people row still
 *         exists (add a new one if the first login consumed the only one,
 *         so this step actually exercises the "unlinked people still exist"
 *         condition).
 *      3. Log out, then log in again with the same Google account.
 *      4. Confirm the browser lands directly on /pt-PT/ — /claim is NOT
 *         shown on this second (returning) login, even though unlinked
 *         people still exist.
 */

import { test, expect, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// --- Fixture helpers ------------------------------------------------------
//
// These talk directly to Supabase with the service-role key (bypassing RLS
// and the app entirely), the same pattern as lib/supabase/service.ts, so
// tests can construct linked/inactive people states that no admin UI
// exposes. Only called from E2E_WITH_AUTH-gated tests, where a real
// .env.local with SUPABASE_SERVICE_ROLE_KEY is required to run them anyway.

// Unlike the `next start`/`next dev` process Playwright's webServer spawns
// (which loads .env.local itself), the Playwright test runner's own Node
// process does not. Without this, a developer with a filled-in .env.local
// would still see "supabaseUrl is required" from serviceClient() below
// unless they also manually re-exported the same vars in their shell. Fall
// back to reading .env.local directly (only for vars not already set) so
// `E2E_WITH_AUTH=1 npm run test:e2e` works out of the box, the same way
// `npm run dev` does.
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

interface PersonFixtureOptions {
  linkedUserId?: string;
  isActive?: boolean;
}

async function createPerson(
  client: SupabaseClient,
  name: string,
  opts: PersonFixtureOptions = {}
): Promise<string> {
  const { data, error } = await client
    .from('people')
    .insert({
      name,
      linked_user_id: opts.linkedUserId ?? null,
      is_active: opts.isActive ?? true,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create fixture person "${name}": ${error?.message}`);
  }
  return data.id as string;
}

async function deletePerson(client: SupabaseClient, id: string): Promise<void> {
  await client.from('people').delete().eq('id', id);
}

// Creates a real, isolated auth user + matching public.users row so a
// fixture person can be linked to "someone else" (a throwaway account, never
// the real E2E_WITH_AUTH test account) without touching any real data.
async function createThrowawayLinkedUser(client: SupabaseClient): Promise<string> {
  const email = `story11-qa-linked-${randomUUID()}@example.invalid`;
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomUUID(),
  });

  if (error || !data.user) {
    throw new Error(`Failed to create throwaway linked-user fixture: ${error?.message}`);
  }

  const userId = data.user.id;
  const { error: usersError } = await client.from('users').insert({
    id: userId,
    email,
    display_name: 'STORY-11 QA Linked User',
    role: 'member',
  });

  if (usersError) {
    throw new Error(`Failed to insert public.users row for throwaway fixture: ${usersError.message}`);
  }

  return userId;
}

// Deleting the auth user cascades to public.users (ON DELETE CASCADE); any
// people row referencing it as linked_user_id is handled independently by
// deletePerson (callers always delete their own person fixtures explicitly).
async function deleteThrowawayLinkedUser(client: SupabaseClient, userId: string): Promise<void> {
  await client.auth.admin.deleteUser(userId);
}

// ---------------------------------------------------------------------------

// Regression: unauthenticated POST to the claim endpoint returns 401 JSON,
// not a redirect — Route Handlers bypass proxy.ts's page guard, so the
// handler itself must enforce auth via requireAuth().
test('regression: unauthenticated POST /api/people/claim returns 401', async ({ request }) => {
  const response = await request.post('/api/people/claim', {
    data: { person_id: '00000000-0000-0000-0000-000000000000' },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

// AC4 (page-level defense-in-depth): unauthenticated visit to /pt-PT/claim
// redirects to /pt-PT/login (exercises proxy.ts's existing guard; no new
// proxy code needed — /claim sits outside the (app)/ route group but is
// still an authenticated-only page per the getSessionUser() check).
test('unauthenticated GET /pt-PT/claim redirects to /pt-PT/login', async ({ page }) => {
  await page.goto('/pt-PT/claim');
  await expect(page).toHaveURL(/\/pt-PT\/login/);
});

// AC7: only unlinked + active people render in the claim list. Seeds three
// fixtures (unlinked-active / already-linked-to-someone-else / inactive) and
// asserts only the unlinked-active one appears — this would fail if the
// page's .is('linked_user_id', null).eq('is_active', true) filters were
// removed, unlike the previous version of this test.
test('AC7: claim page lists only unlinked, active people', async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_WITH_AUTH, '/claim requires authentication; see manual steps in file header.');

  const client = serviceClient();
  const suffix = uniqueSuffix(testInfo);
  const unlinkedName = `STORY-11 QA Unlinked (${suffix})`;
  const linkedName = `STORY-11 QA Linked (${suffix})`;
  const inactiveName = `STORY-11 QA Inactive (${suffix})`;

  const otherUserId = await createThrowawayLinkedUser(client);
  const unlinkedId = await createPerson(client, unlinkedName);
  const linkedId = await createPerson(client, linkedName, { linkedUserId: otherUserId });
  const inactiveId = await createPerson(client, inactiveName, { isActive: false });

  try {
    await page.goto('/pt-PT/claim');
    const list = page.getByTestId('claim-person-list');
    await expect(list).toBeVisible();

    await expect(list.getByText(unlinkedName, { exact: true })).toBeVisible();
    await expect(list.getByText(linkedName, { exact: true })).toHaveCount(0);
    await expect(list.getByText(inactiveName, { exact: true })).toHaveCount(0);
  } finally {
    await deletePerson(client, unlinkedId);
    await deletePerson(client, linkedId);
    await deletePerson(client, inactiveId);
    await deleteThrowawayLinkedUser(client, otherUserId);
  }
});

// AC2: select + confirm links the record, redirects home, and the link is
// actually persisted in the DB (not just that the redirect happened).
test('AC2: selecting a person and confirming links the record and redirects home', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.E2E_WITH_AUTH, '/claim requires authentication; see manual steps in file header.');

  const client = serviceClient();
  const name = `STORY-11 QA AC2 (${uniqueSuffix(testInfo)})`;
  const personId = await createPerson(client, name);

  try {
    await page.goto('/pt-PT/claim');

    const confirmButton = page.getByTestId('claim-confirm');
    await expect(confirmButton).toBeDisabled();

    const option = page.getByRole('radio', { name, exact: true });
    await expect(option).toBeVisible();
    await option.check();
    await expect(confirmButton).toBeEnabled();

    await confirmButton.click();
    await expect(page).toHaveURL(/\/pt-PT\/?$/);

    const { data: row, error } = await client
      .from('people')
      .select('linked_user_id')
      .eq('id', personId)
      .single();
    expect(error).toBeNull();
    expect(row?.linked_user_id).not.toBeNull();
  } finally {
    // Deleting the fixture also un-links the test account, so subsequent
    // tests in this file see the account as "not linked" again.
    await deletePerson(client, personId);
  }
});

// AC3: skip -> no link, redirect home as member, no fetch to the claim API.
// Creates its own unlinked fixture so the claim page reliably renders the
// form regardless of what other unlinked people currently exist.
test('AC3: clicking skip redirects home without calling the claim API', async ({ page }, testInfo) => {
  test.skip(!process.env.E2E_WITH_AUTH, '/claim requires authentication; see manual steps in file header.');

  const client = serviceClient();
  const name = `STORY-11 QA AC3 (${uniqueSuffix(testInfo)})`;
  const personId = await createPerson(client, name);

  let claimApiCalled = false;
  await page.route('**/api/people/claim', (route) => {
    claimApiCalled = true;
    return route.continue();
  });

  try {
    await page.goto('/pt-PT/claim');
    await expect(page.getByTestId('claim-person-list')).toBeVisible();
    await page.getByTestId('claim-skip').click();
    await expect(page).toHaveURL(/\/pt-PT\/?$/);
    expect(claimApiCalled).toBe(false);
  } finally {
    await deletePerson(client, personId);
  }
});

// AC5 (page-level defense-in-depth): direct navigation to /pt-PT/claim as an
// already-linked user redirects home. Links the real test account (via the
// real claim API, so it's tied to whatever user id the session actually has)
// to a dedicated fixture, then cleans up by deleting the fixture.
test('AC5: an already-linked user visiting /pt-PT/claim directly is redirected home', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.E2E_WITH_AUTH, '/claim requires authentication; see manual steps in file header.');

  const client = serviceClient();
  const name = `STORY-11 QA AC5 (${uniqueSuffix(testInfo)})`;
  const personId = await createPerson(client, name);

  try {
    const claimResponse = await page.request.post('/api/people/claim', {
      data: { person_id: personId },
    });
    expect(claimResponse.status()).toBe(200);

    await page.goto('/pt-PT/claim');
    await expect(page).toHaveURL(/\/pt-PT\/?$/);
  } finally {
    await deletePerson(client, personId);
  }
});

// AC6: claiming a person that's already linked to someone else returns 409
// already_claimed. The "someone else" is a throwaway fixture user (never the
// real E2E_WITH_AUTH account), so this is a faithful, self-contained
// reproduction of the story's literal AC6 ("two users, same person, only one
// succeeds") without needing a second real authenticated session.
test('AC6: claiming an already-claimed person returns 409 already_claimed', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.E2E_WITH_AUTH, '/claim requires authentication; see manual steps in file header.');

  const client = serviceClient();
  const suffix = uniqueSuffix(testInfo);
  const name = `STORY-11 QA AC6 Claimed (${suffix})`;
  const otherUserId = await createThrowawayLinkedUser(client);
  const personId = await createPerson(client, name, { linkedUserId: otherUserId });

  try {
    const response = await page.request.post('/api/people/claim', {
      data: { person_id: personId },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('already_claimed');
  } finally {
    await deletePerson(client, personId);
    await deleteThrowawayLinkedUser(client, otherUserId);
  }
});

// Regression (WARNING #5, backend area): claiming a second, different,
// unlinked person while the account is already linked to a first one
// returns 409 already_linked. This exercises the partial-unique-index
// concurrency guard (migration 20260705000001_people_linked_user_unique.sql)
// via a 23505 on the second UPDATE, which previously had zero test coverage.
test('regression: claiming a second different person while already linked returns 409 already_linked', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.E2E_WITH_AUTH, '/claim requires authentication; see manual steps in file header.');

  const client = serviceClient();
  const suffix = uniqueSuffix(testInfo);
  const firstId = await createPerson(client, `STORY-11 QA AC6 First (${suffix})`);
  const secondId = await createPerson(client, `STORY-11 QA AC6 Second (${suffix})`);

  try {
    const first = await page.request.post('/api/people/claim', { data: { person_id: firstId } });
    expect(first.status()).toBe(200);

    const second = await page.request.post('/api/people/claim', { data: { person_id: secondId } });
    expect(second.status()).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.error).toBe('already_linked');
  } finally {
    await deletePerson(client, firstId);
    await deletePerson(client, secondId);
  }
});

// AC4 (page-level defense-in-depth): direct navigation to /pt-PT/claim when
// no unlinked+active people exist redirects home. Since we cannot know ahead
// of time what other unlinked people exist in this Supabase project, this
// test snapshots every currently unlinked+active person, temporarily
// deactivates them all (the least disruptive reversible way to construct
// "zero unlinked people" — is_active is already a soft-delete flag, so this
// mirrors the real deactivation flow rather than deleting real data), then
// restores them exactly as they were in a `finally` block regardless of
// test outcome.
test('AC4: direct navigation to /claim redirects home when no unlinked people exist', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, '/claim requires authentication; see manual steps in file header.');

  const client = serviceClient();
  const { data: existing, error } = await client
    .from('people')
    .select('id')
    .is('linked_user_id', null)
    .eq('is_active', true);

  if (error) {
    throw new Error(`AC4 fixture setup: failed to read unlinked people: ${error.message}`);
  }

  const idsToRestore = (existing ?? []).map((row) => row.id as string);

  try {
    if (idsToRestore.length > 0) {
      const { error: deactivateError } = await client
        .from('people')
        .update({ is_active: false })
        .in('id', idsToRestore);
      if (deactivateError) {
        throw new Error(`AC4 fixture setup: failed to deactivate existing people: ${deactivateError.message}`);
      }
    }

    await page.goto('/pt-PT/claim');
    await expect(page).toHaveURL(/\/pt-PT\/?$/);
  } finally {
    if (idsToRestore.length > 0) {
      await client.from('people').update({ is_active: true }).in('id', idsToRestore);
    }
  }
});

// Regression: invalid JSON body -> 400 invalid_json.
test('regression: authenticated POST with invalid JSON body returns 400', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Requires authentication; see manual steps in file header.');
  const response = await page.request.post('/api/people/claim', {
    headers: { 'Content-Type': 'application/json' },
    data: 'not json{{{',
  });
  expect(response.status()).toBe(400);
});

// Regression: non-UUID person_id -> 400 invalid_id.
test('regression: authenticated POST with a non-UUID person_id returns 400', async ({ page }) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Requires authentication; see manual steps in file header.');
  const response = await page.request.post('/api/people/claim', {
    data: { person_id: 'not-a-uuid' },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toBe('invalid_id');
});
