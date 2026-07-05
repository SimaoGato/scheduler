/**
 * e2e/i18n-key-parity.spec.ts — BUGFIX: en/pt-PT translation key parity.
 *
 * STORY-17 added Nav.roles + the RoleManagement namespace to
 * messages/pt-PT.json only, so /en/admin/roles rendered raw key names
 * ("RoleManagement.title", "Nav.roles", …) in production. next-intl falls
 * back to the key name when a locale file lacks a key, so a parity gap
 * ships silently — no build or lint failure.
 *
 * This is a CI-safe filesystem check (fs.readFileSync), not a browser-driven
 * Playwright test, per the dark-mode.spec.ts precedent: it must hold for
 * every current and future namespace, not just the pages a browser test
 * happens to visit.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MESSAGES_DIR = join(__dirname, '..', 'messages');

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function loadKeys(locale: string): Set<string> {
  const raw = readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8');
  return new Set(flattenKeys(JSON.parse(raw)));
}

test('every pt-PT message key exists in en.json', () => {
  const ptKeys = loadKeys('pt-PT');
  const enKeys = loadKeys('en');
  const missingFromEn = [...ptKeys].filter((key) => !enKeys.has(key)).sort();
  expect(missingFromEn).toEqual([]);
});

test('every en message key exists in pt-PT.json', () => {
  const ptKeys = loadKeys('pt-PT');
  const enKeys = loadKeys('en');
  const missingFromPt = [...enKeys].filter((key) => !ptKeys.has(key)).sort();
  expect(missingFromPt).toEqual([]);
});
