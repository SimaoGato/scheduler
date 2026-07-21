/**
 * e2e/settings-page-redesign.spec.ts — CHORE-31: Redesign Settings page
 * (profile card + grouped preference rows)
 *
 * AC coverage:
 *   E2E_WITH_AUTH-gated (requires .env.local + real Supabase + Google OAuth,
 *   same pre-existing limitation as STORY-21/CHORE-06/CHORE-11's own
 *   Settings-area tests):
 *     - AC1: profile card shows the initials avatar, display name, and
 *       email; also re-pins the retained page <h1> (redundant with
 *       language-switcher.spec.ts AC4, but pinned directly in this story's
 *       own spec since AC1 is the natural home for "top-level content
 *       renders").
 *     - AC2: the three preference rows render with translated titles inside
 *       the preferences card, and a computed-style check proves divide-y
 *       actually engaged (non-zero border-top on the 2nd/3rd row) — not
 *       just visually eyeballed.
 *     - AC3: the sign-out button performs the exact STORY-15 marker-cookie
 *       flow (mirrors signout-instant-nav.spec.ts's clickSignOut pattern),
 *       renders full-width with a >=44px tap target.
 *     - AC5: no horizontal overflow at 375px; sign-out button and each row's
 *       control remain >=44px.
 *
 *   CI-safe (no auth required):
 *     - AC3 contrast: see e2e/design-language-foundation.spec.ts's
 *       "CHORE-31 AC3a"/"CHORE-31 AC3b" tests for the automated
 *       --destructive-outline vs --background WCAG AA check (this file only
 *       covers the button's behavior/sizing, not its color contrast math).
 *
 *   Manual verification only (documented in the story, not automated):
 *     - Visually render both themes at 375px and 1280px via local dev
 *       server — confirm the destructiveOutline sign-out button reads
 *       clearly as a red/alert-hued outline in both themes, and confirm row
 *       wrapping looks intentional at 375px (BUGFIX-06 precedent: a passing
 *       scrollWidth check alone is not sufficient proof of
 *       visually-coherent wrapping).
 */

import { test, expect } from '@playwright/test';
import { SIGNOUT_MARKER_COOKIE } from '../lib/auth/signout-marker';

test.describe('CHORE-31: Settings page redesign', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication; see manual steps in file header.');

  test('AC1: profile card shows initials avatar, name, and email; page heading is retained', async ({
    page,
  }) => {
    await page.goto('/pt-PT/settings');

    // Retained <h1> (Design decision 7) — pins the regression directly in
    // this story's own spec, in addition to language-switcher.spec.ts AC4.
    await expect(page.getByRole('heading', { name: 'Definições' })).toBeVisible();

    const avatar = page.getByTestId('settings-profile-avatar');
    await expect(avatar).toBeVisible();
    const initialsText = (await avatar.textContent())?.trim() ?? '';
    expect(initialsText).toMatch(/^[A-Z]{1,2}$/);

    const name = page.getByTestId('settings-profile-name');
    await expect(name).toBeVisible();
    await expect(name).not.toHaveText('');

    // Email is account-dependent; only assert presence/shape (same
    // limitation as settings-display-name.spec.ts's AC2).
    const email = page.getByTestId('settings-profile-email');
    await expect(email).toBeVisible();
  });

  test('AC2: preferences card shows three titled rows with hairline dividers', async ({ page }) => {
    await page.goto('/pt-PT/settings');

    const card = page.getByTestId('settings-preferences-card');
    await expect(card).toBeVisible();

    // Translated row titles (not raw keys) are visible inside the card.
    await expect(card.getByText('Nome apresentado')).toBeVisible();
    await expect(card.getByText('Idioma')).toBeVisible();
    await expect(card.getByText('Tema')).toBeVisible();

    // Lightweight computed-style check that divide-y actually engaged: the
    // 2nd and 3rd row each have a non-zero border-top width, proving
    // Tailwind's divide-y utility is applied, not just eyeballed.
    const rows = card.locator('> div');
    const rowCount = await rows.count();
    expect(rowCount).toBe(3);
    for (let i = 1; i < rowCount; i += 1) {
      const borderTopWidth = await rows.nth(i).evaluate(
        (el) => window.getComputedStyle(el).borderTopWidth
      );
      expect(parseFloat(borderTopWidth)).toBeGreaterThan(0);
    }
  });

  test('AC3: sign-out button performs the marker-cookie flow, full-width, >=44px', async ({
    page,
    context,
  }) => {
    await page.goto('/pt-PT/settings');

    const signOutButton = page.getByTestId('settings-sign-out-button');
    await expect(signOutButton).toBeVisible();

    const box = await signOutButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    // Full-width: matches (or very nearly matches) the max-w-2xl container's
    // width, i.e. it isn't a narrow inline button.
    const containerBox = await page
      .locator('main .flex.flex-col.gap-6')
      .boundingBox();
    expect(box?.width).toBeCloseTo(containerBox?.width ?? 0, 0);

    await signOutButton.click();

    const cookies = await context.cookies();
    const marker = cookies.find((c) => c.name === SIGNOUT_MARKER_COOKIE);
    expect(marker?.value).toBe('1');
    expect(marker?.path).toBe('/');
    expect(marker?.sameSite).toBe('Lax');

    await expect(page).toHaveURL(/\/pt-PT\/login/, { timeout: 500 });
  });

  test('AC5: settings page has no horizontal overflow at 375px; controls stay >=44px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pt-PT/settings');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);

    const signOutButton = page.getByTestId('settings-sign-out-button');
    await expect(signOutButton).toBeVisible();
    const signOutBox = await signOutButton.boundingBox();
    expect(signOutBox?.height).toBeGreaterThanOrEqual(44);

    const languageLink = page.getByTestId('language-switcher-link');
    await expect(languageLink).toBeVisible();
    const languageBox = await languageLink.boundingBox();
    expect(languageBox?.height).toBeGreaterThanOrEqual(44);
  });
});
