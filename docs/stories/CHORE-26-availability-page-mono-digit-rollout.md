# CHORE-26: Roll out mono-digit/date treatment on the Availability page
Epic: maintenance
Priority: standard — visual-only, sequenced as part of the pre-EPIC-04 UI
push the user explicitly requested
Status: draft
Depends on: CHORE-23 (tokens/fonts), CHORE-24 (shared pill-shape primitives)
Related: CHORE-19 (existing availability page Card redesign, being extended
here, not replaced), user-provided mockup in `App design refinement/`

## Task
As a Member or Admin viewing the Availability page
(`app/[locale]/(app)/availability/page.tsx`, `AvailabilityToggleList.tsx`),
I want the Sunday date rows and summary stat numbers to use the new
monospace font treatment from the design mockup, so this page visually
matches the Dashboard's data-vs-prose distinction (CHORE-25) once the new
design language rolls out.

## Context
CHORE-19 already gave this page a Card-wrapped structure with a live
summary block and WCAG-contrast-fixed blocked-state badges. This chore does
**not** revisit that structure or the contrast fixes — it only applies the
monospace font (from CHORE-23) to the numeric/date content the mockup
treats as data: each Sunday row's date, the available/blocked summary
counts, and the "Next blocked Sunday" date, while status badge text
("UNAVAILABLE"/"Available"/equivalent pt-PT strings) and all prose labels
keep the display font.

## Acceptance criteria
1. Given the Availability page's summary card, when rendered, then the
   available-count and blocked-count numbers use the CHORE-23 monospace
   font token; their labels ("available Sundays"/"blocked Sundays" or
   pt-PT equivalents) keep the display font.
2. Given the Availability page's Sunday row list, when rendered, then each
   row's date text uses the monospace font token; the status badge
   ("Disponível"/"Indisponível" or equivalent) keeps its existing font and
   the WCAG-AA-verified contrast treatment from CHORE-19 — this chore must
   not touch badge color/contrast, only the date's font.
3. Given the "Next blocked Sunday" line, when rendered, then the date value
   uses the monospace font token while the surrounding sentence stays in
   the display font.
4. Given this is purely a font-family change on existing elements, when
   applied, then no existing WCAG AA contrast measurement from CHORE-19
   regresses (font-family does not affect contrast ratio, but re-run/
   spot-check the existing contrast e2e test to confirm no incidental
   change).
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0, with existing availability e2e tests
   (STORY-25/26/27, CHORE-19) passing unmodified.

## Out of scope
- Any change to the blocked/available toggle logic, API calls, or the
  admin-on-behalf mode (`AvailabilityToggleList`'s `personId` prop path,
  STORY-27) — purely a font-family visual change.
- Badge shape/color — already pill-shaped and contrast-verified by CHORE-19;
  CHORE-24 covers shape language for any remaining non-pill elements, not
  this chore.
- The Dashboard's mirrored summary card — CHORE-25 owns that instance even
  though it shares the same stat markup pattern; keep the two chores
  independent so either can land without waiting on the other, and note in
  each PR if a shared subcomponent naturally covers both (in which case the
  second chore to land should reference this one rather than duplicate the
  change).

## Technical notes
- Primary files: `app/[locale]/(app)/availability/page.tsx`,
  `components/AvailabilityToggleList.tsx`.
- If Dashboard (CHORE-25) and Availability share a summary-card
  subcomponent already (both render "available/blocked Sundays" stats),
  check for that reuse before duplicating the font change in two places —
  applying it once in the shared component may satisfy both chores'
  acceptance criteria simultaneously; call this out explicitly in whichever
  PR lands second.
- Reuse CHORE-23's verified mono token directly; no new font or color
  values.
- Visually render (dev server) both Member and admin-on-behalf modes, both
  themes, at 375px and 1280px, before marking done.

## Definition of Done
See CLAUDE.md.
