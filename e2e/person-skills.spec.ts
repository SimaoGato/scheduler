/**
 * e2e/person-skills.spec.ts — STORY-18: Assign per-role skill levels (1-3)
 * to a person
 *
 * AC coverage:
 *   AC1 — assign a level (1/2/3) for a person/role; saved and shown.
 *   AC2 — changing an existing level (1 -> 2) is saved and reflected.
 *   AC3 — unassigning a role removes the person's skill level for it.
 *   AC4 — out-of-range levels (0, 4, blank, non-numeric, decimal, negative)
 *         are rejected with 400 `invalid_level`; nothing is written.
 *   AC5 — at most one skill row per (person, role) pair; re-assigning
 *         updates the existing row rather than creating a duplicate
 *         (covered by AC2's row-count assertion).
 *   AC6 — a role with no skill level is absent from the qualified set
 *         (not present as `level: null`).
 *   AC7 — non-admin/unauthenticated users are blocked (page + API). The
 *         Member-role 403 case requires a real Member session, which this
 *         environment cannot provide — see the manual verification step
 *         below.
 *   AC8 — level labels render as human-readable pt-PT text (Intermédio),
 *         not a bare number.
 *   AC9 — mobile (375px): no horizontal scroll, 44x44px tap targets, one
 *         tap per level change (no separate Save button).
 *
 * BUGFIX-03 coverage (visual indication of selected skill level):
 *   BUGFIX-03/AC1 — selected level is visually distinguished on fresh render.
 *   BUGFIX-03/AC2 — "Sem nível" is visually distinguished when no level saved.
 *   BUGFIX-03/AC3 — visual state reverts if optimistic save fails.
 *   BUGFIX-03/AC4 — test asserts computed style (not just hidden input checked).
 *   BUGFIX-03/AC5 — selected differs visually from both unselected and hovered.
 *
 * Also covers a PR #34 review regression: the cross-role race in
 * `savingRoleId` (single scalar → per-role Set), see the
 * "cross-role race" test below.
 *
 * CI-safe tests (no real Supabase session) run unconditionally below. The
 * E2E_WITH_AUTH-gated tests further down require .env.local + a real
 * Supabase admin session and are skipped in CI (see auth-gated test
 * pattern in CLAUDE.md and e2e/role-management.spec.ts).
 *
 * Fixture hygiene (STORY-11/STORY-14 pattern): each auth-gated test creates
 * a worker-indexed fixture person + role via the admin API in
 * `test.beforeEach`, and `test.afterEach` unconditionally deletes the skill
 * row, then the fixture person, then the fixture role (order doesn't
 * matter — these are soft-deletes, not hard deletes, so no CASCADE fires
 * from cleanup itself).
 *
 * Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC7 — Member role is blocked from the skills API:
 *    1. Log in as a Member (role = 'member' in public.users).
 *    2. Open DevTools console and run:
 *       fetch('/api/admin/people/<any-id>/skills').then(r => console.log(r.status))
 *    3. Confirm the logged status is 403.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

function backgroundColorOf(locator: Locator) {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

// ---------------------------------------------------------------------------
// CI-safe: auth-gate tests (no real Supabase session required)
// ---------------------------------------------------------------------------

test('AC7-api-get: GET /api/admin/people/some-id/skills unauthenticated → 401', async ({ request }) => {
  const response = await request.get('/api/admin/people/some-id/skills');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC7-api-put: PUT /api/admin/people/some-id/skills/some-role-id unauthenticated → 401', async ({ request }) => {
  const response = await request.put('/api/admin/people/some-id/skills/some-role-id', {
    data: { level: 2 },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC7-api-delete: DELETE /api/admin/people/some-id/skills/some-role-id unauthenticated → 401', async ({ request }) => {
  const response = await request.delete('/api/admin/people/some-id/skills/some-role-id');
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toBeTruthy();
});

test('AC7-page-guard: GET /pt-PT/admin/people/some-id/skills unauthenticated → redirected to login', async ({ page }) => {
  await page.goto('/pt-PT/admin/people/some-id/skills');
  // proxy.ts redirects unauthenticated users to /pt-PT/login
  expect(page.url()).toContain('/login');
});

// ---------------------------------------------------------------------------
// E2E_WITH_AUTH-gated: happy-path/validation tests (require a real admin
// session). Fixture lifecycle mirrors e2e/role-management.spec.ts /
// e2e/people-table-alignment.spec.ts: unique-per-worker fixture names +
// afterEach cleanup.
// ---------------------------------------------------------------------------

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

test.describe('STORY-18: assign per-role skill levels (auth-gated)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in file header.');

  let personName: string;
  let roleName: string;
  let personId: string;
  let roleId: string;

  test.beforeEach(async ({ page }, testInfo) => {
    personName = `STORY-18 QA Person (w${testInfo.workerIndex})`;
    roleName = `STORY-18 QA Role (w${testInfo.workerIndex})`;

    const person = await createPerson(page, personName);
    personId = person.id;

    const role = await createRole(page, roleName);
    roleId = role.id;
  });

  test.afterEach(async ({ page }) => {
    // Order doesn't matter: person/role deletes are soft-deletes, not hard
    // deletes, so no CASCADE fires from cleanup itself.
    await page.request.delete(`/api/admin/people/${personId}/skills/${roleId}`);
    await page.request.delete(`/api/admin/people/${personId}`);
    await page.request.delete(`/api/admin/roles/${roleId}`);
  });

  test('AC1: assign level 2 for a role; saved and shown', async ({ page }) => {
    await page.goto(`/pt-PT/admin/people/${personId}/skills`);

    const option = page.getByTestId(`skills-role-${roleId}-2`);
    await expect(option).toBeVisible();
    await option.click();

    await expect(option.locator('input')).toBeChecked();

    const getResponse = await page.request.get(`/api/admin/people/${personId}/skills`);
    const skills = (await getResponse.json()) as Array<{ role_id: string; level: number }>;
    expect(skills).toEqual([{ role_id: roleId, level: 2 }]);
  });

  test('AC2/AC5: changing level 1 -> 2 leaves exactly one row with level 2', async ({ page }) => {
    const firstPut = await page.request.put(`/api/admin/people/${personId}/skills/${roleId}`, {
      data: { level: 1 },
    });
    expect(firstPut.status()).toBe(200);

    const secondPut = await page.request.put(`/api/admin/people/${personId}/skills/${roleId}`, {
      data: { level: 2 },
    });
    expect(secondPut.status()).toBe(200);

    const getResponse = await page.request.get(`/api/admin/people/${personId}/skills`);
    const skills = (await getResponse.json()) as Array<{ role_id: string; level: number }>;
    expect(skills).toHaveLength(1);
    expect(skills[0].level).toBe(2);
  });

  test('AC3/AC6: unassigning a role removes it from the qualified set', async ({ page }) => {
    const putResponse = await page.request.put(`/api/admin/people/${personId}/skills/${roleId}`, {
      data: { level: 1 },
    });
    expect(putResponse.status()).toBe(200);

    await page.goto(`/pt-PT/admin/people/${personId}/skills`);
    const noneOption = page.getByTestId(`skills-role-${roleId}-none`);
    await expect(noneOption).toBeVisible();
    await noneOption.click();
    await expect(noneOption.locator('input')).toBeChecked();

    const getResponse = await page.request.get(`/api/admin/people/${personId}/skills`);
    const skills = (await getResponse.json()) as Array<{ role_id: string; level: number }>;
    expect(skills.find((s) => s.role_id === roleId)).toBeUndefined();
  });

  test('AC4: out-of-range levels rejected with 400 invalid_level; nothing written', async ({ page }) => {
    for (const badValue of [0, 4, '', 'abc', -1, 1.5]) {
      const response = await page.request.put(`/api/admin/people/${personId}/skills/${roleId}`, {
        data: { level: badValue },
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe('invalid_level');
    }

    const getResponse = await page.request.get(`/api/admin/people/${personId}/skills`);
    const skills = (await getResponse.json()) as Array<{ role_id: string; level: number }>;
    expect(skills.find((s) => s.role_id === roleId)).toBeUndefined();
  });

  test('AC8: selected level renders a human-readable pt-PT label, not a bare number', async ({ page }) => {
    await page.goto(`/pt-PT/admin/people/${personId}/skills`);
    await page.getByTestId(`skills-role-${roleId}-2`).click();

    // Extracted from messages/pt-PT.json's SkillManagement.level2 at
    // test-write time (per CLAUDE.md's button-text-extraction discipline).
    await expect(page.locator('fieldset', { hasText: roleName })).toContainText('Intermédio');
  });

  test('cross-role race: saving role A stays disabled while role B save starts and resolves independently', async ({ page }, testInfo) => {
    // Regression test for the WARNING found in PR #34 review: savingRoleId
    // was a single scalar, so starting a save on role B while role A's
    // request was still in-flight silently un-gated role A's disabled
    // state, and whichever role's request resolved last unconditionally
    // cleared the shared state for both. Fixed by tracking in-flight saves
    // per-role (a Set of role_ids) instead of one shared scalar.
    const roleBName = `STORY-18 QA Role B (w${testInfo.workerIndex})`;
    const roleB = await createRole(page, roleBName);

    try {
      // Delay role A's PUT response so we can observe the in-flight window.
      await page.route(`**/api/admin/people/${personId}/skills/${roleId}`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.continue();
      });

      await page.goto(`/pt-PT/admin/people/${personId}/skills`);

      const roleAOption = page.getByTestId(`skills-role-${roleId}-1`);
      const roleBOption = page.getByTestId(`skills-role-${roleB.id}-2`);
      await expect(roleAOption).toBeVisible();
      await expect(roleBOption).toBeVisible();

      // Start role A's save (delayed) — its input becomes disabled while
      // in-flight.
      await roleAOption.click();
      await expect(roleAOption.locator('input')).toBeDisabled();

      // Start role B's save while role A is still in-flight. With the fix,
      // this must NOT clear role A's disabled state.
      await roleBOption.click();
      await expect(roleAOption.locator('input')).toBeDisabled();

      // Once both requests resolve, each role reflects its own selection
      // and neither is left permanently disabled.
      await expect(roleAOption.locator('input')).toBeChecked({ timeout: 5000 });
      await expect(roleAOption.locator('input')).toBeEnabled();
      await expect(roleBOption.locator('input')).toBeChecked();
      await expect(roleBOption.locator('input')).toBeEnabled();
    } finally {
      await page.unroute(`**/api/admin/people/${personId}/skills/${roleId}`);
      await page.request.delete(`/api/admin/people/${personId}/skills/${roleB.id}`);
      await page.request.delete(`/api/admin/roles/${roleB.id}`);
    }
  });

  test('AC9: mobile viewport (375px) — no horizontal scroll, 44x44px tap targets, single-click assign', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/pt-PT/admin/people/${personId}/skills`);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);

    const option = page.getByTestId(`skills-role-${roleId}-1`);
    await expect(option).toBeVisible();
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    // Single click assigns the level — no secondary Save-button click.
    await option.click();
    await expect(option.locator('input')).toBeChecked();
  });

  test('BUGFIX-03/AC1/AC4: saved skill level is visually distinguished on fresh page render (zero clicks)', async ({ page }) => {
    // AC1 explicitly requires: "Given a person has a saved skill level for a role...
    // when their skills editor page renders... [it's visually distinguished]
    // without requiring any user interaction."
    // This test uses the pre-loaded pattern (API PUT before page load) to verify
    // the initial render binding works, not the click-after-load path.

    // Pre-load a saved skill level for this role via API (before page load).
    const putResponse = await page.request.put(`/api/admin/people/${personId}/skills/${roleId}`, {
      data: { level: 2 },
    });
    expect(putResponse.status()).toBe(200);

    // Now load the page fresh — level 2 should already be visually distinguished.
    await page.goto(`/pt-PT/admin/people/${personId}/skills`);

    const noneOption = page.getByTestId(`skills-role-${roleId}-none`);
    const level1Option = page.getByTestId(`skills-role-${roleId}-1`);
    const level2Option = page.getByTestId(`skills-role-${roleId}-2`);
    await expect(level2Option).toBeVisible();

    // AC1/AC4: Level 2 is visually distinguished on fresh render with zero clicks —
    // a computed-style check, not only `toBeChecked()` on the hidden input.
    const level2BgSelected = await backgroundColorOf(level2Option);
    const level1BgUnselected = await backgroundColorOf(level1Option);
    const noneBgUnselected = await backgroundColorOf(noneOption);
    expect(level2BgSelected).not.toBe(level1BgUnselected);
    expect(level2BgSelected).not.toBe(noneBgUnselected);
    // Both unselected options have the same background (not visually distinguished).
    expect(level1BgUnselected).toBe(noneBgUnselected);
  });

  test('BUGFIX-03/AC2/AC5: no saved level renders "Sem nível" visually selected, and hover differs from selected', async ({ page }) => {
    // AC2: With no saved skill, "Sem nível" is the visually indicated option.
    // AC5: Selected option must differ visually from a hovered-but-unselected option.

    await page.goto(`/pt-PT/admin/people/${personId}/skills`);

    const noneOption = page.getByTestId(`skills-role-${roleId}-none`);
    const level1Option = page.getByTestId(`skills-role-${roleId}-1`);
    await expect(noneOption).toBeVisible();

    // AC2: With no saved skill, "Sem nível" is the visually selected option
    // (on fresh page render, zero clicks).
    const noneBgSelected = await backgroundColorOf(noneOption);
    const level1BgUnselected = await backgroundColorOf(level1Option);
    expect(noneBgSelected).not.toBe(level1BgUnselected);

    // AC5: A hovered-but-unselected option must not look identical to the
    // selected option.
    await level1Option.hover();
    const level1BgHovered = await backgroundColorOf(level1Option);
    expect(level1BgHovered).not.toBe(noneBgSelected);
  });

  test('BUGFIX-03/AC3: visual selection reverts if the optimistic save fails', async ({ page }) => {
    await page.route(`**/api/admin/people/${personId}/skills/${roleId}`, async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'errorGeneric' }),
      });
    });

    try {
      await page.goto(`/pt-PT/admin/people/${personId}/skills`);

      const noneOption = page.getByTestId(`skills-role-${roleId}-none`);
      const level2Option = page.getByTestId(`skills-role-${roleId}-2`);

      const selectedBg = await backgroundColorOf(noneOption); // baseline: none selected by default
      const unselectedBg = await backgroundColorOf(level2Option); // baseline: level2 unselected by default

      await level2Option.click();
      await expect(level2Option.locator('input')).toBeDisabled();

      // Optimistic: level2 now shows the "selected" style, none shows "unselected".
      expect(await backgroundColorOf(level2Option)).toBe(selectedBg);
      expect(await backgroundColorOf(noneOption)).toBe(unselectedBg);

      // After the mocked 500 resolves, the optimistic update rolls back.
      await expect(level2Option.locator('input')).toBeEnabled({ timeout: 2000 });
      expect(await backgroundColorOf(noneOption)).toBe(selectedBg);
      expect(await backgroundColorOf(level2Option)).toBe(unselectedBg);
    } finally {
      await page.unroute(`**/api/admin/people/${personId}/skills/${roleId}`);
    }
  });
});
