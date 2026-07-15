/**
 * e2e/home-page-cards.spec.ts — CHORE-18: Redesign home page visual design
 * (Card-based layout).
 *
 * CI-safe static-source guard (smoke suite, no auth) mirroring the
 * card-ui-primitive.spec.ts / BUGFIX-02 static-source-guard pattern. Proves
 * that `app/[locale]/(app)/page.tsx` imports the Card family from
 * CHORE-17's primitive and that the three summary/quick-links testids are
 * rendered on a `<Card` element (not a bare `<div`), without needing a live
 * auth-backed render.
 *
 * AC coverage:
 *   - AC1: admin-team-summary and admin-quick-links each render on a `<Card`
 *     element (static proof; live proof is in e2e-integration/home.spec.ts).
 *   - AC2: member-availability-summary renders on a `<Card` element.
 *   - AC6: this file itself is the "new visual-regression assertion" the
 *     story's AC6 requires.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const PAGE_SOURCE_PATH = join(process.cwd(), 'app', '[locale]', '(app)', 'page.tsx');

function readPageSource(): string {
  return readFileSync(PAGE_SOURCE_PATH, 'utf8');
}

test('imports Card, CardHeader, CardTitle, CardContent from @/components/ui/card', () => {
  const source = readPageSource();

  expect(source).toMatch(
    /import\s*\{[^}]*Card[^}]*\}\s*from\s*['"]@\/components\/ui\/card['"]/
  );

  // Extract the import specifier list to assert each named import precisely
  // (avoids a false pass from a loose "Card" substring match).
  const importMatch = source.match(
    /import\s*\{([^}]*)\}\s*from\s*['"]@\/components\/ui\/card['"]/
  );
  expect(importMatch).not.toBeNull();
  const specifiers = importMatch![1];

  for (const name of ['Card', 'CardHeader', 'CardTitle', 'CardContent']) {
    expect(specifiers).toMatch(new RegExp(`\\b${name}\\b`));
  }
});

test('admin-team-summary, admin-quick-links, and member-availability-summary render on a <Card element', () => {
  const source = readPageSource();

  for (const testid of [
    'admin-team-summary',
    'admin-quick-links',
    'member-availability-summary',
  ]) {
    // The <Card element carrying this data-testid must appear as
    // `<Card ... data-testid="<testid>"` (attribute order in this codebase
    // consistently puts data-testid after the element name, within the same
    // opening tag — allow any attributes/whitespace in between, but require
    // the opening tag to start with `<Card` specifically, not a bare `<div`).
    const re = new RegExp(`<Card\\b[^>]*data-testid="${testid}"`, 's');
    expect(source, `expected data-testid="${testid}" on a <Card element`).toMatch(re);
  }
});
