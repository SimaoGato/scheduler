/**
 * e2e/link-picker-color-scheme.spec.ts — BUGFIX-04: Link-account `<select>`
 * picker is unreadable in dark mode until hovered.
 *
 * Cause: `app/globals.css` never set the CSS `color-scheme` property, so the
 * browser rendered the native `<select>` popup (and other native form-control
 * chrome) with a light-scheme palette regardless of the app's `.dark` class,
 * while the `<select>`'s inherited `color` was still the dark-mode
 * near-white foreground — near-white text on a near-white native popup.
 *
 * Fix: `app/globals.css` now declares `color-scheme: light;` inside `:root`
 * and `color-scheme: dark;` inside `.dark`, keeping native-widget theming
 * tied to the same class-driven signal CHORE-11 already uses for every other
 * themed surface (not the `light dark` shorthand, which would re-couple
 * native popups to `prefers-color-scheme` and regress CHORE-11 AC3).
 *
 * AC coverage:
 *   CI-safe, no auth:
 *     - AC1 (static) + AC2 (static): `app/globals.css` source declares
 *       `color-scheme: dark;` inside `.dark { ... }` and
 *       `color-scheme: light;` inside `:root { ... }` (brace-balanced
 *       extraction, not a naive substring match — mirrors
 *       `extractPrefersColorSchemeDarkBlocks` in e2e/dark-mode.spec.ts).
 *     - AC1 (mechanism) + AC2 (mechanism): a fresh, unauthenticated visit to
 *       the public /pt-PT/login page under a forced OS `colorScheme` context
 *       resolves `getComputedStyle(document.documentElement).colorScheme`
 *       to 'dark' / 'light' respectively (mirrors e2e/dark-mode.spec.ts's
 *       AC2 pattern for the `.dark` class itself).
 *
 *   E2E_WITH_AUTH-gated (require a real Supabase admin session):
 *     - AC4 (regression check): opening the picker still yields a >=44px
 *       tall control with the `pm-link-select-{id}` testid and an
 *       `aria-label` matching messages/pt-PT.json's `linkPickerLabel`
 *       ("Escolher conta a ligar") — no regression from this CSS-only fix.
 *
 *   Manual verification only (not automatable — see story file's Test plan
 *   for the full checklist and rationale; results are recorded in
 *   docs/stories/BUGFIX-04-link-picker-select-dark-mode-contrast.md):
 *     - AC1: native dropdown popup pixel-level readability in dark mode
 *       (screenshot + contrast-ratio sampling).
 *     - AC2: same, light mode, before/after parity.
 *     - AC3: keyboard-only (arrow key) focused-option distinguishability —
 *       OS-native chrome outside Playwright's reach.
 *     - Cross-cutting spot-check: components/ClaimPersonForm.tsx's visible
 *       native radio inputs in both themes (color-scheme is inherited and
 *       root-scoped, so this fix's blast radius includes them even though no
 *       code in that component changed).
 *
 * SUPERSEDED BY BUGFIX-05 (2026-07-10): the reporting user confirmed the
 * "Ligar conta" popup was *still* unreadable on Windows Chrome/Edge dark
 * mode after this fix shipped — a genuine Chromium cross-platform popup-
 * rendering limitation (native `<select>` popup background painting does
 * not consistently follow `color-scheme` on Windows), not something a
 * CSS-only fix can close. BUGFIX-05 replaced the native `<select>` with a
 * Radix `Select` (shadcn/ui) that renders its own themed DOM popup instead
 * of relying on the OS-native popup. As a direct result, the AC1
 * "element-level" test formerly here — asserting
 * `getComputedStyle(select).colorScheme === 'dark'` on the picker element —
 * has been REMOVED: the picker is now a `<button>`-like `SelectTrigger`,
 * not a `<select>`, so that assertion no longer describes anything
 * meaningful about the popup's actual rendered contrast, and would not fail
 * even if the new popup were unreadable. The popup's actual rendered
 * contrast is now tested directly (via `getComputedStyle()` on real DOM
 * nodes, since Radix's popup is a normal same-document node, not an opaque
 * native one) in e2e/link-picker-custom-dropdown.spec.ts's AC1/AC2 tests.
 * The static/mechanism tests below (testing the `color-scheme` CSS
 * declaration itself, still shipped per BUGFIX-05's "Out of scope" — the
 * declaration remains correct/useful for other native controls, e.g. any
 * future `<input type="date">`) and the AC4 tap-target/testid/aria-label
 * regression check (still meaningful against the new `SelectTrigger`, which
 * preserves the same `data-testid`/`aria-label` contract) are unchanged.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page, type TestInfo } from '@playwright/test';

// --- Static-source guard: brace-balanced block extraction ----------------
// Mirrors extractPrefersColorSchemeDarkBlocks in e2e/dark-mode.spec.ts: a
// naive `[^}]*` regex only captures up to the first closing brace, which
// would silently pass/fail on a multi-declaration block. Balancing braces
// guarantees the whole block's contents are inspected.
function extractTopLevelBlock(css: string, selector: RegExp): string | null {
  const match = selector.exec(css);
  if (!match) return null;
  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let i = bodyStart;
  for (; i < css.length && depth > 0; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
  }
  return css.slice(bodyStart, i - 1);
}

test('AC1/AC2 (static): app/globals.css declares color-scheme: dark in .dark and color-scheme: light in :root', () => {
  const cssPath = join(process.cwd(), 'app', 'globals.css');
  const css = readFileSync(cssPath, 'utf8');

  const rootBlock = extractTopLevelBlock(css, /:root\s*\{/);
  expect(rootBlock).not.toBeNull();
  expect(rootBlock).toMatch(/color-scheme:\s*light\s*;/);

  const darkBlock = extractTopLevelBlock(css, /\.dark\s*\{/);
  expect(darkBlock).not.toBeNull();
  expect(darkBlock).toMatch(/color-scheme:\s*dark\s*;/);

  // Guard against the too-broad shorthand fix (see story's Step-by-step
  // approach, item 3): `color-scheme: light dark;` on :root alone would
  // re-couple native popup theming to the OS's prefers-color-scheme,
  // regressing CHORE-11 AC3 (explicit in-app theme choice overriding OS
  // preference). Neither block should contain the shorthand form.
  expect(rootBlock).not.toMatch(/color-scheme:\s*light\s+dark\s*;/);
  expect(darkBlock).not.toMatch(/color-scheme:\s*light\s+dark\s*;/);
});

// --- Mechanism check: computed color-scheme on <html> --------------------

test('AC1 (mechanism): fresh visit with OS dark preference resolves colorScheme to dark', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/pt-PT/login');
  const colorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme
  );
  expect(colorScheme).toBe('dark');
  await context.close();
});

test('AC2 (mechanism): fresh visit with OS light preference resolves colorScheme to light', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/pt-PT/login');
  const colorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme
  );
  expect(colorScheme).toBe('light');
  await context.close();
});

// ---------------------------------------------------------------------------
// E2E_WITH_AUTH-gated: element-level checks against the real "Ligar conta"
// picker. Fixture helper mirrors e2e/admin-link-person.spec.ts's
// createPerson/deletePerson (duplicated locally per this project's
// established convention of self-contained spec files).
// ---------------------------------------------------------------------------

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

test.describe('BUGFIX-04: link picker color-scheme (auth-gated; AC1 element-level check removed — see BUGFIX-05 superseded-by note above)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in story file.');

  test('AC4: picker regression — 44px tap target, pm-link-select testid, and aria-label wiring unchanged', async ({
    page,
  }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const personName = `BUGFIX-04 QA AC4 Person (${suffix})`;
    const person = await createPerson(page, personName);

    try {
      await page.goto('/pt-PT/admin/people');
      const row = page.locator('tr', { hasText: personName });
      await row.getByTestId(`pm-link-${person.id}`).click();

      const trigger = row.getByTestId(`pm-link-select-${person.id}`);
      await expect(trigger).toBeVisible();

      const box = await trigger.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);

      // Extracted from messages/pt-PT.json's PeopleManagement.linkPickerLabel.
      await expect(trigger).toHaveAttribute('aria-label', 'Escolher conta a ligar');
    } finally {
      await deletePerson(page, person.id);
    }
  });
});
