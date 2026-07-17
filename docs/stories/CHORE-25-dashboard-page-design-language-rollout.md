# CHORE-25: Roll out mockup's Dashboard-specific treatments (hero stat, empty state, mono digits)
Epic: maintenance
Priority: standard — visual-only, but sequenced as part of the pre-EPIC-04
UI push the user explicitly requested
Status: draft
Depends on: CHORE-23 (tokens/fonts), CHORE-24 (shared pill-shape primitives)
Related: CHORE-18 (existing home page Card redesign, being extended here,
not replaced), user-provided mockup in `App design refinement/`

## Task
As the coordinator, I want the home/Dashboard page
(`app/[locale]/(app)/page.tsx`) to pick up the Dashboard-specific visual
treatments from the design mockup — the solid-accent "hero" stat card for
the admin's primary metric, the dashed-border empty-state card, and
monospace styling for stat numbers and dates — so the most-visited screen
in the app matches the approved direction.

## Context
CHORE-18 already gave this page a Card-based structural redesign (stat
cards, empty state card). This chore does **not** redo that structure — it
layers the mockup's specific finishing details on top, now that CHORE-23
(tokens/fonts) and CHORE-24 (pill shapes) have landed:
- The Admin view's primary metric ("Active people") rendered as a
  solid-accent-background "hero" card with a flat offset shadow, visually
  distinct from the other (outlined) stat cards next to it.
- The empty-state card (Member view, "No schedule published yet") using a
  dashed border rather than the current solid one.
- All stat numbers and the "Next blocked Sunday" date rendered in the new
  monospace font token (from CHORE-23), distinguishing data from prose.

## Acceptance criteria
1. Given the Admin view of the Dashboard, when rendered, then the "Active
   people" stat card (or whichever is designated the primary metric) uses
   a solid accent background with the mockup's flat offset-shadow treatment,
   visually distinct from the "Active roles" / "Blocks · next 30 days"
   cards, in both light and dark theme.
2. Given the Member view's empty-state card ("No schedule published yet"),
   when rendered, then its border uses a dashed style instead of the
   current solid border, in both light and dark theme.
3. Given any stat number (available/blocked Sunday counts, people/roles/
   blocks counts) or date value (next blocked Sunday) on this page, when
   rendered, then it uses the monospace font token introduced in CHORE-23,
   while surrounding prose/labels keep the display font.
4. Given light and dark theme, when all of the above render, then text over
   the new hero card's accent background meets WCAG AA contrast (≥4.5:1),
   measured via the project's established HSL contrast method — do not
   assume the accent/foreground pairing verified in CHORE-23 for small text
   automatically holds for this larger stat-number use, re-check directly.
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0, with existing home-page e2e assertions
   (`e2e/home.spec.ts` or equivalent, STORY-30/CHORE-18's tests) passing
   unmodified unless they specifically assert the old solid-border/
   non-mono styling, in which case update them intentionally and say so in
   the PR description.

## Out of scope
- Any change to the underlying data/business logic on this page (stat
  counts, empty-state conditions, admin vs. member branching) — purely
  visual.
- The Availability and Team pages — CHORE-26 and CHORE-21, respectively.
- The header/nav — CHORE-22.
- Introducing the hero-card treatment anywhere else in the app (e.g. other
  admin pages) — confined to this page for now; a follow-up chore can
  extend the pattern if it reads well here.

## Technical notes
- Primary file: `app/[locale]/(app)/page.tsx` (and whatever Card/stat
  subcomponents CHORE-18 introduced there).
- Reuse CHORE-23's verified accent/mono tokens directly; do not introduce
  new color values or a third font in this chore.
- Visually render (dev server) both personas (Member/Admin), both themes,
  at 375px and 1280px, before marking done — per CLAUDE.md's "QA must
  visually render UI stories" note.

## Definition of Done
See CLAUDE.md.
