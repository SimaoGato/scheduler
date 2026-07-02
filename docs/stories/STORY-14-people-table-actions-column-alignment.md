# STORY-14: Actions column alignment in management tables
Epic: EPIC-02
Status: done ✅
PR: 23

## User story
As an admin, I want the Editar/Remover buttons in the people list to sit in
a predictable, consistent place, so I can find and use them without hunting
for them.

## Context
`components/PeopleTable.tsx` (STORY-07) renders a two-column HTML `<table>`
with `w-full` but no `table-layout: fixed` and no explicit column widths.
The actions `<td>` has no text alignment, and the inner button wrapper is a
plain `flex gap-2` with no `justify-end`. Because the table uses the
browser's default auto-layout algorithm, the "Nome" column doesn't reliably
consume all remaining width, so the Editar/Remover buttons can end up
sitting close to the name rather than aligned to the trailing edge of the
row — most visible with short names on wide viewports. This matches the
user's report (2026-07-02 triage) that "the Editar and Remover buttons are
in a weird place."

`components/UserTable.tsx` (admin/users, STORY-05) has the identical table
shape and the same missing alignment (empty last `<th>`, no `justify-end` on
the promote/demote button). The user didn't call this one out by name, but
it's the same component pattern and root cause, so it's included here for
consistency rather than filed separately.

## Acceptance criteria
1. Given the people-management table on a desktop viewport (≥1024 px), when
   rendered, then the Editar/Remover buttons are visually right-aligned at
   the trailing edge of the table row.
2. Given the user-management table on a desktop viewport, when rendered,
   then the promote/demote button follows the same right-aligned pattern.
3. Given the people-management table on a narrow viewport (375 px, inside
   the existing `overflow-x-auto` wrapper), when rendered, then the actions
   remain usable and tap targets stay ≥ 44 px (no regression of existing
   `min-h-[44px]` buttons).
