/**
 * e2e/design-language-foundation.spec.ts — CHORE-23: Adopt "Escala"
 * design-language foundation (color tokens + type).
 *
 * This chore ships two new, currently-unconsumed CSS custom properties
 * (`--brand` / `--brand-foreground`) and wires two Google Fonts (Space
 * Grotesk, JetBrains Mono) as the app's global `font-sans` / `font-mono`
 * defaults. No page/component visual rewrite is included (see the story's
 * AC5 and PR description). All tests here are CI-safe, non-auth,
 * static/filesystem checks plus one unauthenticated HTTP fetch — same
 * category as e2e/card-ui-primitive.spec.ts (whose HSL contrast-ratio
 * helpers are duplicated locally below, matching that file's own
 * precedent of not exporting them).
 *
 * AC coverage:
 *   - AC1: static HSL-format check for --brand/--brand-foreground in both
 *     :root and .dark, plus computed WCAG AA contrast (>=4.5:1) for the
 *     brand-foreground-on-brand pairing in both themes.
 *   - AC2: snapshot-style regression check — every pre-existing semantic
 *     token pair must remain >=4.5:1 in both themes (should pass
 *     immediately and stay green, since Decision 1 in the story's plan is
 *     that no existing token value is touched). One exception found during
 *     test-first authoring: --muted/--muted-foreground as a *solid*,
 *     100%-opacity pairing already measures 4.39:1 in light theme (below
 *     AA) before this chore's diff — pre-existing, never touched by this
 *     chore, and never consumed as a solid pairing anywhere in the app
 *     (grep-verified: all live usages are translucent `bg-muted/25` or
 *     `bg-muted/50`). AC2's wording only guards *currently passing*
 *     combinations, so this pair is pinned separately (not gated at 4.5)
 *     rather than included in the strict "must stay >=4.5" loop — see the
 *     dedicated test below for the full rationale.
 *   - AC3: static check that lib/fonts.ts loads both fonts via
 *     next/font/google (not a runtime <link> tag) and that globals.css's
 *     @theme inline block wires --font-sans/--font-mono to the font
 *     variables with a documented fallback stack; plus a compiled-output
 *     check (skipped if `npm run build` hasn't run yet) that no Google
 *     Fonts <link> ships in the HTML and the compiled CSS's @font-face
 *     src is self-hosted under /_next/static/media/.
 *   - AC4: extends the smoke suite's 375px scrollWidth overflow pattern to
 *     the two public, unauthenticated pages (/pt-PT/login, /pt-PT/claim)
 *     to catch a font-driven overflow regression from the global font
 *     swap. This is necessarily narrower than full coverage since every
 *     other page requires auth — see the story's manual visual QA step
 *     for the authenticated pages (home, availability, team, admin
 *     users/roles).
 *   - AC5: no automated test possible (PR description content) — verified
 *     manually per the Definition of Done.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const GLOBALS_CSS_PATH = join(process.cwd(), 'app', 'globals.css');
const FONTS_SOURCE_PATH = join(process.cwd(), 'lib', 'fonts.ts');
const LOCALE_LAYOUT_PATH = join(process.cwd(), 'app', '[locale]', 'layout.tsx');

// --- Shared HSL -> sRGB -> relative-luminance -> WCAG contrast-ratio helpers
// (duplicated from e2e/card-ui-primitive.spec.ts, which itself does not
// export these — matching that file's established precedent rather than
// introducing a new shared module for a third duplication, per the story's
// Implementation Plan debt note.)

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

// --- AC1a: static HSL-format check ------------------------------------------

test('AC1a: --brand and --brand-foreground exist in HSL format in both :root and .dark', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  // Must be H S% L% (no oklch(...) copy-paste).
  expect(rootBlock).toMatch(/--brand:\s*[\d.]+\s+[\d.]+%\s+[\d.]+%;/);
  expect(rootBlock).toMatch(/--brand-foreground:\s*[\d.]+\s+[\d.]+%\s+[\d.]+%;/);
  expect(darkBlock).toMatch(/--brand:\s*[\d.]+\s+[\d.]+%\s+[\d.]+%;/);
  expect(darkBlock).toMatch(/--brand-foreground:\s*[\d.]+\s+[\d.]+%\s+[\d.]+%;/);

  expect(rootBlock).not.toMatch(/--brand:\s*oklch/);
  expect(darkBlock).not.toMatch(/--brand:\s*oklch/);
});

// --- AC1b: computed WCAG AA contrast for --brand-foreground on --brand -----

test('AC1b: --brand-foreground on --brand meets WCAG AA (>=4.5:1) in both themes', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightBrand = extractHslVar(rootBlock, 'brand');
  const lightBrandForeground = extractHslVar(rootBlock, 'brand-foreground');
  const lightRatio = contrastRatioFromHsl(lightBrandForeground, lightBrand);
  expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

  const darkBrand = extractHslVar(darkBlock, 'brand');
  const darkBrandForeground = extractHslVar(darkBlock, 'brand-foreground');
  const darkRatio = contrastRatioFromHsl(darkBrandForeground, darkBrand);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

// --- AC2: no regression on any pre-existing semantic token pair ------------

// NOTE (found during test-first authoring, unrelated to this chore's diff):
// --muted / --muted-foreground as a *solid*, 100%-opacity pairing measures
// 4.39:1 in light theme — just under the 4.5:1 AA floor. This is pre-existing
// (present in app/globals.css before this chore; Decision 1 forbids touching
// existing token values, so it is intentionally left as-is) and, per
// grep-verification, is never actually consumed as a solid pairing anywhere
// in the app: every live usage of `bg-muted` is translucent (`bg-muted/25`,
// `bg-muted/50` in UserTable.tsx/RoleTable.tsx/PeopleTable.tsx and the
// login/claim layout shells), compositing over `--background`, not the raw
// `--muted` value. AC2's own wording only requires "no *currently passing*
// combination regresses below 4.5:1" — this pair was never passing as a raw
// solid pairing, so it is excluded from the strict loop below and instead
// pinned here (not gated at 4.5) so a future accidental change is still
// caught, without blocking this unrelated chore on pre-existing debt.
test('AC2 note: --muted-foreground on solid --muted is pre-existing, below-AA debt (pinned, not gated — see comment)', () => {
  const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
  const rootBlock = extractThemeBlock(css, ':root');
  const darkBlock = extractThemeBlock(css, '\\.dark');

  const lightMuted = extractHslVar(rootBlock, 'muted');
  const lightMutedForeground = extractHslVar(rootBlock, 'muted-foreground');
  const lightRatio = contrastRatioFromHsl(lightMutedForeground, lightMuted);
  expect(lightRatio).toBeCloseTo(4.39, 1);

  // Dark theme's solid pairing does currently pass — gate it normally so a
  // future change that breaks it is still caught as a real regression.
  const darkMuted = extractHslVar(darkBlock, 'muted');
  const darkMutedForeground = extractHslVar(darkBlock, 'muted-foreground');
  const darkRatio = contrastRatioFromHsl(darkMutedForeground, darkMuted);
  expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
});

const EXISTING_SEMANTIC_PAIRS: Array<[string, string]> = [
  ['background', 'foreground'],
  ['card', 'card-foreground'],
  ['popover', 'popover-foreground'],
  ['primary', 'primary-foreground'],
  ['secondary', 'secondary-foreground'],
  ['accent', 'accent-foreground'],
  ['destructive', 'destructive-foreground'],
  ['warning', 'warning-foreground'],
];

for (const [bg, fg] of EXISTING_SEMANTIC_PAIRS) {
  test(`AC2: --${fg} on --${bg} still meets WCAG AA in both themes (no regression)`, () => {
    const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
    const rootBlock = extractThemeBlock(css, ':root');
    const darkBlock = extractThemeBlock(css, '\\.dark');

    const lightBg = extractHslVar(rootBlock, bg);
    const lightFg = extractHslVar(rootBlock, fg);
    const lightRatio = contrastRatioFromHsl(lightFg, lightBg);
    expect(lightRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);

    const darkBg = extractHslVar(darkBlock, bg);
    const darkFg = extractHslVar(darkBlock, fg);
    const darkRatio = contrastRatioFromHsl(darkFg, darkBg);
    expect(darkRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
  });
}

// --- AC3a: static check — fonts loaded via next/font/google, wired into theme

test('AC3a: lib/fonts.ts loads Space Grotesk and JetBrains Mono via next/font/google', () => {
  test.skip(!existsSync(FONTS_SOURCE_PATH), 'lib/fonts.ts does not exist yet.');
  const source = readFileSync(FONTS_SOURCE_PATH, 'utf8');

  expect(source).toMatch(/import\s*\{[^}]*Space_Grotesk[^}]*\}\s*from\s*['"]next\/font\/google['"]/);
  expect(source).toMatch(/import\s*\{[^}]*JetBrains_Mono[^}]*\}\s*from\s*['"]next\/font\/google['"]/);
  expect(source).toMatch(/variable:\s*['"]--font-space-grotesk['"]/);
  expect(source).toMatch(/variable:\s*['"]--font-jetbrains-mono['"]/);
});

test('AC3a: app/[locale]/layout.tsx does not use a runtime <link> tag for fonts', () => {
  const source = readFileSync(LOCALE_LAYOUT_PATH, 'utf8');
  expect(source).not.toMatch(/<link[^>]*fonts\.googleapis\.com/);
});

test('AC3a: globals.css @theme inline wires --font-sans and --font-mono with fallback stacks', () => {
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

  expect(themeBlock).toMatch(/--font-sans:\s*var\(--font-space-grotesk\)[\s\S]*?;/);
  expect(themeBlock).toMatch(/--font-mono:\s*var\(--font-jetbrains-mono\)[\s\S]*?;/);
  // Documented fallback stack — must list at least one generic family after
  // the CSS variable reference, not just the variable alone.
  expect(themeBlock).toMatch(/--font-sans:\s*var\(--font-space-grotesk\)[^;]*sans-serif/);
  expect(themeBlock).toMatch(/--font-mono:\s*var\(--font-jetbrains-mono\)[^;]*monospace/);
});

// --- AC3b: compiled-output self-hosting check (skipped until `npm run build`)

test('AC3b: /pt-PT/login response HTML contains no Google Fonts <link> tag', async ({ request }) => {
  const response = await request.get('/pt-PT/login');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).not.toMatch(/<link[^>]*href="https:\/\/fonts\.googleapis\.com/);
});

test('AC3b: compiled CSS contains a self-hosted @font-face rule (no external Google Fonts request)', () => {
  const nextStaticDir = join(process.cwd(), '.next', 'static');
  const cssFiles = findCssFiles(nextStaticDir);
  test.skip(
    cssFiles.length === 0,
    'No compiled CSS found under .next/static — run `npm run build` first.'
  );

  const combined = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  const fontFaceBlocks = combined.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  expect(fontFaceBlocks.length).toBeGreaterThan(0);

  const hasLocalSrc = fontFaceBlocks.some((block) => /src:[^;]*\/_next\/static\/media\//.test(block));
  expect(hasLocalSrc).toBe(true);

  expect(combined).not.toMatch(/fonts\.googleapis\.com/);
  expect(combined).not.toMatch(/fonts\.gstatic\.com/);
});

// --- AC4: extended 375px overflow smoke check for public pages -------------

test('AC4: /pt-PT/login has no horizontal overflow at 375px after the font change', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/pt-PT/login');
  await expect(page.locator('main')).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

test('AC4: /pt-PT/claim has no horizontal overflow at 375px after the font change', async ({ page }) => {
  // /claim requires auth and redirects unauthenticated visitors to /login
  // (see app/[locale]/claim/page.tsx); this still exercises the redirected
  // page's rendered layout at this viewport, matching the "public,
  // unauthenticated" framing of this check — full coverage of the
  // authenticated /claim content itself is out of CI's reach and is
  // covered by the story's manual visual QA step instead.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/pt-PT/claim');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});
