# CHORE-22: Mobile bottom tab bar + Manage hub (replaces inline nav on phones)
Epic: maintenance
Priority: standard (explicit user dissatisfaction with current mobile nav;
the updated design mockup now specifies the concrete replacement)
Status: draft
Related: BUGFIX-06 (header-nav-mobile-overflow-regression, functional fix —
superseded on mobile by this chore), CHORE-28 (header recolor/desktop nav —
owns ≥sm chrome), CHORE-31 (Settings redesign — the bottom bar's Settings
tab lands there), updated mockup in
`App design refinement/Escala Dashboard.dc.html` (`bottomBarStyle`,
`mobileTabs`, `isManage` block)

> **Direction change (2026-07-18 triage):** this chore originally proposed a
> hamburger menu, based on the user's tentative quote ("hamburger menu or
> whatever, i dont know — just for phone"). The user has since updated the
> design mockup, which resolves that "or whatever" concretely: a **fixed
> bottom tab bar** on mobile, plus a **Manage hub page** that collapses the
> admin-only links. This rewrite supersedes the hamburger direction.
> Re-confirm with the user at Refine if in doubt.

## Task
As any user on a phone, I want the app's navigation as a fixed bottom tab
bar (like a native app) instead of nav links stacked under the header, so
the header is compact, content starts higher, and main sections are always
one thumb-tap away.

## Context
The updated mockup specifies, below a mobile breakpoint (mockup uses
700px; this app's established mobile gate is `sm`/640px — Refine picks
one and states why):

- **Bottom bar** (`bottomBarStyle`): fixed to the viewport bottom, on the
  navy header surface, with `env(safe-area-inset-bottom)` padding. Tabs
  render as icon-less label buttons with a small accent indicator bar on
  the active tab, muted text otherwise, `minHeight: 48`.
- **Tabs (member)**: Home · Availability · Settings. **Tabs (admin)**:
  Home · Availability · Manage · Settings. (The mockup also shows a
  Schedule tab — that arrives with STORY-31/EPIC-05, not this chore; the
  bar must make adding it later trivial.)
- **Manage hub** (`isManage` block): a mobile-only page listing the
  admin-only destinations (Team, Roles, Users) as full-width card link
  rows (title + muted description + trailing arrow). Active-tab state for
  Manage also covers being *inside* Team/Roles/Users.
- **Content padding**: main content gets bottom padding (mockup: 110px) so
  the fixed bar never covers page content.
- Desktop (≥ breakpoint) keeps the inline header nav — this chore is
  mobile-only. The mockup also moves Settings out of the desktop nav into
  a small header button; that desktop concern belongs to CHORE-28, not
  here.

BUGFIX-06 fixed the *functional* wrapping/overflow of the old always-
visible nav rows. This chore removes that mobile layout entirely; the
`sm:order-*`/`ml-auto` arrangement documented in `AppHeader.tsx` remains
load-bearing for desktop only — update the stale mobile reasoning in that
comment block.

## Acceptance criteria
1. Given the app at 375px/390px viewport, when any `(app)` page renders,
   then no inline nav links appear under the header; instead a fixed
   bottom tab bar is visible with the role-appropriate tabs (member:
   Home/Availability/Settings; admin: + Manage), each tab having a ≥44px
   tap target, an accessible name, and labels from i18n keys in both
   locale files.
2. Given the bottom bar, when the current route matches a tab (including
   Team/Roles/Users mapping to the Manage tab), then that tab shows the
   active accent indicator; all tab text meets WCAG AA contrast on the
   bar surface in both themes.
3. Given an admin taps Manage, when the hub renders, then it lists Team,
   Roles, and Users as full-width card link rows (≥44px, i18n'd
   title + description) navigating to the existing routes; a member
   never sees the Manage tab or hub (direct navigation to the hub as a
   member follows the existing per-page admin-guard convention).
4. Given any scrollable page at mobile width, when scrolled to the
   bottom, then the fixed bar does not cover the last content (bottom
   padding applied) and honors `env(safe-area-inset-bottom)`.
5. Given the app at ≥1280px (and ≥ the chosen breakpoint), when rendered,
   then the bottom bar and Manage hub are absent and today's inline nav
   renders unchanged (BUGFIX-06's desktop arrangement intact).
6. Given a keyboard user at mobile width, when tabbing, then bar tabs are
   reachable and operable in a sensible order; the bar is a `<nav>`
   landmark with an accessible label, and is not announced twice alongside
   the (removed-on-mobile) header nav.
7. Given existing nav specs (`e2e/app-nav.spec.ts`,
   `e2e-integration/header-nav-mobile-overflow.spec.ts`), when this
   ships, then desktop assertions pass unmodified; mobile-width assertions
   are rewritten for the bottom-bar DOM (an anticipated test change —
   call it out in the PR), plus new coverage for AC1–AC4 including a
   screenshot artifact at 375px per the BUGFIX-06 evidence pattern.
8. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Desktop (≥sm) nav behavior, the header recolor, and the desktop
  Settings-button placement — CHORE-28.
- A Schedule tab — arrives with the schedule pages (STORY-31/EPIC-05);
  just don't hardcode the bar in a way that makes adding a tab painful.
- Icons for tabs — the mockup uses text labels + indicator dot only; if
  icons are ever wanted that's a later polish pass.
- Changing role-gating logic — only presentation of existing destinations.

## Technical notes
- Primary files: `components/AppHeader.tsx`, `components/AppNav.tsx`, a
  new bottom-bar client component, a new
  `app/[locale]/(app)/admin/manage/page.tsx` (or similar) hub page, and
  `app/[locale]/(app)/layout.tsx` for the content bottom padding.
- The bar needs the current route for active state → `'use client'` with
  `usePathname` from `@/i18n/navigation` (locale-aware), unlike the
  server-rendered `AppNav`.
- Role gating: reuse the same role source `AppNav` uses today; member gets
  no Manage tab (STORY-16 "return null when empty" spirit — never an
  empty hub).
- Fixed positioning + `env(safe-area-inset-bottom)`: test on a real phone
  or emulated safe-area, not just desktop devtools.
- Manage hub is admin-only → follow the per-page admin guard convention
  (CLAUDE.md) with `?denied=1` redirect.
- Land after CHORE-28 if possible so the bar restyles onto the already-navy
  surface (orchestrator decision, per CLAUDE.md multi-story guidance).

## Definition of Done
See CLAUDE.md.
