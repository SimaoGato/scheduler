/**
 * e2e/link-picker-custom-dropdown.spec.ts — BUGFIX-05: Replace native
 * `<select>` link-account picker with a custom-styled (Radix `Select`)
 * dropdown, closing the Windows Chrome/Edge dark-mode popup contrast gap
 * BUGFIX-04's `color-scheme` CSS fix could not close (see that story's Bug
 * section: Chromium delegates native `<select>` *popup* background painting
 * differently per platform, and does not consistently follow `color-scheme`
 * on Windows — a genuine browser limitation, not an app bug).
 *
 * The picker in components/PeopleTable.tsx ("Ligar conta" flow) is now built
 * on shadcn/ui's Select (components/ui/select.tsx), wrapping
 * `@radix-ui/react-select` (installed via `radix-ui` meta-package, v2.3.3).
 * Radix renders its popup as an ordinary (Portal-rendered, but still
 * same-document) DOM node fully themed by the app's own Tailwind CSS
 * variables — no native OS popup involved, so this class of bug cannot
 * recur here. This also means, unlike BUGFIX-04, the popup's rendered
 * pixels are now reachable via Playwright's `getComputedStyle()` — closing
 * the automation gap BUGFIX-04's QA stage flagged.
 *
 * AC coverage:
 *   CI-safe, no auth:
 *     - Static-source regression: components/PeopleTable.tsx's link picker
 *       call site uses the new Select/SelectTrigger/SelectContent/SelectItem
 *       primitives (not a native `<select>`), with `position="popper"`
 *       explicit on SelectContent, and the STORY-20/BUGFIX-04
 *       `data-testid`/`aria-label` wiring preserved. This mirrors the
 *       BUGFIX-02 fallback pattern (read the source file directly, assert a
 *       single full-string regex) for coverage that doesn't require a live
 *       admin session.
 *
 *   E2E_WITH_AUTH-gated (require a real Supabase admin session — see
 *   e2e/admin-link-person.spec.ts's file header for the manual-login-based
 *   setup this project uses; there is no storageState/global-setup
 *   auth fixture in this repo):
 *     - AC1: with theme forced to dark, the open popup's every option
 *       (SelectContent background vs. each SelectItem's text color) passes a
 *       WCAG AA contrast-ratio check (>= 4.5:1 for normal-size text). No
 *       contrast-ratio helper exists elsewhere in this repo (confirmed
 *       during story refinement — see e2e/dark-mode.spec.ts's own header
 *       comment) so a small local WCAG relative-luminance/contrast-ratio
 *       function is defined below, scoped to this file only.
 *     - AC2: same mechanism, light theme (no regression from the previous
 *       native-`<select>` implementation).
 *     - AC3: keyboard-only interaction — focus the trigger (no mouse),
 *       open with Enter, ArrowDown to move the highlighted option
 *       (`data-highlighted`), Enter to select it (asserted via the
 *       trigger's displayed value), then reopen and Escape to confirm the
 *       popup closes with the previous selection unchanged.
 *     - AC4: 44px tap target + `pm-link-select-{id}` testid + exact
 *       `aria-label` on the new `SelectTrigger` (adapted from the
 *       equivalent check retired from e2e/link-picker-color-scheme.spec.ts).
 *     - AC5 is covered by e2e/admin-link-person.spec.ts (updated in this
 *       same story for the new DOM shape, not duplicated here).
 *     - AC6 (automated half): closed trigger has `role="combobox"`,
 *       `aria-expanded="false"`, `aria-autocomplete="none"`, and the
 *       preserved `aria-label`; opening flips `aria-expanded` to `"true"`
 *       and populates `aria-controls`; the open content has
 *       `role="listbox"` with an `id` matching the trigger's
 *       `aria-controls`; each item has `role="option"`. Per installed
 *       `@radix-ui/react-select@2.3.3` source
 *       (node_modules/@radix-ui/react-select/dist/index.mjs), `aria-selected`
 *       is `isSelected && isFocused` — Radix ties it to *DOM focus*, not
 *       merely value-matching. Radix auto-focuses the item matching the
 *       current value when the content opens, so this is still exactly
 *       observable (and asserted below) at the moment of opening: reopen
 *       after selecting a value and the matching item's `aria-selected` is
 *       `"true"` while the rest are `"false"`. This was verified against
 *       the real installed package source during implementation, per the
 *       plan's explicit instruction not to assume the contract.
 *     - AC6 (manual half — mandatory, not automatable): see this story's
 *       "Manual verification" section in
 *       docs/stories/BUGFIX-05-link-picker-custom-dropdown.md for the
 *       screen-reader spot-check record.
 *
 *   Manual verification only (recorded in the story file, not automatable
 *   from this environment — see story file for details/gaps):
 *     - Windows Chrome/Edge desktop, light + dark theme (the exact
 *       platform/browser that motivated this story).
 *     - Mobile Chrome/Safari touch spot-check at 375px.
 *     - Empty-`unlinkedUsers` graceful degradation.
 *     - Long `display_name`/email overflow behavior.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// --- WCAG relative-luminance / contrast-ratio helper ----------------------
// New local infrastructure for this file (confirmed during refinement: no
// reusable contrast-ratio helper exists elsewhere in this repo). Standard
// WCAG 2.x formula: relative luminance from sRGB channels, then
// (L1 + 0.05) / (L2 + 0.05) with L1 the lighter of the two.

function parseRgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) throw new Error(`Unparseable computed color: "${value}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(colorA: string, colorB: string): number {
  const La = relativeLuminance(parseRgb(colorA));
  const Lb = relativeLuminance(parseRgb(colorB));
  const lighter = Math.max(La, Lb);
  const darker = Math.min(La, Lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const WCAG_AA_NORMAL_TEXT_MIN_RATIO = 4.5;

// ---------------------------------------------------------------------------
// CI-safe: static-source regression (no browser/auth required)
// ---------------------------------------------------------------------------

test('static: PeopleTable.tsx link picker uses the Select primitives (not native <select>), position="popper", testid/aria-label preserved', () => {
  const sourcePath = join(process.cwd(), 'components', 'PeopleTable.tsx');
  const source = readFileSync(sourcePath, 'utf8');

  expect(source).toMatch(/<Select\b[\s\S]*?value=\{selectedUserId\}[\s\S]*?onValueChange=\{setSelectedUserId\}/);
  expect(source).toMatch(/<SelectContent\b[\s\S]*?position="popper"/);
  expect(source).toMatch(/<SelectTrigger\b[\s\S]*?data-testid=\{`pm-link-select-\$\{person\.id\}`\}[\s\S]*?aria-label=\{t\('linkPickerLabel'\)\}/);
  // Old native <select> for the link picker must be gone (a different
  // <select> element is not otherwise used in this file).
  expect(source).not.toMatch(/<select\b/);
});

// ---------------------------------------------------------------------------
// E2E_WITH_AUTH-gated: real interaction against the "Ligar conta" picker.
// Fixture helpers mirror e2e/admin-link-person.spec.ts's established
// pattern (duplicated locally per this project's self-contained-spec-file
// convention).
// ---------------------------------------------------------------------------

function loadEnvLocalFallback(): void {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
}
loadEnvLocalFallback();

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function uniqueSuffix(testInfo: TestInfo): string {
  return `w${testInfo.workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface FixtureRecord {
  id: string;
  name: string;
}

async function createPerson(page: Page, name: string): Promise<FixtureRecord> {
  const response = await page.request.post('/api/admin/people', { data: { name } });
  expect(response.status()).toBe(201);
  return (await response.json()) as FixtureRecord;
}

async function deletePerson(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/admin/people/${id}`);
}

async function createThrowawayLinkedUser(
  client: SupabaseClient,
  label: string
): Promise<{ id: string; displayName: string; email: string }> {
  const email = `bugfix05-qa-${label}-${randomUUID()}@example.invalid`;
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomUUID(),
  });

  if (error || !data.user) {
    throw new Error(`Failed to create throwaway user fixture "${label}": ${error?.message}`);
  }

  const userId = data.user.id;
  const displayName = `BUGFIX-05 QA ${label}`;
  const { error: usersError } = await client.from('users').insert({
    id: userId,
    email,
    display_name: displayName,
    role: 'member',
  });

  if (usersError) {
    throw new Error(`Failed to insert public.users row for "${label}" fixture: ${usersError.message}`);
  }

  return { id: userId, displayName, email };
}

async function deleteThrowawayLinkedUser(client: SupabaseClient, userId: string): Promise<void> {
  await client.auth.admin.deleteUser(userId);
}

// Opens the picker for a given person row via a real (mouse) click on the
// trigger — used by AC1/AC2/AC4/AC6 tests where the *opening* mechanism
// itself isn't under test (only the popup's rendered state is).
async function openPickerByClick(page: Page, personId: string, personName: string) {
  const row = page.locator('tr', { hasText: personName });
  await row.getByTestId(`pm-link-${personId}`).click();
  const trigger = row.getByTestId(`pm-link-select-${personId}`);
  await trigger.click();
  return trigger;
}

test.describe('BUGFIX-05: link picker custom dropdown (auth-gated)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in e2e/admin-link-person.spec.ts header.');

  test('AC1: dark mode — SelectContent background vs. each SelectItem text passes WCAG AA contrast', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const personName = `BUGFIX-05 QA AC1 Person (${suffix})`;
    const person = await createPerson(page, personName);
    const userA = await createThrowawayLinkedUser(client, `ac1-a-${suffix}`);
    const userB = await createThrowawayLinkedUser(client, `ac1-b-${suffix}`);

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('theme', 'dark');
      });
      await page.goto('/pt-PT/admin/people');
      await expect(page.locator('html')).toHaveClass(/dark/);

      const trigger = await openPickerByClick(page, person.id, personName);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible();
      const backgroundColor = await listbox.evaluate((el) => getComputedStyle(el).backgroundColor);

      const options = page.getByRole('option');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);

      for (let i = 0; i < optionCount; i += 1) {
        const optionColor = await options.nth(i).evaluate((el) => getComputedStyle(el).color);
        const ratio = contrastRatio(optionColor, backgroundColor);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
      }

      // Both fixture users must actually be present as options (not just
      // "some options exist") so this test can't pass vacuously.
      await expect(page.getByRole('option', { name: userA.displayName })).toBeVisible();
      await expect(page.getByRole('option', { name: userB.displayName })).toBeVisible();
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, userA.id);
      await deleteThrowawayLinkedUser(client, userB.id);
    }
  });

  test('AC2: light mode — same contrast mechanism, no regression', async ({ page }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const personName = `BUGFIX-05 QA AC2 Person (${suffix})`;
    const person = await createPerson(page, personName);
    const user = await createThrowawayLinkedUser(client, `ac2-${suffix}`);

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('theme', 'light');
      });
      await page.goto('/pt-PT/admin/people');
      await expect(page.locator('html')).not.toHaveClass(/dark/);

      const trigger = await openPickerByClick(page, person.id, personName);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible();
      const backgroundColor = await listbox.evaluate((el) => getComputedStyle(el).backgroundColor);

      const options = page.getByRole('option');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);

      for (let i = 0; i < optionCount; i += 1) {
        const optionColor = await options.nth(i).evaluate((el) => getComputedStyle(el).color);
        const ratio = contrastRatio(optionColor, backgroundColor);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_MIN_RATIO);
      }

      await expect(page.getByRole('option', { name: user.displayName })).toBeVisible();
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, user.id);
    }
  });

  test('AC3: keyboard-only navigation — ArrowDown highlights, Enter selects, Escape closes without changing selection', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const personName = `BUGFIX-05 QA AC3 Person (${suffix})`;
    const person = await createPerson(page, personName);
    const userA = await createThrowawayLinkedUser(client, `ac3-a-${suffix}`);
    const userB = await createThrowawayLinkedUser(client, `ac3-b-${suffix}`);

    try {
      await page.goto('/pt-PT/admin/people');
      const row = page.locator('tr', { hasText: personName });
      await row.getByTestId(`pm-link-${person.id}`).click();

      const trigger = row.getByTestId(`pm-link-select-${person.id}`);
      await trigger.focus();
      await page.keyboard.press('Enter'); // open via keyboard, no mouse
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('listbox')).toBeVisible();

      // ArrowDown repeatedly until some option is highlighted
      // (data-highlighted). Loop guards against Radix's initial focus
      // landing on the first item vs. requiring one ArrowDown press,
      // depending on whether a value is already selected.
      let highlighted = page.locator('[role="option"][data-highlighted]');
      for (let i = 0; i < 5 && (await highlighted.count()) === 0; i += 1) {
        await page.keyboard.press('ArrowDown');
        highlighted = page.locator('[role="option"][data-highlighted]');
      }
      await expect(highlighted).toHaveCount(1);

      // Visually distinguishable (not just DOM-attribute presence): confirm
      // the highlighted item's actual rendered background/text colors
      // differ measurably from a non-highlighted item's. Asserting only
      // `data-highlighted`'s presence would not catch a regression that
      // silently dropped `focus:bg-accent`/`focus:text-accent-foreground`
      // from `SelectItem` (components/ui/select.tsx) while the attribute
      // itself stayed present.
      const nonHighlightedOption = page.locator('[role="option"]:not([data-highlighted])').first();
      await expect(nonHighlightedOption).toBeVisible();
      const [highlightedBackground, nonHighlightedBackground] = await Promise.all([
        highlighted.evaluate((el) => getComputedStyle(el).backgroundColor),
        nonHighlightedOption.evaluate((el) => getComputedStyle(el).backgroundColor),
      ]);
      expect(highlightedBackground).not.toBe(nonHighlightedBackground);
      // Reuse the WCAG contrast helper as a "measurably different" check
      // between the two backgrounds (not a text-on-background AA check —
      // just confirming the color values are genuinely distinct, not a
      // rounding/anti-aliasing artifact).
      expect(contrastRatio(highlightedBackground, nonHighlightedBackground)).toBeGreaterThan(1.1);

      const highlightedText = await highlighted.textContent();

      await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toContainText(highlightedText!.trim());

      // Reopen, move the highlight to a genuinely *different* option than
      // the confirmed selection, THEN press Escape. Radix auto-focuses the
      // already-selected item on open, so pressing Escape immediately
      // (without first moving the highlight) can't distinguish "selection
      // unchanged after Escape" (correct) from "Escape re-committed the
      // already-highlighted item" (a hypothetical regression) — both would
      // leave the trigger showing the same text. Moving the highlight first
      // makes this assertion capable of catching a real regression.
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('ArrowDown');
      const highlightedAfterReopen = page.locator('[role="option"][data-highlighted]');
      await expect(highlightedAfterReopen).toHaveCount(1);
      const highlightedAfterReopenText = (await highlightedAfterReopen.textContent())!.trim();
      // Sanity: the ArrowDown must have actually moved the highlight to a
      // different option than the confirmed selection — with only two
      // fixture users in the list, one ArrowDown press from the
      // auto-focused (already-selected) item always lands on the other one.
      expect(highlightedAfterReopenText).not.toBe(highlightedText!.trim());

      await page.keyboard.press('Escape');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      // The selection must still be the ORIGINAL confirmed value, not the
      // newly-highlighted-but-never-confirmed option.
      await expect(trigger).toContainText(highlightedText!.trim());
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, userA.id);
      await deleteThrowawayLinkedUser(client, userB.id);
    }
  });

  test('AC4: regression — 44px tap target, pm-link-select testid, and aria-label wiring unchanged on the new SelectTrigger', async ({
    page,
  }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const personName = `BUGFIX-05 QA AC4 Person (${suffix})`;
    const person = await createPerson(page, personName);

    try {
      await page.goto('/pt-PT/admin/people');
      const row = page.locator('tr', { hasText: personName });
      await row.getByTestId(`pm-link-${person.id}`).click();

      const trigger = row.getByTestId(`pm-link-select-${person.id}`);
      await expect(trigger).toBeVisible();

      const box = await trigger.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);

      // Extracted from messages/pt-PT.json's PeopleManagement.linkPickerLabel.
      await expect(trigger).toHaveAttribute('aria-label', 'Escolher conta a ligar');
    } finally {
      await deletePerson(page, person.id);
    }
  });

  test('AC6 (automated): trigger combobox contract, content listbox, item option/aria-selected', async ({
    page,
  }, testInfo) => {
    const client = serviceClient();
    const suffix = uniqueSuffix(testInfo);
    const personName = `BUGFIX-05 QA AC6 Person (${suffix})`;
    const person = await createPerson(page, personName);
    const user = await createThrowawayLinkedUser(client, `ac6-${suffix}`);

    try {
      await page.goto('/pt-PT/admin/people');
      const row = page.locator('tr', { hasText: personName });
      await row.getByTestId(`pm-link-${person.id}`).click();

      const trigger = row.getByTestId(`pm-link-select-${person.id}`);
      await expect(trigger).toBeVisible();

      // Closed state.
      await expect(trigger).toHaveAttribute('role', 'combobox');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveAttribute('aria-autocomplete', 'none');
      // Extracted from messages/pt-PT.json's PeopleManagement.linkPickerLabel.
      await expect(trigger).toHaveAttribute('aria-label', 'Escolher conta a ligar');

      // Open state.
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const controlsId = await trigger.getAttribute('aria-controls');
      expect(controlsId).toBeTruthy();

      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible();
      await expect(listbox).toHaveAttribute('id', controlsId!);

      const option = page.getByRole('option', { name: user.displayName });
      await expect(option).toBeVisible();
      // Nothing selected yet — the target option must not be marked selected.
      await expect(option).toHaveAttribute('aria-selected', 'false');

      await option.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      // Reopen: Radix auto-focuses the item matching the current value on
      // open, so aria-selected (isSelected && isFocused per the installed
      // @radix-ui/react-select@2.3.3 source) is observably "true" for the
      // matching item at this point.
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const reopenedOption = page.getByRole('option', { name: user.displayName });
      await expect(reopenedOption).toHaveAttribute('aria-selected', 'true');
    } finally {
      await deletePerson(page, person.id);
      await deleteThrowawayLinkedUser(client, user.id);
    }
  });
});
