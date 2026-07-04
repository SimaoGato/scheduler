/**
 * e2e/dark-theme-locale-flash.spec.ts — CHORE-13: Fix white flash when
 * switching language in dark mode.
 *
 * Root cause: the `[locale]` segment change remounts `<html>` in
 * `app/[locale]/layout.tsx` during a soft (client-side) navigation. Because
 * next-themes applies the `.dark` class imperatively (in a post-mount
 * `useEffect`), the freshly re-rendered server markup has no `className` for
 * at least one frame, painting the light background before the effect
 * re-applies `.dark`.
 *
 * Fix: a resolved-theme cookie (`lib/theme/theme-cookie.ts`), kept in sync
 * with next-themes' `resolvedTheme` by `components/ThemeCookieSync.tsx`, is
 * read server-side in `app/[locale]/layout.tsx` so the SSR'd `<html>` always
 * carries the correct `className` — soft-nav or not.
 *
 * AC coverage:
 *   CI-safe (no auth required):
 *     - AC1 (mechanism): a raw HTTP GET of the public /pt-PT/login route with
 *       the resolved-theme cookie set to 'dark' returns markup whose <html>
 *       tag already carries the `dark` class — proving the SSR mechanism
 *       itself, independent of any client JS execution.
 *     - AC5 (mirror / no regression in the opposite direction): the same GET
 *       with the cookie set to 'light', and with the cookie absent entirely,
 *       returns markup with no `dark` class on <html>.
 *     - AC4 (cold-load, no regression): not a new test — the existing
 *       e2e/dark-mode.spec.ts AC2/AC4 tests (fresh goto with OS dark
 *       preference, `.dark` present at domcontentloaded) exercise this path
 *       unmodified; the blocking next-themes script is untouched by this fix.
 *
 *   E2E_WITH_AUTH-gated (requires .env.local + real Supabase + Google OAuth):
 *     - AC1 (real reproduction): on /pt-PT/settings with `theme=dark`
 *       pre-seeded, a requestAnimationFrame sampling loop records
 *       `document.documentElement.classList.contains('dark')` on every frame
 *       across a real click-through of the language switcher; every sample
 *       must be `true` (no white paint).
 *     - AC2: within the same test, asserts the URL prefix and <html lang>
 *       reflect the new locale after the sampling window (switch still
 *       works). e2e/language-switcher.spec.ts AC4/AC5 remain the primary
 *       regression guard for this AC and must still pass unmodified.
 *     - AC3: within the same test, asserts `.dark` is still present and
 *       `localStorage.getItem('theme')` is unchanged after the navigation
 *       settles.
 *     - AC5 (real reproduction, reverse direction): mirrors the AC1 sampling
 *       test starting from light mode; asserts `dark` is never present in
 *       any sample.
 */

import { test, expect, type Page } from '@playwright/test';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme-cookie';

// --- AC1 / AC5 (CI-safe): SSR mechanism in isolation ---------------------

test('AC1: SSR <html> carries the dark class when the resolved-theme cookie is dark', async ({
  page,
}) => {
  const response = await page.request.get('/pt-PT/login', {
    headers: { Cookie: `${THEME_COOKIE_NAME}=dark` },
  });
  const body = await response.text();
  const htmlTagMatch = body.match(/<html[^>]*>/);
  expect(htmlTagMatch).not.toBeNull();
  expect(htmlTagMatch?.[0]).toMatch(/class="[^"]*\bdark\b[^"]*"/);
});

test('AC5: SSR <html> does not carry the dark class when the resolved-theme cookie is light', async ({
  page,
}) => {
  const response = await page.request.get('/pt-PT/login', {
    headers: { Cookie: `${THEME_COOKIE_NAME}=light` },
  });
  const body = await response.text();
  const htmlTagMatch = body.match(/<html[^>]*>/);
  expect(htmlTagMatch).not.toBeNull();
  expect(htmlTagMatch?.[0] ?? '').not.toMatch(/class="[^"]*\bdark\b[^"]*"/);
});

