/**
 * e2e/login-design-language.spec.ts — CHORE-27: Roll out design language on
 * the login page.
 *
 * CI-safe, no auth required — the login page is reachable unauthenticated.
 *
 * AC coverage:
 *   - AC1 (navy backdrop both themes, brand offset-shadow on the card):
 *     static-source checks that `login/layout.tsx` uses `bg-header` (not
 *     `bg-muted`) and `login/page.tsx`'s card carries the
 *     `shadow-[0_6px_0_0_hsl(var(--brand)/55%)]` construct (CHORE-25's
 *     pattern, 6px offset per the mockup's login-specific value); live-DOM
 *     checks that the centering root's computed background-color matches
 *     `--header`'s HSL (converted to rgb) in both light and dark theme, and
 *     that the card's computed `boxShadow` last layer parses as the 6px
 *     brand offset-shadow in both light and dark theme (dark theme also
 *     carries the extra `dark:ring` layer ahead of it, per the WARNING 1
 *     fix below — the shared assertion helper proves last-layer parsing
 *     still holds with that extra layer present).
 *   - Challenge WARNING 1 (dark-mode card/backdrop separation): static-source
 *     check that the card also carries `dark:ring-1 dark:ring-header-border`
 *     — a decorative, non-WCAG-gated visual-separation aid in dark theme,
 *     reusing the existing `--header-border` token already established by
 *     CHORE-28 (`AppHeader.tsx`/`BottomNav.tsx` precedent) rather than
 *     inventing a new token. Per the `--border`/`--header-border` precedent
 *     in `app/globals.css` ("Border color only — no contrast gate needed"),
 *     this pairing is not WCAG-gated app-wide; independent HSL→luminance→
 *     ratio verification puts this ring at ~1.69:1 against `--header` in
 *     dark theme, well short of the 3:1 non-text floor. It is a decorative
 *     boundary, not a contrast-verified one — no WCAG ratio is asserted for
 *     it here, and the card's actual demarcation against the backdrop in
 *     dark theme comes from the offset-shadow (see AC4's manual-verification
 *     note in the story file), not from this ring.
 *   - AC2 (wordmark display font, tagline mono font, i18n-sourced): static
 *     check for `uppercase`/`tracking-wide` on the `login-app-name` element
 *     and `font-mono` on the tagline; existing `e2e/smoke.spec.ts`'s
 *     `toContainText('Escala')` (unmodified) keeps proving no new hardcoded
 *     string was introduced.
 *   - AC3 (CTA testid/pill/tap-target/behavior unchanged): not re-tested
 *     here — covered by unmodified `e2e/button-pill-shape.spec.ts` and
 *     `e2e/design-system.spec.ts`, which both still pass without edits (see
 *     PR description). This file only asserts the *error-alert* classNames
 *     changed, not the CTA button itself.
 *   - AC4 (WCAG AA on all text/background pairs incl. error banners, both
 *     themes): static regression guard that both error surfaces
 *     (`auth-error` banner in `page.tsx`, inline alert in
 *     `GoogleSignInButton.tsx`) use the CHORE-19 solid-fill remediation
 *     (`bg-destructive text-destructive-foreground`, no `/10` tint) instead
 *     of the pre-existing failing translucent-tint combo; a duplicated
 *     HSL-extraction/contrast-ratio helper (per this repo's established
 *     precedent of not sharing the helper module across specs — see
 *     `e2e/header-surface-tokens.spec.ts`'s header comment) computes the
 *     actual ratio for `--destructive-foreground` on solid `--destructive`
 *     in both themes and asserts >= 4.5:1.
 *     Note: the shadow color (`hsl(var(--brand)/55%)`) is a 55%-alpha
 *     composite, not pure `--brand` — this file does not cite the
 *     undiluted-brand-vs-header ratio as proof of the shadow's visibility
 *     (Challenge WARNING 2). See PR description for the composited ratio
 *     and the manual visual-check reliance.
 *   - AC5 (no horizontal overflow at 375px): re-asserted here for the
 *     login-design-specific page state (in addition to the unmodified,
 *     still-passing `e2e/smoke.spec.ts` check).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const GLOBALS_CSS_PATH = join(process.cwd(), 'app', 'globals.css');
const LAYOUT_PATH = join(process.cwd(), 'app', '[locale]', 'login', 'layout.tsx');
const PAGE_PATH = join(process.cwd(), 'app', '[locale]', 'login', 'page.tsx');
const GOOGLE_BUTTON_PATH = join(
  process.cwd(),
  'app',
  '[locale]',
  'login',
  'GoogleSignInButton.tsx'
);

// --- Shared HSL -> sRGB -> relative-luminance -> WCAG contrast-ratio helpers
// (duplicated from e2e/header-surface-tokens.spec.ts / e2e/availability-
// destructive-contrast.spec.ts, per this repo's established precedent of
// duplicating rather than sharing a module across specs).

function extractThemeBlock(css: string, selector: string): string {
  const openerRe = new RegExp(`${selector}\\s*\\{`);
  const match = openerRe.exec(css);
  if (!match) throw new Error(`Could not find "${selector}" block in globals.css`);
  const bodyStart = match.index + match[0].length;
  let depth = 1;
  let i = bodyStart;
  for (; i < css.length && depth > 0; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
  }
  return css.slice(bodyStart, i - 1);
}

function extractHslVar(block: string, varName: string): [number, number, number] {
  const re = new RegExp(`--${varName}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`);
  const match = re.exec(block);
  if (!match) throw new Error(`Could not find --${varName} in block`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp >= 1 && hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp >= 2 && hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp >= 3 && hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp >= 4 && hp < 5) [r1, g1, b1] = [x, 0, c];
  else if (hp >= 5 && hp < 6) [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatioFromHsl(
  hslA: [number, number, number],
  hslB: [number, number, number]
): number {
  const [ha, sa, la] = hslA;
  const [hb, sb, lb] = hslB;
  const rgbA = hslToRgb(ha, sa / 100, la / 100);
  const rgbB = hslToRgb(hb, sb / 100, lb / 100);
  const La = relativeLuminance(rgbA);
  const Lb = relativeLuminance(rgbB);
  const lighter = Math.max(La, Lb);
  const darker = Math.min(La, Lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function hslToRgbString(hsl: [number, number, number]): string {
  const [h, s, l] = hsl;
  const [r, g, b] = hslToRgb(h, s / 100, l / 100);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

const WCAG_AA_NORMAL_TEXT_MIN_RATIO = 4.5;

// --- AC1: static-source checks -------------------------------------------

test('AC1: login layout backdrop uses bg-header, not bg-muted', () => {
  const source = readFileSync(LAYOUT_PATH, 'utf8');
  expect(source).toMatch(/\bbg-header\b/);
  expect(source).not.toMatch(/\bbg-muted\b/);
});

test('AC1: login card carries the CHORE-25 offset-shadow construct at a 6px offset', () => {
  const source = readFileSync(PAGE_PATH, 'utf8');
  expect(source).toMatch(/shadow-\[0_6px_0_0_hsl\(var\(--brand\)\/55%\)\]/);
});

test('WARNING 1 fix: login card carries a decorative dark-mode ring using the existing --header-border token (not WCAG-gated, see file header comment)', () => {
  const source = readFileSync(PAGE_PATH, 'utf8');
  expect(source).toMatch(/\bdark:ring-1\b/);
  expect(source).toMatch(/\bdark:ring-header-border\b/);
});

// --- AC2: static-source checks --------------------------------------------

test('AC2: wordmark uses uppercase + tracking-wide (display-font logotype look)', () => {
  const source = readFileSync(PAGE_PATH, 'utf8');
  const h1Match = source.match(/<h1\b([\s\S]*?)>/);
  expect(h1Match).not.toBeNull();
  const h1Attrs = h1Match![1];
  expect(h1Attrs).toMatch(/data-testid="login-app-name"/);
  const classNameMatch = h1Attrs.match(/className="([^"]*)"/);
  expect(classNameMatch).not.toBeNull();
  expect(classNameMatch![1]).toMatch(/\buppercase\b/);
  expect(classNameMatch![1]).toMatch(/\btracking-wide\b/);
});

test('AC2: tagline uses font-mono', () => {
  const source = readFileSync(PAGE_PATH, 'utf8');
  expect(source).toMatch(/tApp\('tagline'\)/);
  const taglineBlockMatch = source.match(/<p className="([^"]*)">\s*\{tApp\('tagline'\)\}/);
  expect(taglineBlockMatch).not.toBeNull();
  expect(taglineBlockMatch![1]).toMatch(/\bfont-mono\b/);
});

// --- AC4: static regression guard (solid-fill destructive classes) -------

test("AC4 regression guard: page.tsx's auth-error banner uses solid bg-destructive/text-destructive-foreground, not the translucent-tint combo", () => {
  const source = readFileSync(PAGE_PATH, 'utf8');
  const bannerBlockMatch = source.match(/data-testid="auth-error"[\s\S]*?className="([^"]*)"/);
  expect(bannerBlockMatch).not.toBeNull();
  const classes = bannerBlockMatch![1];
  expect(classes).toMatch(/\bbg-destructive\b/);
  expect(classes).toMatch(/\btext-destructive-foreground\b/);
  expect(classes).not.toMatch(/bg-destructive\/10/);
  expect(classes).not.toMatch(/\btext-destructive\b(?!-foreground)/);
});

test("AC4 regression guard: GoogleSignInButton.tsx's inline alert uses solid bg-destructive/text-destructive-foreground", () => {
  const source = readFileSync(GOOGLE_BUTTON_PATH, 'utf8');
  const alertBlockMatch = source.match(/role="alert"\s*className="([^"]*)"/);
  expect(alertBlockMatch).not.toBeNull();
  const classes = alertBlockMatch![1];
  expect(classes).toMatch(/\bbg-destructive\b/);
  expect(classes).toMatch(/\btext-destructive-foreground\b/);
  expect(classes).not.toMatch(/\btext-destructive\b(?!-foreground)/);
});

test('AC4: --destructive-foreground on solid --destructive (both error surfaces) meets WCAG AA in both themes', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightDestructive = extractHslVar(rootBlock, 'destructive');
  const lightDestructiveForeground = extractHslVar(rootBlock, 'destructive-foreground');
  const lightRatio = contrastRatioFromHsl(lightDestructiveForeground, lightDestructive);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

  const darkDestructive = extractHslVar(darkBlock, 'destructive');
  const darkDestructiveForeground = extractHslVar(darkBlock, 'destructive-foreground');
  const darkRatio = contrastRatioFromHsl(darkDestructiveForeground, darkDestructive);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- AC1 + AC5: live-DOM checks --------------------------------------------

test('AC1 (live, light theme): login-centering-root background-color matches --header light HSL', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/pt-PT/login');

  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const lightHeader = extractHslVar(rootBlock, 'header');
  const expectedRgb = hslToRgbString(lightHeader);

  const root = page.getByTestId('login-centering-root');
  await expect(root).toBeVisible();
  const backgroundColor = await root.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(backgroundColor).toBe(expectedRgb);

  await context.close();
});

test('AC1 (live, dark theme): login-centering-root background-color matches --header dark HSL', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/pt-PT/login');

  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');
  const darkHeader = extractHslVar(darkBlock, 'header');
  const expectedRgb = hslToRgbString(darkHeader);

  const root = page.getByTestId('login-centering-root');
  await expect(root).toBeVisible();
  const backgroundColor = await root.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(backgroundColor).toBe(expectedRgb);

  await context.close();
});

async function assertCardBoxShadowHas6pxOffset(page: import('@playwright/test').Page) {
  await page.goto('/pt-PT/login');
  const card = page.getByTestId('login-app-name').locator('xpath=ancestor::main[1]');
  await expect(card).toBeVisible();

  const boxShadow = await card.evaluate((el) => window.getComputedStyle(el).boxShadow);
  expect(boxShadow).not.toBe('none');

  // Chromium composes ring-utility box-shadow layers (present even at
  // ring-width 0 in light theme, and carrying the dark-mode
  // `dark:ring-1 dark:ring-header-border` layer in dark theme) alongside
  // our own offset-shadow layer, so the computed value has multiple
  // comma-separated layers in both themes, e.g.:
  // "rgba(0,0,0,0) 0px 0px 0px 0px, ..., rgba(250,137,39,0.55) 0px 6px 0px 0px".
  // Split on top-level commas (not the ones inside an rgba(...) color) and
  // inspect the LAST layer, which is our brand offset-shadow
  // (`shadow-[0_6px_0_0_hsl(var(--brand)/55%)]` composes after any ring
  // layers in Tailwind's cascade, in both light and dark theme). Do not
  // hardcode the full string — the color renders as rgba(), not the
  // original hsl().
  const layers = boxShadow.split(/,(?![^(]*\))/).map((layer) => layer.trim());
  const lastLayer = layers[layers.length - 1];
  const pxValues = lastLayer.match(/(-?\d+(?:\.\d+)?)px/g) ?? [];
  expect(pxValues.length).toBeGreaterThanOrEqual(2);
  const yOffset = parseFloat(pxValues[1]);
  expect(yOffset).toBe(6);
}

test('AC1 (live, light theme): login card boxShadow is present with a 6px vertical offset', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await assertCardBoxShadowHas6pxOffset(page);
  await context.close();
});

test('AC1 (live, dark theme): login card boxShadow last layer still parses as the 6px brand offset-shadow with the extra dark:ring layer present', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await assertCardBoxShadowHas6pxOffset(page);
  await context.close();
});

test('AC5: no horizontal overflow at 375px viewport on the redesigned login page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/pt-PT/login');
  await expect(page.locator('main')).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});
