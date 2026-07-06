# STORY-24: Edit a person's skill levels without leaving the Team table
Epic: EPIC-02
Status: draft
Priority: low — UX refinement of an already-shipped, working pattern; needs
product confirmation before implementation (see Context).

## User story
As an Admin, I want to set a person's skill levels directly from the Team
list, so that I don't have to navigate to a separate page and back just to
change one role's level.

## Context
STORY-18 (done, PR #34) deliberately chose a **dedicated sub-page**
(`/admin/people/[id]/skills`) over a modal, because no `Dialog` primitive
existed in `components/ui/` at the time and a full page sidesteps
375px-viewport modal-sizing concerns entirely (see STORY-18's Technical
notes, decision 1). That reasoning was sound at the time and the resulting
page still meets all of STORY-18's acceptance criteria — this is not a bug.

Raised in triage (2026-07-06): after using it, the coordinator finds the
round trip (Team → click Competências → new page → set levels → click back
to Team) is more friction than expected for what is conceptually a quick,
frequent action ("Rita is now a level 2 on Sound"). This story proposes
collapsing that round trip — **the concern is real UX feedback, not a
defect**, so this needs a quick product go-ahead on the interaction
direction below before it's picked up (see Technical notes' open question).
`components/ui/` still has no `Dialog` primitive as of this writing, so the
"no modal primitive" constraint from STORY-18 still holds today.

## Acceptance criteria
1. Given an Admin viewing the Team table, when they trigger skills editing
   for a person, then they can view and change that person's role/level
   assignments **without a full page navigation** away from the Team list
   (e.g. an expand-in-place row, matching the existing table-row idiom
   already used for inline name editing in `PeopleTable.tsx`).
2. Given the in-place editor is open for one person, when the Admin selects
   a level (or "no level") for a role, then the same auto-save-per-tap
   behavior from STORY-18 applies (PUT/DELETE fires immediately, no separate
   Save button), including the same double-tap/race guard and 404-as-no-op
   handling already implemented.
3. Given the in-place editor is open for one person, when the Admin opens
   it for a different person, then the first person's editor closes (only
   one open at a time) — prevents an unbounded number of expanded rows.
4. Given all existing STORY-18 acceptance criteria (AC1-AC9 in
   `docs/stories/STORY-18-assign-per-role-skill-levels.md`), when this story
   ships, then they still pass unmodified — this is a presentation change,
   not a change to the validation, RLS, or API contract.
5. Given the coordinator on a 375px phone viewport (PRD §2 primary device),
   when they expand the in-place editor, then the same 44×44px tap-target
   and no-horizontal-scroll requirements from STORY-18 AC9 hold for the
   expanded content too.

## Out of scope
- Removing or changing `app/[locale]/(app)/admin/people/[id]/skills/page.tsx`
  itself — keep the standalone page as a fallback/deep-link target (e.g. for
  a future direct link), only change how it's *reached* from the Team table
  by default. (Confirm during Refine whether keeping both is worth the
  duplication, or whether the page should be removed once the inline editor
  ships — flagged as an open question, not decided here.)
- Adding a `Dialog`/modal primitive — this story should reuse the existing
  expand-in-place row idiom already in `PeopleTable.tsx` (inline edit mode),
  not introduce a new UI primitive, to avoid re-opening STORY-18's original
  "no Dialog exists yet" trade-off.
- BUGFIX-02 (the actions-column vertical-stacking bug) — fix that
  independently first; this story's row-expansion UI will be easier to
  reason about once the actions row itself renders correctly.
- A bulk/matrix skills editor — still out of scope per STORY-18.

## Technical notes
- **Open question for Refine/product**: should the in-place editor replace
  the "Competências" *link* with a *toggle button* that expands a new row
  (or an extra `<tr>` under the person's row) rendering
  `PersonSkillsEditor`'s content inline? This mirrors the existing
  inline-name-edit affordance in the same table and needs no new dependency.
  Confirm this direction (vs. some other pattern) before implementation.
- Likely reuses `components/PersonSkillsEditor.tsx` largely as-is (it's
  already a self-contained Client Component keyed by `personId` with its own
  local state) — the change is primarily *where* it mounts (inline within
  `PeopleTable.tsx`'s row) rather than on its own routed page.
- `PeopleTable.tsx` would need to fetch each person's roles/skills lazily
  on first expand (not eagerly for every row) to avoid N+1 queries on page
  load — e.g. fetch via the existing
  `GET /api/admin/people/[id]/skills` route on expand, roles list can be
  fetched once for the whole table.
- Re-run `e2e/person-skills.spec.ts` against the new mount point; most
  assertions (data-testids, level labels, 44px tap targets) should transfer
  directly since they target `PersonSkillsEditor`'s internals, not the page
  shell.

## Definition of Done
See CLAUDE.md.
