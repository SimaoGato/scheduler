# CHORE-29: Redesign Roles page as card-list rows (fixes 375px overflow)
Epic: maintenance
Priority: standard — includes a real, ticketless pre-existing mobile
overflow bug found during CHORE-24 QA; part of the pre-EPIC-04 UI push
Status: draft
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: CHORE-21 (Team page redesign — same row pattern, land in either
order but reuse the same visual idiom), updated mockup in
`App design refinement/Escala Dashboard.dc.html` (`isRoles` block,
`roleRows`), STORY-17 (roles CRUD), STORY-19 (in-use deletion guard)

## Task
As an Admin on the Funções page (`/admin/roles`), I want each role shown
as a card-style list row (name + meta line, slots badge, pill actions)
instead of the current table, so the page matches the new design language
and stops overflowing horizontally on phones.

## Context
Two drivers:
1. **Known bug with no ticket**: CHORE-24's QA found pre-existing
   horizontal page overflow on `/pt-PT/admin/roles` at 375px
   (`scrollWidth` 410–419 vs 375, confirmed on `main` before CHORE-23/24)
   and said "requires a separate BUGFIX ticket … documented here to
   prevent it from being lost during story archival." No ticket was ever
   filed — this chore is that ticket, folded into the redesign the updated
   mockup now specifies for this exact page.
2. **Updated mockup direction**: the `isRoles` block renders each role as
   a bordered card row: role name (display font, bold) with a mono meta
   line underneath ("N people can serve"), a slots badge ("X per Sunday",
   mono pill), and a pill-shaped Edit action on the right.

The mockup's meta line also shows "min level {N}" per role — that concept
does **not** exist in the data model (roles have `default_slots`;
qualification is per-person via `person_role_skills`, STORY-18). Omit the
min-level fragment; render only what the model supports ("N people can
serve" is derivable via the qualified-set query pattern,
`lib/skills/qualified-roles.ts`). Whether a per-role minimum level should
exist is an EPIC-04 data-model question, flagged separately in triage.

## Acceptance criteria
1. Given the Funções page at 375px/390px viewport, when rendered with
   seeded roles (including long pt-PT names), then
   `document.documentElement.scrollWidth` ≤ viewport width — the
   CHORE-24-documented overflow is gone, verified by an automated test.
2. Given the page, when rendered, then each active role appears as a
   card-style row showing: the role name (display font), a meta line with
   the count of people qualified for that role (mono font, correct ICU
   pluralization in both locales), and the per-Sunday slots as a badge
   (mono, pill).
3. Given the existing role management flows (add role with slots, inline
   edit name/slots, remove with the STORY-19 in-use confirm prompt), when
   used in the new layout, then all behave exactly as today — same API
   calls, same optimistic-update and sort behavior, same error messages —
   and every existing `data-testid` in `RoleTable.tsx` is preserved so
   STORY-17/19 e2e test **coverage** continues to pass. "Preserved" means:
   zero change to any assertion, any `data-testid`, or any tested behavior.
   The row-container tag selectors in `e2e/role-management.spec.ts` and the
   roles-only sections of `e2e/deletion-guard.spec.ts` (currently
   `page.locator('tr', { hasText })`) are mechanically updated to match the
   new row element (see Implementation Plan, Design decision 1) — this is
   a pure selector-tag swap with no change to what is asserted. The
   people-only sections of `e2e/deletion-guard.spec.ts` (`PeopleTable.tsx`
   is out of scope for this chore) are untouched.
4. Given all interactive controls in the new layout, when measured, then
   each keeps a ≥44px tap target, and the add/edit input fields keep their
   distinct accessible labels (WCAG SC 1.3.1, STORY-17 pattern).
5. Given light and dark theme, when rendered, then all new text/background
   pairs meet WCAG AA 4.5:1 using existing verified tokens (no new colors).
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Any roles API/validation/data-model change — including per-role minimum
  level (EPIC-04 decision).
