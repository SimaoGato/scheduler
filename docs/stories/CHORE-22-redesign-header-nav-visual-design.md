# CHORE-22: Collapse mobile nav into a hamburger menu
Epic: maintenance
Priority: standard (explicit user dissatisfaction with current mobile nav;
concrete direction now given, no longer just visual-debt polish)
Status: draft
Related: BUGFIX-06 (header-nav-mobile-overflow-regression, functional fix —
superseded on mobile by this chore), CHORE-18 (home page redesign), CHORE-19
(availability page redesign)

## Task
As any user viewing the app on a phone, I want the nav links tucked behind a
hamburger/menu button instead of always taking up a full second row under
the header, so the header is compact and the page content starts higher up
the screen.

## Context
User feedback (direct quote): "i was referring to the nav bar, I dont like
it. Do something to fix it, i dont know, hamburger menu or whatever (just
for phone)". Confirmed direction: below the `sm` breakpoint (640px), replace
the always-visible, full-width-wrapping nav row (`AppNav`, currently row 2 of
`AppHeader`, four plain text links: `Disponibilidade`, `Utilizadores`,
`Equipa`, `Funções`) with a single hamburger/menu icon button in the header's
row 1. Tapping it opens the nav links (e.g. a dropdown panel or slide-out),
tapping again (or selecting a link, or tapping outside) closes it. Desktop
(≥sm) keeps the current inline nav — **this chore is mobile-only**.

BUGFIX-06 fixed the *functional* wrapping/overflow bug for the old
always-visible two-row layout. This chore replaces that mobile layout
entirely with a collapsed menu, so BUGFIX-06's specific wrap/order mechanics
(the `sm:order-*`/`ml-auto` arrangement documented in `AppHeader.tsx`) no
longer apply below `sm` once this ships — re-verify the `>=sm` desktop
behavior is untouched, since BUGFIX-06's arrangement is still what governs
that breakpoint.

## Acceptance criteria
1. Given the header at 375px/390px viewport, when rendered, then the nav
   links are not shown inline; instead a single hamburger/menu button is
   visible in the header's first row, with an accessible name (e.g.
   `aria-label`) indicating it opens navigation, and a ≥44px tap target.
2. Given the collapsed mobile header, when the hamburger button is tapped,
   then the nav links (all role-appropriate items, same set `AppNav`
   currently renders for the signed-in user's role) become visible in an
   open menu/panel, each with a ≥44px tap target.
3. Given the open mobile nav menu, when a link is tapped, or the hamburger
   button is tapped again, or (if feasible with the chosen implementation)
   focus/click moves outside the menu, then the menu closes. Follow the
   existing `UserWidgetMenu.tsx` click-outside/Escape-dismiss pattern
   (CLAUDE.md) if a custom disclosure is built, for consistency with the
   avatar menu's dismiss behavior already in this codebase.
4. Given the header at ≥1280px (desktop), when rendered, then the nav still
   renders inline exactly as it does today (no hamburger button shown,
   BUGFIX-06's existing desktop arrangement unchanged).
5. Given a keyboard-only user, when tabbing through the mobile header, then
   the hamburger button is reachable and operable via Enter/Space, and once
   open, the menu's links are reachable via Tab in a sensible order; when
   closed via Escape, focus returns to the hamburger button (ARIA APG
   disclosure convention, same as `UserWidgetMenu`).
6. Given light and dark theme, when the hamburger button and open menu
   render, then all text/icons meet WCAG AA contrast in both themes, reusing
   existing verified tokens.
7. Given all existing `data-testid`/role-based locators in
   `e2e/app-nav.spec.ts` and `e2e-integration/header-nav-mobile-overflow.spec.ts`,
   when this ships, then desktop (≥sm) assertions continue to pass
   unmodified; mobile-width assertions in those specs are expected to need
   rework since the mobile DOM structure fundamentally changes — update
   them to assert the new hamburger/open-menu behavior instead of the old
   wrapped-row behavior (this is an anticipated, not accidental, test change
   — call it out explicitly in the PR).
8. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Any change to desktop (≥sm) nav behavior or BUGFIX-06's desktop DOM-order/
  tab-order arrangement — unchanged.
- The page content below the header (home, availability, team) — those are
  CHORE-18/19/21's concerns.
- Adding new nav items or changing role-based nav visibility logic — only
  how the existing items are presented on mobile.
- Building a new global dropdown/disclosure primitive from scratch if the
  existing `UserWidgetMenu.tsx` pattern (native `<details>`/`<summary>` +
  click-outside/Escape wrapper) can be reused or closely mirrored — prefer
  reuse over a new pattern; Refine should confirm the concrete approach.

## Technical notes
- Primary files: `components/AppHeader.tsx`, `components/AppNav.tsx`. Likely
  needs a new `'use client'` wrapper (mirroring `UserWidgetMenu.tsx`'s
  ref + document-level click/keydown listener pattern from STORY-13) since
  open/close state and outside-click/Escape dismissal require client-side
  interactivity that `AppNav` (currently role-gated but otherwise static)
  doesn't have today.
- `AppHeader.tsx` currently has a large load-bearing comment block
  documenting BUGFIX-06's `sm:order-*`/`ml-auto` mobile-vs-desktop DOM order
  tradeoff. Since this chore removes the inline mobile nav entirely (replaced
  by a hamburger button), most of that comment's mobile-specific reasoning
  becomes obsolete — update/replace it rather than leaving stale reasoning
  next to new code. Re-verify desktop (`sm:order-2`) is still correct once
  the mobile branch changes.
- Re-check `AppNav`'s role-gating (`role !== 'admin'` → fewer/no links,
  STORY-16's "return null when empty" convention) still works sensibly
  inside a hamburger panel — e.g. don't render an empty/pointless hamburger
  button for a role with zero nav items.
- Visually render (dev server or Vercel preview) at 375px, 390px, and
  1280px, both themes, open and closed states, before marking done.

## Definition of Done
See CLAUDE.md.
