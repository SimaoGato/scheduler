/**
 * e2e/dashboard-hero-stat.spec.ts — CHORE-25: Roll out mockup's
 * Dashboard-specific treatments (hero stat, mono digits).
 *
 * CI-safe, non-browser, non-auth static/filesystem checks — same category as
 * e2e/card-ui-primitive.spec.ts and e2e/button-pill-shape.spec.ts. Live-DOM
 * assertions for AC1/AC3 live in e2e-integration/home.spec.ts (auth-gated,
 * real Supabase), since this page requires an authenticated session to
 * render its Admin/Member branches.
 *
 * AC coverage:
 *   - AC1: static source guard — the Admin "Active people" hero <li> uses
 *     `bg-brand`/`text-brand-foreground`, while its sibling stat <li>s use a
 *     plain `border` (not `bg-brand`) — proves the hero/outline distinction
 *     exists in source and cannot regress silently.
 *   - AC3: static source guard — `font-mono` appears on each of the 6 `num`
 *     render-prop spans in page.tsx (the 3 Admin stats + 3 Member
 *     numerals/date).
 *   - AC4: WCAG AA contrast (>= 4.5:1), independently re-derived from
 *     `app/globals.css`'s real `--brand`/`--brand-foreground` HSL values in
 *     both `:root` (light) and `.dark` (dark) — duplicated (not imported,
 *     matching CHORE-17/23/24's established non-shared-helper precedent)
 *     HSL->sRGB->luminance->ratio helpers. WCAG's large-text allowance
 *     (3:1) is NOT relied upon — this story's AC4 sets the stricter 4.5:1
 *     floor explicitly, and since the HSL values are re-read directly from
 *     source (not hardcoded from CHORE-23's test file) this is a genuine
 *     independent re-check, not a copy-paste of CHORE-23's math.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const PAGE_SOURCE_PATH = join(process.cwd(), 'app', '[locale]', '(app)', 'page.tsx');
const GLOBALS_CSS_PATH = join(process.cwd(), 'app', 'globals.css');

// --- AC1: static source guard — hero card vs. outlined siblings -----------

test('AC1: admin-active-people-hero uses bg-brand/text-brand-foreground', () => {
  const source = readFileSync(PAGE_SOURCE_PATH, 'utf8');

  // The hero <li> carries data-testid="admin-active-people-hero" together
  // with bg-brand and text-brand-foreground in its className (order-agnostic
  // within the same element — matched as one contiguous JSX block).
  const heroMatch = source.match(
    /<li\s+data-testid="admin-active-people-hero"[\s\S]{0,300}?className="([^"]*)"/
  );
  expect(heroMatch, 'admin-active-people-hero <li> not found in page.tsx').not.toBeNull();
  const heroClassName = heroMatch![1];
  expect(heroClassName).toMatch(/\bbg-brand\b/);
  expect(heroClassName).toMatch(/\btext-brand-foreground\b/);
});

test('AC1: sibling stat boxes (active roles, blocks-next-30) use a plain border, not bg-brand', () => {
  const source = readFileSync(PAGE_SOURCE_PATH, 'utf8');

  // The active-roles <li> is the first <li> after the hero block, identified
  // by its adminActiveRolesCount t.rich() call within a nearby className.
  const rolesMatch = source.match(
    /<li\s+className="([^"]*)">\s*<p className="text-sm font-semibold">\s*\{t\.rich\('adminActiveRolesCount'/
  );
  expect(rolesMatch, 'active-roles <li> not found in page.tsx').not.toBeNull();
  const rolesClassName = rolesMatch![1];
  expect(rolesClassName).toMatch(/\bborder\b/);
  expect(rolesClassName).not.toMatch(/\bbg-brand\b/);

  const blocksMatch = source.match(
    /<li\s+data-testid="admin-blocks-next-30-days"\s+className="([^"]*)"/
  );
  expect(blocksMatch, 'admin-blocks-next-30-days <li> not found in page.tsx').not.toBeNull();
  const blocksClassName = blocksMatch![1];
  expect(blocksClassName).toMatch(/\bborder\b/);
  expect(blocksClassName).not.toMatch(/\bbg-brand\b/);
});

// --- AC3: static source guard — font-mono on all 6 numeral/date spans -----

test('AC3: all 6 stat-number/date num render-prop spans use font-mono', () => {
  const source = readFileSync(PAGE_SOURCE_PATH, 'utf8');

  const expectedTestIds = [
    'admin-active-people-numeral',
    'member-available-numeral',
    'member-blocked-numeral',
    'member-next-blocked-date',
  ];

  for (const testId of expectedTestIds) {
    const re = new RegExp(`data-testid="${testId}"[\\s\\S]{0,120}?className="([^"]*)"`);
    const match = source.match(re);
    expect(match, `span with data-testid="${testId}" not found`).not.toBeNull();
    expect(match![1]).toMatch(/\bfont-mono\b/);
  }

  // The two remaining num spans (active-roles, blocks-next-30) have no
  // dedicated testid per the story's markup plan (Test plan / AC3 note) —
  // assert font-mono is present on their num render props by proximity to
  // their translation keys instead.
  const rolesNumMatch = source.match(
    /adminActiveRolesCount'[\s\S]{0,200}?num: \(chunks\) => <span className="([^"]*)"/
  );
  expect(rolesNumMatch, 'adminActiveRolesCount num render prop not found').not.toBeNull();
  expect(rolesNumMatch![1]).toMatch(/\bfont-mono\b/);

  const blocksNumMatch = source.match(
    /adminBlocksNext30Days'[\s\S]{0,200}?num: \(chunks\) => <span className="([^"]*)"/
  );
  expect(blocksNumMatch, 'adminBlocksNext30Days num render prop not found').not.toBeNull();
  expect(blocksNumMatch![1]).toMatch(/\bfont-mono\b/);
});

test('AC3: label wrapper <p> elements do not carry font-mono (proves numeral/label split)', () => {
  const source = readFileSync(PAGE_SOURCE_PATH, 'utf8');

  // Every t.rich() call site's <p> wrapper className must not itself
  // contain font-mono — only the nested num span should.
  const pWrapperMatches = [
    ...source.matchAll(/<p className="([^"]*)">\s*\{t\.rich\(/g),
    ...source.matchAll(/<p className="([^"]*)">\s*\{h\.rich\(/g),
  ];
  expect(pWrapperMatches.length).toBeGreaterThan(0);
  for (const match of pWrapperMatches) {
    expect(match[1]).not.toMatch(/\bfont-mono\b/);
  }
});

// --- AC4: WCAG AA contrast, independently re-derived from globals.css -----

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

test('AC4: --brand-foreground on --brand meets WCAG AA (>= 4.5:1) in both light and dark themes', () => {
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
