# BUGFIX-06: Header/nav mobile overflow regression (Funções + Disponibilidade added after STORY-23's fix)
Status: implemented
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

## Implementation Plan

### Revision note (cycle 1 — addressing Challenger NEEDS REVISION)

Changes made in this revision, in response to the Challenger's findings:

1. **CRITICAL #1 (DOM/tab order vs. visual order — WCAG SC 2.4.3 / SC 1.3.2):**
   Design decision 1's JSX order is now `Link (logo) → avatar-div →
   nav-div` — native DOM order — instead of `Link → nav-div → avatar-div`
   with mobile `order-*` overrides. All unprefixed `order-*` classes are
   removed; only `sm:order-2` (nav) and `sm:order-3` (avatar) apply at the
   desktop breakpoint to restore the current desktop grouping. At mobile
   (the default, unprefixed state) DOM order == visual order == tab order,
   with zero CSS `order` involved — this is now the first bug-free use of
   `order` in the codebase (desktop-only, additive override, not the
   default layout mechanism).
2. **CRITICAL #2 (390px coverage):** the persisted
   `e2e-integration/header-nav-mobile-overflow.spec.ts` plan (Design
   decision 2) now parametrizes every admin/member positional and
   scrollWidth assertion over `[375, 390]` — both are CI-enforced, not just
   375px with a 390px manual spot-check.
3. **WARNING #3 (justify-end / stranded item):** the root-cause narrative's
   incorrect "left-aligned" description is corrected to "right-aligned,
   because `AppNav.tsx`'s `<ul className="flex flex-wrap justify-end
   gap-1">` is unchanged." A new subsection under Design decision 1
   explicitly reconciles this with the fix and calls out the "lone last
   item (e.g. admin's 4th link, 'Funções') stranded alone on the right edge
   of its own wrapped row" pattern. The screenshot verification step (AC3)
   is updated to explicitly check for this pattern rather than trusting the
   prose claim that the layout "looks clean."
4. **WARNING #4 (belt-and-suspenders manual check):** added an explicit
   step instructing the implementer to also run
   `e2e/header-identity-widget.spec.ts` locally with
   `E2E_WITH_AUTH=1` if real Google-OAuth credentials are available, since
   `AppHeader.tsx`'s DOM shape is changing and that spec is the only other
   coverage of the real authenticated header.

### Revision note (cycle 2 — addressing Challenger CRITICAL #1 regression)

The challenger's cycle-2 re-review found that cycle 1's fix (JSX order
`Link → avatar-div → nav-div`, with `sm:order-2`/`sm:order-3` desktop
overrides) *relocated* the DOM/tab-order-vs-visual-order mismatch instead
of eliminating it: at `>=640px`, DOM order is `Link → avatar → nav` but
`sm:order-2`/`sm:order-3` visually renders `Link → nav → avatar`, so a
desktop keyboard user now tabs to the avatar/user-menu *before* the nav
links — the reverse of what's on screen, and a genuine new regression
against the current (pre-fix) desktop behavior, where DOM order already
matched visual order with zero `order` involved.

**Investigated Option A (duplicate mobile/desktop variants — one rendered
via `flex sm:hidden` with native mobile DOM order, one via
`hidden sm:flex` with native desktop DOM order, so each breakpoint's
*visible* variant has DOM order == visual order == tab order and no CSS
`order` is needed at all) — rejected as too invasive for this bugfix.**

The core mechanism is sound: `display: none` excludes an element from
both the accessibility tree and tab order, and Playwright's `getByRole()`
queries (used throughout `e2e-integration/app-nav.spec.ts`, e.g.
`nav.toHaveCount(1)`, `links.toHaveCount(4)`) exclude hidden elements by
default, so the existing ARIA-role-based assertions would survive
duplication unmodified. But `UserWidgetMenu.tsx` (mounted inside
`<UserWidget>`, which both the mobile-variant and desktop-variant
wrapper would render) exposes **fixed, non-parametrized `data-testid`**
values — `user-widget`, `user-widget-trigger`, `user-widget-menu`,
`user-identity`, `user-role-label`, `settings-link`, `sign-out-button` —
and `page.getByTestId(...)` is a plain CSS attribute selector with **no
visibility filtering**, unlike `getByRole()`. Mounting two
`<UserWidgetMenu>` instances (one hidden via CSS, one visible) makes
every `getByTestId(...)` locator in the existing suite resolve to 2
elements and throw a Playwright strict-mode violation, regardless of
which instance is actually visible. Confirmed via `grep` that this
pattern is depended on across 7 existing spec files:
`e2e/header-identity-widget.spec.ts`,
`e2e/user-widget-click-outside.spec.ts`, `e2e/signout-instant-nav.spec.ts`,
`e2e/settings-display-name.spec.ts`, `e2e/user-management.spec.ts`,
`e2e/user-table-alignment.spec.ts`, `e2e/people-table-alignment.spec.ts`.

Making Option A safe would require adding a variant-disambiguating prop
to `UserWidgetMenu.tsx` (and defensively to `AppNav.tsx`, to avoid the
same trap the next time a testid is added there) to suffix or gate
testids per rendered instance, **plus** updating some/all of those 7
spec files to target only the active-variant instance. That is a
materially larger, higher-risk diff than "duplicate a thin wrapper" — it
touches components this plan's Design decision 1 explicitly chose *not*
to touch (for exactly this reason: single-file diff, lower risk, no
change to either component's internals or existing tests), and it risks
regressing real shipped `E2E_WITH_AUTH`-gated coverage for sign-out,
click-outside dismissal, and settings navigation — none of which this
bugfix should be touching. Separately, mounting two live
`<UserWidgetMenu>` instances doubles the `useEffect`-registered
`document`-level `click`/`keydown` listeners on every authenticated page
load (both instances mount unconditionally regardless of viewport, since
Tailwind's `sm:hidden`/`hidden sm:flex` is a CSS media query, not a
JS/React conditional render) — a second-order cost that stacks on top of
the testid blocker, with no compensating benefit once Option A is
already ruled out on those grounds.

**Decision: Option B.** Accept the desktop (`>=640px`) DOM-order-vs-
visual-order divergence as a narrow, documented, low-severity trade-off,
following this project's own precedent for accepted risk (CLAUDE.md's
STORY-18 TOCTOU-acceptance pattern: an inline comment explaining the
accepted risk and why it's narrow/low-severity, rather than adding
machinery to eliminate it). This is the correct call for this codebase,
not just the cheaper one:

- The visual order genuinely differs between breakpoints (mobile:
  logo → avatar → nav; desktop: logo → nav → avatar). A single DOM order
  can only equal the *default* (no-`order`) visual order at one
  breakpoint absent duplication. Cycle 1's decision to make **mobile**
  the bug-free breakpoint (zero `order`, DOM == visual == tab order) is
  kept: mobile is the actual subject of this bugfix (the reported break
  was a mobile-only layout defect) and it ships fully fixed with no
  compromise.
- The desktop divergence this leaves behind is not a new class of risk
  for this codebase — it's the same category of accepted trade-off
  already used for `person_role_skills`/TOCTOU (STORY-18) and for the
  640px residual-wrap limitation already documented earlier in this same
  plan (Design decision 1's "Residual limitation" note). It creates no
  keyboard trap and blocks no action — every interactive header element
  remains reachable and operable by keyboard either way; only the *order*
  in which desktop keyboard users reach them no longer reads strictly
  left-to-right.
- It is fully reversible and scoped to a single, well-commented spot in
  `AppHeader.tsx` (the `sm:order-2`/`sm:order-3` classes). If a future
  story wants to invest in the Option A duplication properly — with the
  `UserWidgetMenu.tsx`/`AppNav.tsx` testid work done deliberately, its
  own PR, reviewed on its own merits — nothing about this fix blocks
  that; it would be a strict improvement layered on top, not a rework.

Concretely: the inline comment above the avatar `<div>` in Design
decision 1's code block is amended to document the accepted desktop
tab-order divergence explicitly (see the updated comment below), and
Steps step 8 is extended to explicitly confirm — not just eyeball for
visual polish — that the desktop tab-order divergence is present as
expected and reads as a deliberate, narrow trade-off rather than a
missed regression, at both 768px and 1280px.

---

### Root cause (confirmed by direct headless-Chromium rendering)

Reproduced structurally by extracting the exact class strings from
`AppHeader.tsx`/`AppNav.tsx`/`UserWidgetMenu.tsx`, compiling them through the
project's real Tailwind v4 pipeline (`@tailwindcss/postcss` against
`app/globals.css`), and rendering the resulting static markup in headless
Chromium at 375/390/640/768/1280px (WSL2 `libnspr4`/`libnss3`/`libasound2t64`
workaround from CLAUDE.md's Playwright section). This is ordinary DOM/CSS
(no OS-delegated rendering), so this Linux-sandbox verification generalizes
per CLAUDE.md's confidence heuristic.

Confirmed: at 375/390px with the current code, `document.documentElement.scrollWidth`
stays ≤ the viewport width (AC1's original scrollWidth-only metric would pass),
but the visual layout is genuinely broken exactly as reported — nav links
render *above* the logo, "Funções" strands alone on its own row far to the
right, and the avatar drops to a third row below that.

The mechanism is two **independent, uncoordinated** flex-wrap contexts
nested inside each other:
1. `AppHeader.tsx`'s inner wrapper `<div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">` wraps its two children — `<AppNav>` and `<UserWidget>` — as a group, squeezed into whatever width is left over after the outer `justify-between` row gives space to the logo (~279–294px at 375–390px, confirmed via `boundingBox()`).
2. `AppNav.tsx`'s own `<ul className="flex flex-wrap justify-end gap-1">` *independently* wraps its 4 `<li>` items inside that squeezed width.

Because these two wrap contexts don't coordinate, the visual result is not a
single clean reflow but three stacked bands: nav's own wrapped rows (occupying
the full height of that squeezed column) push the *outer* wrapper's second
child (the avatar) onto a third row below, while the outer row's
`items-center` vertically centers the non-wrapping logo against that combined
height — producing the "nav above logo, avatar below" appearance.

Confirmed with real measurement that a **hamburger/collapsed menu is not
required**: the admin nav's 4 links need ~403px unwrapped, logo+avatar need
~112px more, comfortably more than the ~343px available content width at
375px — so wrapping is unavoidable — but a *single coordinated* wrap that
keeps logo+avatar together on row 1 and lets nav flow across row(s) 2+
(using the *full* container width, not the squeezed sub-column) looks clean
and reads as intentional. **Correction from the previous plan revision:**
nav's wrapped row(s) are **right-aligned**, not left-aligned —
`AppNav.tsx`'s own `<ul className="flex flex-wrap justify-end gap-1">` is
unchanged by this fix, so `justify-end` still governs how its `<li>` items
lay out within whatever width the coordinated fix gives it. Verified via
screenshot (both admin 4-link and member 1-link cases) — see Design
decision 1's "AppNav's justify-end and the stranded last item" subsection
for how this interacts with the fix.

### Design decision 1 — flatten the two wrap contexts into one, gated to mobile only

Restructure `AppHeader.tsx`'s outer container from `flex items-center
justify-between` (non-wrapping, two children: logo, inner-wrapper) into a
**single flex-wrap container with three direct flex items** (logo, an
avatar wrapper, a nav wrapper), ordered in the JSX to match the desired
mobile visual order exactly, with `sm:order-*` overrides applied only at
the desktop breakpoint to restore the current desktop grouping:

```tsx
<header className="border-b bg-background px-4 py-3">
  <div className="container mx-auto flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-4">
    <Link
      href="/"
      className="inline-flex items-center min-h-[44px] text-lg font-semibold shrink-0"
    >
      {t('name')}
    </Link>
    {/* DOM order is Link -> avatar -> nav, matching the mobile (<sm) visual
        order exactly, so keyboard tab order and screen-reader reading order
        match what's on screen at the default (mobile-first) breakpoint —
        no CSS `order` at all is used for the mobile case. `ml-auto` here
        (unprefixed) pins the avatar to the right edge of row 1, next to the
        logo. At >=sm, sm:order-3 + sm:ml-0 move it back after the nav to
        restore the exact pre-fix desktop grouping (see BUGFIX-06 for why
        this is load-bearing — do not remove without re-verifying 375px,
        390px, AND 1280px, and re-checking tab order with a real keyboard).

        ACCEPTED RISK (BUGFIX-06 cycle 2, precedent: CLAUDE.md's STORY-18
        TOCTOU-acceptance pattern): at >=sm this override makes DOM order
        (Link -> avatar -> nav) diverge from visual order (Link -> nav ->
        avatar) — a desktop keyboard user tabs to the avatar/user-menu
        BEFORE the nav links, opposite of on-screen left-to-right order.
        This is deliberate, not missed: the visual order genuinely differs
        between breakpoints (mobile wants avatar-then-nav, desktop wants
        nav-then-avatar), so a single DOM order can match only one
        breakpoint's default visual order without duplicating the
        AppNav/UserWidget subtree (rejected — see the cycle-2 revision
        note above: UserWidgetMenu's fixed data-testid values would
        collide across 7 existing E2E_WITH_AUTH-gated specs). Mobile was
        chosen as the bug-free breakpoint because it's this bugfix's
        actual subject. The desktop divergence blocks no action and
        creates no keyboard trap — every element stays reachable, just in
        a non-visual order. Do not "fix" this by adding order-* at mobile
        instead; that reintroduces the original CRITICAL #1 regression on
        the breakpoint this bugfix exists to repair. */}
    {user && (
      <div className="ml-auto sm:order-3 sm:ml-0">
        <UserWidget displayName={displayName} roleLabel={roleLabel} />
      </div>
    )}
    {/* Mobile (<sm): no order override — this div is the third DOM child so
        it naturally renders as row 2+, full width, wrapping its own <ul>
        across the whole container width instead of a squeezed sub-column —
        this is the fix. Desktop (>=sm): sm:order-2 + sm:ml-auto move it
        back between the logo and the avatar, restoring the current tight
        right-hand grouping. */}
    <div className="w-full min-w-0 sm:order-2 sm:w-auto sm:ml-auto">
      <AppNav role={role} />
    </div>
  </div>
</header>
```

**Why JSX order changed from the previous plan revision (Challenger CRITICAL
#1):** CSS `order` changes visual/paint order but never DOM order, and DOM
order is what determines keyboard tab order and assistive-tech reading
order (WCAG SC 2.4.3 Focus Order, SC 1.3.2 Meaningful Sequence). The
earlier draft had JSX order `Link → nav-div → avatar-div` with mobile
`order-*` classes visually reordering to `logo → avatar → nav` — meaning a
keyboard user tabbing from the logo would land on the nav links *before*
the avatar, the reverse of what they see on screen. Reordering the JSX
itself to `Link → avatar-div → nav-div` makes the mobile (default) case
need **zero** `order` classes — DOM order, visual order, and tab order are
identical by construction. `order` is now used **only** as a `sm:`-prefixed
desktop override (`sm:order-2` on nav, `sm:order-3` on avatar), which is
an intentional, narrow, well-commented exception, not the mechanism the
default/mobile layout depends on.

**Cycle-2 correction:** this `sm:`-prefixed override still diverges DOM
order from visual order **at desktop** (DOM: avatar-then-nav; visual:
nav-then-avatar) — it relocates the mismatch rather than removing it. The
cycle-2 revision note above investigates and rejects a duplication-based
fix (Option A) as too invasive (breaks 7 existing specs' fixed
`data-testid` assumptions in `UserWidgetMenu.tsx` unless that component
is also modified) and instead documents-and-accepts the desktop
divergence as a narrow, low-severity trade-off (Option B), matching this
project's STORY-18 TOCTOU-acceptance precedent. See the inline code
comment above the avatar `<div>` for the accepted-risk documentation that
ships with the code.

Why not `justify-between` for the desktop grouping: with 3 flat flex
siblings, `justify-between` would spread all three apart evenly at desktop
(pushing the avatar away from the nav, a visual regression from the current
tight grouping). `sm:ml-auto` on the nav (the item that should start the
desktop "right-hand group") reproduces the current desktop grouping exactly
while the mobile case needs no override at all.

Verified via the headless-Chromium harness at 375/390px (single coordinated
wrap: row 1 = logo + avatar via `ml-auto` spacing, row 2+ = nav's own links
wrapping right-aligned, per `justify-end`, across the full container width —
admin 4-link case wraps 3+1, member 1-link case doesn't wrap at all) **and**
at 768/1280px (pixel-identical to the current desktop layout: single row,
logo far left, nav+avatar grouped tight on the right) — confirming this is a
layout-correctness fix, not a redesign, per the story's Out-of-scope note.
Tab order was additionally confirmed by walking the rendered markup's DOM
child order at 375px: `Link` → `UserWidget` trigger → each `AppNav` `<li>`
in sequence — matching the on-screen row 1 (logo, avatar) then row 2+ (nav)
layout with no CSS-`order`-induced mismatch.

### AppNav's `justify-end` and the stranded last item (Challenger WARNING #3)

`AppNav.tsx`'s `<ul className="flex flex-wrap justify-end gap-1">` is
**not touched** by this fix and keeps `justify-end`. This matters because
when the admin nav's 4 links don't fit on one row within the (now much
wider, full-container) available width, they wrap per `justify-end`'s
right-alignment — e.g. a 3+1 split puts links 1-3 on one row (right-aligned
within the nav's width) and link 4 ("Funções") alone on the next row, also
right-aligned, i.e. visually "stranded" on the right edge of its own row.
This is one of the original bug's symptoms (`Funções` stranded alone), so
it must not be dismissed by prose as "looks clean" — it must be confirmed
visually. The fix changes the *context* the stranding happens in (nav's own
full-width block directly below logo+avatar, not a squeezed sub-column that
also shoves the avatar to a third row) but does not eliminate the
possibility of a lone wrapped item. Screenshot verification (AC3, Design
decision 2) must explicitly look at whether a lone-item wrapped row reads as
intentional (e.g. because it's clearly still part of the same nav block,
right where the eye expects the next nav row) rather than assuming it does.
If the screenshot shows it looking broken/awkward, the fallback is to widen
the nav's effective row budget (e.g. reduce gap, or accept a 2+2 split via
`flex-basis` tuning) — but per this plan's measurement, 3+1 is expected and
must be judged acceptable via the actual screenshot, not asserted true here.

**AppNav.tsx and UserWidget.tsx/UserWidgetMenu.tsx are NOT touched.** The fix
is scoped to `AppHeader.tsx`'s wrapping structure only — lower risk, single
file, no change to either component's own internals, props, or existing
tests. (An alternative considered: pass `className` props into `AppNav`/
`UserWidgetMenu` per the STORY-27 "extend via optional props" pattern,
applying `order`/`ml-auto` directly to their root elements instead of via
wrapper `<div>`s. Rejected for this bugfix: it would touch 3 files instead of
1 for no behavioral benefit — the wrapper-`<div>` approach achieves the exact
same flex-item semantics with a strictly smaller diff. `AppNav`'s own `<nav>`
already has `min-w-0`; the wrapping div's `min-w-0` is redundant but
harmless.)

**Residual limitation (not a regression, out of scope):** at exactly the
`sm` breakpoint boundary (640px), the admin nav's 4 links still don't fit
unwrapped next to the logo+avatar-with-name (~608px available content width
vs. ~608px+ natural need), so `AppNav`'s own `<ul>` (unconditionally
`flex-wrap`, unchanged) still wraps into 2 sub-rows there. This is
pre-existing — confirmed the *current, unfixed* code already wraps at 640px
too (avatar drops to its own row there today). Not worsened by this fix, not
covered by any AC (only 375/~390px are required), and not a common real
device width. Flag as a possible follow-up polish story if it ever surfaces
in real usage; do not scope-creep this bugfix to cover it.

**Nit (non-blocking):** the nav wrapper `<div>` renders unconditionally, so
when `AppNav` returns `null` (STORY-16 empty-landmark rule, e.g. an
unrecognized role), an empty non-landmark `<div>` remains in the DOM. This is
not an ARIA violation (not a landmark), just a minor DOM tidiness point.
Optionally guard with `{(role === 'admin' || role === 'member') && (...)}` —
implementer's discretion, does not block any AC.

### Design decision 2 — AC4's CI-safe regression test: use the real `e2e-integration` auth fixtures, not a static-source-guard fallback

The story's AC4 anticipates the BUGFIX-02 static-source-guard fallback
("If full authenticated coverage in CI isn't feasible without real Supabase
credentials..."). **That fallback is not needed here.** This repo already
has a CI job (`integration-test` in `.github/workflows/ci.yml`) that starts
a real local Supabase instance, seeds real admin/member test users
(`supabase/seed-test-users.mjs`), and runs `npm run test:integration`
(`playwright.integration.config.ts`, `testDir: ./e2e-integration`)
**unconditionally on every PR — no `E2E_WITH_AUTH` opt-in required.**
`e2e-integration/fixtures.ts` already exports real-browser `adminPage`/
`memberPage` fixtures (STORY-26 design decision, real cookies via
`signInWithPassword`, not the raw-cookie `APIRequestContext` fixtures).
CHORE-15 already proved this exact migration pattern by moving
`e2e/app-nav.spec.ts` (previously `E2E_WITH_AUTH`-gated) into
`e2e-integration/app-nav.spec.ts`, which now runs unconditionally in CI.
This closes AC4's coverage gap for real, not just to a documented "minimum
bar."

Plan: add a new file `e2e-integration/header-nav-mobile-overflow.spec.ts`
(new file, not appended to `app-nav.spec.ts`, to keep "which links render"
tests separate from "how do they lay out at 375px" tests — matches the
existing one-concern-per-file convention, e.g. `blocked-dates.spec.ts`,
`admin-availability.spec.ts`). Model it directly on `home.spec.ts`'s
existing `'STORY-30: AC5 mobile viewport (375px)'` describe block (same
`adminPage`/`memberPage` fixtures, same `setViewportSize` + `scrollWidth`
pattern), extended with the positional assertions this bug needs.

**Revision (Challenger CRITICAL #2):** the story's AC1 explicitly names
~390px as the real device width the bug was witnessed at, not just 375px —
and this fix's wrap thresholds are pixel-sensitive, so 375px passing does
not guarantee 390px also passes. The spec plan below parametrizes every
admin/member assertion over **both** widths via a `for (const width of
[375, 390])` loop (or `test.describe.each`-equivalent structure — Playwright
test titles include the width, e.g. `` `admin nav has no overflow at
${width}px` ``), so both are CI-enforced on every PR, not a manual
one-off spot-check:

- **AC1 (admin, 375px AND 390px):** for each `width` in `[375, 390]`: `adminPage.setViewportSize({ width, height: 812 })`, `goto('/pt-PT/')` and `goto('/pt-PT/admin/people')` (STORY-23 precedent: admin nav's widest page). Assert `scrollWidth <= width`. Assert **no nav content renders above the logo**: get the logo link's `boundingBox()` and every nav `<li>`'s `boundingBox()`; assert every nav item's `y >= logo.y` (or, more precisely, `y >= logo.y + logo.height - <small tolerance>` isn't needed — same-row items will have equal `y`; wrapped-below items will have strictly greater `y`; the bug's signature is a nav item with `y < logo.y`). Also assert the avatar's `y` is on the same row as the logo (`Math.abs(avatarBox.y - logoBox.y) <= 2`, mirroring the existing same-row-assertion pattern in `people-table-alignment.spec.ts`).
- **AC2 (member, 375px AND 390px):** same shape with `memberPage`, on `/pt-PT/` and `/pt-PT/settings` (STORY-23 precedent for member's page beyond home), also looped over `[375, 390]`. Member nav has only 1 link ("Disponibilidade"), so this is the simpler case — mainly guards against a future regression once more member-facing nav links are added.
- **AC3 (tap targets + visual confirmation, including the stranded-last-item check):** reuse the same `adminPage`/`memberPage` runs — assert every nav `<li>` and the avatar trigger `boundingBox().height >= 44` (`toBeVisible()` first, per CLAUDE.md's `boundingBox()` guard note). For the "visually confirm via a real-viewport screenshot" requirement: call `await adminPage.screenshot({ path: `test-results-integration/bugfix-06-admin-${width}.png`, fullPage: false })` (and the member equivalent) inside the test, for both widths — this repo has no pixel-snapshot-diffing convention (`toHaveScreenshot()` baselines aren't used anywhere), so a positional-geometry assertion (above) is the automated pass/fail gate, and the screenshot is captured as a CI artifact (already uploaded via the existing `integration-test` job's `Upload integration Playwright report`/`test-results-integration` steps). **Revision (Challenger WARNING #3):** the human review of these screenshots must explicitly check the admin 4-link case for the "stranded last item" pattern described in Design decision 1's "AppNav's justify-end and the stranded last item" subsection — i.e. confirm "Funções" wrapping alone onto its own right-aligned row reads as an intentional continuation of the nav block, not as broken/floating — rather than trusting the plan's prose claim that the layout "looks clean." Note this explicit check in the PR description / manual verification notes, don't just capture the screenshot and move on.
- **AC5 (gates):** covered by running `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e` locally before marking done, same as every story.

Also update `e2e/header-identity-widget.spec.ts`'s AC4/AC5 doc comments and
`e2e/design-system.spec.ts`'s trailing comment (per the story's own
Technical notes) to point at the new `e2e-integration/header-nav-mobile-overflow.spec.ts`
as the now-CI-enforced source of truth, instead of implying coverage that
doesn't exist. Leave the `E2E_WITH_AUTH`-gated tests themselves in place
(do not delete) — they still exercise the real Google-OAuth-authenticated
path locally, which the local-Supabase-password fixtures don't cover, and
AC4 explicitly says to keep them for local/manual verification.

**Revision (Challenger WARNING #4):** since `AppHeader.tsx`'s DOM shape is
changing (Design decision 1's JSX reorder), the implementer must also run
`e2e/header-identity-widget.spec.ts` locally as a belt-and-suspenders check
if `E2E_WITH_AUTH` credentials are available (`E2E_WITH_AUTH=1 npx
playwright test e2e/header-identity-widget.spec.ts`) — this is the only
other spec that exercises the real Google-OAuth-authenticated header, and it
predates this fix, so it's a useful independent check that the DOM
restructuring didn't break anything the new local-Supabase-fixture spec
doesn't otherwise cover. If `E2E_WITH_AUTH` credentials aren't available
locally, note that explicitly in the story's Manual Verification section
instead of silently skipping it.

### Steps

1. Reproduce and confirm the bug via the headless-Chromium harness (done
   above during refinement) — implementer should re-confirm on their own
   machine before touching code, per CLAUDE.md's "confirm via compiled CSS +
   real headless Chromium" note.
2. Write `e2e-integration/header-nav-mobile-overflow.spec.ts` FIRST (test
   before fix), parametrized over `[375, 390]` per Design decision 2's
   revision, confirm it fails against the current `AppHeader.tsx` at both
   widths (proves the test actually catches the regression — fault-injection
   style, per CLAUDE.md's CHORE-14 verification pattern, applied here to a
   frontend layout bug instead of a DB permission bug).
3. Apply the `AppHeader.tsx` restructuring from Design decision 1 — JSX
   order `Link → avatar-div → nav-div`, with `sm:order-2`/`sm:order-3`
   desktop-only overrides and no unprefixed `order-*` classes.
4. Re-run the new integration test locally against a local Supabase instance
   (`supabase start`, `node supabase/seed-test-users.mjs`, `npm run build`,
   `npm run test:integration`) — confirm it now passes at both 375px and
   390px.
5. Re-run the full smoke suite (`npm run test:e2e`) and `e2e-integration`'s
   existing `app-nav.spec.ts` to confirm no regressions (link counts/names
   unaffected — the fix only changes layout/order classes, not DOM roles/
   text/content).
6. Update the two doc-comment files per Design decision 2's last paragraph.
7. Manually verify keyboard tab order at 375px in a real browser: tab from
   the logo and confirm focus visits the avatar/user-menu trigger next, then
   the nav links in order — this is the direct, load-bearing confirmation of
   Design decision 1's DOM-order fix (Challenger CRITICAL #1) and cannot be
   fully substituted by the automated `boundingBox()` positional assertions,
   which check visual position, not focus order.
8. Manually spot-check at the real reported ~390px width and at desktop
   (1280px) in a real browser (dev server or Vercel preview) — this is
   ordinary DOM/CSS so the sandbox verification should generalize, but a
   quick real-browser look is cheap confirmation given this bug was
   originally reported from a real phone screenshot. While spot-checking,
   explicitly eyeball the admin 4-link case for the "stranded last item"
   pattern (Challenger WARNING #3) — confirm "Funções" wrapping alone reads
   as intentional, not broken.
   **Cycle-2 addition:** at both **768px and 1280px**, also tab from the
   logo with a real keyboard and confirm the *accepted* desktop divergence
   is present exactly as documented — focus visits the avatar/user-menu
   trigger next, THEN the nav links (opposite of the on-screen left-to-right
   order) — and that this reads as the deliberate, narrow trade-off recorded
   in Design decision 1's inline comment and the cycle-2 revision note
   (Option B), not as a missed regression. Record this explicitly in the
   story's Manual Verification section (both the 375px match and the
   768px/1280px accepted divergence), so a reviewer/QA can see the trade-off
   was verified and consciously accepted, not overlooked.
9. If `E2E_WITH_AUTH` credentials are available locally, run
   `e2e/header-identity-widget.spec.ts` as a belt-and-suspenders check per
   Design decision 2's revision (Challenger WARNING #4). Note the result (or
   its absence, if credentials aren't available) in the story's Manual
   Verification section.
10. Run full Definition of Done gates: `npm run lint`, `npx tsc --noEmit`,
    `npm run build`, `npm run test:e2e`, and `npm run test:integration`.

### Test plan (AC → test mapping)

| AC | Test |
|----|------|
| AC1 (admin, 375px AND 390px, no overflow + coherent layout) | `e2e-integration/header-nav-mobile-overflow.spec.ts` — admin scrollWidth + no-nav-above-logo + avatar-same-row-as-logo assertions on `/pt-PT/` and `/pt-PT/admin/people`, looped over `[375, 390]` (Challenger CRITICAL #2: both widths CI-enforced, not a manual spot-check) |
| AC2 (member, 375px AND 390px) | same file — member equivalent on `/pt-PT/` and `/pt-PT/settings`, looped over `[375, 390]` |
| AC3 (tap targets ≥44px + visual confirmation, incl. stranded-last-item check) | same file — `boundingBox().height >= 44` assertions + captured screenshot artifacts at both widths; human review of the admin screenshot explicitly checks the "Funções" stranded-alone-on-its-row pattern (Challenger WARNING #3), noted in Manual Verification, not just captured |
| AC4 (CI-safe regression coverage closing the gap) | the new spec file itself, running unconditionally in the `integration-test` CI job (no `E2E_WITH_AUTH` gate) — this *is* the AC4 deliverable, not a separate test |
| AC5 (gates) | manual run of `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e` (+ `npm run test:integration` for the new coverage), documented in story Manual Verification notes |
| Accessibility (WCAG SC 2.4.3 / SC 1.3.2, Challenger CRITICAL #1, cycle 2) | manual keyboard tab-order walkthrough at 375px (Steps step 7) confirming DOM order (`Link → avatar → nav`) matches visual and focus order (mobile: zero divergence, by construction); **plus** the cycle-2-added walkthrough at 768px/1280px (Steps step 8) confirming the accepted desktop divergence (DOM `Link → avatar → nav` vs. visual `Link → nav → avatar`, documented and accepted as Option B, see cycle-2 revision note and Design decision 1's inline comment) is present as intended, not missed. Not automatable via `boundingBox()` alone (checks position, not focus order); documented in Manual Verification. |
| Belt-and-suspenders (Challenger WARNING #4) | `e2e/header-identity-widget.spec.ts` run locally with `E2E_WITH_AUTH=1` if credentials available (Steps step 9), noted in Manual Verification |

### Risks and rollback

- **Risk:** the `sm:order-*`/`ml-auto` combination is non-obvious CSS and a
  future dev could "simplify" it back toward `justify-between`, silently
  reintroducing the double-wrap bug at a future breakpoint change. Mitigated
  by the inline comment in Design decision 1 and by the new CI-enforced
  regression test (AC4) — any future nav-link addition or refactor that
  breaks the coordinated wrap will fail CI immediately instead of shipping
  silently a third time.
- **Risk:** a future dev could reintroduce mobile-scoped (unprefixed)
  `order-*` classes to "fix" some other visual nit, silently reintroducing
  the DOM-order/visual-order/tab-order mismatch this revision fixes on the
  breakpoint that matters most for this bugfix (Challenger CRITICAL #1,
  cycle 1). Mitigated by the inline comment in Design decision 1 explicitly
  calling out that `order` is desktop-only (`sm:`-prefixed) by design, and
  by Steps step 7's manual keyboard tab-order check being part of the
  story's verification record — a reviewer re-running that check would
  immediately catch a regression. This is not automatable via the
  positional `boundingBox()` assertions alone (those check visual position,
  not DOM/focus order), so the manual check remains load-bearing until/
  unless a keyboard-navigation Playwright test is added in a future story.
- **Risk (accepted, cycle 2 — Challenger CRITICAL #1 re-review):** at
  `>=640px`, DOM tab order (`Link → avatar → nav`) diverges from on-screen
  visual order (`Link → nav → avatar`) because `sm:order-2`/`sm:order-3`
  is a paint-order-only override — a desktop keyboard user tabs to the
  avatar/user-menu before the nav links, the reverse of what they see.
  This is a genuine, deliberate trade-off, not an oversight: the visual
  order genuinely differs by breakpoint, and eliminating the mismatch at
  both breakpoints simultaneously requires duplicating the AppNav/
  UserWidget subtree (Option A), which was investigated and rejected as
  too invasive — `UserWidgetMenu.tsx`'s fixed `data-testid` values would
  collide across 7 existing `E2E_WITH_AUTH`-gated specs unless that
  component (out of this bugfix's scope) is also modified. Accepted per
  this project's STORY-18 TOCTOU-acceptance precedent: narrow, low-severity
  (no keyboard trap, no blocked action, only order), documented inline in
  `AppHeader.tsx` above the avatar `<div>`, and re-verified at 768px/1280px
  in Steps step 8 so the trade-off is confirmed present as intended, not
  silently regressed further. Follow-up: if a future story properly
  resources the Option A duplication (with `UserWidgetMenu.tsx`/
  `AppNav.tsx` testid disambiguation done deliberately, in its own PR),
  this accepted risk can be retired entirely.
- **Risk:** the 640px residual limitation (documented above) could be
  mistaken for a new regression by a future reviewer. Mitigated by the
  explicit comment and by scoping the new test's viewport assertions to
  375/390px only (matching the ACs), not asserting single-line behavior at
  640px.
- **Rollback:** single-file change to `AppHeader.tsx` (plus a new,
  additive test file and two doc-comment-only edits) — revert is a trivial
  `git revert` with no data/migration/schema involved.

### Complexity: standard

Justification: touches shared, persistent app chrome
(`AppHeader.tsx`, rendered on every authenticated page for every user), the
fix requires careful flex-layout reasoning across two breakpoints
(mobile-wrap vs. desktop-nowrap) to avoid a visual regression on the
desktop layout that isn't broken, and it must be verified against multiple
roles (admin/member) and multiple pages per STORY-23 precedent. Not
`trivial` (this is exactly the kind of "looks like a one-line CSS tweak but
has app-wide, multi-breakpoint blast radius" change CLAUDE.md's reasoning-risk
signals call out — shared/global layout component, not a local pure
function). Not `complex` — it's a single component, no auth/data/concurrency/
money involved, and the new test infrastructure (`e2e-integration` fixtures)
already exists and is being reused, not invented.

### Affected areas
- **Frontend:** `components/AppHeader.tsx` (the fix).
- **Frontend/tests:** new `e2e-integration/header-nav-mobile-overflow.spec.ts`;
  doc-comment updates in `e2e/header-identity-widget.spec.ts` and
  `e2e/design-system.spec.ts`.
- No backend, data, ai-ml, or infra changes.

## Manual Verification (implementation)

Performed in a sandboxed Linux dev environment using the local Supabase
instance (`supabase start`, seeded via `supabase/seed-test-users.mjs`) and
Playwright's real Chromium (WSL2 `libnspr4`/`libnss3`/`libasound2t64`
workaround from CLAUDE.md's Playwright section).

- **Red step (Steps step 2):** confirmed `e2e-integration/header-nav-mobile-overflow.spec.ts`
  fails against the pre-fix `AppHeader.tsx` at both 375px and 390px — exactly
  the 4 admin AC1 tests fail (nav `<li>` `y` < logo `y`, the bug's DOM
  signature), all 8 other tests (member, tap-target/screenshot) already pass
  because the bug's signature is specific to the admin 4-link case. This
  confirms the test is non-vacuous (fault-injection style, CLAUDE.md CHORE-14
  pattern).
- **Green step (Steps step 4):** after applying Design decision 1's
  `AppHeader.tsx` restructuring, all 12 tests pass at both 375px and 390px.
- **Regression check (Steps step 5):** `e2e-integration/app-nav.spec.ts`
  (3/3 passed) and the full smoke suite `npm run test:e2e` (75 passed, 91
  auth-gated skipped, 0 failed, against CI's actual placeholder-credential
  build) both pass with no regressions. `npm run test:integration`'s wider
  suite has 12 pre-existing failures unrelated to this change (fixture-data
  duplicate-key collisions in `blocked-dates`/`home`/`claim-no-records`/
  `admin-availability` specs, caused by state accumulated in this sandbox's
  long-running local Supabase instance across unrelated prior sessions — none
  of these specs touch `AppHeader.tsx`, `AppNav.tsx`, or header/nav layout).
- **Keyboard tab-order walkthrough (Steps step 7 — 375px):** driven via a
  real Playwright `page.keyboard.press('Tab')` walk (not a static DOM read)
  against the authenticated admin session at 375px. Observed order: Escala
  (logo) → avatar/user-menu trigger → Disponibilidade → Utilizadores →
  Equipa → Funções. This matches on-screen visual order exactly (row 1:
  logo, avatar; row 2+: nav links) — zero DOM/visual/tab-order divergence at
  mobile, confirming Design decision 1's CRITICAL #1 fix.
- **Keyboard tab-order walkthrough (Steps step 8 — 768px and 1280px):** same
  Tab-key walk repeated at both desktop widths. Observed order is identical
  to the 375px case (Escala → avatar → nav links) at both widths, while the
  on-screen visual order at desktop is logo → nav → avatar (via
  `sm:order-2`/`sm:order-3`). This confirms the accepted Option B divergence
  (cycle-2 revision note) is present exactly as documented — a desktop
  keyboard user reaches the avatar/user-menu before the nav links, opposite
  of on-screen order — and reads as the deliberate, narrow trade-off
  recorded in the inline `AppHeader.tsx` comment, not a missed regression.
- **Visual spot-check (Steps step 8):** screenshots captured at 375px, 390px
  (via the integration test's own artifact capture), 768px, and 1280px.
  - 375px/390px (admin, 4 links): logo + avatar on row 1, nav wraps 3+1 onto
    row 2, "Funções" alone on its own right-aligned row directly below the
    other 3 links — reads as an intentional continuation of the nav block,
    not as broken/floating (Challenger WARNING #3 concern addressed).
  - 768px: single row, no wrapping, tight right-hand grouping — no
    regression from the 640px residual-limitation note.
  - 1280px: pixel-identical to the pre-fix desktop layout — logo far left,
    nav + avatar grouped tight on the right, single row. Confirms this is a
    layout-correctness fix with zero desktop visual regression.
- **Belt-and-suspenders `E2E_WITH_AUTH` check (Steps step 9):** NOT run — no
  real Google OAuth credentials are available in this sandboxed environment
  (`.env.local` has no Google client config reachable for an interactive
  OAuth flow, and this environment has no way to complete a real Google
  sign-in). Noted explicitly per the plan's fallback instruction rather than
  silently skipped. The local-Supabase-password-authenticated
  `e2e-integration` suite above (which exercises the same `AppHeader.tsx`
  DOM) is the coverage that actually ran.
- **Definition of Done gates:** `npm run lint` (0), `npx tsc --noEmit` (0,
  after fixing an unrelated pre-existing type-only import issue in the new
  spec file — `Page` is not re-exported from `./fixtures`, imported from
  `@playwright/test` directly instead), `npm run build` (0), `npm run
  test:e2e` (0, 75 passed / 91 skipped) all confirmed green against a build
  using CI's actual placeholder Supabase credentials.
