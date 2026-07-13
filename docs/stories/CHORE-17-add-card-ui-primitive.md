# CHORE-17: Add a Card UI primitive to the design system
Epic: maintenance
Priority: low (foundational — enables CHORE-18/CHORE-19, no user-visible
change on its own)
Status: draft

## Task
Add a shadcn/ui `Card` component (and the small set of subcomponents that
ship with it: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
`CardFooter`) to `components/ui/`, matching the same integration pattern
already used for `Button` and `Select`. This is a pure infrastructure
addition — no page changes — that unblocks the visual-design chores raised in
this triage round.

## Context
CHORE-01 (done ✅) set up Tailwind + shadcn/ui as the project's design
system, but `components/ui/` currently only contains `button.tsx` and
`select.tsx`. Every page that presents grouped information (home page team
summary, availability summary, etc.) currently does so as bare `<div>`/`<ul>`
text blocks with no visual container — no border, no background
differentiation, no elevation. This reads as "raw browser defaults" rather
than the "intentionally designed" bar CHORE-01's AC2 set. A reusable `Card`
primitive is the standard building block for fixing that without every story
reinventing its own container styling.

## Acceptance criteria
1. Given `components/ui/card.tsx`, when a consumer imports `Card`,
   `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and
   `CardFooter`, then each renders semantic, accessible markup styled with
   the project's existing design tokens (the same CSS custom properties
   `Button` already uses — `bg-card`, `text-card-foreground`, border tokens,
   etc. — defined in `app/globals.css`).
2. Given the component in both light and dark theme (`.dark` class per
   CHORE-11's class-driven strategy), when rendered, then contrast of card
   text against the card background meets WCAG AA, verified the same way
   STORY-19 verified `--warning`/`--warning-foreground` (measured contrast
   ratio in compiled CSS output, not eyeballed).
3. Given the component at 375px and 1280px viewports, when rendered with
   representative content (a title + a short list, similar to what CHORE-18
   will use it for), then it has no horizontal overflow and no
   sub-44px-effective tap targets if it contains interactive children.
4. Given `npm run lint && npx tsc --noEmit && npm run build`, then all exit
   0. (No e2e test is required for this chore alone since it adds no new
   page-visible behavior; CHORE-18/CHORE-19 will add the first real usage
   and its own AC-driven tests.)

## Out of scope
- Using the Card component anywhere yet — that's CHORE-18 (home page) and
  CHORE-19 (availability page).
- Any other new shadcn primitives (Badge, Separator, etc.) — add only if a
  later story concretely needs one; don't speculatively bulk-add components.
- Changing existing tokens in `app/globals.css` — reuse what CHORE-01/
  CHORE-11/STORY-19 already established.

## Technical notes
- Per CLAUDE.md: `npx shadcn@latest add card` may be blocked in sandboxed
  environments — if so, create `components/ui/card.tsx` manually; the CLI
  output is deterministic and well-documented (shadcn's Card source is a
  small set of `React.forwardRef` div wrappers with fixed class strings).
- Follow the same pattern as `components/ui/button.tsx` re: `'use client'`
  only if the component actually needs client-side behavior (Card itself
  typically doesn't — it's presentational — so it likely does NOT need
  `'use client'` and can be used directly from Server Components).
- No database, auth, or business-logic surface — this is a pure UI/styling
  chore, safe to classify as `trivial`-to-`standard` complexity.

## Definition of Done
See CLAUDE.md.