- The qualified-people count becoming a link/drill-down — display only.
- Team and Users pages — CHORE-21 and CHORE-30 respectively; reuse the
  same row idiom but keep the PRs independent.

## Technical notes
- Primary files: `components/RoleTable.tsx` (likely renamed conceptually
  to a list, but keep the exported name/testids stable),
  `app/[locale]/(app)/admin/roles/page.tsx` (may need to fetch qualified
  counts server-side alongside the roles list — one aggregate query, not
  N+1; follow the STORY-30 metric-scope-consistency rule: count only
  active people, `!inner` join on active roles).
- The count text needs new i18n keys in **both** locale files with ICU
  plural (`{count, plural, one {…} other {…}}`).
- The inline edit mode currently relies on the HTML `form`-attribute
  association pattern (STORY-14/17) — a non-table layout can simplify
  this, but keep Enter-to-submit working.
- Visually render (dev server) both themes at 375px and 1280px, including
  the edit mode and in-use-delete confirm states, before marking done.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Grounding notes (from exploration)

- **CHORE-21 (Team page) has NOT landed** — `Status: draft`, not in
  `docs/stories/done/`, no commits found. There is no shared card-row
  component to reuse yet; this chore establishes the row idiom for the
  first time (concretely, in code — CHORE-21/CHORE-30 will follow it, not
  the other way around, if this one lands first).
- `components/RoleTable.tsx` is a `'use client'` component with real state
  (`rows`, `addName/addSlots`, `editingId/editName/editSlots`, `loadingId`,
  `errorMessage`, `confirmingRemoveId/confirmMessage`) and existing STORY-19
  concurrent-row-blocking logic (`blockedByOtherConfirm`). None of that
  logic changes — only the JSX/markup around it.
- `lib/skills/qualified-roles.ts` currently exports one function,
  `qualifiedRolesForPerson(client, personId)` (person → their qualified
  active roles). It does **not** already provide the reverse direction
  (role → count of qualified active people) that this story needs — a new
  function must be added.
- `public.person_role_skills` has a **composite PRIMARY KEY
  `(person_id, role_id)`** (migration `20260705000002`), so counting rows
  is equivalent to counting distinct qualified people per role — no risk of
  double-counting a person for the same role.
