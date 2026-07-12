/**
 * e2e/people-table-alignment.spec.ts — STORY-14 + BUGFIX-02 Actions column alignment
 *
 * STORY-14 AC coverage (requires a real authenticated admin session; see the
 * auth-gated test pattern below):
 *   AC1 — Editar/Remover buttons are right-aligned at the trailing edge of
 *         the people-management table row on a desktop viewport (>=1024px).
 *   AC3 — On a narrow (375px) viewport, actions remain usable and tap
 *         targets stay >= 44px; the page itself does not overflow
 *         horizontally (the `overflow-x-auto` wrapper absorbs it).
 *   AC4 — Entering inline-edit mode does not cause a layout jump: the
 *         Save/Cancel buttons occupy the same actions-column position
 *         (same right edge) as the view-mode Editar/Remover buttons.
 *
 * BUGFIX-02 AC coverage:
 *   AC1 — (Desktop single-row action rendering, auth-gated) At 1280px
 *         viewport, the view-mode action elements
 *         (Competências/Disponibilidade/Editar/Remover) render on a single
 *         horizontal line (same y bounding-box position), not stacked
 *         vertically. (STORY-27 added the "Disponibilidade" action; this
 *         test was updated to include it in the same regression check it
 *         already covers for its siblings — see BUGFIX-02.)
 *
 * These tests require `/pt-PT/admin/people` to be reachable as an
 * authenticated admin, which this environment/CI cannot provide (no real
 * Supabase/Google OAuth credentials). Following the established
 * auth-gated test pattern (see e2e/user-widget-click-outside.spec.ts), they
 * are skipped unless E2E_WITH_AUTH is set, and each AC is documented below
 * as a manual verification step to satisfy the Definition of Done's
 * AC-coverage requirement. A separate CI-safe static source guard (no auth,
 * no live render, no extra route — see the bottom of this file) provides an
 * additional automated regression check that runs unconditionally in CI.
 *
 * Fixture lifecycle: each test creates (or reuses) a "STORY-14 QA Person"
 * row via `ensureOnePerson`, uniquely suffixed per Playwright worker index
 * to avoid name collisions if tests ever run with parallel workers. A
 * shared `test.afterEach` hook (via `removePersonIfPresent`) deletes that
 * row after every test, pass or fail, so the fixture never leaks into the
 * live admin people list even if an individual AC assertion throws.
 *
 * Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC1 (STORY-14) — Desktop right alignment:
 *    1. Log in as an admin with at least one person in the team list.
 *    2. Open /pt-PT/admin/people at a desktop viewport (>=1024px wide).
 *    3. Confirm the Editar/Remover buttons sit flush against the right
 *       edge of the table, not near the middle of the row.
 *
 *  AC1 (BUGFIX-02) — Desktop single-line rendering:
 *    1. Log in as an admin with at least one person in the team list.
 *    2. Open /pt-PT/admin/people at 1280px wide (desktop width).
 *    3. Confirm the action buttons (Competências/Disponibilidade/Editar/
 *       Remover) render on a single horizontal line, not stacked
 *       vertically.
 *
 *  AC3 — Narrow viewport (375px):
 *    1. Set the browser to 375px wide (DevTools device mode).
 *    2. Open /pt-PT/admin/people.
 *    3. Confirm Editar/Remover remain usable (tap targets >= 44px tall)
 *       and the page does not scroll horizontally (the table's own
 *       overflow-x-auto wrapper may scroll internally).
 *
 *  AC4 — No layout jump entering edit mode:
 *    1. Click "Editar" on a row and note where the buttons sit.
 *    2. Confirm "Guardar"/"Cancelar" render in the same actions-column
 *       position (same right edge), not shifted or in the name column.
 */

import { test, expect, type Page } from '@playwright/test';

const RIGHT_EDGE_TOLERANCE_PX = 4;
const RIGHT_PADDING_PX = 16; // px-4
const MIN_TAP_TARGET_PX = 44;

async function ensureOnePerson(page: Page, name: string): Promise<void> {
  await page.goto('/pt-PT/admin/people');
  const existingRow = page.locator('tr', { hasText: name });
  if ((await existingRow.count()) > 0) return;

  await page.getByTestId('pm-add-input').fill(name);
  await page.getByTestId('pm-add-submit').click();
  await expect(page.locator('tr', { hasText: name })).toBeVisible();
}

