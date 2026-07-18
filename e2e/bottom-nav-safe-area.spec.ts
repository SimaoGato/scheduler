/**
 * e2e/bottom-nav-safe-area.spec.ts — CHORE-22
 *
 * CI-safe, non-auth, static/filesystem check (BUGFIX-02 pattern): reads the
 * source files directly and asserts the `env(safe-area-inset-bottom)` calc()
 * is present in both the content wrapper's bottom padding
 * (app/[locale]/(app)/layout.tsx) and the bottom bar's own bottom padding
 * (components/BottomNav.tsx). Real device/notch rendering is a manual
 * verification step (documented in the story file), not automatable in
 * headless Chromium (BUGFIX-05 precedent: OS-delegated rendering needs a
 * real spot-check).
 *
 * Also guards the Tailwind v4 arbitrary-value calc() syntax gotcha: literal
 * spaces must be encoded as `_` around `+`/`-` operators
 * (`calc(110px_+_env(...))`, not `calc(110px+env(...))`, which is invalid
 * CSS that Tailwind either drops or emits broken).
 *
 * AC coverage: AC4 (part 1 of the CHORE-13 "invisible mechanism" split — the
 * scroll-to-bottom / bounding-box assertion is part 2, in
 * e2e-integration/header-nav-mobile-overflow.spec.ts).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const LAYOUT_PATH = join(process.cwd(), 'app', '[locale]', '(app)', 'layout.tsx');
const BOTTOM_NAV_PATH = join(process.cwd(), 'components', 'BottomNav.tsx');

// Note: the negative ("invalid, no-whitespace variant") check is deliberately
// NOT asserted here — both source files' doc comments legitimately quote that
// exact invalid string as a documented gotcha, which would make a naive
// `not.toMatch` guard false-negative on the comment text itself, not real
// code. The compiled-CSS check (see this story's manual verification notes)
// is the authoritative proof that the actual emitted class is valid; this
// test only proves the correct arbitrary-value class is present in the
// `className` source.

test('AC4: the content wrapper applies bottom padding with a valid env(safe-area-inset-bottom) calc()', () => {
  const source = readFileSync(LAYOUT_PATH, 'utf8');
  expect(source).toMatch(/className="flex-1 pb-\[calc\(110px_\+_env\(safe-area-inset-bottom\)\)\] sm:pb-0"/);
});

test('AC4: the bottom bar applies its own bottom padding with a valid env(safe-area-inset-bottom) calc()', () => {
  const source = readFileSync(BOTTOM_NAV_PATH, 'utf8');
  expect(source).toMatch(/pb-\[calc\(8px_\+_env\(safe-area-inset-bottom\)\)\]/);
});
