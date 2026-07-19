/**
 * e2e/availability-mono-digit.spec.ts — CHORE-26: Roll out mono-digit/date
 * treatment on the Availability page.
 *
 * CI-safe, non-browser, non-auth static/filesystem checks — same category as
 * e2e/dashboard-hero-stat.spec.ts (CHORE-25) and
 * e2e/availability-destructive-contrast.spec.ts (CHORE-19). Live-DOM
 * assertions for AC1/AC2/AC3 live in e2e-integration/availability.spec.ts
 * and e2e-integration/admin-availability.spec.ts (auth-gated, real
 * Supabase), since this page requires an authenticated session to render.
 *
 * AC coverage:
 *   - AC1: static source guard — the summary counts' `num` render-prop spans
 *     (`availability-available-numeral`, `availability-blocked-numeral`)
 *     carry `font-mono`; their enclosing `<li>` wrappers do not (proving the
 *     numeral/label split — Decision 3, locked: the `<li>` keeps its
 *     existing `text-xl font-bold` untouched, size/weight are inherited by
 *     the span, not redeclared).
 *   - AC2: static source guard — the per-row Sunday date `<span>` carries
 *     `font-mono`; the sibling status-badge `<span>`'s className ternary is
 *     byte-identical to its CHORE-19-shipped value (no `font-mono` added).
 *   - AC3: static source guard — the `availability-next-blocked-date` span
 *     carries `font-mono`; its enclosing `<p>` does not.
 *   - AC4: folded into the AC2 badge-className byte-identity assertion —
 *     direct proof that this purely-font-family change did not touch the
 *     badge's classes at all (the badge's own WCAG AA contrast is
 *     independently re-verified, unmodified, by
 *     e2e/availability-destructive-contrast.spec.ts).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const COMPONENT_SOURCE_PATH = join(process.cwd(), 'components', 'AvailabilityToggleList.tsx');

function readSource(): string {
  return readFileSync(COMPONENT_SOURCE_PATH, 'utf8');
}

// --- AC1: summary counts' numeral spans are font-mono; <li> wrappers are not

test('AC1: availability-available-numeral and availability-blocked-numeral spans use font-mono', () => {
  const source = readSource();

  for (const testId of ['availability-available-numeral', 'availability-blocked-numeral']) {
    const re = new RegExp(`data-testid="${testId}"[\\s\\S]{0,60}?className="([^"]*)"`);
    const match = source.match(re);
    expect(match, `span with data-testid="${testId}" not found`).not.toBeNull();
    expect(match![1]).toMatch(/\bfont-mono\b/);
  }
});

test('AC1: the summary <li> wrappers keep text-xl font-bold and do not carry font-mono themselves', () => {
  const source = readSource();

  const liMatches = [...source.matchAll(/<li className="([^"]*)">\s*\{t\.rich\('summary(Available|Blocked)Count'/g)];
  expect(liMatches.length).toBe(2);
  for (const match of liMatches) {
    expect(match[1]).toMatch(/\btext-xl\b/);
    expect(match[1]).toMatch(/\bfont-bold\b/);
    expect(match[1]).not.toMatch(/\bfont-mono\b/);
  }
});

// --- AC2: row-date span is font-mono; badge span is byte-identical to CHORE-19

test('AC2: the per-row Sunday date span uses font-mono', () => {
  const source = readSource();
  expect(source).toMatch(/<span className="font-mono">\{formattedDate\}<\/span>/);
});

test('AC2/AC4: the blocked-state badge span className ternary is byte-identical to its CHORE-19-shipped value (no font-mono)', () => {
  const source = readSource();

  // The exact, unmodified CHORE-19 ternary — Review should diff this
  // literally against the shipped version to confirm no incidental touch.
  const expectedBadgeSnippet =
    "isBlocked\n" +
    "                        ? 'rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground'\n" +
    "                        : 'font-medium'";
  expect(source).toContain(expectedBadgeSnippet);
  expect(expectedBadgeSnippet).not.toMatch(/font-mono/);
});

// --- AC3: next-blocked date span is font-mono; enclosing <p> is not

test('AC3: the availability-next-blocked-date span uses font-mono', () => {
  const source = readSource();
  const re = /data-testid="availability-next-blocked-date"[\s\S]{0,60}?className="([^"]*)"/;
  const match = source.match(re);
  expect(match, 'span with data-testid="availability-next-blocked-date" not found').not.toBeNull();
  expect(match![1]).toMatch(/\bfont-mono\b/);
});

test('AC3: the summaryNextUnavailable <p> wrapper does not itself carry font-mono', () => {
  const source = readSource();

  const pMatch = source.match(/<p className="([^"]*)">\s*\{t\.rich\('summaryNextUnavailable'/);
  expect(pMatch, 'summaryNextUnavailable <p> wrapper not found').not.toBeNull();
  expect(pMatch![1]).not.toMatch(/\bfont-mono\b/);
});
