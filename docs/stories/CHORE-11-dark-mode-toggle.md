# CHORE-11: Introduce dark mode (class-based toggle over existing tokens)
Epic: maintenance
Status: draft
Priority: low

## Task statement
As a user, I want to switch the app to a dark theme (or have it follow my
device preference), so that it's comfortable to use at night — e.g. checking
the schedule from a dimly lit sound booth on a Sunday.

## Context
The foundation is already in place from CHORE-01: `app/globals.css` contains a
complete `.dark` CSS-variable block (lines 26–46) mirroring every light token,
and a codebase-wide grep confirms **zero hardcoded colors** in `app/` and
`components/` — everything uses semantic tokens (`bg-background`,
`text-muted-foreground`, `bg-accent`, …). Dark mode is therefore a small
toggle-mechanism chore, not a repaint.

**Latent inconsistency to fix while here:** in Tailwind v4 the `dark:`
variants already present in `components/ui/button.tsx` respond to the OS
`prefers-color-scheme` media query by default, while the `.dark` token block
only activates via a class that nothing currently sets. A user whose OS is in
dark mode today gets a few dark button styles on an otherwise light page.
The fix is to make `dark:` class-driven with
`@custom-variant dark (&:is(.dark *));` in `globals.css`, so both systems key
off the same `.dark` class.

CHORE-01 explicitly listed dark mode as out-of-scope/nice-to-have; the user
has now asked for it "eventually" — hence Priority: low, schedule at will.

## Acceptance criteria
1. Given the app, when dark mode is active, then the `.dark` class is present
   on the `<html>` element and all pages (home, login, Utilizadores, Equipa)
   render with the existing dark token palette — no unreadable text, no
   left-over light surfaces.
2. Given a first-time visitor with OS-level dark preference, when the app
   loads, then dark mode is applied automatically (default to `system`).
3. Given a user explicitly picks light or dark (via a toggle in the user
   widget menu or equivalent), when they reload or navigate, then the choice
   persists (localStorage or equivalent) and overrides the OS preference.
4. Given the theme is applied on first paint, when a dark-preferring user
   loads any page, then there is no visible light-mode flash (FOUC) — the
   class must be set before hydration (inline script or `next-themes`'
   built-in handling).
5. Given `globals.css` after this chore, when `dark:` utilities are used
   anywhere, then they activate from the `.dark` class (via
   `@custom-variant dark (&:is(.dark *));`), not the media query — verifying
   the button variants no longer partially activate on OS preference alone.
6. Given the toggle control, when it renders, then its label/aria-label comes
   from `messages/pt-PT.json` (AO90) and it meets the 44px tap-target floor.
7. Given the dark palette, when the main screens are inspected, then text
   meets WCAG AA contrast (the stock shadcn dark values already do; verify
   nothing app-specific regresses).

## Out of scope
- Redesigning the dark palette (stock shadcn dark tokens are fine for v1).
- Per-page or per-component theme exceptions.
- Theming the future exported schedule image (EPIC-06 decides its own
  rendering; the export should likely always render light for legibility —
  note this for EPIC-06, don't solve it here).

## Technical notes
- Recommended: `next-themes` (`attribute="class"`, `defaultTheme="system"`,
  `enableSystem`) wrapped around the locale layout body; it handles AC4's
  no-flash requirement and AC3's persistence out of the box. A hand-rolled
  inline script + localStorage is an acceptable dependency-free alternative.
- Add `@custom-variant dark (&:is(.dark *));` near the top of
  `app/globals.css` (after `@import "tailwindcss"`).
- `<html>` is owned by `app/[locale]/layout.tsx` (locale layout pattern —
  CLAUDE.md); `next-themes`' provider must render inside it, and
  `suppressHydrationWarning` goes on the `<html>` tag.
- Toggle placement: the `/[locale]/settings` page introduced in STORY-21 is
  the natural home, alongside the display-name field and (CHORE-06) the
  language switcher — one consolidated account-preferences page rather than
  loose controls dropped into the `UserWidgetMenu` dropdown itself. Login
  page can simply follow system preference with no control.
- Complexity: **standard** — small surface but touches the root layout,
  hydration timing, and a Tailwind variant redefinition.

## Definition of Done
See CLAUDE.md.
