/**
 * e2e/button-pill-shape.spec.ts — CHORE-24: Adopt pill-shape language in
 * shared shadcn primitives.
 *
 * AC coverage:
 *   Automated (CI-safe, no auth required):
 *     - AC1: static-source check that components/ui/button.tsx's shared
 *       `buttonVariants` cva() base string carries `rounded-full` (not
 *       `rounded-md`), and that neither the `sm` nor `lg` size variants
 *       redeclare `rounded-md` (the tailwind-merge "last occurrence wins"
 *       landmine documented in this story's Implementation Plan — a
 *       redeclared `rounded-md` on a size variant would silently override
 *       the pill-shaped base radius for that size only).
 *     - AC1: static-source check that no `variant` option string
 *       (default/destructive/outline/secondary/ghost/link) carries its own
 *       `rounded-*` class — confirms radius stays variant-agnostic, so one
 *       live instance (the login page's default-variant button below)
 *       stands in for "any variant" without needing a fixture page for
 *       variants with no live consumer today (e.g. `destructive`).
 *     - AC1 (live): computed-style check on the login page's Google
 *       sign-in button (default variant) confirms the rendered
 *       border-radius is fully rounded (radius >= half of height — a
 *       "pill" by definition, robust across Tailwind v4 patch versions
 *       that may change the raw `rounded-full` CSS value, per this story's
 *       documented risk note; do not hardcode the raw computed string).
 *       This button is located via `getByTestId('google-signin-button')`
 *       (the testid already present on GoogleSignInButton.tsx) — this does
 *       NOT mirror design-system.spec.ts's login-button locator, which
 *       uses `getByRole('button', { name: 'Continuar com Google' })`
 *       instead; both locators resolve to the same element.
 *     - AC4 (belt-and-suspenders): the same live button's computed height
 *       is still >= 44px (WCAG AA tap target), confirming the radius-only
 *       edit did not shrink the tap target.
 *     - AC2 regression guard: `disabled:pointer-events-none` remains in
 *       buttonVariants (unrelated to this story's edit, but shares the
 *       same file as button-cursor.spec.ts's AC2 static check — guarded
 *       here too so a future edit to this file can't silently drop it
 *       without at least one of the two specs catching it).
 *
 *   Manual verification only (documented in the story file):
 *     - AC1: visual pass across all variants/sizes, light+dark theme.
 *     - AC2: no label/icon clipping across all AC2-listed pages, 375px and
 *       1280px viewports.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readButtonSource(): string {
  return readFileSync(join(__dirname, '..', 'components', 'ui', 'button.tsx'), 'utf8');
}

// Extracts the raw base class string (the first argument passed to cva()).
function extractBaseString(source: string): string {
  const match = source.match(/cva\(\s*"([^"]*)"/);
  if (!match) throw new Error('Could not find cva() base string in button.tsx');
  return match[1];
}

// Extracts the `size: { ... }` object literal body from the cva() config.
function extractSizeBlock(source: string): string {
  const match = source.match(/size:\s*{([^}]*)}/s);
  if (!match) throw new Error('Could not find size variants block in button.tsx');
  return match[1];
}

// Extracts the `variant: { ... }` object literal body from the cva() config.
function extractVariantBlock(source: string): string {
  const match = source.match(/variant:\s*{([^}]*)}/s);
  if (!match) throw new Error('Could not find variant variants block in button.tsx');
  return match[1];
}

// Extracts a single named key's quoted string value from an object-literal body.
function extractKeyValue(block: string, key: string): string {
  const match = block.match(new RegExp(`${key}:\\s*"([^"]*)"`));
  if (!match) throw new Error(`Could not find key "${key}" in block`);
  return match[1];
}

test('AC1: buttonVariants base string uses rounded-full, not rounded-md', () => {
  const source = readButtonSource();
  const base = extractBaseString(source);
  expect(base).toMatch(/\brounded-full\b/);
  expect(base).not.toMatch(/\brounded-md\b/);
});

test('AC1: sm and lg size variants do not redeclare rounded-md (tailwind-merge landmine guard)', () => {
  const source = readButtonSource();
  const sizeBlock = extractSizeBlock(source);
  const sm = extractKeyValue(sizeBlock, 'sm');
  const lg = extractKeyValue(sizeBlock, 'lg');
  expect(sm).not.toMatch(/\brounded-md\b/);
  expect(lg).not.toMatch(/\brounded-md\b/);
  // Guard against a redeclared rounded-* of any kind sneaking back in.
  expect(sm).not.toMatch(/\brounded-\w+\b/);
  expect(lg).not.toMatch(/\brounded-\w+\b/);
});

test('AC1: no variant option string carries its own rounded-* class (radius stays variant-agnostic)', () => {
  const source = readButtonSource();
  const variantBlock = extractVariantBlock(source);
  for (const key of ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']) {
    const value = extractKeyValue(variantBlock, key);
    expect(value, `variant "${key}" should not declare its own rounded-* class`).not.toMatch(/\brounded-\w+\b/);
  }
});

test('AC2 regression guard: disabled:pointer-events-none remains present', () => {
  const source = readButtonSource();
  expect(source).toMatch(/disabled:pointer-events-none/);
});

test('AC1 + AC4 (live): login page default-variant Button is fully rounded and keeps 44px tap target', async ({ page }) => {
  await page.goto('/pt-PT/login');
  const button = page.getByTestId('google-signin-button');
  await expect(button).toBeVisible();

  const styles = await button.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return {
      borderRadius: parseFloat(cs.borderRadius),
      height: parseFloat(cs.height),
    };
  });

  // A "fully rounded" pill has its radius clamped to (at least) half the
  // element's height by the browser's rendering engine, regardless of the
  // raw Tailwind `rounded-full` value (which may be an enormous number
  // like `3.4e38px` under the hood, not a fixed literal). Assert the
  // relationship, not a hardcoded string.
  expect(styles.borderRadius).toBeGreaterThanOrEqual(styles.height / 2 - 0.5);
  // AC4: radius change must not shrink the existing 44px tap target.
  expect(styles.height).toBeGreaterThanOrEqual(44);
});
