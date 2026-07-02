# STORY-14: Actions column alignment in management tables
Epic: EPIC-02
Status: draft

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
