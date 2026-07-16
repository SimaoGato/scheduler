/**
 * e2e/availability-destructive-contrast.spec.ts — CHORE-19: Redesign
 * availability page visual design (Card-based layout).
 *
 * CI-safe, non-browser, non-auth static/filesystem check, modeled on
 * e2e/card-ui-primitive.spec.ts's HSL-extraction + contrast-ratio helpers.
 * Verifies AC5's blocked-state badge combination: `--destructive-foreground`
 * text on a *solid* `--destructive` background (no alpha compositing, since
 * the badge is fully opaque) meets WCAG AA (>= 4.5:1) in both light and dark
 * themes — the corrected remediation from the story's Design decision 4
 * (the original `text-destructive` on `bg-destructive/10` combination fails
 * AA: 4.14:1 light / 1.93:1 dark).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const GLOBALS_CSS_PATH = join(process.cwd(), 'app', 'globals.css');

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

// Standard HSL -> sRGB conversion (h in degrees, s/l as 0-1 fractions).
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

test('AC5: --destructive-foreground on solid --destructive (blocked-row badge) meets WCAG AA in both themes', () => {
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
