/**
 * e2e/header-surface-tokens.spec.ts — CHORE-28: Header recolor + desktop nav
 * design-language rollout.
 *
 * CI-safe, non-auth, static/filesystem checks only — modeled on
 * e2e/design-language-foundation.spec.ts, duplicating its HSL-extraction/
 * contrast helpers per that file's own established precedent of not sharing
 * a module across specs (see that file's header comment).
 *
 * AC coverage:
 *   - AC1: static HSL-format check for --header/--header-foreground/
 *     --header-muted/--header-border in both :root and .dark, plus computed
 *     WCAG AA contrast (>=4.5:1) for --header-foreground on --header in both
 *     themes.
 *   - AC2 (muted variant): computed WCAG AA contrast (>=4.5:1) for
 *     --header-muted on --header in both themes — this token has no live
 *     consumer in this story's diff (see the story's Challenge Warning 1),
 *     but its contrast is still verified as forward infrastructure.
 *   - Wiring check: @theme inline maps all four --color-header* lines so
 *     bg-header/text-header-foreground/text-header-muted/border-header-border
 *     utilities exist.
 *   - PR #59 review (CRITICAL fix): computed WCAG 2.4.11/1.4.11 non-text
 *     contrast (>=3:1) for --header-foreground on --header in both themes —
 *     this pairing is reused as AppNav.tsx's focus-visible ring color
 *     (`focus-visible:ring-header-foreground`), replacing the shared
 *     Button base's default --ring token, which measured only ~1.03:1
 *     against --header in light theme (below the 3:1 floor for focus
 *     indicators). See AppNav.tsx's HEADER_AWARE_FOCUS_RING comment.
 *   - CHORE-22: computed WCAG AA contrast (>=4.5:1) for --brand as literal
 *     text color on --header in both themes — the first live consumer of
 *     `text-brand` directly against `--header` (previously only verified as
 *     a solid `bg-brand`/`text-brand-foreground` pairing, CHORE-23). This is
 *     BottomNav.tsx's active-tab text/indicator color.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const GLOBALS_CSS_PATH = join(process.cwd(), 'app', 'globals.css');

// --- Shared HSL -> sRGB -> relative-luminance -> WCAG contrast-ratio helpers
// (duplicated from e2e/design-language-foundation.spec.ts, per that file's
// own precedent of duplicating rather than sharing a module).

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

const WCAG_AA_NORMAL_TEXT_MIN_RATIO = 4.5;
const WCAG_NON_TEXT_MIN_RATIO = 3.0;

// --- AC1a: static HSL-format check ------------------------------------------

test('AC1a: --header, --header-foreground, --header-muted, --header-border exist in HSL format in both :root and .dark', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  for (const varName of ['header', 'header-foreground', 'header-muted', 'header-border']) {
    const re = new RegExp(`--${varName}:\\s*[\\d.]+\\s+[\\d.]+%\\s+[\\d.]+%;`);
    expect(rootBlock).toMatch(re);
    expect(darkBlock).toMatch(re);
  }

  // No stray oklch(...) copy-paste from the mockup source values.
  expect(rootBlock).not.toMatch(/--header:\s*oklch/);
  expect(darkBlock).not.toMatch(/--header:\s*oklch/);
});

// --- AC1b: computed WCAG AA contrast for --header-foreground on --header ---

test('AC1b: --header-foreground on --header meets WCAG AA (>=4.5:1) in both themes', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightHeader = extractHslVar(rootBlock, 'header');
  const lightHeaderForeground = extractHslVar(rootBlock, 'header-foreground');
  const lightRatio = contrastRatioFromHsl(lightHeaderForeground, lightHeader);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

  const darkHeader = extractHslVar(darkBlock, 'header');
  const darkHeaderForeground = extractHslVar(darkBlock, 'header-foreground');
  const darkRatio = contrastRatioFromHsl(darkHeaderForeground, darkHeader);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- AC2: computed WCAG AA contrast for --header-muted on --header ---------

test('AC2: --header-muted on --header meets WCAG AA (>=4.5:1) in both themes', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightHeader = extractHslVar(rootBlock, 'header');
  const lightHeaderMuted = extractHslVar(rootBlock, 'header-muted');
  const lightRatio = contrastRatioFromHsl(lightHeaderMuted, lightHeader);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

  const darkHeader = extractHslVar(darkBlock, 'header');
  const darkHeaderMuted = extractHslVar(darkBlock, 'header-muted');
  const darkRatio = contrastRatioFromHsl(darkHeaderMuted, darkHeader);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- PR #59 review (CRITICAL fix): --header-foreground reused as the ------
// --- AppNav focus-visible ring color must clear the 3:1 non-text floor ----

test("PR #59 fix: --header-foreground on --header meets WCAG 2.4.11 non-text contrast (>=3:1) in both themes, verifying its reuse as AppNav.tsx's focus-visible ring color", () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightHeader = extractHslVar(rootBlock, 'header');
  const lightHeaderForeground = extractHslVar(rootBlock, 'header-foreground');
  const lightRatio = contrastRatioFromHsl(lightHeaderForeground, lightHeader);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_NON_TEXT_MIN_RATIO);

  const darkHeader = extractHslVar(darkBlock, 'header');
  const darkHeaderForeground = extractHslVar(darkBlock, 'header-foreground');
  const darkRatio = contrastRatioFromHsl(darkHeaderForeground, darkHeader);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_NON_TEXT_MIN_RATIO);
});

// --- CHORE-22: computed WCAG AA contrast for --brand (as text) on --header -

test("CHORE-22: --brand as text color on --header meets WCAG AA (>=4.5:1) in both themes, verifying BottomNav.tsx's active-tab text/indicator color", () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightHeader = extractHslVar(rootBlock, 'header');
  const lightBrand = extractHslVar(rootBlock, 'brand');
  const lightRatio = contrastRatioFromHsl(lightBrand, lightHeader);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

  const darkHeader = extractHslVar(darkBlock, 'header');
  const darkBrand = extractHslVar(darkBlock, 'brand');
  const darkRatio = contrastRatioFromHsl(darkBrand, darkHeader);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- Wiring check: @theme inline maps the four --color-header* utilities ---

test('@theme inline wires bg-header, text-header-foreground, text-header-muted, border-header-border utilities', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const themeOpenerRe = /@theme inline\s*\{/;
  const match = themeOpenerRe.exec(css);
  expect(match).not.toBeNull();
  const bodyStart = match!.index + match![0].length;
  let depth = 1;
  let i = bodyStart;
  for (; i < css.length && depth > 0; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
  }
  const themeBlock = css.slice(bodyStart, i - 1);

  expect(themeBlock).toMatch(/--color-header:\s*hsl\(var\(--header\)\);/);
  expect(themeBlock).toMatch(/--color-header-foreground:\s*hsl\(var\(--header-foreground\)\);/);
  expect(themeBlock).toMatch(/--color-header-muted:\s*hsl\(var\(--header-muted\)\);/);
  expect(themeBlock).toMatch(/--color-header-border:\s*hsl\(var\(--header-border\)\);/);
});
