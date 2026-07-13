# BUGFIX-06: Header/nav mobile overflow regression (Funções + Disponibilidade added after STORY-23's fix)
Status: draft
Related story: STORY-23 (fix-header-nav-mobile-overflow, done ✅, PR 28),
STORY-17 (added the "Funções" roles nav link after STORY-23 shipped),
STORY-26 (added the "Disponibilidade" nav link after STORY-23 shipped)
Epic: EPIC-01

## Bug
On a real phone (screenshot supplied by the user, ~390px-wide viewport), the
authenticated app header/nav renders broken: the nav links
("Disponibilidade", "Utilizadores", "Equipa") wrap onto a line *above* the
"Escala" logo, "Funções" (roles) is stranded alone on the following line far
to the right, and the user avatar drops to its own line below that — before a
large empty gap and the page content. This does not look like an
intentionally responsive layout; it looks broken.

STORY-23 (done ✅, PR 28) fixed a documented 375px horizontal-overflow bug in
`AppHeader.tsx` / `AppNav.tsx` / `UserWidget.tsx`, and its AC3 explicitly
required the fix to "not be a one-off measurement that breaks again the next
time a nav link is added." Git history shows STORY-23's fix commit
(`50aad0a`/`1845d20`) landed *before* STORY-17 added the "Funções" (roles)
nav link and STORY-26 added the "Disponibilidade" nav link — i.e., two nav
items were added to `AppNav.tsx` after the overflow fix, and neither story
re-verified the 375px no-overflow guarantee AC3 was meant to protect.

This gap wasn't caught by CI: the only authenticated-header overflow
assertions (`e2e/header-identity-widget.spec.ts` AC4/AC5) are gated behind
`test.skip(!process.env.E2E_WITH_AUTH, ...)` and never run in CI (no real
Supabase credentials there). `e2e/smoke.spec.ts`'s no-overflow test only
covers the *unauthenticated login shell*, not the authenticated header/nav —
despite a comment in `e2e/design-system.spec.ts` implying broader coverage
("the no-horizontal-overflow assertion at 375px is already covered by
smoke.spec.ts"), which is misleading for the authenticated chrome.

## Acceptance criteria
1. Given an admin user, when the header/nav render at a 375px viewport (and
   the reported ~390px real-device width) on `/pt-PT/`, then
   `document.documentElement.scrollWidth` is `<= 375` and the logo, nav
   links, and user avatar render in a sane, visually coherent arrangement
   (no nav content wrapping above the logo).
2. Given a member user, when the header/nav render at 375px on any page they
   can access, then the same no-overflow assertion holds.
3. Given the admin nav's current full set of links (Disponibilidade,
   Utilizadores, Equipa, Funções), when rendered at 375px, then all links
   remain reachable and usable (tap targets ≥ 44px) without a layout that
   reads as broken — visually confirm via a real-viewport screenshot, not
   just the scrollWidth assertion, since STORY-23's own AC1 metric didn't
   catch this class of "wraps but still ≤375px and still ugly" regression.
4. Given this fix, when a future story adds another nav link, then a CI-run
   (not `E2E_WITH_AUTH`-gated) test catches header/nav overflow or breakage
   automatically — close the coverage gap that let this regression ship
   twice. If full authenticated coverage in CI isn't feasible without real
   Supabase credentials, add a CI-safe static/structural check (see
   CLAUDE.md's "fallback pattern" precedent from BUGFIX-02) as a minimum
   bar, and keep the `E2E_WITH_AUTH`-gated visual test for local/manual
   verification.
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Redesigning the header's visual style (colors, spacing polish) — this
  story is a layout-correctness fix, not a redesign. See CHORE-18/CHORE-19
  for the separate visual-design work raised in the same triage round.
- A hamburger/collapsed-menu pattern — try layout fixes first (as STORY-23
  did); only reach for this if 4+ nav items genuinely can't fit without one,
  and document that decision if so.
- Non-header/nav mobile layout issues.

## Technical notes
- Reproduce first at 375px AND ~390px (the user's actual device width) with
  the current full admin nav (4 links) — STORY-23's original repro only had
  2-3 admin links.
- Likely root cause: `AppHeader.tsx`'s outer flex row (`flex items-center
  justify-between`, no wrap) versus the inner `flex min-w-0 flex-wrap
  items-center gap-2 sm:gap-4` wrapper around `<AppNav>` + `<UserWidget>` —
  and `AppNav.tsx`'s own `<ul className="flex flex-wrap justify-end gap-1">`
  — interact in a way that produces multi-level wrapping instead of a single
  clean reflow. Confirm the exact cascade via compiled CSS + real headless
  Chromium rendering at 375/390px (per CLAUDE.md's OS-delegated-rendering
  confidence note — this is ordinary DOM/CSS, so Linux sandbox verification
  should generalize).
- Consider whether nav items should collapse to icon-only or a single "Menu"
  affordance below a breakpoint, rather than trying to keep 4 full-text
  links + logo + avatar on one flexible row.
- Update `e2e/header-identity-widget.spec.ts` and `e2e/design-system.spec.ts`
  comments once the CI-coverage gap (AC4) is addressed, so they no longer
  imply coverage that doesn't exist.

## Definition of Done
See CLAUDE.md.
