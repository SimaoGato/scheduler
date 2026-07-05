/**
 * e2e/people-table-alignment.spec.ts — STORY-14: Actions column alignment
 *
 * AC coverage (requires a real authenticated admin session; see the
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
 * These tests require `/pt-PT/admin/people` to be reachable as an
 * authenticated admin, which this environment/CI cannot provide (no real
 * Supabase/Google OAuth credentials). Following the established
 * auth-gated test pattern (see e2e/user-widget-click-outside.spec.ts), they
 * are skipped unless E2E_WITH_AUTH is set, and each AC is documented below
 * as a manual verification step to satisfy the Definition of Done's
 * AC-coverage requirement.
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
 *  AC1 — Desktop right alignment:
 *    1. Log in as an admin with at least one person in the team list.
 *    2. Open /pt-PT/admin/people at a desktop viewport (>=1024px wide).
 *    3. Confirm the Editar/Remover buttons sit flush against the right
 *       edge of the table, not near the middle of the row.
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
    const editButton = row.locator('[data-testid^="pm-edit-"]');
    const removeButton = row.locator('[data-testid^="pm-remove-"]');
    await expect(skillsButton).toBeVisible();
    await expect(editButton).toBeVisible();
    await expect(removeButton).toBeVisible();

    const skillsBox = await skillsButton.boundingBox();
    const editBox = await editButton.boundingBox();
    const removeBox = await removeButton.boundingBox();
    // STORY-18 added a third action (Competências) to this row. Width is
    // asserted here (not just height) because three actions in a
    // `flex justify-end` row risk shrinking below the 44px tap-target
    // minimum at this viewport if they don't wrap — see STORY-18 finding.
    expect(skillsBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(skillsBox!.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
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
});
