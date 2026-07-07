# BUGFIX-03: Person skills editor shows no visual indication of a person's current skill level
Status: done ✅
PR: #36
Related story: STORY-18 (introduced `components/PersonSkillsEditor.tsx`)
Epic: EPIC-02

## Bug
On `/admin/people/[id]/skills` ("Competências de {name}"), every level
option (Sem nível / Iniciante / Intermédio / Especialista) renders
identically regardless of whether it is the person's current level —
confirmed live: a person ("Jorge") with skill levels already saved in the DB
shows all four options per role with the same unselected-looking border/
background, with no visible highlight, checkmark, or other affordance
distinguishing the assigned level from the other three.

## Cause (to be confirmed by implementer)
`components/PersonSkillsEditor.tsx` renders each option as a `<label>`
wrapping a real `<input type="radio">` that is visually hidden via
`className="sr-only"` (lines 129-137, 146-154). The `<label>` itself has a
single static `className` (line 127, 144) that never varies with
`currentLevel === level` (or `currentLevel === undefined` for the "Sem
nível" option) — there is no `peer-checked:`/`has-[:checked]:` variant, no
conditional class computed from `currentLevel`, and no icon/checkmark
rendered inside the checked label. The underlying DOM `checked` state is
set correctly (existing e2e tests assert `input` `toBeChecked()` — see
`e2e/person-skills.spec.ts` lines 145, 179, 245/247, 272), which is exactly
why this shipped unnoticed: the tests only ever queried the hidden input's
checked attribute, never a visible style difference on the label. This
matches [[feedback_qa_visual_rendering]] — structural/DOM checks passed while
the actual rendered page has no visible affordance at all.

## Acceptance criteria
1. Given a person has a saved skill level for a role (e.g. level 2 —
   Intermédio), when their skills editor page renders, then the label
   corresponding to that level is visually distinguishable from the other
   three options (e.g. filled/highlighted background, border color change,
   or checkmark) without requiring any user interaction.
2. Given a person has no saved skill level for a role, when their skills
   editor page renders, then "Sem nível" is the visually indicated option
   for that role (not merely the DOM default with no visible cue).
3. Given an Admin taps a different level for a role, when the optimistic
   update applies (per STORY-18's existing auto-save-on-tap behavior), then
   the visual indication moves to the newly selected option immediately,
   and reverts visually if the save fails and the optimistic state is
   rolled back.
4. Given the fix, when checked via automated test, then the test asserts
   something a sighted user would actually perceive (e.g. a CSS class or
   computed style applied to the selected label), not only the hidden
   input's `checked` DOM attribute — closing the exact gap that let this
   ship unnoticed.
5. Given the existing 44×44px tap targets and `hover:bg-accent` styling
   (STORY-18), when the selected-state style is added, then it remains
   visually distinct from both the default and hover states (a selected
   option must not look identical to a hovered-but-unselected option).

## Out of scope
- Any change to the auto-save-on-tap interaction model, error handling, or
  the double-tap/race guard (`savingRoleIds`) — this is a pure visual/CSS
  fix on top of existing, correct state.
- Any change to which roles are shown or how skill data is fetched/stored —
  confirmed during triage that the DB data and server-side fetch
  (`qualifiedRolesForPerson`, `app/[locale]/(app)/admin/people/[id]/skills/page.tsx`)
  are correct; the bug is presentation-only.
- Redesigning the level control away from a radio-per-label pattern (e.g. to
  a dropdown or segmented control) — keep the existing structure, add the
  missing visual state.

## Technical notes
- Likely fix: add a `peer` class to each `<input>` and a `peer-checked:`
  variant to its sibling `<label>` (note: current markup has the input
  *inside* the label, so either restructure to sibling elements for
  `peer-checked:` to apply, or use Tailwind's `has-[:checked]:` variant on
  the `<label>` directly, which works with the input nested inside — likely
  the smaller change). Example: `has-[:checked]:bg-primary
  has-[:checked]:text-primary-foreground has-[:checked]:border-primary`.
- Apply the same treatment to both the "Sem nível" label (line ~127) and the
  per-level labels (line ~144).
- Update/extend `e2e/person-skills.spec.ts` to assert a visible class or
  computed style on the selected label in addition to (not instead of) the
  existing `toBeChecked()` assertions, per AC4.
- Manually render the page in a browser (dev server or Vercel preview) per
  the QA visual-rendering convention before marking done — this bug only
  became visible that way, not from reading test output.

## Definition of Done
See CLAUDE.md.