test('AC5: SSR <html> does not carry the dark class when the resolved-theme cookie is absent', async ({
  page,
}) => {
  const response = await page.request.get('/pt-PT/login');
  const body = await response.text();
  const htmlTagMatch = body.match(/<html[^>]*>/);
  expect(htmlTagMatch).not.toBeNull();
  expect(htmlTagMatch?.[0] ?? '').not.toMatch(/class="[^"]*\bdark\b[^"]*"/);
});

test('resolved-theme cookie is written with Secure and SameSite=Lax attributes', async ({
  page,
  context,
}) => {
  // Regression guard for the code-review WARNING on this story: the
  // ThemeCookieSync write must carry `Secure`, matching the established
  // convention in components/UserWidgetMenu.tsx's SIGNOUT_MARKER_COOKIE
  // write. Inspecting document.cookie alone can't reveal the Secure/
  // SameSite attributes (the browser strips them from that string), so this
  // reads the attributes back via the browser context's cookie jar instead.
  await page.goto('/pt-PT/login');
  // ThemeCookieSync writes the cookie from a post-hydration useEffect, so
  // poll rather than reading the cookie jar immediately after goto()
  // resolves (which only waits for the load event, not hydration).
  await expect
    .poll(async () => {
      const cookies = await context.cookies();
      return cookies.some((c) => c.name === THEME_COOKIE_NAME);
    })
    .toBe(true);
  const cookies = await context.cookies();
  const themeCookie = cookies.find((c) => c.name === THEME_COOKIE_NAME);
  expect(themeCookie?.secure).toBe(true);
  expect(themeCookie?.sameSite).toBe('Lax');
});

// --- AC1/AC2/AC3/AC5 (E2E_WITH_AUTH-gated): real click-through -----------

// Samples `document.documentElement`'s `.dark` class on every animation
// frame from just before the click through ~1s after the click, mirroring
// the story's own repro probe methodology.
async function sampleDarkClassAcrossNavigation(page: Page): Promise<boolean[]> {
  await page.evaluate(() => {
    (window as unknown as { __darkSamples: boolean[] }).__darkSamples = [];
    const samples = (window as unknown as { __darkSamples: boolean[] }).__darkSamples;
    const start = performance.now();
    function sample() {
      samples.push(document.documentElement.classList.contains('dark'));
      if (performance.now() - start < 1000) {
        requestAnimationFrame(sample);
      }
    }
    requestAnimationFrame(sample);
  });
  await page.getByTestId('language-switcher-link').click();
  await page.waitForURL(/\/en\/settings\/?$/);
  // Let the 1s sampling window finish.
  await page.waitForTimeout(1100);
  return page.evaluate(() => (window as unknown as { __darkSamples: boolean[] }).__darkSamples);
}

test('AC1/AC2/AC3: dark theme never drops during a soft locale-switch navigation', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'dark');
  });
  await page.goto('/pt-PT/settings');
  await expect(page.locator('html')).toHaveClass(/dark/);

  const samples = await sampleDarkClassAcrossNavigation(page);

  // AC1: not a single sampled frame lost the dark class.
  expect(samples.length).toBeGreaterThan(0);
  expect(samples.every(Boolean)).toBe(true);

  // AC2: the switch still actually changed the locale.
  await expect(page).toHaveURL(/\/en\/settings\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  // AC3: dark theme still active and the persisted choice is unchanged.
  await expect(page.locator('html')).toHaveClass(/dark/);
  const persisted = await page.evaluate(() => window.localStorage.getItem('theme'));
  expect(persisted).toBe('dark');
});

test('AC5: no dark flash is introduced when switching language in light mode', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'light');
  });
  await page.goto('/pt-PT/settings');
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  const samples = await sampleDarkClassAcrossNavigation(page);

  expect(samples.length).toBeGreaterThan(0);
  expect(samples.every((sample) => sample === false)).toBe(true);

  await expect(page).toHaveURL(/\/en\/settings\/?$/);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  const persisted = await page.evaluate(() => window.localStorage.getItem('theme'));
  expect(persisted).toBe('light');
});