- The mockup's `isRoles`/`roleRows` block (`App design refinement/Escala
  Dashboard.dc.html` lines 249-274, 638-650) renders `<ul><li>` rows with:
  name (display font, bold) + mono meta line ("N people can serve · min
  level N" — **omit the min-level fragment**, out of scope per Context),
  a mono pill slots badge, and a pill Edit button. No column headers are
  shown in the mockup.
- **Material tension found during exploration, resolved below (Design
  decision 1, revised after Challenge cycle 1):** the existing
  STORY-17/STORY-19 e2e suites (`e2e/role-management.spec.ts`,
  `e2e/deletion-guard.spec.ts`) use `page.locator('tr', { hasText: ... })`
  and `row.locator('input').nth(0|1)` — literal HTML-tag and DOM-position
  dependencies, not just `data-testid` dependencies. Exact accounting:
  - `e2e/role-management.spec.ts` — **13** `page.locator('tr', {hasText})`
    occurrences (lines 83, 84, 94, 118, 166, 195, 208, 210, 218, 228, 230,
    232, 249) and **3** `row.locator('input').nth(0|1)` occurrences (lines
    197, 212, 213). The entire file is roles-only.
  - `e2e/deletion-guard.spec.ts` — **8** roles-only `tr` occurrences
    (lines 283, 284, 300, 311, 319, 335, 352, 353, inside the
    `rm-`/`roleName`-scoped tests spanning lines 263-376) and **5**
    people-only `tr` occurrences (lines 452, 453, 478, 485, 502, inside the
    `pm-`/`personName`-scoped test spanning lines 432-505) that belong to
    `PeopleTable.tsx`, which this chore does **not** touch and must not
    edit.
  - No `getByRole('table'|'row'|'cell')` or column-header text
    (`columnName`/`columnSlots`) assertions exist anywhere, which keeps the
    blast radius to exactly the 21 role-scoped `tr`/`input().nth()` lines
    above.
  - Cycle-1 plan proposed keeping a `<table>` with one `<td>` per row to
    avoid touching these lines at all. Challenge correctly flagged that
    this had no concrete CSS mechanism for the mockup's actual per-row card
    look (`background`, `border`, `border-radius`, 10px inter-row gaps) —
    `margin` does not apply to `<tr>`/`<td>`, and the only table-native gap
    mechanism, `border-spacing` on the `<table>`, also adds spacing above
    the first row and below the last row that the mockup's `<ul>` `gap`
    does not have, which would need a hacky negative-margin/overflow
    correction to hide. **Revised decision: commit to `<ul><li>` now**
    (Design decision 1 below), and fold the 21-line mechanical selector
    update into this story's implementation steps as first-class scope,
    not a reactive fallback discovered mid-implementation.

### Design decisions

1. **Commit to `<ul><li>` as the row markup** (revised after Challenge
   cycle 1 — see the grounding note above for why the `<table>`-with-one-
   column alternative was rejected). Concrete structure, matching the
   mockup's `listRow` style (`App design refinement/Escala
   Dashboard.dc.html` lines 559-563: `background: t.card`, `border: 1.5px
   solid`, `borderRadius: 10`, `padding: 14px 16px`, `<ul>` `gap: 10px`)
   with existing Tailwind tokens (no new colors, no arbitrary hex/px
   values beyond standard scale steps that already line up with the
   mockup's numbers):
   - Outer list: `<ul className="flex flex-col gap-2.5">` — Tailwind's
     `gap-2.5` is exactly `0.625rem` = 10px, matching the mockup's `<ul>`
     gap exactly, and (unlike `border-spacing` on a table) does **not**
     add any spacing above the first or below the last item.
   - Replace the current outer `<div className="overflow-x-auto rounded-md
     border">` table wrapper entirely — there is no longer one shared
     border around a table; each row supplies its own.
   - Each row: `<li key={role.id} className="rounded-lg border bg-card
     px-4 py-3.5">` — `rounded-lg` (0.5rem) is the closest existing
     Tailwind step to the mockup's 10px radius (no exact-px mockup-parity
     requirement in the ACs); `px-4 py-3.5` = 16px/14px, an exact match to
     the mockup's `padding: '14px 16px'`; `bg-card`/`border` are already
     WCAG-AA-verified tokens (`card`/`card-foreground` is in
     `EXISTING_SEMANTIC_PAIRS`).
   - Inside each `<li>`, a flex row: left side (`min-w-0 flex-1`) holds
     the name (display font, bold) and the mono meta line; right side
     (`flex-shrink-0`) holds the slots badge and the pill Edit / Save-
     Cancel / Confirm-remove controls, using `flex-wrap`/`gap-2` at the
     row level so a very long pt-PT name can wrap onto its own line at
     375px without overflowing (STORY-26/CLAUDE.md flexbox pattern),
     fixing AC1.
   - No `<thead>`/column headers (they don't map to real columns in a
     card-list layout) — no visually-hidden table caption is needed either
     now that this isn't a `<table>`; the page's existing `<h1>{t('title')}</h1>`
     already labels the list for screen readers, so `title` is **not**
     reused a second time here (correction from cycle 1's draft, which
     assumed a `<caption>`).
   - The inline-edit `<form>` wraps the whole `<li>`'s interactive content
     directly (no more STORY-14 `form={editFormId}` attribute-association
     trick — Technical notes call this out as a valid simplification once
     the row is a single container, whether that container is a `<td>` or
     an `<li>`).
   - This is the same list-row idiom `AvailabilityToggleList.tsx` already
     uses (`<ul className="flex flex-col gap-2">` of bordered/rounded
     `<li>`/interactive-row items) — visually and structurally consistent
     with an existing, shipped part of the app, not a one-off pattern.
   - **Required accompanying change, now first-class implementation scope
     (not a fallback)**: update the 21 role-scoped `tr`/`input().nth()`
     lines enumerated in the grounding note above —
     `page.locator('tr', { hasText })` → `page.locator('li', { hasText })`
     in `e2e/role-management.spec.ts` (all 13 lines) and in the
     roles-only sections of `e2e/deletion-guard.spec.ts` (8 of its 13
     `tr` lines; the other 5, in the people-only test, are untouched).
     `row.locator('input').nth(0|1)` lines are unchanged (input DOM order
     — name, then slots — stays the same inside the `<li>`, only the
     parent selector's tag changes). Zero change to any assertion,
     `data-testid`, `toHaveCount`/`toBeVisible`/`toContainText` call, or
     test title — a pure tag-selector swap. See AC3 (Acceptance criteria,
     revised) for the story-level framing of "preserved" under this
     approach.

2. **Qualified-people-count query**: add a new function to
   `lib/skills/qualified-roles.ts` (the file the story's own Technical
   notes point at as the pattern to follow), sibling to
   `qualifiedRolesForPerson`, going the opposite direction:

   ```ts
   export async function qualifiedPeopleCountsByRole(
     client: SupabaseClient,
     roleIds: string[]
   ): Promise<{ data: Map<string, number> | null; error: unknown }> {
     if (roleIds.length === 0) return { data: new Map(), error: null }
     const { data, error } = await client
       .from('person_role_skills')
       .select('role_id, people!inner(is_active)')
       .in('role_id', roleIds)
       .eq('people.is_active', true)
     if (error) return { data: null, error }
     const counts = new Map<string, number>()
     for (const row of data ?? []) {
       counts.set(row.role_id as string, (counts.get(row.role_id as string) ?? 0) + 1)
     }
     return { data: counts, error: null }
   }
   ```

   This is **one aggregate query, not N+1** (STORY-30 pattern: fetch once,
   reduce in JS — Supabase-js has no server-side `GROUP BY`). It counts
   only **active** people (`people!inner(is_active)` + `.eq('people.is_active',
   true)`), matching this story's own scope note and the STORY-30
   metric-scope-consistency rule. Because the `roles` list passed in is
   already filtered to `is_active = true` roles, and counts are looked up
   by role id from the resulting map (defaulting to 0 if absent), a skill
   row belonging to a soft-deleted role is naturally excluded without an
   extra join condition — no caller can forget the filter (same argument
   `qualifiedRolesForPerson`'s doc comment makes for its own direction).
   **Unverified assumption, first thing to check in implementation**: the
   `people!inner(is_active)` embed key is inferred from the FK target
   table name (`person_id` → `people`), not the column prefix; the only
   existing precedent in this codebase (`roles!inner`) happens to have a
   column prefix that matches its table name, so it doesn't prove the
   irregular-plural case works. If PostgREST rejects the embed name,
   fall back to the explicit hint syntax
   `people!person_role_skills_person_id_fkey(is_active)`.

3. **`app/[locale]/(app)/admin/roles/page.tsx`** fetches `roleIds` from the
   already-loaded roles list, calls `qualifiedPeopleCountsByRole`, and
   passes a plain `Record<string, number>` prop (`qualifiedCounts`) into
   `RoleTable` — **not** a change to the shared `RoleRow` type. A role
   added via the existing optimistic-add flow won't have an entry in this
   map; `RoleTable` treats a missing entry as `0`, which is correct (a
   brand-new role has zero qualified people until someone assigns a skill
   on the separate Skills page — STORY-18, out of scope here). This keeps
   `RoleRow` (`types/roles.ts`) untouched, so no Server/Client shared-type
   ripple.

4. **Badge/pill styling reuses existing WCAG-AA-verified tokens only**
   (no new colors, AC5): slots badge = `rounded-full bg-secondary
   text-secondary-foreground px-2 py-0.5 text-xs font-mono font-semibold`
   (mirrors `AvailabilityToggleList`'s existing pill-badge pattern, swaps
   `destructive` for the already-verified `secondary`/`secondary-foreground`
   pair in `EXISTING_SEMANTIC_PAIRS`, `e2e/design-language-foundation.spec.ts`).
   Edit button = existing bordered/hover-accent button styling, restyled
   `rounded-full` instead of `rounded-md` to match the mockup's pill Edit
   button — same `border`/`hover:bg-accent hover:text-accent-foreground`
   tokens already used today, only the corner radius changes. Error/confirm
   banners (`bg-destructive`/`text-destructive-foreground`,
   `bg-warning/10`/`text-warning`) are untouched — already WCAG-AA-verified
   (STORY-19/CHORE-19).

### Affected areas

- **Frontend / UI**: `components/RoleTable.tsx` (markup restructure only;
  state machine, handlers, API calls untouched), row-level card styling,
  tap-target and aria-label preservation.
- **Backend (Server Component / data)**: `app/[locale]/(app)/admin/roles/page.tsx`
  (add one aggregate query call), `lib/skills/qualified-roles.ts` (new
  exported function).
- **i18n**: `messages/pt-PT.json` and `messages/en.json` (new ICU-plural
  keys, both files, key parity enforced by
  `e2e/i18n-key-parity.spec.ts`).
- **Test infra**: new `e2e-integration/roles-card-list.spec.ts` (CI-enforced,
  no `E2E_WITH_AUTH` opt-in — BUGFIX-06 pattern) seeding roles + people +
  `person_role_skills` via `serviceClient()`, using the existing
  `adminPage` fixture.

No auth/data-model/migration changes, no API route changes.

### New i18n keys

Add to **both** `messages/pt-PT.json` and `messages/en.json`, under
`RoleManagement`:

| Key | pt-PT | en |
|---|---|---|
| `peopleCanServeCount` | `"{count, plural, one {# pessoa pode servir} other {# pessoas podem servir}}"` | `"{count, plural, one {# person can serve} other {# people can serve}}"` |
| `slotsPerSundayBadge` | `"{count, plural, one {# vaga por domingo} other {# vagas por domingo}}"` | `"{count, plural, one {# slot per Sunday} other {# slots per Sunday}}"` |

`columnName`/`columnSlots` become unused once the `<thead>`/`<table>` is
removed (Design decision 1) — per CLAUDE.md's i18n key hygiene rule
("only add keys explicitly consumed"; orphaned keys are dead weight),
**remove** both keys from both locale files in the same diff rather than
leaving them behind. (`title`, `slotsPlaceholder`, and all other existing
keys stay — `title` continues to label the page via the existing
`<h1>{t('title')}</h1>` in `page.tsx`, unchanged by this story.)

### Step-by-step approach (test-first where possible)

1. **Spike-check** the `people!inner(is_active)` PostgREST embed (Design
   decision 2's flagged assumption) directly against local Supabase before
   writing the real helper, to avoid discovering an embed-name rejection
   mid-implementation.
2. Add `qualifiedPeopleCountsByRole` to `lib/skills/qualified-roles.ts`
   with its own doc comment (mirroring `qualifiedRolesForPerson`'s style).
3. Write `e2e-integration/roles-card-list.spec.ts` first (failing):
   - AC1: seed 2-3 roles with long pt-PT names via `serviceClient()`,
     visit `/pt-PT/admin/roles` at 375px and 390px via `adminPage`, assert
     `document.documentElement.scrollWidth <= viewport width`.
   - AC2: seed a role + 2 active people with `person_role_skills` rows for
     it (plus one soft-deleted/inactive person with a skill row for the
     same role, to prove the active-only filter), assert the rendered meta
     line shows the correct plural count (2, not 3) and correct wording in
     both `pt-PT` and `en` locales.
   - AC4: assert each interactive control's bounding box height ≥44px at
     375px (`toBeVisible()` before `boundingBox()`, per CLAUDE.md).
4. Update `app/[locale]/(app)/admin/roles/page.tsx`: fetch role ids from
   the existing roles query, call `qualifiedPeopleCountsByRole`, own
   try/catch (independent failure — a count-query error should not break
   the page, mirroring STORY-30's per-query try/catch pattern), pass
   `qualifiedCounts` prop to `RoleTable`.
5. Restructure `components/RoleTable.tsx` markup per Design decision 1 —
   `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<td>` → `<ul className="flex
   flex-col gap-2.5">` of `<li className="rounded-lg border bg-card px-4
   py-3.5">` rows, each containing the flex name/meta + badge/actions
   layout, with Save/Cancel/Confirm-remove states rendered within the
   same `<li>` (form now wraps the `<li>`'s content directly, dropping the
   `form={editFormId}` attribute trick). **Do not touch** any state,
   handler, or API-call code — this is a pure JSX/className diff.
6. Update the 21 role-scoped selector lines identified in the grounding
   note: `page.locator('tr', { hasText })` → `page.locator('li', {
   hasText })` in `e2e/role-management.spec.ts` (13 lines) and in the
   roles-only sections of `e2e/deletion-guard.spec.ts` (8 of its 13 `tr`
   lines — do **not** touch the 5 people-only `tr` lines in the same
   file, which belong to `PeopleTable.tsx`). No assertion content changes.
7. Add the two new i18n keys to both locale files; remove `columnName`/
   `columnSlots` from both.
8. Update the stale doc comment in
   `e2e/design-language-foundation.spec.ts` (lines 188-190): it currently
   lists `RoleTable.tsx` as a live consumer of `bg-muted/50` (the old
   `<thead>` row background), which Design decision 1 removes entirely.
   Drop `RoleTable.tsx` from that comment's list (`UserTable.tsx`/
   `PeopleTable.tsx` remain accurate).
9. Run the **role-management and roles-side deletion-guard** e2e suites
   (`E2E_WITH_AUTH=1`, local Supabase) — now with their `li` selector
   updates applied — to confirm zero *behavioral* regressions (same
   assertions, same testids, same pass/fail outcome as before the
   markup change). This is a **manual/local verification step**, not
   something AC6's CI `test:e2e` run re-checks automatically: these
   specs are `E2E_WITH_AUTH`-gated and skip in CI without real Supabase
   admin credentials (same as today, unchanged by this story). Record the
   pass in the story file's manual-verification notes before marking done.
10. Run the new `e2e-integration/roles-card-list.spec.ts`, confirm it now
    passes. Unlike step 9, this **is** CI-enforced on every future PR
    (BUGFIX-06 pattern — no `E2E_WITH_AUTH` opt-in).
11. Add/adjust WCAG contrast assertions if any new pairing is introduced
    (Design decision 4 says no new pairings, so this should be a no-op
    check, not new test code) — spot-check by reading compiled CSS or
    reusing `e2e/design-language-foundation.spec.ts`'s existing
    `EXISTING_SEMANTIC_PAIRS` gate, which already covers `secondary`/
    `secondary-foreground`.
12. Visually render (dev server) both themes at 375px and 1280px,
    including edit mode and the in-use-delete confirm state, per the
    story's own Technical notes — screenshot and note pass/fail in the
    story file before marking done. Confirm the rendered row matches the
    mockup's card look (background, border, radius, 10px gaps) — this is
    the direct visual proof Design decision 1's CSS choices actually
    produce AC2's "card-style row," not just narrower markup.
13. `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e`.

### Test plan (mapped to acceptance criteria)

| AC | Test |
|---|---|
| AC1 (375px/390px no overflow) | New `e2e-integration/roles-card-list.spec.ts`, seeded long-name roles, `scrollWidth` assertion at both widths. |
| AC2 (card row content: name, qualified-count meta line with correct ICU plural in both locales, slots badge) | Same new spec: seed people/skills, assert meta-line text and slots-badge text in `pt-PT` and `en` (singular and plural counts both exercised — 1 and 2+ qualified people). |
| AC3 (existing flows unchanged, testids preserved, e2e coverage continues to pass) | Re-run `e2e/role-management.spec.ts` + the roles-only tests in `e2e/deletion-guard.spec.ts` (`E2E_WITH_AUTH=1`, local Supabase) after their 21-line `tr`→`li` selector update (Design decision 1); zero change to assertions/testids/test titles is the proof, not zero file diff. **This is a manual/local verification step** — these specs are `E2E_WITH_AUTH`-gated and are skipped in CI without real credentials, so AC6's CI-enforced `npm run test:e2e` run does **not** automatically re-verify this on future PRs; record the pass explicitly in the story's manual-verification notes (same pre-existing convention as `e2e/role-management.spec.ts`'s own header comment). |
| AC4 (≥44px tap targets, distinct aria-labels) | New spec's `boundingBox()` assertions (after `toBeVisible()`) on add/edit inputs and buttons; existing `aria-label={t('namePlaceholder')}` / `aria-label={t('slotsPlaceholder')}` calls are untouched by Design decision 1, so no new assertion is strictly required, but add one regression check in the new spec for defense-in-depth. |
| AC5 (WCAG AA, no new colors) | No new token pairs introduced (Design decision 4); confirmed by inspection that `secondary`/`secondary-foreground` is already gated in `e2e/design-language-foundation.spec.ts`'s `EXISTING_SEMANTIC_PAIRS` loop — no new test needed, note this explicitly in the story's AC verification section per CLAUDE.md precedent (CHORE-17's "surfacing marginal-but-pre-existing contrast" pattern, here surfacing "already-covered, no new pairing" instead). |
| AC6 (lint/build/type/test:e2e all exit 0) | CI + local run before marking done. |

### Risks and rollback

- **Risk**: the `<ul><li>` CSS (Design decision 1) is specified concretely
  here (`gap-2.5`, `rounded-lg border bg-card px-4 py-3.5`) but not yet
  rendered — there is residual risk the visual result doesn't read as
  "card-style" as closely as intended (e.g. spacing feels off next to the
  add-role form above the list). Mitigated by Step 12's explicit
  mockup-comparison visual check at both 375px and 1280px in both themes
  before marking done, rather than deferring that judgment to a late,
  vague "looks fine" pass.
- **Risk**: the 21-line `tr`→`li` selector update (Step 6) touches two
  existing, previously-stable e2e spec files. Mitigated by the exact line
  accounting in the grounding note (13 + 8 lines, all identified by number
  up front, not discovered ad hoc during implementation) and by explicitly
  excluding the 5 people-only `tr` lines in `deletion-guard.spec.ts`,
  which must not change. Rollback: `git revert` the two spec files'
  changes independently of the component change if a selector update
  turns out to be wrong — they're separate, easily-isolated commits.
- **Risk**: `people!inner(is_active)` embed-name assumption (Design
  decision 2) is unverified against this exact irregular-plural FK
  relationship. Mitigated by Step 1's spike-check before writing the real
  query; fallback is the explicit FK-hint syntax.
- **Risk**: restructuring `RoleTable.tsx`'s JSX while preserving exact
  behavior (STORY-19's `blockedByOtherConfirm` gating, STORY-17's
  optimistic sort-after-mutate) is the highest-reasoning-risk step; a
  copy/paste slip could silently change which controls are disabled
  during a confirm-remove state. Mitigated by running the existing e2e
  suites (with only their mechanical `tr`→`li` selector update applied,
  Step 6) as the regression gate — same assertions as before — not just
  visual QA.
- **Rollback**: this chore touches no migrations, no API routes, and no
  shared types (`RoleRow` unchanged) — a revert is a clean single-PR
  revert with no data or schema cleanup required.

### Complexity tag

**Standard.** Multi-file (Client Component markup rewrite + Server
Component query + new lib helper + two locale files + new integration
test), requires understanding of the existing STORY-17/STORY-19 state
machine and the STORY-30 aggregate-query/metric-scope-consistency pattern
well enough to preserve both exactly through a structural markup change.
No auth, money, concurrency, or security surface — stays standard, not
complex.
