# CHORE-21: Redesign team (Equipa) admin page mobile layout
Epic: maintenance
Priority: standard (demonstrable broken layout, not just aesthetic taste)
Status: draft
Related: CHORE-18 (home page redesign), CHORE-19 (availability page redesign),
STORY-14 (people table actions column alignment), BUGFIX-02 (people table
actions always wrap)

## Task
As an Admin using the "Equipa" page (`/admin/people`, `PeopleTable.tsx`) on a
phone, I want each person's row to stay readable and usable, so that I can
manage the team from my phone without the layout breaking.

## Context
User-reported screenshot (mobile, ~390px width) of `/pt-PT/admin/people`
shows the row for "Joao" with visibly broken alignment: the row's five view-mode
action buttons (`Competências`, `Disponibilidade`, `Editar`, `Remover`,
`Ligar conta`) stack vertically inside the shrink-to-fit actions `<td>`
(`PeopleTable.tsx` lines 462-522, `flex flex-wrap justify-end gap-2
sm:flex-nowrap` — the `sm:flex-nowrap` gate from BUGFIX-02 only prevents
wrapping at ≥640px, so at phone widths all 5 buttons still wrap into a tall
stack). Because the row's height is now driven entirely by that stacked
actions column, the Name/Conta `<td>`s in the same `<tr>` render far
shorter than the row, making "Joao" and "Sem conta" appear to float
disconnected from their own action buttons — the table reads as visually
broken, not just tightly packed.

This is a known category of issue flagged in CLAUDE.md's
"Breakpoint-gated flex-wrap" and "Nested independent flex-wrap contexts"
notes: a horizontal-overflow check (`scrollWidth`) passes because nothing
overflows sideways — the buttons wrap instead — but the resulting layout is
still visually incoherent. BUGFIX-02 fixed the "always wraps even at
desktop" bug; this chore addresses the fact that 5 stacked action buttons
per row is not a workable mobile pattern at all, regardless of wrap
correctness.

CHORE-18 and CHORE-19 already gave the home page and availability page a
Card-based visual redesign. This page (`components/PeopleTable.tsx`) has
not had equivalent treatment and is the last major admin surface still using
the plain `<table>` + always-visible-multi-button-row pattern from STORY-14.

## Acceptance criteria
1. Given the Equipa page at a 375px/390px viewport, when a row's actions are
   shown, then the row's Name and Conta values remain visually aligned with
   (adjacent to, not detached from) that row's own action controls — no
   action-stack-driven row-height mismatch.
2. Given the Equipa page at a 375px/390px viewport, when viewed, then all
   five per-row actions (skills, availability, edit, remove, link/unlink
   account) remain reachable and legible without requiring horizontal
   scrolling, and every interactive control keeps its existing ≥44px tap
   target (STORY-18/CLAUDE.md standard).
3. Given the Equipa page at ≥1280px, when viewed, then the existing desktop
   table layout is visually unchanged (or only intentionally refined) from
   today — this chore should not regress the already-working desktop view.
4. Given all existing `data-testid` attributes in `PeopleTable.tsx`
   (`pm-add-input`, `pm-skills-{id}`, `pm-availability-{id}`, `pm-edit-{id}`,
   `pm-remove-{id}`, `pm-link-{id}`/`pm-unlink-{id}`, `pm-link-select-{id}`,
   etc.), when the redesign ships, then they are preserved unchanged so
   STORY-14/18/19/20's existing e2e tests keep passing without modification.
5. Given light and dark theme, when the redesigned rows render, then text
   and any new visual grouping (cards/dividers) meet WCAG AA contrast in
   both themes, reusing existing verified tokens (CHORE-17/CHORE-19
   pattern) rather than introducing new unverified colors.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0 with existing people-management e2e tests
   passing unmodified.

## Out of scope
- Any change to the add/edit/remove/link business logic, API routes, or
  optimistic state updates in `PeopleTable.tsx` — purely visual/structural
  layout, same constraint CHORE-19 applied to `AvailabilityToggleList`.
- The header/nav chrome — that's a separate concern (see
  CHORE-22-redesign-header-nav-visual-design.md).
- Introducing a net-new UI primitive (e.g. shadcn `DropdownMenu`) is allowed
  only if a simpler layout fix (stacked card rows, 2-column action grid,
  etc.) doesn't clear AC1/AC2 — prefer the smallest change that works;
  Refine should confirm which approach before implementation.
- Admin/Utilizadores and Funções pages are not in scope even though they may
  share a similar action-button pattern — file a follow-up chore if this
  redesign's approach should be applied there too.

## Technical notes
- Primary file: `components/PeopleTable.tsx` (the "Equipa" page's Client
  Component, mounted from `app/[locale]/(app)/admin/people/page.tsx`).
- The `w-[1%] whitespace-nowrap` shrink-to-fit trailing-column pattern
  (CLAUDE.md, STORY-14) is why the actions column is narrow enough to force
  wrapping — a mobile-specific layout (e.g. switching from `<table>` to a
  card/list per person below a breakpoint) sidesteps this rather than fighting
  table auto-layout further.
- Re-check STORY-19's "blockedByOtherConfirm" and STORY-20's link-picker
  in-row state against whatever new layout is chosen — those states
  (confirm-remove banner, link-picker Select) must still render sensibly at
  mobile widths, not just the default view-mode action row.
- Visually render (dev server or Vercel preview) at real mobile widths
  before marking done — do not rely on structural assertions alone to judge
  the layout.

## Definition of Done
See CLAUDE.md.
