/**
 * e2e/i18n-neutral-copy.spec.ts — STORY-30: guard against the AC4
 * "default available unless explicitly blocked" data-model misrepresentation
 * risk in future copy edits.
 *
 * AC4's Technical notes flag this as the single most important design
 * decision in the story: `blocked_dates` absence means "fully available,"
 * not "hasn't engaged with the feature." A naive future copy edit (e.g.
 * relabeling `Home.adminBlocksNext30Days` to something like "N pessoas com
 * disponibilidade pendente") would silently reintroduce that
 * misrepresentation without failing any build/lint/type check.
 *
 * This is a CI-safe filesystem check (fs.readFileSync), not a browser-driven
 * Playwright test, per e2e/i18n-key-parity.spec.ts's precedent: it asserts a
 * property of the copy itself, independent of any live rendered count.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MESSAGES_DIR = join(__dirname, '..', 'messages');

function loadMessages(locale: string): Record<string, Record<string, string>> {
  const raw = readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8');
  return JSON.parse(raw);
}

// Keys whose copy describes a count derived from the "default available
// unless explicitly blocked" data model (STORY-25) and must never be
// phrased as a warning/incompleteness signal.
const GUARDED_KEYS = [
  'Home.adminBlocksNext30Days',
  'Home.memberSummaryNoUpcomingBlocks',
  'Home.memberSummaryBlockedCount',
  'Home.memberSummaryAvailableCount',
  // CHORE-19 (PR #55 review SUGGESTION): the availability page summary Card
  // shares the same "absence-of-row means default-available" data model as
  // the Home page's STORY-30 summary — guard it the same way.
  'Availability.summaryNoUpcomingBlocks',
] as const;

const FORBIDDEN_SUBSTRINGS_PT = ['aviso', 'atenção', 'pendente', 'falta'];
const FORBIDDEN_SUBSTRINGS_EN = ['warning', 'pending', 'missing'];

function getByPath(messages: Record<string, unknown>, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, segment) => {
    if (acc !== null && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, messages);
  if (typeof value !== 'string') {
    throw new Error(`expected a string at messages path "${path}", got: ${JSON.stringify(value)}`);
  }
  return value;
}

test('AC4 guarded pt-PT copy avoids warning-toned substrings', () => {
  const messages = loadMessages('pt-PT');
  for (const path of GUARDED_KEYS) {
    const text = getByPath(messages, path).toLowerCase();
    for (const forbidden of FORBIDDEN_SUBSTRINGS_PT) {
      expect(text, `${path} must not contain "${forbidden}": ${text}`).not.toContain(forbidden);
    }
  }
});

test('AC4 guarded en copy avoids warning-toned substrings', () => {
  const messages = loadMessages('en');
  for (const path of GUARDED_KEYS) {
    const text = getByPath(messages, path).toLowerCase();
    for (const forbidden of FORBIDDEN_SUBSTRINGS_EN) {
      expect(text, `${path} must not contain "${forbidden}": ${text}`).not.toContain(forbidden);
    }
  }
});
