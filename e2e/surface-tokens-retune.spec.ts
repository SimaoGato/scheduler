/**
 * e2e/surface-tokens-retune.spec.ts — CHORE-32: Retune base surface tokens
 * (background/card/border) to match the mockup's dark-theme palette.
 *
 * CI-safe, non-auth, static/filesystem checks only — modeled on
 * e2e/card-ui-primitive.spec.ts / e2e/header-surface-tokens.spec.ts,
 * duplicating their HSL-extraction/contrast helpers per those files' own
 * established precedent of not sharing a module across specs.
 *
 * AC coverage:
 *   - AC1: static HSL-format check for --background/--card/--border/--input
 *     in `.dark` (exact new values, no stray oklch(...) copy-paste), plus a
 *     strict-inequality ordering check (background L < card L < border L) —
 *     the concrete "future edit can't silently flatten the tokens back
 *     together" regression gate.
 *   - AC2: computed WCAG AA contrast (>=4.5:1) for the previously-untested
 *     --muted-foreground on --background pairing (dark); computed WCAG AA
 *     contrast for --popover-foreground on --popover (dark) plus a
 *     regression guard that --popover now tracks the new --card value
 *     exactly (Challenge WARNING #1 fix — previously a literal duplicate of
 *     the OLD --background, which would have inverted elevation order
 *     after this retune); computed WCAG 2.4.11/1.4.11 non-text contrast
 *     (>=3:1) for --ring on --background and --ring on --card (dark).
 *     --foreground/--background and --card-foreground/--card are already
 *     re-verified automatically by e2e/design-language-foundation.spec.ts's
 *     EXISTING_SEMANTIC_PAIRS loop and --muted-foreground/--card by
 *     e2e/card-ui-primitive.spec.ts, both of which read globals.css at test
 *     time — no code change needed there.
 *   - AC3: regression guard that `:root`'s `--background`/`--card` remain
 *     byte-for-byte unchanged (pure white), confirming light theme was not
 *     touched by this chore.
 *   - Informational (non-gating, per Challenge NOTE #4): computed non-text
 *     ratios for --border on --background and --border on --card (dark).
 *     These are documented, not asserted against the 3:1 floor — plain
 *     divider/outline borders are not WCAG-gated the way focus indicators
 *     are (--ring, checked above, is the actual 3:1-gated non-text token).
 *     See app/globals.css's inline comments for the full rationale.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const GLOBALS_CSS_PATH = join(process.cwd(), 'app', 'globals.css');

// --- Shared HSL -> sRGB -> relative-luminance -> WCAG contrast-ratio helpers
// (duplicated from e2e/card-ui-primitive.spec.ts / e2e/header-surface-tokens.spec.ts,
// per those files' own precedent of duplicating rather than sharing a module).

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

// Computed from the mockup's oklch(...) sources via the CHORE-23/28
// OKLab->linear-sRGB->sRGB->HSL matrix method (see the story's Implementation
// Plan for the full derivation and cross-validation against CHORE-28).
const EXPECTED_DARK_BACKGROUND: [number, number, number] = [211, 28, 15];
const EXPECTED_DARK_CARD: [number, number, number] = [211, 24, 21];
const EXPECTED_DARK_BORDER: [number, number, number] = [211, 18, 31];
const EXPECTED_DARK_INPUT: [number, number, number] = [211, 18, 31];

// --- AC1a: static HSL-format + exact-value check ----------------------------

test('AC1a: --background, --card, --border, --input in .dark are the new retuned HSL values, no stray oklch(...)', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  for (const varName of ['background', 'card', 'border', 'input']) {
    const re = new RegExp(`--${varName}:\\s*[\\d.]+\\s+[\\d.]+%\\s+[\\d.]+%;`);
    expect(darkBlock).toMatch(re);
  }

  expect(extractHslVar(darkBlock, 'background')).toEqual(EXPECTED_DARK_BACKGROUND);
  expect(extractHslVar(darkBlock, 'card')).toEqual(EXPECTED_DARK_CARD);
  expect(extractHslVar(darkBlock, 'border')).toEqual(EXPECTED_DARK_BORDER);
  expect(extractHslVar(darkBlock, 'input')).toEqual(EXPECTED_DARK_INPUT);

  expect(darkBlock).not.toMatch(/--background:\s*oklch/);
  expect(darkBlock).not.toMatch(/--card:\s*oklch/);
  expect(darkBlock).not.toMatch(/--border:\s*oklch/);
  expect(darkBlock).not.toMatch(/--input:\s*oklch/);
});

// --- AC1b: strict tonal-separation ordering ---------------------------------

test('AC1b: .dark tonal separation is strictly increasing: background L < card L < border L', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const [, , backgroundL] = extractHslVar(darkBlock, 'background');
  const [, , cardL] = extractHslVar(darkBlock, 'card');
  const [, , borderL] = extractHslVar(darkBlock, 'border');

  expect(cardL).toBeGreaterThan(backgroundL);
  expect(borderL).toBeGreaterThan(cardL);
});

// --- AC2: previously-untested --muted-foreground on --background -----------

test('AC2: --muted-foreground on --background meets WCAG AA (>=4.5:1) in dark theme', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const darkBackground = extractHslVar(darkBlock, 'background');
  const darkMutedForeground = extractHslVar(darkBlock, 'muted-foreground');
  const darkRatio = contrastRatioFromHsl(darkMutedForeground, darkBackground);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- AC2: --popover now tracks --card (Challenge WARNING #1 fix) -----------

test('AC2: .dark --popover matches the new --card value exactly (elevation-order fix)', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  expect(extractHslVar(darkBlock, 'popover')).toEqual(extractHslVar(darkBlock, 'card'));
});

test('AC2: --popover-foreground on --popover meets WCAG AA (>=4.5:1) in dark theme after the elevation-order fix', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const darkPopover = extractHslVar(darkBlock, 'popover');
  const darkPopoverForeground = extractHslVar(darkBlock, 'popover-foreground');
  const darkRatio = contrastRatioFromHsl(darkPopoverForeground, darkPopover);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- AC2: --ring non-text contrast against the new --background/--card -----

test('AC2: --ring on --background and --ring on --card meet WCAG 2.4.11 non-text contrast (>=3:1) in dark theme', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const darkBackground = extractHslVar(darkBlock, 'background');
  const darkCard = extractHslVar(darkBlock, 'card');
  const darkRing = extractHslVar(darkBlock, 'ring');

  const ratioOnBackground = contrastRatioFromHsl(darkRing, darkBackground);
  expect(ratioOnBackground).toBeGreaterThanOrEqual(WCAG_NON_TEXT_MIN_RATIO);

  const ratioOnCard = contrastRatioFromHsl(darkRing, darkCard);
  expect(ratioOnCard).toBeGreaterThanOrEqual(WCAG_NON_TEXT_MIN_RATIO);
});

// --- AC3: light theme unchanged ---------------------------------------------

test('AC3: :root --background and --card remain byte-for-byte unchanged (pure white, light theme untouched)', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');

  expect(extractHslVar(rootBlock, 'background')).toEqual([0, 0, 100]);
  expect(extractHslVar(rootBlock, 'card')).toEqual([0, 0, 100]);
});

// --- Informational (non-gating): --border non-text ratios, per Challenge ---
// --- NOTE #4. Documented alongside --ring above, not asserted against the --
// --- 3:1 floor — plain divider/outline borders are not WCAG-gated the way --
// --- focus indicators are. Regression guard only (values must stay close --
// --- to the computed, documented figures). ------------------------------

test('Informational: --border on --background and --border on --card computed ratios match the documented figures (dark theme)', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const darkBackground = extractHslVar(darkBlock, 'background');
  const darkCard = extractHslVar(darkBlock, 'card');
  const darkBorder = extractHslVar(darkBlock, 'border');

  const ratioOnBackground = contrastRatioFromHsl(darkBorder, darkBackground);
  expect(ratioOnBackground).toBeCloseTo(1.82, 1);

  const ratioOnCard = contrastRatioFromHsl(darkBorder, darkCard);
  expect(ratioOnCard).toBeCloseTo(1.48, 1);
});
