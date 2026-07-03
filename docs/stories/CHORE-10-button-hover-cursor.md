# CHORE-10: Add pointer cursor to the shared Button component on hover
Epic: maintenance
Status: draft

## Task statement
As a user, I want buttons across the app (starting with "Continuar com
Google" on the login page) to show a hand/pointer cursor on hover, so that
there's a clear visual indication the element is clickable, matching the
existing color-shift hover feedback.

## Context
`components/ui/button.tsx` (shadcn `Button`, used by
`GoogleSignInButton.tsx`, `AppNav.tsx`, and `app/[locale]/(app)/page.tsx`) has
no `cursor-pointer` utility in its `buttonVariants` base classes. Browsers'
default UA stylesheet renders `<button>` elements with `cursor: default` (the
arrow), not `cursor: pointer` (the hand) — unlike `<a href>`, which gets
pointer by default. This is a well-known gap that most CSS resets patch
explicitly; it wasn't patched here. Confirmed via `grep` — no `cursor-pointer`
in `app/globals.css` or `components/ui/button.tsx`. The user noticed this on
the Google sign-in button, but the fix at the shared-component level benefits
every `Button`-based control app-wide.

## Acceptance criteria
1. Given `components/ui/button.tsx`, when `cursor-pointer` is added to the
   `buttonVariants` base class string, then hovering any enabled `Button`
   (Google sign-in, nav links rendered via `asChild`, home page CTA) shows a
   pointer/hand cursor.
2. Given a `Button` is `disabled`, when hovered, then no pointer cursor
   appears (the existing `disabled:pointer-events-none` already prevents
   hover interaction entirely — confirm no regression, no additional cursor
   rule needed for the disabled case).
3. Given `npm run lint`, `npx tsc --noEmit`, and `npm run build` are re-run
   after the change, then all three exit 0 (this is a pure CSS class
   addition, no logic change).

## Out of scope
- Raw (non-shadcn) `<button>` elements in `PeopleTable.tsx` and
  `UserTable.tsx` — these already use their own `hover:bg-accent` classes
  directly and don't go through `buttonVariants`. A follow-up chore can
  extend the same fix there if wanted.
- Any other component's custom cursor behavior.

## Technical notes
- Single-line change: add `"cursor-pointer"` to the base class string passed
  to `cva(...)` in `components/ui/button.tsx`.
- Mechanical, single-file, no reasoning risk — classify as **trivial** per
  CLAUDE.md complexity rules (implementer-light/haiku eligible).

## Definition of Done
See CLAUDE.md.
