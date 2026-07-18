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

## Implementation Plan

### Pre-flight verification (done during Refine)
- **CHORE-28 status confirmed**: `git log` shows CHORE-28 merged and archived
  to `docs/stories/done/CHORE-28-header-recolor-desktop-nav-design.md`
  (commits `251bbe3`…`e8818e5`). `components/AppHeader.tsx` and
  `components/AppNav.tsx` were read directly and confirm the shipped state:
  navy `--header`/`--header-foreground`/`--header-muted`/`--header-border`
  tokens exist and are contrast-verified in `app/globals.css`; `AppNav.tsx`
  has the brand-highlighted active-item classes and the
  `focus-visible:ring-header-foreground` CRITICAL fix. This chore can safely
  restyle onto that surface as the story's Technical notes intend — no
  CHORE-28 rework needed.
- **Context correction**: the story's AC7 references `e2e/app-nav.spec.ts`,
  but that file no longer exists at that path — CHORE-15 migrated it to
  `e2e-integration/app-nav.spec.ts` (STORY-16/17/26 content, unrelated to
  this chore). The plan below uses the real path.
- **AppNav today has no "Home" link** (the header wordmark/logo Link is
  desktop's Home affordance) and **no "Settings" link** (Settings lives in
  `UserWidgetMenu`'s dropdown, `components/UserWidgetMenu.tsx`). The bottom
  bar needs both as explicit tabs (mockup + AC1), so `Nav.home` is a new
  label (distinct from the removed-in-STORY-26 "Início" desktop link — this
  is a different, mobile-only affordance) and the Settings tab reuses the
  existing `Auth.settingsLink` string rather than duplicating it.
- **Home page already has a "quick links" Card** (`app/[locale]/(app)/page.tsx`
  lines ~384-403, from STORY-30) linking to `/admin/people`, `/admin/roles`,
  `/admin/users` using `Nav.people`/`Nav.roles`/`Nav.userManagement`. The new
  Manage hub reuses these exact same three labels for its card titles
  (i18n hygiene: don't duplicate strings that already exist for the same
  destinations) and is unrelated/independent from that Card (out of scope
  to touch the home page's quick-links Card — it stays as-is for desktop).
  **Documented gap (Challenge cycle 1 WARNING, not fixed by this chore)**:
  that Card is rendered as plain page content with no `sm:` breakpoint gate
  of its own, so it stays visible at mobile widths too. After this chore
  ships, a mobile admin on the home page will see **two parallel paths** to
  Team/Roles/Users: the existing Quick access Card (STORY-30) *and* the new
  bottom-bar Manage tab / Manage hub. This is left out-of-scope deliberately
  — the story's own out-of-scope list says "only presentation of existing
  destinations," and touching the home page's Card would be a separate,
  unrelated content change — but it must be called out explicitly in the PR
  description as a known, accepted duplication rather than silently shipped.
  A future story (candidate: fold into STORY-30/EPIC-05 follow-up, or a new
  small chore) can decide whether to hide that Card at mobile widths now
  that the Manage hub covers the same destinations there.

### Chosen breakpoint: `sm` (640px), not the mockup's 700px
The mockup's `s.isMobile` gate is an arbitrary prototype value with no other
CSS anchor. This app already has exactly one established mobile gate — the
Tailwind `sm` breakpoint (640px) — used consistently by
`AppHeader.tsx`/`AppNav.tsx`/`UserWidgetMenu.tsx` (BUGFIX-06, CHORE-28) to
decide "mobile vs. desktop chrome". Introducing a second, different
breakpoint (700px) just for the bottom bar would create a 640–700px dead
zone where the inline `AppNav` (visible at `≥sm` today, per current code —
CHORE-28 never hid it at any width, it only ever wrapped/restyled) would
render **at the same time as** the bottom bar (hidden only below 700px in
the mockup's gate), i.e. both navs visible simultaneously between 640 and
700px. Reusing `sm` for the bottom bar instead makes "inline nav visible"
and "bottom bar hidden" flip at exactly the same viewport width, with no
gap or overlap. Single source of truth, zero new Tailwind config, consistent
with every other responsive decision in this codebase.

### File list

**New:**
- `components/BottomNav.tsx` — `'use client'`, mirrors `AppNav.tsx`'s
  `usePathname`-from-`@/i18n/navigation` + prefix-match active-state pattern.
- `app/[locale]/(app)/admin/manage/page.tsx` — Server Component, admin-only,
  per-page guard convention.

**Modified:**
- `components/AppHeader.tsx` — add `hidden sm:block` to the existing
  `<div className="w-full min-w-0 sm:order-2 sm:w-auto sm:ml-auto">` wrapper
  around `<AppNav />` (one class addition, no logic change). **Precise prune
  scope** (re-read against the actual file to fix the earlier imprecise
  "~52-84" citation, which overlapped content that must be kept):
  - Lines 52-61 (the "DOM order is Link -> avatar -> nav, matching the
    mobile (<sm) visual order exactly... no CSS `order` at all is used for
    the mobile case" paragraph, up to but not including "ACCEPTED RISK") —
    **prune/replace**. This is now dead reasoning: `AppNav` is `display:none`
    below `sm`, so it never participates in the mobile flex flow or wraps at
    all. Replace with a short note that mobile chrome is now `BottomNav`
    (this story).
  - Lines 62-79 (the "ACCEPTED RISK (BUGFIX-06 cycle 2...)" paragraph,
    describing the **desktop** (`>=sm`) DOM-order-vs-tab-order divergence
    between the avatar and `AppNav`) — **keep verbatim, untouched**. This
    chore doesn't change any `sm:order-*` class, so the desktop risk
    described here is still accurate and still load-bearing.
  - Lines 85-90 (the second comment, directly above the `AppNav` wrapper
    div: "Mobile (<sm): no order override — this div is the third DOM
    child so it naturally renders as row 2+, full width, wrapping its own
    `<ul>`...") — **prune/replace**. This becomes false the moment `hidden`
    is added to that wrapper: there is no more row-2 wrapping behavior to
    describe on mobile, because the div doesn't render at all below `sm`.
    Replace with a short note that mobile presentation moved to
    `BottomNav` and only the desktop `sm:order-2`/`sm:ml-auto` repositioning
    is still in effect for this wrapper.
- `app/[locale]/(app)/layout.tsx` — becomes `async`; calls
  `getSessionUser()`/`getUserProfile(user.id)` — the **same** function
  `AppHeader.tsx` already calls with the same argument (not `getUserRole()`,
  which the original plan proposed) — and derives `role` from
  `profile?.role ?? null`. Both are `cache()`-wrapped per-request, and
  because `AppHeader` renders on *every* `(app)` page and already calls
  `getUserProfile(user.id)` with the identical argument, this dedupes to
  zero extra Supabase round-trips **on every route**, not just the routes
  that happened to already call `getUserRole` (the original plan's claim
  only held for `admin/roles/page.tsx` and the home page; it did not hold
  for `settings/page.tsx`, which calls `getUserProfile` not `getUserRole`,
  or `availability/page.tsx`, which calls neither — both would have been a
  genuine second round-trip under the old plan). Wraps `{children}` in a
  div carrying the mobile-only bottom padding; renders
  `<BottomNav role={role} />` **right after `<AppHeader />` and before
  `{children}`** (not last, as originally planned — see CRITICAL fix below):
  ```tsx
  <div className="flex min-h-screen flex-col">
    <AppHeader />
    <BottomNav role={role} />
    <div className="flex-1 pb-[calc(110px_+_env(safe-area-inset-bottom))] sm:pb-0">
      {children}
    </div>
  </div>
  ```
  **CRITICAL fix (Challenge cycle 1)**: the original plan rendered
  `<BottomNav>` as the *last* child, after `{children}`, reasoning it
  should be "last in DOM/tab order." Because the bar is `position: fixed`,
  its DOM position has zero effect on where it's painted — but it has a
  real, harmful effect on keyboard tab order: a keyboard user would have
  had to Tab through every piece of page content (forms, tables, links)
  before ever reaching primary navigation, directly undercutting AC6's
  "sensible order" requirement and the story's own "one thumb-tap away"
  goal (which becomes "many-tab-presses away" for keyboard users on long
  pages like `/admin/people`). Moving `<BottomNav>` to right after
  `<AppHeader />` makes it the *second* focusable region on the page —
  reachable in a small, bounded number of Tab presses regardless of page
  content length — mirroring how the fixed bar is visually the first thing
  below the header on mobile. See the new test assertion added to AC6 in
  the Test plan section below, which bounds exactly how many Tab presses
  are needed to reach the bar.
  **Gotcha to flag for the implementer**: Tailwind v4 arbitrary values encode
  literal spaces as `_`. CSS `calc()` *requires* whitespace around `+`/`-`
  operators, so the class must be
  `pb-[calc(110px_+_env(safe-area-inset-bottom))]`, not
  `pb-[calc(110px+env(safe-area-inset-bottom))]` (invalid calc — Tailwind
  will either drop the utility or emit broken CSS). Verify by inspecting the
  compiled CSS chunk under `.next/static/chunks/*.css` (Turbopack location,
  per CLAUDE.md), not just that `npm run build` exits 0.
  This wrapper-div approach is deliberately chosen over touching every
  page's own `<main className="... py-8">` (11 occurrences across
  `page.tsx`, `availability/page.tsx`, `admin/people/page.tsx`,
  `admin/roles/page.tsx`, `admin/users/page.tsx`, `settings/page.tsx`,
  `admin/people/[id]/skills/page.tsx`, `admin/people/[id]/availability/page.tsx`,
  plus the new Manage hub) — centralizing in the one shared layout file
  the story's own Technical notes point to avoids missing a page today and
  avoids future pages silently forgetting the padding.
- `messages/pt-PT.json`, `messages/en.json` — new keys (see below).

**Test files:**
- `e2e-integration/header-nav-mobile-overflow.spec.ts` — **rewritten**.
  BUGFIX-06's specific bug (an AppNav `<li>` wrapping above the logo) is
  structurally impossible once `AppNav` is `display:none` below `sm` — there
  is no more inline nav in the mobile DOM to wrap. Repurpose the file (same
  filename, updated header comment referencing CHORE-22 supersession, same
  `WIDTHS = [375, 390]` parametrization, same `adminPage`/`memberPage`
  fixtures) to assert **no horizontal overflow** with the bottom bar present
  and capture the same tap-target + screenshot evidence, now against
  `BottomNav`'s tabs instead of `AppNav`'s links.
- `e2e-integration/mobile-bottom-nav.spec.ts` — **new**. Role-gated tab sets
  (AC1), active-tab matching including the Team/Roles/Users→Manage
  aggregation (AC2), single `<nav>` landmark at both mobile and desktop
  widths with no duplicate announcement (AC6), keyboard reachability (AC6),
  and desktop absence of the bar (AC5, cross-checked against
  `app-nav.spec.ts`'s existing unmodified desktop assertions).
- `e2e-integration/admin-manage-hub.spec.ts` — **new**. Hub renders three
  card links with i18n'd title+description navigating to the right routes,
  ≥44px tap targets (AC3); a member hitting `/admin/manage` directly is
  redirected via the per-page admin guard (`?denied=1`) (AC3).
- `e2e/header-surface-tokens.spec.ts` — **extended** with one new test:
  `--brand` (as literal text color, not the existing solid-fill pairing)
  on `--header` meets WCAG AA (≥4.5:1) in both themes. This is the first
  live consumer of `text-brand` directly against `--header` (previously only
  verified as a solid `bg-brand`/`text-brand-foreground` pairing, CHORE-23).
  Pre-computed via the same HSL→sRGB→luminance→ratio method this file
  already uses (double-checked independently in Python during Refine):
  **light ≈ 7.09:1, dark ≈ 7.45:1** — comfortably clears AA, no new token
  needed. `--header-muted` on `--header` is *already* covered by this file's
  existing `AC2` test (6.92:1 light / 6.84:1 dark) — BottomNav's inactive
  tab color becomes that token's first live consumer; no new test needed
  for it, just note the consumer in a code comment per that file's own
  "forward infrastructure" convention.
- `e2e/i18n-key-parity.spec.ts` — no changes needed; it already generically
  diffs all keys between locale files, so it will automatically catch any
  parity gap in the new keys below.

### i18n keys to add (both `messages/pt-PT.json` and `messages/en.json`)

`Nav` (existing namespace, add two keys):
- `home`: pt-PT `"Início"` / en `"Home"`
- `manage`: pt-PT `"Gerir"` / en `"Manage"`

`Manage` (new namespace — hub page title + card descriptions; card *titles*
reuse `Nav.people`/`Nav.roles`/`Nav.userManagement`, not new keys):
- `title`: pt-PT `"Gerir"` / en `"Manage"`
- `teamDescription`: pt-PT `"Gerir pessoas da equipa"` / en `"Manage people on the team"`
- `rolesDescription`: pt-PT `"Gerir funções e vagas por domingo"` / en `"Manage roles and slots per Sunday"`
- `usersDescription`: pt-PT `"Gerir contas de utilizador"` / en `"Manage user accounts"`

No new key for the bottom bar's `aria-label` — it reuses `Nav.ariaLabel`
("Navegação principal"/"Main navigation"). Rationale: `AppNav`'s `<nav>` and
`BottomNav`'s `<nav>` are mutually exclusive via CSS (`hidden sm:block` /
`sm:hidden`), so exactly one is ever present in the accessibility tree at a
given viewport — reusing the label is accurate (same semantic landmark,
relocated) and avoids an unnecessary new key.

### Role-gating approach
No new logic. `BottomNav` receives `role: 'admin' | 'member' | null` as a
prop (same shape as `AppNav`'s existing `Props`) computed via the same
`getSessionUser`/`getUserProfile` `cache()`-wrapped helpers already used by
`AppHeader.tsx`, now also called once in `layout.tsx` (see the Warning fix
in the File list above — `getUserProfile`, not `getUserRole`, is the call
that guarantees zero extra round-trips on every route). `BottomNav` returns
`null` for `role !== 'admin' && role !== 'member'` (STORY-16 "return null
when empty" convention, same guard `AppNav.tsx` already has). The Manage tab
is only ever included in the tab array when `role === 'admin'`.

### Active-tab-matching logic
```tsx
const tabs = [
  { href: '/', label: t('home'), isActive: (p: string) => p === '/' },
  {
    href: '/availability',
    label: t('availability'),
    isActive: (p: string) => p === '/availability' || p.startsWith('/availability/'),
  },
  ...(role === 'admin'
    ? [{
        href: '/admin/manage',
        label: t('manage'),
        isActive: (p: string) =>
          p === '/admin/manage' ||
          p.startsWith('/admin/manage/') ||
          p.startsWith('/admin/people') ||
          p.startsWith('/admin/roles') ||
          p.startsWith('/admin/users'),
      }]
    : []),
  { href: '/settings', label: tAuth('settingsLink'), isActive: (p: string) => p === '/settings' },
];
```
Notes:
- Home's matcher is deliberately **exact-only** (`p === '/'`), not the
  `AppNav` prefix pattern — `'/'` is a prefix of every path, so
  `startsWith('/')` would make Home permanently "active" everywhere. This is
  the one place this story's active-matching *must* diverge from `AppNav`'s
  existing helper, and is worth a code comment referencing why.
- Manage's matcher explicitly ORs in `/admin/people`, `/admin/roles`,
  `/admin/users` prefixes (covering their sub-routes too, e.g.
  `/admin/people/[id]/skills`) — this is AC2's "Team/Roles/Users mapping to
  the Manage tab" requirement, verbatim.
- The array-of-objects shape (not a hardcoded JSX list) is what makes
  "adding a Schedule tab later is trivial" (out-of-scope note) concretely
  true: STORY-31/EPIC-05 adds one object to this array.
- Structure the tab array so `Nav.home`/`Nav.manage`/`Auth.settingsLink`
  reuse existing `useTranslations('Nav')` plus one `useTranslations('Auth')`
  call in the same client component (two hooks, both cheap, same pattern
  `AppHeader.tsx` already uses server-side for `App`+`Auth`+`UserManagement`
  namespaces).

### Visual spec (from `bottomBarStyle`/`mobileTabs`/`isManage`, mapped to real tokens)
- Bar: `fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around
  border-t border-header-border bg-header px-1.5 pt-2
  pb-[calc(8px_+_env(safe-area-inset-bottom))] sm:hidden` (mobile-first:
  visible by default, hidden at `sm:`).
- Each tab: plain `<Link>` (not the shadcn `Button` primitive — the
  icon-less two-line flex-col label+indicator shape doesn't fit `Button`'s
  pill-shaped variants, and nothing in the house pattern mandates `Button`
  for every clickable element), `flex-1 min-h-[48px] flex flex-col
  items-center justify-center gap-1 text-xs font-semibold` — 48px comfortably
  clears the 44px WCAG floor.
- Text color: `text-brand` when active, `text-header-muted` when inactive —
  both verified above.
- Indicator: `h-1 w-5 rounded-full` with `bg-brand` when active,
  `bg-transparent` otherwise (mockup's `dotStyle`).
- Focus ring: reuse `focus-visible:ring-header-foreground` (CHORE-28's
  header-aware ring fix) on every tab `<Link>` — same surface, same landmine
  the shared Button base's default `ring-ring/50` would hit if these used
  `Button`, so apply the override directly since these are plain `<Link>`s.
- Manage hub card rows (`manageLinkStyle`): `flex min-h-[44px] items-center
  justify-between gap-3 rounded-lg border p-4 hover:bg-accent
  hover:text-accent-foreground transition-colors`, title `font-semibold`,
  description `text-sm text-muted-foreground`, trailing arrow `aria-hidden="true"`
  (decorative, must not be read by screen readers as part of the link's
  accessible name).
- Manage hub descriptions are **static copy**, not live `peopleCount`/
  `rolesCount` numbers the mockup shows — deliberate scope trim: fetching
  those counts would duplicate `admin/people`/`admin/roles` page queries and
  risks the STORY-30 "two counts must share the same scope filter" trap for
  a low-value hub page. This is presentation-only per the story's own
  out-of-scope note ("only presentation of existing destinations").

### Step-by-step approach (test-first where practical)
1. Add the four new `Nav.home`/`Nav.manage` + `Manage.*` keys to both locale
   files. Run `e2e/i18n-key-parity.spec.ts` to confirm parity (should
   already pass since both files are edited together).
2. Add the new `--brand`-on-`--header` contrast test to
   `e2e/header-surface-tokens.spec.ts` (red — no consumer yet, but the test
   itself only reads `globals.css`, so it's actually green immediately since
   the tokens already exist; there's no red step here, just add the
   assertion as forward documentation, matching this file's own
   `--header-muted` precedent).
3. Build `components/BottomNav.tsx` with the tab array above; unit-verify
   active-matching manually against the route list before wiring in. Each
   tab `<Link>` gets `aria-current="page"` when its `isActive(pathname)`
   matcher returns true, mirroring `AppNav.tsx`'s existing pattern exactly
   (same attribute, same conditional-application approach) — this is what
   AC2's "active tab" state and the AC2/AC6 test assertions below key off.
4. Wire `BottomNav` into `app/[locale]/(app)/layout.tsx` **directly after
   `<AppHeader />` and before `{children}`** (not after `{children}` — see
   the CRITICAL keyboard-order fix in the File list above) alongside the
   `getUserProfile`-based role-fetch and padding wrapper.
5. Add `hidden sm:block` to `AppHeader.tsx`'s nav wrapper; prune the two
   stale comments at the precise line ranges called out in the File list
   above (lines 52-61 and lines 85-90), leaving the lines 62-79 ACCEPTED
   RISK paragraph untouched.
6. Build `app/[locale]/(app)/admin/manage/page.tsx` (guard → translations →
   three card links), reusing `Nav.people`/`Nav.roles`/`Nav.userManagement`
   for titles.
7. Write/rewrite the four test files (red first for the two brand-new
   integration specs — write assertions against the not-yet-built
   `BottomNav`/hub page, confirm they fail, then confirm green after steps
   3-6).
8. Manual verification pass (see below) for safe-area rendering and visual
   coherence, since headless Chromium cannot emulate a real device notch.
9. Run the full Definition of Done gate: `npm run lint`, `npx tsc --noEmit`,
   `npm run build`, `npm run test:e2e` (smoke) and the integration suite.

### Test plan mapped to acceptance criteria
- **AC1** (bottom bar visible at mobile, role-appropriate tabs, ≥44px,
  accessible name, i18n both locales): `mobile-bottom-nav.spec.ts` — for
  both `adminPage` and `memberPage` at 375px, assert `BottomNav`'s `<nav>`
  is visible with the exact expected tab set (member: 3, admin: 4) using the
  real pt-PT strings extracted from `messages/pt-PT.json`
  (`Nav.home`/`Nav.availability`/`Nav.manage`/`Auth.settingsLink`), and each
  tab's `boundingBox().height >= 44` (after `toBeVisible()` per CLAUDE.md's
  `boundingBox()` guard). i18n key parity is covered structurally by
  `i18n-key-parity.spec.ts`.
- **AC2** (active-tab indicator incl. Team/Roles/Users→Manage; WCAG AA
  contrast both themes): `mobile-bottom-nav.spec.ts` — navigate to `/`,
  `/availability`, `/admin/people`, `/admin/roles`, `/admin/users`,
  `/settings` as admin and assert `aria-current="page"` lands on the
  expected tab each time (Manage active for all three admin sub-routes).
  Contrast: the new test in `header-surface-tokens.spec.ts` (static,
  CI-safe, no browser needed).
- **AC3** (Manage hub cards, admin-only, member gets per-page redirect):
  `admin-manage-hub.spec.ts` — `adminPage` navigates to `/pt-PT/admin/manage`,
  asserts three links with real i18n'd text (Team/Roles/Users titles +
  descriptions) each `boundingBox().height >= 44`, clicking each navigates to
  the right existing route; `memberPage` navigates directly to
  `/pt-PT/admin/manage` and asserts redirect to `/pt-PT/?denied=1` with the
  access-denied banner visible (existing `showDeniedBanner` mechanism, no
  new logic).
- **AC4** (content bottom padding + safe-area, bar never covers content):
  Two-part per the CHORE-13 "invisible mechanism" split — (1) CI-safe static
  check in `mobile-bottom-nav.spec.ts` or a new small spec: read
  `app/[locale]/(app)/layout.tsx` source (or compiled CSS) and assert the
  `env(safe-area-inset-bottom)` calc is present in both the content wrapper
  and the bar's own bottom padding; (2) scroll a long page (e.g.
  `/admin/people` with several rows, or `/pt-PT/` home) to the bottom at
  375px and assert the last visible content's bounding box bottom edge is
  above the bar's bounding box top edge (`contentBox.bottom <=
  barBox.top`). Real device/notch behavior is a **manual verification**
  step (documented below), not automatable in headless Chromium (BUGFIX-05
  precedent: OS-delegated rendering needs a real spot-check).
- **AC5** (desktop ≥1280px: bar and hub absent, inline nav unchanged):
  `mobile-bottom-nav.spec.ts` at 1280px asserts `BottomNav`'s `<nav>` has
  `toHaveCount(0)` in the accessibility tree (i.e. not matched by
  `getByRole`, since `sm:hidden` removes it); existing
  `e2e-integration/app-nav.spec.ts` stays **unmodified** and passing,
  proving the desktop inline nav is untouched. Note: the `/admin/manage`
  *route* itself still exists and renders at any viewport if visited
  directly by URL (Next.js has no viewport-conditional routing) — "absent"
  means absent from the default discoverable UI/flow, not that the route
  404s at desktop widths; this reading is stated explicitly here so
  Challenge/Review don't misinterpret AC5 as requiring a desktop route
  block.
- **AC6** (keyboard reachable, `<nav>` landmark, no duplicate announcement):
  `mobile-bottom-nav.spec.ts` — at 375px and at 1280px, assert exactly one
  `getByRole('navigation', { name: 'Navegação principal' })` exists (proves
  no double-landmark at either breakpoint); Tab-key walk from the top of the
  page confirms each `BottomNav` link is reachable and, on Enter, navigates
  correctly. **New assertion (Challenge cycle 1 CRITICAL fix)**: at 375px,
  starting from the top of a content-heavy page (e.g. `/admin/people`),
  press Tab a small, bounded number of times (e.g. no more than the header's
  own two focusable controls — the wordmark `Link` and the avatar/user-menu
  trigger — plus one) and assert `document.activeElement` is inside
  `BottomNav`'s `<nav>` by that point. This proves the bar is reachable
  shortly after the header, not after all page content, and would fail if a
  future regression moved `<BottomNav>` back to being the last DOM child.
- **AC7** (existing specs: desktop unmodified, mobile rewritten, new
  coverage, screenshot artifact): `e2e-integration/app-nav.spec.ts` — run
  unmodified, must still pass (desktop-only, default Playwright viewport is
  1280×720, no viewport override in that file, confirmed by reading it).
  `e2e-integration/header-nav-mobile-overflow.spec.ts` — rewritten in place
  per above, screenshot capture preserved at
  `test-results-integration/*.png`. Call out the rewrite explicitly in the
  PR description (anticipated test change, per AC7's own wording).
- **AC8** (lint/tsc/build/test:e2e all exit 0): final gate, run all four
  commands plus the integration config
  (`npx playwright test --config=playwright.integration.config.ts`) locally
  before marking ready.

### Manual verification notes (non-automatable in headless Chromium)
- Real-phone or DevTools safe-area-inset emulation: confirm the bottom bar
  sits above the home-indicator gesture bar and content doesn't get clipped
  underneath it on an iPhone-class device (notch/home-indicator simulation).
- Visual screenshot review of the two new
  `test-results-integration/bugfix-06-*-{375,390}.png`-equivalent artifacts
  (renamed appropriately) to confirm the bar and indicator read as
  intentional, not broken — same human-judgment gate BUGFIX-06 established.

### Risks and rollback
- **Blast radius**: `layout.tsx` and `AppHeader.tsx` wrap every authenticated
  page. A mistake in the padding wrapper or a `BottomNav` render error would
  break every page, not one screen — this is the primary reason for the
  `standard` (not `trivial`) complexity tag below.
- **Active-tab matcher bugs** (e.g. Home's exact-match vs. prefix-match)
  are easy to get subtly wrong and would silently mis-highlight tabs without
  crashing anything — mitigated by the explicit AC2 route-by-route test
  above covering all six representative paths, not just the happy path.
- **Tailwind arbitrary-value calc() syntax** (`_` vs literal space) is a
  known sharp edge (documented above) — verify via compiled CSS output, not
  just a green build.
- **Safe-area rendering** cannot be proven correct by CI alone (BUGFIX-05
  precedent: OS-delegated rendering); flagged as a manual verification gate,
  not silently assumed correct from a passing headless suite.
- **Known, accepted duplication (not a defect)**: the home page's existing
  admin-only Quick access Card (STORY-30) has no mobile-hiding breakpoint
  and will keep rendering alongside the new Manage tab/hub, giving mobile
  admins two paths to the same three destinations. Documented explicitly
  above and must be called out in the PR description — not a silent gap.
- **Rollback**: every change is additive or a small, isolated edit
  (one class addition + one comment prune in `AppHeader.tsx`; new files for
  `BottomNav`/hub page; a wrapping div + one hook call in `layout.tsx`) — a
  revert of the PR's commits cleanly restores CHORE-28's shipped state with
  no migration or data to unwind.

### Complexity tag: **standard**
Justification: this touches shared, global chrome (`app/[locale]/(app)/layout.tsx`,
`components/AppHeader.tsx`) that wraps every authenticated page in the app —
per CLAUDE.md's reasoning-risk override, that alone rules out `trivial`
regardless of how small any individual diff looks. It also introduces a new
multi-file feature (client component with route-matching logic + a new
guarded route + locale files + rewritten/new test suites across 4 files),
squarely fitting the default `standard` bucket ("multi-file, requires
understanding of at least two modules"). It does **not** reach `complex`:
no auth/guard *logic* changes (the per-page admin guard and role source are
reused verbatim, zero new decision logic there), no concurrency, no money,
no new database schema, and no genuinely novel Next.js 16 API surface — every
pattern used here (`usePathname`/`Link` from `@/i18n/navigation` in a client
component, the per-page admin guard, `searchParams` handling, `cache()`
role-fetching) is copied from an already-shipped, already-proven precedent
elsewhere in this exact codebase, which directly mitigates AGENTS.md's
"breaking changes" caution — we are not exploring new framework territory,
just recomposing known-working pieces into a new layout.