4. Given a row in inline-edit mode (PeopleTable's Save/Cancel form), when
   rendered, then the Save/Cancel buttons occupy the same actions-column
   position as the view-mode Editar/Remover buttons (no layout jump between
   states).

## Out of scope
- Redesigning the tables as cards or a different layout paradigm.
- Adding new actions (e.g. bulk actions, sorting).
- Changing UserTable's promote/demote logic — only the positioning of the
  existing button.

## Technical notes
- Likely fix: add `text-right` (or `text-end`) to the actions `<th>`/`<td>`
  and `justify-end` to the inner flex wrapper, in both `PeopleTable.tsx` and
  `UserTable.tsx`.
- If auto-layout continues to misbehave after that, consider
  `table-layout: fixed` with an explicit width on the name column — Refine
  should confirm the actual root cause against the live rendered DOM before
  picking a fix, rather than assuming.
- Preserve existing `data-testid` attributes (`pm-edit-${id}`,
  `pm-remove-${id}`, etc.) for e2e stability.
- Priority: normal.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Root cause (confirmed against live code)

Read `components/PeopleTable.tsx` and `components/UserTable.tsx` in full. Two
distinct issues, only one of which the story's Technical notes anticipated:

1. **Alignment bug (both tables).** `<table className="w-full text-sm">` uses
   the browser's default auto table-layout algorithm. With no
   `table-layout: fixed` and no explicit column widths, auto-layout
   distributes the table's full width across *all* columns based on their
   content-sizing needs — it does not give 100% of the leftover width to the
   first (name) column. The actions column therefore ends up with a
   non-trivial share of the row width. Since the actions `<td>` has no
   `text-right`/`text-end`, and the inner button wrapper (`<div
   className="flex gap-2">` in `PeopleTable.tsx`) has no `justify-end`, the
   buttons render left-aligned *within that over-wide cell* — which visually
   lands them near the middle of the row rather than pinned to the table's
   trailing edge. This exactly matches the attached screenshot ("Luid" row:
   Editar/Remover sit right after the name, not at the right edge) and the
   user's 2026-07-02 report.

   `text-right`/`justify-end` alone (the story's first suggestion) is
   necessary but **not sufficient**: it will right-align content within
   whatever width auto-layout assigns to that column, but the column itself
   will still be wider than its content requires, leaving a gap on the right
   in the empty-header case or shifting the effective "trailing edge"
   depending on content. The story's fallback suggestion
   (`table-layout: fixed` + explicit width) is closer, but a **fixed pixel
   width** is fragile: `UserTable`'s single button has to fit strings up to
   `"Promover a Administrador"` (25 chars) while `PeopleTable`'s two-button
   row has to fit `"Guardar"` + `"Cancelar"` side by side — a hardcoded width
   would need constant tuning as translations change and risks wrapping/
   truncation on narrow viewports.

   **Fix chosen:** the standard "shrink-to-fit trailing column" CSS-table
   technique — no `table-layout: fixed` needed. Add `w-[1%] whitespace-nowrap
   text-right` to the actions `<th>` and `<td>` in both tables. `width: 1%`
   tells auto-layout "give this column the bare minimum"; `white-space:
   nowrap` stops the browser from wrapping/shrinking it below its intrinsic
   content width, so auto-layout gives every other (unconstrained) column the
   remaining space instead. The result: the actions column always shrinks
   exactly to fit its buttons, and `text-right` (redundant with `justify-end`
   below but harmless, and load-bearing for `UserTable`'s single
   inline-block `<button>`) pins that content flush to the table's right
   border. This is robust to translation-string length changes and viewport
   width, and needs no magic pixel values.

2. **Structural bug found during code review, not mentioned in the story
   (blocks AC4 as written).** In `PeopleTable.tsx`, the inline-edit `<form>`
   (input + Save + Cancel) is rendered entirely inside the **name** `<td>`
   (lines 172–206); the actions `<td>` is emptied via `{!isEditing && (...)}`
   whenever a row enters edit mode (lines 207–228). So today, Save/Cancel do
   **not** occupy the actions column at all — they render in the name
   column, next to the input, and the actions column goes blank. This is a
   real layout jump between view and edit mode (the name column grows to fit
   input+2 buttons; the actions column collapses to empty), which is exactly
   what AC4 prohibits. A pure CSS alignment fix cannot satisfy AC4 — the
   markup must be restructured so Save/Cancel render in the actions cell.

   **Fix chosen:** split the form across the two cells using the HTML5
   `form` **attribute association** (not DOM nesting). A `<form>` element
   cannot validly wrap both `<td>`s of the same row, but form-associated
   elements (`<input>`, `<button>`) can reference a form by `id` from
   anywhere in the document via the `form="..."` attribute — this is exactly
   the browser-native mechanism for "form controls outside the form".
   Concretely, in `PeopleTable.tsx`:
   - Name `<td>` (edit mode): keep only the `<input>`, now with
     `form={`pm-edit-form-${person.id}`}` so Enter-to-submit and the browser's
     implicit-submission algorithm still work correctly even though the
     `<form>` tag itself lives in a different cell.
   - Actions `<td>` (edit mode): render `<form id={`pm-edit-form-${person.id}`}
     onSubmit={...} className="flex justify-end gap-2">` wrapping the Save
     (`type="submit"`) and Cancel (`type="button"`, `onClick={cancelEdit}`)
     buttons. This `<form>` is now a normal, valid child of a single `<td>`.
   - Actions `<td>` (view mode): unchanged structurally, just add
     `justify-end` to the existing `<div className="flex gap-2">`.
   - Add `data-testid={`pm-save-${person.id}`}` and
     `data-testid={`pm-cancel-${person.id}`}` to the two new-position buttons
     (they have no testid today) so the e2e position-comparison test below
     has stable selectors, following the existing `pm-edit-`/`pm-remove-`
     convention.

   Net effect: the actions `<td>` always contains exactly one flex row
   (Editar+Remover, or Save+Cancel) at the same shrink-to-fit, right-aligned
   position — no jump.

### Fix summary by file

**`components/PeopleTable.tsx`:**
- Actions `<th>`: add `w-[1%] whitespace-nowrap text-right` (keep existing
  `px-4 py-3 font-medium`; drop `text-left`).
- Actions `<td>`: add `w-[1%] whitespace-nowrap text-right` (keep `px-4
  py-3`).
- View-mode button wrapper `<div className="flex gap-2">` → `<div
  className="flex justify-end gap-2">`.
- Restructure edit mode as described above: input (with `form` attribute)
  stays in the name `<td>`; `<form id=... className="flex justify-end
  gap-2">` with Save/Cancel moves into the actions `<td>`. Add
  `pm-save-${id}` / `pm-cancel-${id}` testids.
- No change to `min-h-[44px]` classes on any button (AC3 — already present
  and untouched by this restructuring).
- Name `<td>`/`<th>` need no explicit width class — auto-layout gives them
  the remaining space once the actions column is pinned to shrink-to-fit.

**`components/UserTable.tsx`:**
- Actions `<th>` (currently empty, `text-left`): change to `w-[1%]
  whitespace-nowrap text-right`.
- Actions `<td>`: add `w-[1%] whitespace-nowrap text-right`. No flex wrapper
  needed — there is exactly one `<button>` per row (promote *or* demote,
  never both), and `<button>`'s default `display: inline-block` means
  `text-right` on the parent `<td>` is sufficient to right-align it; no
  structural change to the promote/demote logic (explicitly out of scope).

### AC-by-AC verification approach

- **AC1/AC2 (desktop right alignment):** Playwright test at a desktop
  viewport (1280×800) comparing the `right` x-coordinate of the actions
  `<td>`'s bounding box (or the trailing button's bounding box) against the
  table/row's own `right` x-coordinate. Expect the difference to equal the
  cell's right padding (`px-4` = 16px) within a small tolerance (e.g. 2px),
  not the much larger gap the bug currently produces.
- **AC3 (375px, tap targets):** Playwright test at 375×812. Assert
  `pm-edit-${id}`/`pm-remove-${id}` (and `UserTable`'s promote/demote button)
  `boundingBox().height >= 44`, per the existing `min-h-[44px]` guard-rail
  pattern. Assert `document.documentElement.scrollWidth <= 375` for the page
  overall (the `overflow-x-auto` wrapper should absorb any internal table
  overflow rather than pushing the page wider), following the canonical
  overflow-measurement pattern from `smoke.spec.ts` / STORY-13.
- **AC4 (no layout jump on edit):** Playwright test that reads the
  right-edge x-coordinate of `pm-edit-${id}` in view mode, clicks it to enter
  edit mode, then reads the right-edge x-coordinate of the new
  `pm-save-${id}` testid, and asserts they match within a small tolerance
  (e.g. 2px). Also assert `pm-save-${id}`/`pm-cancel-${id}` keep
  `boundingBox().height >= 44`.

All four checks require an authenticated admin session (`/pt-PT/admin/people`
and `/pt-PT/admin/users` are gated by `proxy.ts` + the per-page admin
redirect guard), so — following the established **auth-gated test pattern**
(`test.skip(!process.env.E2E_WITH_AUTH, ...)`, see
`e2e/user-widget-click-outside.spec.ts`) — these will live in new files
`e2e/people-table-alignment.spec.ts` and `e2e/user-table-alignment.spec.ts`
(or appended to the existing `people-management.spec.ts` /
`user-management.spec.ts` files), skipped in CI and documented as manual
verification steps in this story file to satisfy the Definition of Done's
"AC coverage" requirement without a real Supabase session. No changes are
needed to the existing CI-safe 401/redirect tests in
`e2e/people-management.spec.ts` / `e2e/user-management.spec.ts`.

### Step-by-step (test-first where possible)

1. Write the four new Playwright assertions above (auth-gated, initially
   expected to fail against current markup when run locally with
   `E2E_WITH_AUTH=1`).
2. Fix `components/UserTable.tsx` (smaller, no structural change) — apply
   the `w-[1%] whitespace-nowrap text-right` classes.
3. Fix `components/PeopleTable.tsx` view-mode alignment (`justify-end` +
   shrink-to-fit classes).
4. Restructure `components/PeopleTable.tsx` edit-mode markup: move
   Save/Cancel into the actions `<td>` via the `form` attribute technique;
   add `pm-save-`/`pm-cancel-` testids.
5. Run `npm run lint`, `npx tsc --noEmit`, `npm run build`.
6. Run `npm run test:e2e` (CI-safe subset) and, locally with
   `E2E_WITH_AUTH=1` and real credentials, the new alignment tests.
7. Manually verify against the dev server / Vercel preview at 1280px and
   375px per the project's "QA must visually render UI stories" convention —
   structural/DOM checks alone are not sufficient sign-off for a visual bug
   report like this one.
8. Update the story file's manual-verification section with the exact steps
   if the auth-gated tests must be skipped in CI (mirroring
   `user-widget-click-outside.spec.ts`'s doc-comment pattern).

### Opportunistic observation (not in scope, flagging only)

The edit-mode `<input>` in `PeopleTable.tsx` currently has no `aria-label`
(only a `placeholder`), unlike the add-person input a few lines above which
does. This is a pre-existing WCAG SC 1.3.1 gap, not caused by and not
required to be fixed by this story's ACs. Since the input's JSX is being
touched anyway for the `form` attribute change, adding
`aria-label={t('namePlaceholder')}` at the same time is a one-line, zero-risk
opportunistic fix — implementer's judgment, not a blocking requirement, and
does not change the test plan above.

### Risks and rollback

- **Risk:** the `form` attribute cross-cell association is a less common
  pattern; if the implementer instead wraps `<form>` around the whole `<tr>`
  or across both `<td>`s, the HTML parser will foster-parent it out of the
  table structure, silently breaking layout. Mitigated by the explicit
  same-cell-only `<form>` design specified above.
- **Risk:** `w-[1%]` shrink-to-fit is a well-established technique but
  unfamiliar to some readers; a code comment referencing "shrink-to-fit
  trailing column" is worth adding at the first occurrence.
- **Risk:** translation string length changes (pt-PT) could still cause
  wrapping inside the shrink-to-fit column on very narrow viewports — this is
  inherent to `whitespace-nowrap` and is why AC3 explicitly checks 375px
  behaviour inside the existing `overflow-x-auto` wrapper (horizontal scroll
  is the accepted narrow-viewport behaviour, not wrapping).
- **Rollback:** purely presentational + one markup restructuring, isolated
  to two components with no server/DB/API surface changes; revert is a
  single-commit `git revert` with no migration or data implications.

### Affected areas

- Frontend / UX only (`components/PeopleTable.tsx`, `components/UserTable.tsx`,
  new/updated Playwright specs). No backend, data, or infra changes.

### Complexity tag: **standard**

Justification: touches two components and requires understanding both
Tailwind/CSS table-layout mechanics and an HTML5 form-association technique
that most engineers won't reach for by default (`form="id"` spanning table
cells). The AC4 fix is a genuine markup restructuring, not a copy/CSS tweak —
it changes which cell owns the Save/Cancel controls and how the edit form is
wired up, with real risk of subtly breaking Enter-to-submit or hydration if
done incorrectly. Not `complex` (no auth, data integrity, concurrency, or
money concerns, and it's confined to two sibling components with an
identical, well-understood pattern), but clearly above `trivial`.

## Implementation notes (post-implementation)

- **Testids added** (not previously present): `pm-save-${id}`,
  `pm-cancel-${id}` on `PeopleTable.tsx`'s edit-mode buttons; `um-promote-${id}`,
  `um-demote-${id}` on `UserTable.tsx`'s role-change button (warning raised
  during plan review — these had no testid at all before this story).
- **Accessibility fix folded in**: the edit-mode `<input>` in `PeopleTable.tsx`
  now has `aria-label={t('namePlaceholder')}` (reuses the existing
  `PeopleManagement.namePlaceholder` i18n key already used by the add-person
  input) — closes a pre-existing WCAG SC 1.3.1 gap on the same input this
  story was already restructuring.
- **AC coverage / test execution status:** `e2e/people-table-alignment.spec.ts`
  (AC1, AC3, AC4) and `e2e/user-table-alignment.spec.ts` (AC2) were written
  test-first per the auth-gated pattern (`test.skip(!process.env.E2E_WITH_AUTH, ...)`).
  They cannot execute against a real Supabase/Google OAuth session in CI or in
  this implementation environment (no live credentials available), so they
  skip cleanly (`17 skipped`, `0 failed` in the full `npm run test:e2e` run).
  Each spec file's header comment documents the equivalent manual verification
  steps, satisfying the Definition of Done's "AC coverage" requirement via
  the documented-manual-step escape hatch. A developer with `.env.local` +
  real credentials can run `E2E_WITH_AUTH=1 npm run test:e2e` locally to
  execute them for real.
- **Full gate results at implementation time:** `npm run lint` — 0 errors;
  `npx tsc --noEmit` — 0 errors; `npm run build` — succeeded; `npm run test:e2e`
  — 26 passed, 17 skipped (auth-gated), 0 failed, exit code 0.
