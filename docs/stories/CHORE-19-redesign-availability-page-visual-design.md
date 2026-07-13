# CHORE-19: Redesign availability page visual design (Card-based layout)
Epic: maintenance
Priority: low (visual-quality debt, not a functional defect)
Status: draft
Depends on: CHORE-17 (Card UI primitive)
Related story: STORY-26 (member-block-unblock-sundays), STORY-25
(blocked-dates-data-model-and-api) — this chore restyles their output; no
data/logic changes.

## Task
As a Member (or Admin editing on someone's behalf), I want the "Disponibilidade"
page to look intentionally designed instead of a plain list of dates and a
lone bordered button, so it feels as trustworthy and finished as the rest of
a polished app.

## Context
The user's desktop screenshot of `/pt-PT/availability` shows: a title, a
one-line "Nos próximos 12 domingos:" caption, two plain stat lines (available
/ blocked counts), a "next unavailable" line, and a single outline button —
all rendered as unstyled stacked text with a large empty page below. Feedback
tied to this screenshot: "I don't want slop, I want good design. Simple, but
good."

The summary block lives in `app/[locale]/(app)/availability/page.tsx`
(Server Component) before handing off to `AvailabilityToggleList` (Client
Component, STORY-26) for the actual per-Sunday block/unblock list. This
chore is purely visual: give the summary block a `Card` treatment (CHORE-17)
consistent with whatever CHORE-18 establishes for the home page's summary
card, and review `AvailabilityToggleList`'s per-Sunday rows for the same
"simple, but good" bar (clearer row separation, consistent spacing, tap
target affordance) without changing its state machine or optimistic-update
logic.

## Acceptance criteria
1. Given the availability page, when rendered, then the summary (available
   count, blocked count, next-unavailable date) renders inside a `Card`
   consistent with the visual language CHORE-18 establishes for the home
   page's member summary card — not as bare stacked text.
2. Given the per-Sunday list rendered by `AvailabilityToggleList`, when
   viewed, then each row has clear visual separation and consistent spacing
   (e.g. alternating/bordered rows or card-per-row treatment), a visible
   distinction between available and blocked state beyond text alone
   (e.g. a color/badge cue using existing design tokens), while preserving
   its existing one-tap block/unblock interaction and optimistic-update
   behavior exactly as-is.
3. Given all existing `data-testid` attributes in both the Server Component
   (`availability-load-error`, `noLinkedPersonTitle` container, etc.) and
   `AvailabilityToggleList`, when the redesign ships, then they are
   preserved unchanged so STORY-25/STORY-26/STORY-27's existing e2e tests
   keep passing without modification.
4. Given the page at 375px and 1280px viewports, when rendered, then there
   is no horizontal overflow and all interactive block/unblock controls
   retain their existing ≥44px tap targets (per STORY-26/STORY-18's
   established tap-target standard).
5. Given light and dark theme, when the redesigned card/rows render, then
   text and state-indicator contrast meets WCAG AA in both themes, reusing
   CHORE-17's verified tokens.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0 with STORY-25/26/27's existing availability
   e2e tests passing unmodified.

## Out of scope
- Any change to blocked-dates data model, API routes, or the optimistic
  update/revert logic in `AvailabilityToggleList` — purely visual.
- The Admin-on-behalf variant's URLs/props (STORY-27) — the visual change
  should apply uniformly since `AvailabilityToggleList` is shared between
  Member and Admin-on-behalf modes per its existing optional-props pattern
  (CLAUDE.md), but no new admin-specific UI is in scope.
- The header/nav chrome — that's BUGFIX-06.
- The home page — that's CHORE-18 (sequence this chore after or alongside
  it so the two summary cards share one consistent visual language).
- Icons/illustrations — text, color, spacing, and card grouping only.

## Technical notes
- Depends on CHORE-17 landing first. Consider sequencing after CHORE-18 so
  the "stat card" pattern only needs to be designed once and is then reused
  here, rather than two stories independently inventing similar-but-slightly-
  different card styles.
- Per CLAUDE.md's "Extending a Member-facing Client Component for admin use"
  pattern: `AvailabilityToggleList` already gates admin-mode via optional
  `personId`/`personName` props — do not duplicate the component; restyle
  the one shared implementation.
- Re-verify STORY-26's flexbox `justify-between` + `gap` lesson (CLAUDE.md)
  if row layout changes — long pt-PT date strings need explicit `gap-2`
  minimum spacing against adjacent state labels.
- Visually render (dev server or Vercel preview) before marking done — do
  not rely on structural assertions alone to judge "good design."

## Definition of Done
See CLAUDE.md.
