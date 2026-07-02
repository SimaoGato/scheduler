/**
 * e2e/user-table-alignment.spec.ts — STORY-14: Actions column alignment
 *
 * AC coverage (requires a real authenticated admin session; see the
 * auth-gated test pattern below):
 *   AC2 — The promote/demote button follows the same right-aligned
 *         trailing-edge pattern as the people-management table, on a
 *         desktop viewport (>=1024px).
 *
 * This test requires `/pt-PT/admin/users` to be reachable as an
 * authenticated admin, which this environment/CI cannot provide (no real
 * Supabase/Google OAuth credentials). Following the established
 * auth-gated test pattern (see e2e/user-widget-click-outside.spec.ts), it
 * is skipped unless E2E_WITH_AUTH is set, and the AC is documented below
 * as a manual verification step to satisfy the Definition of Done's
 * AC-coverage requirement.
 *
 * Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC2 — Desktop right alignment:
 *    1. Log in as an admin with at least one other user in the list.
 *    2. Open /pt-PT/admin/users at a desktop viewport (>=1024px wide).
 *    3. Confirm the Promover/Rebaixar button sits flush against the right
 *       edge of the table, not near the middle of the row.
 *    4. Confirm the button's tap target remains >= 44px tall (no
 *       regression of the existing min-h-[44px] class).
 */

import { test, expect } from '@playwright/test';

const RIGHT_EDGE_TOLERANCE_PX = 4;
const RIGHT_PADDING_PX = 16; // px-4
const MIN_TAP_TARGET_PX = 44;

test.describe('STORY-14: user table actions-column alignment', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in file header.');

  test('AC2: promote/demote button right-aligned at desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/pt-PT/admin/users');

    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible();

    const actionsCell = row.locator('td').last();
    const roleButton = row.locator('[data-testid^="um-promote-"], [data-testid^="um-demote-"]');
    await expect(roleButton).toBeVisible();

    const cellBox = await actionsCell.boundingBox();
    const btnBox = await roleButton.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(btnBox).not.toBeNull();

    const gap = cellBox!.x + cellBox!.width - (btnBox!.x + btnBox!.width);
    expect(gap).toBeGreaterThanOrEqual(RIGHT_PADDING_PX - RIGHT_EDGE_TOLERANCE_PX);
    expect(gap).toBeLessThanOrEqual(RIGHT_PADDING_PX + RIGHT_EDGE_TOLERANCE_PX);

    expect(btnBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
  });
});
