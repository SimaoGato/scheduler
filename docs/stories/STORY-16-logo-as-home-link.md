# STORY-16: Use "Escala" wordmark as the home link, remove redundant "Início" nav item
Epic: EPIC-01
Status: draft

## User story
As a user, I want the "Escala" wordmark in the header to take me home, so
that the nav isn't cluttered with a redundant "Início" link doing the same
thing.

## Context
`components/AppHeader.tsx` renders `{t('name')}` ("Escala") as a plain,
non-interactive `<span>` (line 33). `components/AppNav.tsx` separately
renders an "Início" (Home) `<Link href="/">` nav item. Using the
logo/wordmark as the home link and dropping a separate "Home" nav entry is a
long-established, near-universal convention on both marketing sites and web
apps — this is **not** bad practice. The only requirement is preserving a
clear accessible name on the link (visible "Escala" text already satisfies
this; no icon-only ambiguity here).

The one real risk: several existing e2e specs currently interact with the
"Início" link, not just assert its presence:
- `e2e/user-widget-click-outside.spec.ts` clicks the "Início" link as a
  safe no-op target to test outside-click dismissal of the user menu.
- `e2e/member-gating.spec.ts` and `e2e/header-identity-widget.spec.ts` assert
  on the *count* of nav links (e.g. "1 nav link visible: Início" for Members,
  "3 nav links visible: Início, Utilizadores, Equipa" for Admins) to verify
  role-based nav gating.

Removing "Início" from `AppNav` changes both of these — they need
deliberate updates, not silent breakage.

## Acceptance criteria
1. Given a user is on any authenticated page, when they view the header, then
   "Escala" is rendered as a locale-aware link (`@/i18n/navigation` `Link`)
   with an href resolving to the home route.
2. Given a user clicks "Escala" in the header, when the click completes, then
   they land on the home page.
3. Given the "Início" item is removed from `AppNav`, when an Admin views the
   nav, then it shows exactly "Utilizadores" and "Equipa" (2 links, not 3);
   when a Member views the nav, then it shows 0 nav links (no bare/empty nav
   region left behind — decide whether the `<nav>` element should still
   render with just an aria-label for Members, or be omitted entirely, and
   document the choice).
4. Given `e2e/user-widget-click-outside.spec.ts` currently clicks "Início" as
   a no-op outside-click target, when this story ships, then that test is
   updated to click a different safe no-op element (e.g. the header
   background, or another stable non-menu element) so it keeps testing
   outside-click dismissal correctly.
5. Given `e2e/member-gating.spec.ts` and `e2e/header-identity-widget.spec.ts`
   assert on nav link counts/text including "Início", when this story ships,
   then both specs are updated to match the new nav contents and still pass.

## Out of scope
- Broader logo/branding redesign (colors, icon, etc.).
- Mobile nav collapse/hamburger patterns.
- Changing the `Nav.ariaLabel` landmark or overall header layout.

## Technical notes
- `components/AppHeader.tsx` line 33: wrap `{t('name')}` in a `Link` to `/`.
- `components/AppNav.tsx`: remove the `Início` `<li>` block (lines ~16-20).
- `messages/pt-PT.json`: `Nav.home` ("Início") becomes unused once removed
  from `AppNav` — per i18n key hygiene (CLAUDE.md), either delete it or
  repurpose it as an `aria-label` on the new logo link if a distinct
  "home"-labeled accessible name is wanted alongside the visible "Escala"
  text (probably unnecessary — visible text is already a clear accessible
  name — but flag for refiner judgment).
- Grep `e2e/*.spec.ts` for "Início" before implementing; at least 5 files
  reference it (see Context section above) — some are simple text
  assertions, one (`user-widget-click-outside.spec.ts`) depends on it as an
  interactive no-op click target and needs a functional replacement, not
  just a text swap.
- Complexity: `standard` (touches shared header/nav component + multiple
  e2e specs, low logic risk but broad touch surface).

## Definition of Done
See CLAUDE.md.
