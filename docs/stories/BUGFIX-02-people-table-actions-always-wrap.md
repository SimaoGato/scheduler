# BUGFIX-02: Team table actions column always stacks vertically, not just at narrow viewports
Status: done ✅
PR: #35
Related story: STORY-18 (PR #34, introduced the 3rd action), STORY-23 (PR — introduced the flex-wrap mobile fix this regresses)
Epic: EPIC-02

## Bug
On `/admin/people` (Equipa/Team), every row's actions cell
(Competências/Editar/Remover) renders as three separate stacked rows instead
of one horizontal row — confirmed live on a desktop-width browser window
(screenshot from production, ample horizontal space available). This makes
every row in the Team table roughly 3x taller than it needs to be, with a
large empty gap in the Nome column, and looks broken to any admin regardless
of device.

## Cause (to be confirmed by implementer)
`components/PeopleTable.tsx:206` uses the shrink-to-fit trailing-column
pattern (`w-[1%] whitespace-nowrap`) documented in CLAUDE.md, and
`components/PeopleTable.tsx:236` wraps the three action elements in a
`flex flex-wrap justify-end gap-2` container — added in STORY-18 to solve
horizontal overflow at the 375px mobile viewport (same technique as
STORY-23's nav fix).

The suspected interaction: a `flex-wrap` container's contribution to a table
column's auto-layout width does not reliably behave like a plain nowrap
inline element's max-content width across browsers — the actions column
appears to size to roughly one button's width, forcing the flex container to
wrap onto 3 lines *unconditionally*, not only when the viewport is actually
too narrow to fit all three buttons on one line. `UserTable.tsx` and
`RoleTable.tsx` never hit this because their trailing actions cell only ever
contains a **single** button — there is no `flex-wrap` container in either,
so this defect is specific to multi-button action cells, and today that's
only the Team table (Utilizadores has one button per row; Funções — check
during implementation whether it has more than one action and is
already affected too).

This needs to be diagnosed with an actual rendered snapshot (not just static
reasoning) before picking a fix — see Test plan below.

## Acceptance criteria
1. Given an Admin viewing the Team (Equipa) page in a typical desktop/tablet
   browser window (e.g. 1280px wide), when the page renders, then each
   person's Competências/Editar/Remover actions display in a single
   horizontal row, and row height is consistent with the header/other rows
   (no oversized empty gap in the Nome column).
2. Given an Admin viewing the Team page at the existing 375px mobile
   viewport (STORY-18 AC9 / STORY-23's original fix target), when the page
   renders, then the actions still wrap onto additional lines as needed with
   no horizontal scroll and all tap targets remain ≥44×44px — i.e. the fix
   must not regress the narrow-viewport behavior these two stories already
   shipped and tested.
3. Given the fix, when the Team list renders with varying row counts (0, 1,
   many), then no row's action-column height differs from its siblings at
   the same viewport width.
4. Given the Utilizadores (Users) and Funções (Roles) admin tables, when
   reviewed during this fix, then confirm in the PR description whether they
   have single- or multi-button action cells and whether they are affected —
   this closes out the "why does this only show on Team" question raised
   during triage.

## Out of scope
- Redesigning the actions column into a dropdown/menu — that's a bigger UX
  change, not this regression fix.
- STORY-24 (inline skills editor) — a separate, larger UX change to how
  skills are edited; this bugfix only concerns the *layout* of the existing
  three-button row, not what each button does or where it navigates.
- Changing the 44×44px tap-target floor or any other STORY-18/STORY-23
  established convention.

## Technical notes
- Reproduce first with a Playwright screenshot at ~1280px width against the
  live Team page (or a fixture-backed local render) to confirm the bug
  outside of the one production screenshot already in hand.
- Likely fix directions to evaluate (pick the smallest one that passes the
  ACs, don't over-engineer):
  - Only apply `flex-wrap` below a breakpoint where wrapping is actually
    needed, e.g. `flex-nowrap sm:flex-nowrap` variants keyed to a breakpoint
    matched to the 375px mobile target, so desktop/tablet never wraps.
  - Give the flex container an explicit `min-w-max` (or similar) so its
    reported intrinsic width to the table auto-layout algorithm reflects the
    unwrapped (all-3-inline) width, only actually wrapping when the
    viewport truly can't fit that width.
  - If table auto-layout + flex-wrap intrinsic sizing turns out to be
    fundamentally unreliable across browsers, consider dropping the
    shrink-to-fit (`w-[1%]`) pattern for this specific column in favor of a
    fixed reasonable `min-width`.
- Add a regression test (Playwright, `E2E_WITH_AUTH`-gated per existing
  convention) asserting the three action elements' bounding boxes share the
  same `y` position (i.e., are on one line) at a desktop viewport width, in
  addition to the existing 375px wrap assertions from STORY-18/STORY-23.
- Since this regressed silently (STORY-18 and STORY-23 both shipped with the
  375px assertion passing, but nothing asserted the desktop case), this is
  also a gap in test coverage, not just markup — the fix isn't done until a
  desktop-viewport test exists to prevent recurrence.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Root cause — confirmed, not just suspected

Reproduced outside the app: compiled the exact `PeopleTable.tsx` view-mode
actions markup (`w-[1%] whitespace-nowrap` `<td>` wrapping a
`flex flex-wrap justify-end gap-2` `<div>` with the three action elements)
through the project's real Tailwind v4 pipeline (`@tailwindcss/postcss`) and
rendered it in a real Chromium instance (Playwright, headless, WSL2 libs
workaround per CLAUDE.md) at 1280px width.

Result: the three actions render at `y=57`, `y=109`, `y=161` — three
separate lines — even though the row/page has ~1000px of unused horizontal
space. This confirms the cause described in the bug report: a `w-[1%]`
auto-layout column apparently reports (or Chromium computes) the `flex-wrap`
container's contribution to column width as something narrower than the
unwrapped max-content width of all three buttons, so the column is sized too
narrow and the flex container wraps unconditionally, regardless of available
space.

### Candidate fixes evaluated (same repro harness)

1. **`min-w-max` on the flex container** (2nd bullet in the story's "Likely
   fix directions"): fixes desktop (all three actions at `y=57` at 1280px)
   but **breaks AC2** — at 375px the container no longer wraps at all
   (`min-w-max` forces intrinsic width regardless of viewport), producing
   `scrollWidth=409` (horizontal overflow) at a 375px viewport. Rejected.
2. **`flex-wrap sm:flex-nowrap`** (1st bullet — breakpoint-gated wrap,
   Tailwind's default `sm` breakpoint = 640px): confirmed via the same
   harness —
   - 1280px: all three actions at `y=57` (single row). ✓ AC1
   - 375px: actions wrap onto three lines (`y=57,109,161`), `scrollWidth=375`
     (no overflow), tap targets unchanged (≥44px, already satisfied by
     existing `min-h-[44px]` classes). ✓ AC2
   - Also checked 640px, 700px, 768px, 1024px (the ambiguous "tablet" range
     mentioned in AC1): all single-row, no horizontal overflow (name column
     in this repro is short; real overflow-x-auto wrapper from STORY-14
     absorbs any long-name edge cases exactly as it already does today —
     out of scope for this fix). **Selected fix.**
3. Dropping `w-[1%]` shrink-to-fit for a fixed `min-width` was not needed
   once (2) confirmed reliable — smallest viable change wins per the story's
   own guidance ("pick the smallest one that passes the ACs").

### Fix

In `components/PeopleTable.tsx`, the view-mode actions container (currently
`className="flex flex-wrap justify-end gap-2"`, ~line 236) becomes
`className="flex flex-wrap justify-end gap-2 sm:flex-nowrap"`. Update the
adjacent comment (lines 232-235) to explain the breakpoint: wrap only below
`sm` (640px, matching Tailwind's default breakpoint and comfortably above
the 375px mobile target), never wrap at tablet/desktop widths where all
three actions always fit on one line.

No other markup changes needed:
- The edit-mode form (`flex justify-end gap-2`, 2 buttons: Guardar/Cancelar)
  has no `flex-wrap` and is unaffected by this bug — confirmed by reading
  the code; not touched.
- `UserTable.tsx` (single button per row, no flex wrapper at all) and
  `RoleTable.tsx` (view-mode actions use plain `flex justify-end gap-2`,
  **no** `flex-wrap` class) are structurally incapable of hitting this
  specific "wraps when it shouldn't" bug — confirmed by reading both files.
  `RoleTable.tsx` has two view-mode buttons (Editar/Remover) and, notably,
  never wraps at *any* viewport width (no `flex-wrap` class), which is a
  separate, pre-existing (STORY-17-era) latent gap — at 375px it likely
  relies on `overflow-x-auto` rather than wrapping. That is a different bug
  shape (never-wraps vs. always-wraps) and is explicitly out of scope here;
  AC4 only requires confirming and documenting this in the PR description,
  not fixing it.

### Step-by-step approach

1. Update the className (and comment) on `PeopleTable.tsx`'s view-mode
   actions `<div>` as described above.
2. Add a new desktop-viewport assertion to
   `e2e/people-table-alignment.spec.ts` (same file/pattern as the existing
   AC1/AC3/AC4 tests, same `E2E_WITH_AUTH` gate and fixture lifecycle):
   assert the three action elements' (`pm-skills-*`, `pm-edit-*`,
   `pm-remove-*`) bounding boxes share the same `y` at 1280px width. Extend
   the file's header doc comment to list this as a new AC (call it AC5,
   continuing the numbering already used in that file) and add a manual
   verification step alongside the existing ones, since this suite is
   auth-gated and cannot run in CI (no Supabase/Google OAuth credentials
   available there — same constraint that let this regression ship
   unnoticed).
3. Re-verify the existing AC3 test (375px) and AC4 test (edit-mode, 1280px)
   in that same file still pass conceptually against the new class list (no
   behavior change expected there — confirmed via the repro harness above).
4. Update the file's header comment / this story's AC4 with the
   UserTable/RoleTable findings above, ready to paste into the PR
   description.
5. Manually smoke the real dev-server-rendered page (per the "QA must
   visually render UI stories" convention) at 1280px and 375px if
   `E2E_WITH_AUTH` credentials are available locally; otherwise rely on the
   repro harness's confirmation plus the new Playwright assertion.

### Test plan (mapped to ACs)

- **AC1** (single row at 1280px, no oversized gap): new assertion in
  `e2e/people-table-alignment.spec.ts` — three actions' bounding boxes share
  the same `y`. Also implicitly covered by the existing AC1 test (right-edge
  alignment), which would have been failing sporadically only in visual
  terms, not asserted numerically before now.
- **AC2** (375px still wraps, no regression): existing AC3 test in the same
  file already asserts `scrollWidth <= 375` and per-button `height/width >=
  44px`; re-run after the fix to confirm no regression (expected: identical
  pass, since `sm:flex-nowrap` only changes behavior at `>=640px`).
- **AC3** (consistent row height across 0/1/many rows): existing test
  fixture only exercises a single added row; add a brief manual verification
  note (existing team list in a real environment typically has >1 row) since
  automating "many rows" would require seeding multiple fixture rows and
  the layout mechanism (auto-layout column width) does not vary per-row —
  covered by the AC1 desktop assertion applying uniformly to all rows.
- **AC4** (confirm Users/Roles affected status): documented above in "Fix"
  section and to be restated in the PR description; no code change to
  those two files.

### Risks and rollback

- Low risk: single Tailwind class addition, confirmed via direct rendering
  through the project's real CSS pipeline (not just static reasoning),
  covering both the regressed desktop case and the previously-shipped
  mobile case.
- Rollback: revert the one-line className change; no data/migration
  involved.
- Since the auth-gated e2e suite is the only automated coverage (CI cannot
  exercise `/admin/people` without real credentials), the practical safety
  net is (a) this story's repro-verified reasoning, (b) the new assertion
  for future contributors running `E2E_WITH_AUTH=1` locally, and (c) manual
  visual QA before merge.

### Complexity tag

**trivial** — a single Tailwind utility-class change in one file
(`components/PeopleTable.tsx`), confirmed correct via direct browser
rendering against the real CSS pipeline before writing this plan, with a
mechanical, low-risk regression-test addition following an established
pattern in the same test file. No auth, data, concurrency, or multi-module
reasoning involved, and the fix does not touch `UserTable.tsx`/`RoleTable.tsx`
(confirmed structurally unaffected, not merely assumed).