// Removes the fixture row created by ensureOnePerson, if it still exists.
// Handles the row being mid-edit (Save/Cancel visible instead of
// Editar/Remover) by cancelling first, so this is safe to call
// unconditionally regardless of which test ran or whether it passed.
async function removePersonIfPresent(page: Page, name: string): Promise<void> {
  await page.goto('/pt-PT/admin/people');
  const row = page.locator('tr', { hasText: name });
  if ((await row.count()) === 0) return;

  const cancelButton = row.locator('[data-testid^="pm-cancel-"]');
  if ((await cancelButton.count()) > 0) {
    await cancelButton.click();
  }

  const removeButton = row.locator('[data-testid^="pm-remove-"]');
  if ((await removeButton.count()) > 0) {
    await removeButton.click();
    await expect(page.locator('tr', { hasText: name })).toHaveCount(0);
  }
}

test.describe('STORY-14: people table actions-column alignment', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in file header.');

  // Unique per worker so concurrent local runs (workers: undefined outside CI)
  // can't collide on the same fixture name and break the single-row-match
  // assumption used by `row.locator(...)` throughout this file.
  let testPersonName: string;

  test.beforeEach(({}, testInfo) => {
    testPersonName = `STORY-14 QA Person (w${testInfo.workerIndex})`;
  });

  // Cleanup runs after every test regardless of pass/fail, so a leaked
  // fixture row from AC1/AC3 (which never removed it) or an AC4 failure
  // before its own cleanup step can't persist in the live admin people list.
  test.afterEach(async ({ page }) => {
    await removePersonIfPresent(page, testPersonName);
  });

  test('AC1: Editar/Remover buttons right-aligned at desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureOnePerson(page, testPersonName);

    const row = page.locator('tr', { hasText: testPersonName });
    const actionsCell = row.locator('td').last();
    await expect(actionsCell).toBeVisible();

    const removeButton = row.locator('[data-testid^="pm-remove-"]');
    await expect(removeButton).toBeVisible();

    const cellBox = await actionsCell.boundingBox();
    const btnBox = await removeButton.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(btnBox).not.toBeNull();

    const gap = cellBox!.x + cellBox!.width - (btnBox!.x + btnBox!.width);
    expect(gap).toBeGreaterThanOrEqual(RIGHT_PADDING_PX - RIGHT_EDGE_TOLERANCE_PX);
    expect(gap).toBeLessThanOrEqual(RIGHT_PADDING_PX + RIGHT_EDGE_TOLERANCE_PX);
  });

  test('AC3: actions remain usable at 375px with >=44px tap targets and no page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await ensureOnePerson(page, testPersonName);

    const row = page.locator('tr', { hasText: testPersonName });
    const skillsButton = row.locator('[data-testid^="pm-skills-"]');
    const availabilityButton = row.locator('[data-testid^="pm-availability-"]');
    const editButton = row.locator('[data-testid^="pm-edit-"]');
    const removeButton = row.locator('[data-testid^="pm-remove-"]');
    await expect(skillsButton).toBeVisible();
    await expect(availabilityButton).toBeVisible();
    await expect(editButton).toBeVisible();
    await expect(removeButton).toBeVisible();

    const skillsBox = await skillsButton.boundingBox();
    const availabilityBox = await availabilityButton.boundingBox();
    const editBox = await editButton.boundingBox();
    const removeBox = await removeButton.boundingBox();
    // STORY-18 added a third action (Competências) to this row; STORY-27
    // added a fourth (Disponibilidade). Width is asserted here (not just
    // height) because several actions in a `flex justify-end` row risk
    // shrinking below the 44px tap-target minimum at this viewport if they
    // don't wrap — see STORY-18 finding.
    expect(skillsBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(skillsBox!.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(availabilityBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(availabilityBox!.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(editBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(editBox!.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(removeBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(removeBox!.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  test('AC4: Save/Cancel occupy the same actions-column position as Editar/Remover (no layout jump)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureOnePerson(page, testPersonName);

    const row = page.locator('tr', { hasText: testPersonName });
    const editButton = row.locator('[data-testid^="pm-edit-"]');
    await expect(editButton).toBeVisible();

    const viewModeBox = await editButton.boundingBox();
    const viewModeRightEdge = viewModeBox!.x + viewModeBox!.width;

    await editButton.click();

    const saveButton = row.locator('[data-testid^="pm-save-"]');
    const cancelButton = row.locator('[data-testid^="pm-cancel-"]');
    await expect(saveButton).toBeVisible();
    await expect(cancelButton).toBeVisible();

    const saveBox = await saveButton.boundingBox();
    const editModeRightEdge = saveBox!.x + saveBox!.width;

    expect(Math.abs(editModeRightEdge - viewModeRightEdge)).toBeLessThanOrEqual(RIGHT_EDGE_TOLERANCE_PX);

    const cancelBox = await cancelButton.boundingBox();
    expect(saveBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(cancelBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);

    // Leave edit mode; the shared afterEach hook removes the fixture row.
    await cancelButton.click();
  });

  test('BUGFIX-02 AC1: view-mode actions render on single line at desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureOnePerson(page, testPersonName);

    const row = page.locator('tr', { hasText: testPersonName });
    const skillsButton = row.locator('[data-testid^="pm-skills-"]');
    const availabilityButton = row.locator('[data-testid^="pm-availability-"]');
    const editButton = row.locator('[data-testid^="pm-edit-"]');
    const removeButton = row.locator('[data-testid^="pm-remove-"]');

    await expect(skillsButton).toBeVisible();
    await expect(availabilityButton).toBeVisible();
    await expect(editButton).toBeVisible();
    await expect(removeButton).toBeVisible();

    const skillsBox = await skillsButton.boundingBox();
    const availabilityBox = await availabilityButton.boundingBox();
    const editBox = await editButton.boundingBox();
    const removeBox = await removeButton.boundingBox();

    expect(skillsBox).not.toBeNull();
    expect(availabilityBox).not.toBeNull();
    expect(editBox).not.toBeNull();
    expect(removeBox).not.toBeNull();

    // All view-mode actions should share the same y position (within
    // tolerance), meaning they render on the same horizontal line, not
    // stacked vertically. STORY-27 added "Disponibilidade" as a fourth
    // action; included here alongside its siblings.
    const y1 = skillsBox!.y;
    const y2 = availabilityBox!.y;
    const y3 = editBox!.y;
    const y4 = removeBox!.y;

    expect(Math.abs(y1 - y2)).toBeLessThanOrEqual(2);
    expect(Math.abs(y2 - y3)).toBeLessThanOrEqual(2);
    expect(Math.abs(y3 - y4)).toBeLessThanOrEqual(2);
  });
});

// BUGFIX-02 review fix: an earlier revision of this suite included a
// "CI-runnable fixture" describe block backed by a real Next.js page route
// at app/[locale]/login/e2e-fixture/people-table-actions/page.tsx. That
// route was removed — being nested under `login/`, it matched proxy.ts's
// `isLoginPath` regex and was reachable with no auth in production (QA
// scaffolding leaking into the production route tree), and its hand-copied
// markup had already drifted from the real component (missing the
// `disabled:cursor-not-allowed disabled:opacity-50` classes). A
// `page.setContent()`-based alternative (rendering the real component to
// static HTML via `react-dom/server` from within the Playwright test) was
// evaluated and confirmed NOT viable in this project: Playwright's own test
// transform applies a JSX pragma to every .tsx file it loads (including
// plain component modules, not just spec files) that is incompatible with
// `react-dom`'s runtime, so `renderToStaticMarkup` throws immediately. No
// other component-test harness (Vitest/RTL) exists in this repo. The
// remaining coverage is: the auth-gated live-render test above
// (`BUGFIX-02 AC1: ...`, requires E2E_WITH_AUTH), the documented manual
// verification steps in this file's header, and the CI-safe static guard
// below.
test.describe('BUGFIX-02 (CI-safe, static source guard): actions container keeps breakpoint-gated wrap', () => {
  // No live render, no auth, no extra route: reads PeopleTable.tsx directly
  // and asserts the view-mode actions container's className retains both
  // `flex-wrap` (needed for the 375px mobile case, AC2) and `sm:flex-nowrap`
  // (the BUGFIX-02 fix, needed for the desktop single-line case, AC1)
  // together. This guards against the fix being silently reverted or
  // narrowed without requiring a hand-copied markup fixture.
  test('view-mode actions container className contains flex-wrap and sm:flex-nowrap', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.join(process.cwd(), 'components', 'PeopleTable.tsx');
    const source = await fs.readFile(filePath, 'utf-8');

    const match = source.match(
      /className="flex flex-wrap justify-end gap-2 sm:flex-nowrap"/
    );
    expect(
      match,
      'Expected the view-mode actions container in PeopleTable.tsx to keep ' +
        'both flex-wrap (mobile wrap, AC2) and sm:flex-nowrap (desktop ' +
        'single-line fix, AC1) — see BUGFIX-02.'
    ).not.toBeNull();
  });
});
