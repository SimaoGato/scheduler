# STORY-13: User identity widget — click outside to dismiss
Epic: EPIC-01
Status: draft

## User story
As a logged-in user, I want the user menu to close when I click anywhere
outside it, so that I don't have to click the trigger again just to dismiss
it.

## Context
STORY-12 implemented `UserWidget` using a native `<details>`/`<summary>`
element specifically because shadcn's `DropdownMenu`
(`@radix-ui/react-dropdown-menu`) was not installed at the time. CLAUDE.md
documents the resulting trade-off explicitly: "clicking outside does NOT
close the panel (browsers provide no native outside-click dismissal)... Only
use this pattern when ACs don't require click-outside behavior."

User feedback (2026-07-02 triage) confirms this trade-off is now a real
usability problem: users must click the avatar/name trigger a second time to
close the menu, rather than clicking anywhere else on the page as they would
expect from Gmail/GitHub-style menus (the exact reference pattern STORY-12
cited when choosing this UI).

This story revisits that accepted limitation. Two implementation paths are
worth weighing during Refine:
1. Keep the Server Component base and add a small `'use client'` wrapper
   that listens for outside clicks (and ideally Escape) and force-closes the
   `<details>` via a ref.
2. Install `@radix-ui/react-dropdown-menu` and migrate `UserWidget`'s trigger
   onto shadcn's `DropdownMenu`, which has this behavior built in. This
   requires promoting the trigger to a Client Component and adding a new
   dependency.

See EPIC-01 (app shell/navigation) and STORY-12 for prior context.

## Acceptance criteria
1. Given the user menu is open, when the user clicks anywhere outside the
   menu (header background, page body, another nav link), then the menu
   closes.
2. Given the user menu is open, when the user clicks the trigger itself
   again, then the menu still closes (existing toggle behavior preserved).
3. Given the user menu is closed, when the user clicks the trigger, then the
   menu still opens (regression check).
4. Given the fix, when the widget is rendered at a 375 px viewport, then no
   horizontal overflow is introduced (regression of STORY-12 AC4/AC5).
5. Given the user menu is open, when the user presses Escape, then the menu
   closes (nice-to-have for parity with standard menu UX; Refine may drop
   this if it meaningfully complicates the chosen approach — note the
   trade-off if dropped).

## Out of scope
- A full user settings/profile page.
- Changing what's inside the menu (name, role, sign out).
- Changing nav links or destinations.

## Technical notes
- `components/UserWidget.tsx` is currently an async Server Component using
  native `<details>`/`<summary>` (STORY-12).
- Whichever approach is chosen, keep SSR of the name/role content where
  possible to avoid a layout shift/flash on first paint.
- Once resolved, update the CLAUDE.md note under "Native `<details>`/
  `<summary>` as a lightweight dropdown" — it currently documents
  click-outside as an "acceptable limitation," which will no longer be
  accurate after this story ships. Supersede or qualify it, don't just leave
  it stale.
- Priority: normal — reported usability annoyance, not a functional defect.

## Definition of Done
See CLAUDE.md.
