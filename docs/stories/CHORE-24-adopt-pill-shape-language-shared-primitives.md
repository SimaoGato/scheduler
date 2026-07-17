# CHORE-24: Adopt pill-shaped button/badge language in shared shadcn primitives
Epic: maintenance
Priority: standard — global-blast-radius CSS change (CLAUDE.md's "inherited
CSS" complexity rule), sequenced as part of the pre-EPIC-04 UI push
Status: draft
Depends on: CHORE-23 (design-token foundation — must land first so this
chore consumes verified tokens rather than introducing new ones)
Related: CHORE-18/19 (Card-based page redesigns), CHORE-21/22 (draft, team
& header redesigns), user-provided mockup in `App design refinement/`

## Task
As the coordinator, I want the app's core interactive shapes (`Button`,
`Badge` if/when it exists, and relevant `Card`-adjacent chrome) updated to
the fully-rounded "pill" language shown in the design mockup, so that once
CHORE-23's colors/fonts land, the shared building blocks visually match the
approved direction everywhere they're used, instead of every page needing
its own one-off radius overrides.

## Context
The mockup (`App design refinement/Escala Dashboard.dc.html`) uses
fully-rounded (`border-radius: 999px`) buttons and badges throughout —
nav pills, the persona-switch buttons, the CTA ("Manage availability",
"Add person"), the availability status badges, and team level badges — a
consistent, deliberate departure from the current shadcn default
(`--radius: 0.5rem`, `components/ui/button.tsx`'s default rounded-md/rounded
classes).

This project's shadcn primitives all follow one house pattern (CLAUDE.md:
"shadcn UI primitive house pattern") — styling composed via `cn()` and
Tailwind utilities, no inline styles. That means a shape change made once in
`components/ui/button.tsx` (and any sibling primitives) propagates to every
consumer automatically, which is both the appeal (one change, consistent
result) and the risk (every consumer needs to be spot-checked, not just the
ones this chore's author has in mind) — hence keeping this as its own
chore, separate from CHORE-23's token-only scope and from any single page's
redesign.

## Acceptance criteria
1. Given `components/ui/button.tsx`, when its default and any size variants
   are updated, then the button's border-radius matches the mockup's pill
   shape (fully rounded), and this is verified visually (dev server) on at
   least one instance of every existing variant (`default`, `destructive`
   or equivalent, disabled state, `asChild` link usage) in both light and
   dark theme.
2. Given every existing page that renders a `Button` (home, availability,
   team/admin people, admin users, admin roles, settings, login), when
   viewed after the change, then no button's label or icon is visually
   clipped or misaligned by the new radius/padding, checked at 375px and
   1280px viewports.
3. Given any existing e2e assertions that key off computed border-radius or
   button geometry (search for such assertions before starting), when this
   ships, then they are updated to match the new intentional shape, not
   left silently failing or silently stale.
4. Given WCAG AA tap-target rules (CLAUDE.md: 44px minimum), when the new
   shape is applied, then all interactive elements keep their existing
   `min-h-[44px]` tap targets — the radius change must not shrink effective
   hit area.
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Any color/token change — CHORE-23's job, must land first.
- Rewriting page-level layout (hero stat cards, dashed empty states,
  mono-digit number treatment) — CHORE-25/26, separate chores.
- Introducing a net-new `Badge` primitive if one doesn't already exist in
  `components/ui/` — if status badges (e.g. availability's
  "UNAVAILABLE"/"Available" pills, team's level badges) are currently
  hand-rolled `<span>` elements rather than a shared primitive, Refine
  should decide whether to extract a `Badge` primitive now or defer that
  extraction to a later chore; do not block this chore's shape-language
  goal on that decision — inline pill-shaped spans are an acceptable
  interim outcome.
- Team page mobile action-button layout (CHORE-21) and header/nav structure
  (CHORE-22) — those chores own their respective files' non-shape concerns;
  this chore only touches shared shape, not per-page structure.

## Technical notes
- Primary files: `components/ui/button.tsx`, any other `components/ui/*`
  primitives with a `rounded-*` class, and a grep for hand-rolled
  `borderRadius`/`rounded-` usage outside `components/ui/` for
  badge-like elements (availability status pill, team level badge,
  "Coming soon" empty-state badge) that should visually match even if not
  extracted into a shared primitive.
- This is exactly the "shared shadcn primitive house pattern" CLAUDE.md
  documents — follow it: plain function components, `cn()` composition, no
  inline styles, `data-slot` attributes preserved.

## Definition of Done
See CLAUDE.md.
