/**
 * e2e/card-ui-primitive.spec.ts — CHORE-17: Add a Card UI primitive to the
 * design system.
 *
 * This is a pure infrastructure addition (no page-visible behaviour), so
 * per the story's own AC4 wording no live-page e2e test is required. All
 * tests here are CI-safe, non-browser, non-auth static/filesystem checks —
 * same category as e2e/dark-mode.spec.ts's AC5 and the BUGFIX-02
 * "static source guard" pattern.
 *
 * AC coverage:
 *   - AC1: static source check (`components/ui/card.tsx` exports all six
 *     components with the expected token-based class strings) + compiled-CSS
 *     check (Tailwind's content scanner picked up the new file's utility
 *     classes even though nothing imports it yet).
 *   - AC2: WCAG AA contrast, computed (not eyeballed) from the real HSL
 *     custom properties in app/globals.css, for `--card-foreground`/`--card`
 *     and `--muted-foreground`/`--card` in both `:root` (light) and `.dark`
 *     (dark) — mirrors the STORY-19 precedent described in CLAUDE.md.
 *   - AC3: static source check — no fixed-width utility classes in
 *     card.tsx's class strings, so the component cannot introduce
 *     horizontal overflow by construction. The tap-target clause is N/A
 *     here (zero interactive children shipped by this story); the live,
 *     real-content 375px/1280px check is deferred to CHORE-18/CHORE-19,
 *     which will place actual content (and any interactive children)
 *     inside Card — see the story's Implementation Plan for the full
 *     rationale.
 *   - AC4: covered by CI (`npm run lint && npx tsc --noEmit && npm run
 *     build`), not by this spec file.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const CARD_SOURCE_PATH = join(process.cwd(), 'components', 'ui', 'card.tsx');
const GLOBALS_CSS_PATH = join(process.cwd(), 'app', 'globals.css');

// --- AC1: static source check ---------------------------------------------

test('AC1: card.tsx exports all six components with token-based class strings', () => {
  const source = readFileSync(CARD_SOURCE_PATH, 'utf8');

  expect(source).toMatch(
    /function Card\([\s\S]*?data-slot="card"[\s\S]*?bg-card[\s\S]*?text-card-foreground[\s\S]*?\)/
  );
  expect(source).toMatch(/function CardHeader\([\s\S]*?data-slot="card-header"[\s\S]*?\)/);
  expect(source).toMatch(/function CardTitle\([\s\S]*?data-slot="card-title"[\s\S]*?\)/);
  expect(source).toMatch(
    /function CardDescription\([\s\S]*?data-slot="card-description"[\s\S]*?text-muted-foreground[\s\S]*?\)/
  );
  expect(source).toMatch(/function CardContent\([\s\S]*?data-slot="card-content"[\s\S]*?\)/);
  expect(source).toMatch(/function CardFooter\([\s\S]*?data-slot="card-footer"[\s\S]*?\)/);

  // Single, explicit multi-export statement matching select.tsx's style.
  expect(source).toMatch(
    /export \{[\s\S]*?Card[\s\S]*?CardHeader[\s\S]*?CardFooter[\s\S]*?CardTitle[\s\S]*?CardDescription[\s\S]*?CardContent[\s\S]*?\}/
  );

  // CardAction is deliberately excluded (Design decision #2 in the story's
  // Implementation Plan) — guard against accidental scope creep.
  expect(source).not.toMatch(/CardAction/);

  // No 'use client' directive — Card is presentational only.
  expect(source.trimStart().startsWith("'use client'")).toBe(false);
  expect(source.trimStart().startsWith('"use client"')).toBe(false);
});

// --- AC1: compiled CSS check ----------------------------------------------

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

test('AC1: compiled CSS output contains the card component utility classes', () => {
  const nextStaticDir = join(process.cwd(), '.next', 'static');
  const cssFiles = findCssFiles(nextStaticDir);
  test.skip(
    cssFiles.length === 0,
    'No compiled CSS found under .next/static — run `npm run build` first.'
  );

  const combined = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

  expect(combined).toMatch(/\.bg-card/);
  expect(combined).toMatch(/\.text-card-foreground/);
});

// --- AC2: WCAG AA contrast, computed from real app/globals.css values ----

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

test('AC2: --card-foreground on --card meets WCAG AA in both light and dark themes', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightCard = extractHslVar(rootBlock, 'card');
  const lightCardForeground = extractHslVar(rootBlock, 'card-foreground');
  const lightRatio = contrastRatioFromHsl(lightCardForeground, lightCard);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

  const darkCard = extractHslVar(darkBlock, 'card');
  const darkCardForeground = extractHslVar(darkBlock, 'card-foreground');
  const darkRatio = contrastRatioFromHsl(darkCardForeground, darkCard);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

test('AC2: --muted-foreground on --card (used by CardDescription) meets WCAG AA in both themes', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightCard = extractHslVar(rootBlock, 'card');
  const lightMutedForeground = extractHslVar(rootBlock, 'muted-foreground');
  const lightRatio = contrastRatioFromHsl(lightMutedForeground, lightCard);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

  const darkCard = extractHslVar(darkBlock, 'card');
  const darkMutedForeground = extractHslVar(darkBlock, 'muted-foreground');
  const darkRatio = contrastRatioFromHsl(darkMutedForeground, darkCard);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- AC3: static check — no fixed-width utilities, structurally overflow-safe

test('AC3: card.tsx class strings contain no fixed-width utilities (cannot cause horizontal overflow)', () => {
  const source = readFileSync(CARD_SOURCE_PATH, 'utf8');

  // No arbitrary pixel/rem widths like w-[...].
  expect(source).not.toMatch(/\bw-\[/);
  // No bare numeric width utilities (e.g. w-64, w-96) — w-full is allowed.
  expect(source).not.toMatch(/\bw-(?!full\b)\d/);
  // No min-w- beyond min-w-0.
  expect(source).not.toMatch(/\bmin-w-(?!0\b)/);
});
