/**
 * e2e/dark-mode.spec.ts — CHORE-11: Introduce dark mode (class-based toggle
 * over existing tokens).
 *
 * AC coverage:
 *   CI-safe (no auth required):
 *     - AC2: a fresh, unauthenticated visit to the public /pt-PT/login page
 *       with OS-level dark preference applies the `.dark` class by default
 *       (system theme); with OS-level light preference, no `.dark` class.
 *     - AC4: the `.dark` class is present on <html> at domcontentloaded
 *       (before hydration/paint settles), proving next-themes' pre-hydration
 *       script sets it, not a post-mount effect (no visible FOUC).
 *     - AC5: static build-artifact check — grep the compiled CSS output for
 *       `dark:`-prefixed utility selectors and confirm they are gated by
 *       `:is(.dark *)` (the @custom-variant shape), not a bare
 *       `@media (prefers-color-scheme: dark)` block. This is a filesystem
 *       check (fs.readFileSync), not a browser-driven Playwright test, per
 *       CLAUDE.md's documented guidance that `javaScriptEnabled: false` +
 *       `page.evaluate()` does not work for this purpose.
 *
 *   E2E_WITH_AUTH-gated:
 *     - AC1: with a pre-set localStorage 'dark' theme, home, admin/users,
 *       and admin/people pages all render with `.dark` on <html> and no
 *       console errors.
 *     - AC3: explicitly picking "Escuro"/"Claro" on the settings page
 *       persists (via localStorage) and overrides the OS preference across
 *       a reload.
 *     - AC6: each theme-toggle button's accessible name comes from i18n
 *       (not a hardcoded literal) and meets the 44px tap-target floor; also
 *       asserts the raw i18n key `themeSectionTitle` never leaks into the
 *       rendered DOM (cheap regression guard against a missed/mistyped key
 *       in messages/en.json).
 *
 *   Manual verification only (see "Manual verification" note appended to
 *   docs/stories/CHORE-11-dark-mode-toggle.md):
 *     - AC1 (visual spot-check for unreadable text / leftover light
 *       surfaces — no axe-core/contrast tooling in this repo).
 *     - AC4 (true "was there a visible flash" — not reliably assertable in
 *       Playwright; supplement with a documented manual throttled-network
 *       check).
 *     - AC7 (WCAG AA contrast — no automated tooling installed).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

// --- AC5: static build-artifact check (no browser) ---------------------

function findCssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...findCssFiles(full));
    } else if (entry.endsWith('.css')) {
      files.push(full);
    }
  }
  return files;
}

// Extract the FULL contents of every `@media (prefers-color-scheme: dark)`
// block in `css`, tracking brace depth rather than stopping at the first
// `}`. A naive `[^}]*\{[^}]*\}` regex only captures up to the first closing
// brace, so a multi-rule block (`@media (...) { .a{} .b{} }`) would only be
// partially inspected. Balancing braces guarantees the whole block —
// however many rules it contains — is returned.
function extractPrefersColorSchemeDarkBlocks(css: string): string[] {
  const blocks: string[] = [];
  const openerRe = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = openerRe.exec(css)) !== null) {
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
    }
    // i is now one past the matching closing brace (or css.length if
    // unterminated); include the full block including its own braces.
    blocks.push(css.slice(match.index, i));
    openerRe.lastIndex = i;
  }
  return blocks;
}

test('AC5: compiled CSS gates dark: utilities behind .dark class, not prefers-color-scheme', async () => {
  const nextStaticDir = join(process.cwd(), '.next', 'static');
  const cssFiles = findCssFiles(nextStaticDir);
  test.skip(
    cssFiles.length === 0,
    'No compiled CSS found under .next/static — run `npm run build` first.'
  );

  const combined = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

  // The @custom-variant dark (&:is(.dark *)); directive compiles `dark:*`
  // utilities to selectors containing `:is(.dark ` — confirm at least one
  // exists (e.g. the compiled form of dark:bg-input/30 in button.tsx).
  expect(combined).toMatch(/:is\(\.dark /);

  // Guard against the pre-fix behaviour: no dark:-prefixed utility class
  // name should still be gated by a bare prefers-color-scheme media query.
  // Brace-balanced extraction (not a `[^}]*\{[^}]*\}` regex) so multi-rule
  // media-query blocks are inspected in full, not just their first rule.
  const mediaQueryBlocks = extractPrefersColorSchemeDarkBlocks(combined);
  const mediaQueryGatesDarkUtility = mediaQueryBlocks.some((block) => /\.dark\\:/.test(block));
  expect(mediaQueryGatesDarkUtility).toBe(false);
});

// --- AC2: system-default theme on first visit (no persisted preference) ---

test('AC2: fresh visit with OS dark preference applies .dark by default', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/pt-PT/login');
  const htmlClass = await page.locator('html').getAttribute('class');
  expect(htmlClass).toContain('dark');
  await context.close();
});

test('AC2: fresh visit with OS light preference does not apply .dark', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/pt-PT/login');
  const htmlClass = await page.locator('html').getAttribute('class');
  expect(htmlClass ?? '').not.toContain('dark');
  await context.close();
});

// --- AC4: class is set before hydration (no FOUC) -----------------------

test('AC4: .dark class is present on <html> at domcontentloaded, before hydration settles', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/pt-PT/login', { waitUntil: 'domcontentloaded' });
  const htmlClass = await page.locator('html').getAttribute('class');
  expect(htmlClass).toContain('dark');
  await context.close();
});

// --- AC1: pages render with .dark palette when the theme is dark --------

test('AC1: home, admin/users, admin/people, settings render with .dark when theme is dark', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin/home pages require authentication.');
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'dark');
  });

  // /pt-PT/settings is included because it's the only page where
  // ThemeToggle actually renders — visiting it here catches a real
  // hydration-mismatch regression (e.g. a `theme === undefined` guard that
  // doesn't actually defer to a post-hydration render) via the console-error
  // assertion below, not just manual inspection.
  for (const path of ['/', '/pt-PT/admin/users', '/pt-PT/admin/people', '/pt-PT/settings']) {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(path);
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
    expect(consoleErrors).toEqual([]);
  }
});

// --- AC3: explicit choice persists and overrides OS preference ----------

test('AC3: picking Dark on the settings page persists across reload and overrides OS light preference', async ({
  page,
  context,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await context.grantPermissions([]);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/pt-PT/settings');

  await page.getByTestId('theme-toggle-dark').click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('AC3: picking Light on the settings page persists across reload and overrides OS dark preference', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/pt-PT/settings');

  await page.getByTestId('theme-toggle-light').click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

// --- AC6: toggle labels from i18n + 44px tap target ----------------------

test('AC6: theme toggle buttons have translated accessible names and meet the 44px tap-target floor', async ({
  page,
}) => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Settings page requires authentication.');
  await page.goto('/pt-PT/settings');

  const system = page.getByTestId('theme-toggle-system');
  const light = page.getByTestId('theme-toggle-light');
  const dark = page.getByTestId('theme-toggle-dark');

  await expect(system).toBeVisible();
  await expect(system).toHaveText('Sistema');
  await expect(light).toHaveText('Claro');
  await expect(dark).toHaveText('Escuro');

  for (const locator of [system, light, dark]) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  // Regression guard: the raw i18n key must never leak into the DOM.
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('themeSectionTitle');
});
