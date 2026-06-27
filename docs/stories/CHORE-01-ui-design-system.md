# CHORE-01: Choose and integrate a UI component library & design tokens
Epic: EPIC-01
Status: draft

## Task
Set up a consistent, polished UI foundation — a component library plus base
design tokens (colors, typography, spacing) — as part of the app scaffold
(STORY-01), so that every feature built on top looks good on both phone and
desktop without per-story design work.

## Context
The PRD requires a responsive web app that is pleasant to use on mobile and
desktop. The existing PRD and stories only specify "no layout breakage" and
"WCAG-friendly", which sets a floor for function but not for visual quality.
Without a component library chosen at scaffold time, each story would produce
inconsistent, raw HTML and retrofitting later costs significant rework. This
chore must be done together with or before STORY-01 so the library is available
to all subsequent stories.

## Acceptance criteria
1. Given the project scaffold, when the app is built, then a component library
   is installed, configured, and used in the app shell (at minimum: layout,
   button, and navigation components come from it).
2. Given the app shell on a phone (375 px wide) and on a desktop (1280 px wide),
   when inspected visually, then the shell looks intentionally designed — not raw
   browser defaults — with consistent spacing, typography, and color.
3. Given the design tokens (colors, font sizes, spacing scale), when a new
   component is added in any future story, then the developer can reference these
   tokens rather than hardcoding raw values.
4. Given an accessibility audit, when the shell is scanned, then it has no
   obvious contrast failures (WCAG AA level for text).
5. Given a mobile browser, when the app is opened, then tap targets are
   adequately sized (minimum 44 × 44 px) and the layout does not require
   horizontal scrolling.

## Out of scope
- Per-feature design/UX (handled per story).
- Custom brand identity / logo design.
- Dark mode (nice-to-have, not MVP).
- Animation or micro-interactions.

## Technical notes
- **Recommended stack:** Tailwind CSS + shadcn/ui. Tailwind gives utility-first
  responsive styling; shadcn/ui gives accessible, composable components with no
  runtime overhead. Both are free and work with Next.js on Vercel.
- Alternatively: Tailwind + Radix UI primitives (lower-level, more custom).
- Set up a `globals.css` with CSS variables for the color palette and font;
  document tokens in a README or comment so future stories can reference them.
- Mobile-first breakpoints in Tailwind config.
- This chore should be completed in the same PR as STORY-01 or as a PR that
  immediately precedes it.

## Definition of Done
See CLAUDE.md.
