# CHORE-28: Header recolor + desktop nav design-language rollout
Epic: maintenance
Priority: standard — global chrome, visible on every page; part of the
pre-EPIC-04 UI push
Status: done ✅
PR: #59
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: CHORE-22 (mobile nav restructure — owns everything below `sm`),
updated mockup in `App design refinement/Escala Dashboard.dc.html`
(`headerRowAStyle`/`navRowStyle`/`wordmarkStyle`/`navBtn`), CHORE-27 (login
backdrop shares the navy token)

## Task
As any signed-in user on desktop, I want the header to use the approved
dark navy chrome with the "ESCALA" wordmark and an accent-highlighted
active nav item, so the app's persistent chrome matches the redesigned
pages instead of the old background-matching header.

## Context
The updated mockup renders the header as a dark navy surface **in both
light and dark theme** (light: `oklch(0.22 0.035 250)`, dark:
`oklch(0.20 0.03 250)`), with:
- the "ESCALA" wordmark in the display font (bold, letter-spaced, light
  text on navy);
- a nav row on the navy surface where the **active** item gets a solid
  brand-accent fill with dark text (`navBtn`: `borderRadius: 6`, accent
  background when active, light text otherwise);
- header text/muted-text colors tuned for the navy surface.

CHORE-23 explicitly excluded the header recolor ("header recolor …
deliberately NOT included"); CHORE-22 owns only the mobile (<`sm`)
restructure. Nothing currently covers the desktop header visual change —
this chore closes that gap.

Note the mockup's nav items use `borderRadius: 6`, not the pill radius —
CHORE-24's Design decision 1 already flagged this: `AppNav` links are
shadcn `Button variant="ghost" asChild`, which are now pill-shaped. Refine
must decide whether the active-state fill keeps the shared Button pill
radius (consistency with CHORE-24) or matches the mockup's 6px tab look —
either is acceptable if applied consistently; do not mix.

## Acceptance criteria
1. Given any authenticated page in **light** theme, when the header
   renders, then it uses the dark navy surface with light wordmark/nav
   text (not the page background), and in **dark** theme it uses the navy
   dark-variant — both via new tokens, contrast-verified.
2. Given the nav, when the current route's item renders, then it is
   visually distinguished with the brand accent fill
   (`--brand`/`--brand-foreground`, already contrast-verified at 8.31:1 by
   CHORE-23) while inactive items render as light text on navy meeting
   WCAG AA 4.5:1 (measure the muted variant especially).
3. Given the wordmark, when rendered, then it uses the display font with
   the mockup's bold letter-spaced treatment and remains the home link
   (STORY-16 behavior, accessible name preserved).
4. Given the user widget (avatar menu) and any other header controls, when
   rendered on the navy surface, then their text/focus states remain
   WCAG-AA legible in both themes and all existing behavior (STORY-13
   dismiss handling, STORY-15 sign-out) is unchanged.
5. Given desktop ≥1280px and tablet ≥640px, when rendered, then no layout
   regression: nav wrapping behavior, DOM/tab order, and BUGFIX-06's
   documented arrangement stay intact (this chore recolors and restyles;
   it does not restructure).
6. Given all existing header/nav e2e specs (`e2e-integration/app-nav.spec.ts`
   [Refine correction: CHORE-15 migrated this file from `e2e/app-nav.spec.ts`
   to `e2e-integration/`; the story text has been updated to the current
   path — see Implementation Plan Design decision 5],
   `e2e-integration/header-nav-mobile-overflow.spec.ts`,
   `e2e-integration/home.spec.ts`), when this ships, then they pass —
   updated only where they assert old colors/classes, called out in the
   PR.
7. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Mobile (<640px) nav structure — CHORE-22 owns the bottom-tab-bar
  restructure; land the two in an explicit order (this chore's recolor
  applies to whatever chrome exists at each breakpoint, so prefer landing
  CHORE-28 first, then CHORE-22 restyles the mobile bar on the already-navy
  surface — orchestrator to confirm, per CLAUDE.md multi-story guidance).
- Adding/removing nav items, role-gating changes, or the mockup's team
  switcher pill (multi-team is out of MVP scope — PRD §8).
- The login page backdrop — CHORE-27 (shares the navy token; whichever
  lands second consumes the first's token).

## Technical notes
- Primary files: `components/AppHeader.tsx`, `components/AppNav.tsx`,
  `components/UserWidget.tsx`/`UserWidgetMenu.tsx` (color classes only),
  `app/globals.css` (new header-surface tokens: e.g. `--header`,
  `--header-foreground`, `--header-muted` in `:root` and `.dark`).
- Convert the mockup's OKLCH values via the established OKLCH→HSL +
  contrast-measurement pattern (CHORE-23 Decision 4); document verified
  pairings in the token comment.
- `UserWidgetMenu`'s dropdown panel likely stays on the card surface
  (mockup shows no open menu) — only the trigger sits on navy; verify the
  trigger's resting/hover states.
- This touches inherited/global CSS tokens → `standard` complexity minimum
  (CLAUDE.md rule).
- Visually render (dev server) both themes, both roles, at 640px/1280px
  before marking done.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **Frontend / UX** (primary): `app/globals.css` (new header-surface color
  tokens), `components/AppHeader.tsx`, `components/AppNav.tsx`,
  `components/UserWidgetMenu.tsx` (color-class fix only, no logic change).
- **Test infra**: one new CI-safe static/contrast spec (`e2e/`) and one new
  auth-gated live-DOM spec (`e2e-integration/`), plus a small addition to
  `e2e-integration/app-nav.spec.ts`.
- No backend/data/auth/migration files touched. This does **not** cross into
  `complex` territory (no auth, data integrity, concurrency, or money), but
  per CLAUDE.md's inherited/global-CSS rule it is `standard` at minimum
  regardless of diff size — confirmed below.

### Pre-flight corrections (CHORE-19-style spot-check)
- **AC6 file path**: `e2e/app-nav.spec.ts` does not exist — CHORE-15
  migrated it to `e2e-integration/app-nav.spec.ts`. Corrected inline above.
- **CHORE-22 cross-reference flag (non-blocking for this story, surfaced for
  the orchestrator)**: CHORE-22's draft "Out of scope" section states "the
  mockup also moves Settings out of the desktop nav into a small header
  button; that desktop concern belongs to CHORE-28." CHORE-28's own AC list
  and "Out of scope" section (which forbids "adding/removing nav items")
  never claim this work. The mockup's `headerRowAStyle` row also contains a
  team-switcher pill and a dev-only "Preview as" persona toggle, both
  explicitly out of scope for this repo (multi-team is post-MVP per PRD §8;
  persona-switching is mockup tooling, not a real feature). **Decision for
  this refine**: CHORE-28 ships only what its own AC list describes —
  recolor, active-nav-item highlighting, wordmark treatment, and legibility
  of existing controls. It does **not** add a Settings button, team pill, or
  persona switcher to the header. This is a deliberate scope read, not an
  oversight — flagged here so the orchestrator can reconcile CHORE-22's
  cross-reference before that story's own refine (add the Settings-button
  work there, or open a follow-up chore).

### New CSS custom properties (`app/globals.css`)

Mockup source values (`Escala Dashboard.dc.html` lines 511–534, `theme()`):
light `header: oklch(0.22 0.035 250)`, `headerBorder: oklch(0.30 0.035 250)`,
`headerText: oklch(0.98 0.01 85)`, `headerTextMuted: oklch(0.72 0.02 250)`;
dark `header: oklch(0.20 0.03 250)`, `headerBorder: oklch(0.36 0.03 250)`,
`headerText: oklch(0.96 0.01 85)`, `headerTextMuted: oklch(0.70 0.02 250)`.

Converted via the CHORE-23 OKLab→linear-sRGB→sRGB→HSL matrix pattern
(script run during refine, cross-checked against the repo's own
HSL→luminance→ratio helper from `e2e/design-language-foundation.spec.ts` /
`e2e/card-ui-primitive.spec.ts`):

```css
/* :root (light theme) */
--header: 210 52% 11%;            /* oklch(0.22 0.035 250) */
--header-border: 211 32% 19%;     /* oklch(0.30 0.035 250) */
--header-foreground: 40 60% 97%;  /* oklch(0.98 0.01 85) */
--header-muted: 211 12% 65%;      /* oklch(0.72 0.02 250) */

/* .dark */
--header: 210 52% 9%;             /* oklch(0.20 0.03 250) */
--header-border: 211 22% 25%;     /* oklch(0.36 0.03 250) */
--header-foreground: 40 34% 94%;  /* oklch(0.96 0.01 85) */
--header-muted: 211 11% 63%;      /* oklch(0.70 0.02 250) */
```

Verified pairings (computed, not eyeballed — WCAG AA normal-text floor
4.5:1):
- `--header-foreground` on `--header`: **16.38:1 light / 16.12:1 dark**.
- `--header-muted` on `--header`: **6.92:1 light / 6.84:1 dark**.
- `--header-border` is a border color, not a text pairing — no contrast
  gate needed (matches the existing `--border` token's precedent, which
  also has no contrast test).
- The active-nav-item fill reuses the **already-verified**
  `--brand`/`--brand-foreground` pair (8.31:1, CHORE-23) — do not
  re-measure or redefine; it is a bg-fill + dark-text pair, independent of
  the surface it sits on.

Document each pairing's verified scope in the token comment, per CHORE-23
Decision 4's pattern ("verified: X on Y = R:1 (both themes); NOT verified
as standalone text elsewhere").

**Challenge Warning 1**: `--header-muted` has zero consumers in this
story's own diffs (the mockup confirms inactive nav items use
full-brightness `headerText`, not `headerTextMuted` — see Design decision 4
below — so AC2's "measure the muted variant especially" is satisfied by the
contrast measurement itself, not by applying it to nav text here). Add a
one-line comment on the token noting it is forward infrastructure for a
named future consumer — e.g. CHORE-22's mobile bottom nav or CHORE-27's
login page, both of which use `headerTextMuted` in the mockup — so a future
reader doesn't mistake an unused-looking token for dead code.

**Design decision 1 — include `--header-border` even though the story's
Technical notes only named `--header`/`--header-foreground`/`--header-muted`
("e.g." list, not exhaustive).** The current `border-b` on `<header>` uses
the shared `--border` token (near-white in light theme), which would render
as a barely-visible sliver against the new navy surface and would not
satisfy AC1's "uses the dark navy surface … not the page background" for
the header's own edge. `--header-border` is still squarely a "header-surface
token" (the story's own file-scope grant for `app/globals.css`), not a new
feature — Challenge/Review should confirm this reading against AC1, per
CLAUDE.md's CHORE-20 scope-enforcement lesson (a plan's own transparency
doesn't self-authorize the decision).

Add corresponding `@theme inline` mappings so Tailwind utilities exist:
```css
--color-header: hsl(var(--header));
--color-header-foreground: hsl(var(--header-foreground));
--color-header-muted: hsl(var(--header-muted));
--color-header-border: hsl(var(--header-border));
```
This yields `bg-header`, `text-header-foreground`, `text-header-muted`,
`border-header-border` utilities, following the existing `--color-brand` /
`--color-border` precedent exactly.

### Design decision 2 — nav active-item radius: **pill, not 6px tab**

CHORE-24 already made the shared `Button` primitive's base `rounded-full`
(pill) and explicitly resolved this exact tension for `AppNav`: "this app's
`AppNav` ghost-variant links don't render as a distinct filled tab-bar the
way the mockup's `navBase` buttons do … a uniform pill radius on the shared
primitive is the lower-risk choice" (CHORE-24 Context + Design decision 1).

**Challenge Warning 2 correction**: the plan previously claimed
`e2e/button-pill-shape.spec.ts` "already asserts `AppNav` links render as a
pill in both themes — a live-rendered, shipped fact." This overstated the
existing coverage: that spec's only live/computed-style check targets the
**login page's** `google-signin-button`, not `AppNav`. `AppNav`'s pill
shape is currently covered only by static-source inference (the `ghost`
variant declares no `rounded-*` override, so it inherits `Button`'s base
`rounded-full`) plus manual QA screenshots recorded in CHORE-24's AC
verification notes — not a live, automated, both-themes assertion on
`AppNav` specifically. The underlying decision to keep the pill radius
remains well-grounded regardless (CHORE-24's Context reasoning above is
about the design call, not the test-coverage claim). Reopening this to 6px
now would (a) contradict a already-verified, tested decision, (b) require a
bespoke per-item radius override that fights the shared primitive rather
than composing with it, and (c) create exactly the kind of inconsistency
CHORE-24 was written to prevent. **Decision: keep the inherited
`rounded-full` pill radius for the active nav item; add zero `rounded-*`
classes anywhere in this diff.** This also sidesteps the CHORE-24
`cva`/`twMerge` last-occurrence-wins landmine entirely, by construction —
there is nothing to collide with.

### Design decision 3 — inherited `color` cascade: a bug found during refine

`<header>` currently has no explicit text color; text is inherited from
`body`'s `--foreground`. This story must set `text-header-foreground` on
`<header>` so the wordmark, nav links, and user-widget trigger inherit
correct light-on-navy text (all three currently declare no resting-state
`color` of their own, so ordinary CSS inheritance handles them for free —
no changes needed inside `AppNav.tsx` or the `<summary>` trigger in
`UserWidgetMenu.tsx` for base text color).

**However**: `UserWidgetMenu`'s dropdown *panel*
(`<div data-testid="user-widget-menu" className="... bg-background ...">`)
is **not** on the navy surface (mockup: "dropdown panel likely stays on the
card surface"; confirmed — it renders `bg-background`, a light/white
surface in light theme). Because `color` inherits down through the DOM
regardless of an intervening `background-color` change, the panel would
silently inherit `text-header-foreground` (near-white) from the `<header>`
ancestor while sitting on a near-white (`bg-background`) panel in light
theme — **white text on a white panel, unreadable**. This is exactly the
"inherited/global CSS property blast radius" failure mode CLAUDE.md warns
about (BUGFIX-04 precedent), just via `color` instead of `color-scheme`.

**Required fix**: add an explicit `text-foreground` class to the dropdown
panel `<div data-testid="user-widget-menu">` to reset the color back to the
page/card-appropriate value before any descendant text renders. This is a
**required** fix, not optional polish — flag it prominently in the PR since
it is not something a naive "just recolor the header" diff would catch
without live-rendering the open dropdown in light theme.

### Design decision 4 — nav hover treatment: leave ghost's default hover as-is

Ghost-variant `Button`s (inactive nav links, and the user-widget trigger's
`<summary>`) currently hover to `bg-accent`/`text-accent-foreground` (light
gray bg, near-black text) — a self-contained, already-contrast-verified
pair, independent of the surrounding surface. On the new navy header this
renders as a light "highlight pill" on hover, a common and legible pattern
for dark nav bars. **Decision: do not retune this hover treatment.** AC2
and AC4 require resting-state legibility and unchanged *behavior*, not a
hover recolor; retuning it would add surface area/risk (new on-navy hover
tokens, more `twMerge` override sites) for a cosmetic-only gap the ACs don't
require. This keeps the diff to "recolor + active-state", matching AC5's
"this chore recolors and restyles; it does not restructure."

The **active** nav item is the one exception that *must* override hover:
without it, hovering the active item would show the ghost `hover:bg-accent`
flash instead of staying on `--brand`. Per the BUGFIX-03 precedent (checked/
selected state must out-specify an existing `hover:` utility on the same
element), match modifiers exactly rather than relying on cascade
specificity: `bg-brand text-brand-foreground hover:bg-brand
hover:text-brand-foreground dark:hover:bg-brand
dark:hover:text-brand-foreground`. The `dark:hover:*` duplicates are
necessary because ghost's base string includes `dark:hover:bg-accent/50`,
which — compiled through this repo's `@custom-variant dark
(&:is(.dark *))` — is a higher-specificity selector than a plain
`hover:bg-brand` override; `twMerge` treats differing modifier stacks
(`hover:` vs `dark:hover:`) as different slots and does not dedupe across
them, so both the plain and `dark:`-prefixed forms must be supplied to
reliably win in both themes. (Color values are theme-invariant via CSS
custom properties — the duplication is purely to win the CSS specificity/
`twMerge`-slot fight, not because `--brand` differs per theme.)

**Challenge correction (cycle 1, CRITICAL): these override classes MUST be
applied via `Button`'s own `className` prop, not `Link`'s.** When `Button`
uses `asChild`, Radix `Slot` merges `className` via **plain string
concatenation** (`node_modules/@radix-ui/react-slot`), not `twMerge` —
`Button`'s `ghost`-variant hover classes are already resolved through
`cn(buttonVariants({...}))` *inside* `Button`, before `Slot` ever sees the
child's own `className`. Classes placed on the wrapped `Link` therefore
never pass through that same `cn()`/`twMerge()` call, so the
last-occurrence-wins dedup this section relies on never fires — both
`hover:bg-accent`/`dark:hover:bg-accent/50` (from `ghost`) and
`hover:bg-brand`/`dark:hover:bg-brand` (from the active override) would end
up simultaneously present in the compiled class string, with the winner
determined by incidental Tailwind stylesheet rule order, not a deliberate
mechanism. **Fix: pass the conditional classes through `Button`'s
`className` prop** — see the corrected `AppNav.tsx` diff below.

### File-by-file diff plan

**`app/globals.css`**
- Add the four tokens above to `:root` and `.dark`, with contrast-comment
  documentation matching the CHORE-23 pattern.
- Add the four `--color-header*` lines to `@theme inline`.
- Add `bg-header`, `text-header-foreground`, `text-header-muted`,
  `border-header-border` to the "Design tokens" doc comment block (mirrors
  the existing `--brand` documentation entry).

**`components/AppHeader.tsx`**
- `<header className="border-b bg-background px-4 py-3">` →
  `<header className="border-b border-header-border bg-header px-4 py-3 text-header-foreground">`.
- No other structural change — the existing `sm:order-*`/`ml-auto`
  BUGFIX-06 layout comment and DOM order are untouched (AC5).

**`components/AppNav.tsx`**
- Add `'use client'` already present; import `usePathname` from
  `@/i18n/navigation` (already locale-agnostic per the existing
  `LanguageSwitcher.tsx` precedent — no locale-stripping needed).
- Compute active state per link with a **prefix match**, not exact-only:
  `const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')`.
  Exact-only would miss the "Equipa" nav item while the user is on a
  sub-route like `/admin/people/[id]/availability` or
  `/admin/people/[id]/skills` (both exist today under
  `app/[locale]/(app)/admin/people/[id]/`) — confirmed via a filesystem
  check during refine. Apply the same helper uniformly to all four links,
  even though only `/admin/people` currently has sub-routes, for
  consistency and to avoid a silent gap if `/availability` or
  `/admin/roles` grow sub-routes later.
- For each nav link, conditionally append the Design-decision-4 active
  classes to **`Button`'s own `className` prop** (not `Link`'s — see the
  Challenge correction in Design decision 4 above), so they flow through
  `Button`'s internal `cn(buttonVariants({...}))` call and correctly dedupe
  against `ghost`'s hover classes via `twMerge`'s last-occurrence-wins
  behavior:
  ```tsx
  <Button
    variant="ghost"
    asChild
    className={cn(
      'min-h-[44px] px-3 text-sm',
      isActive(href) &&
        'bg-brand text-brand-foreground hover:bg-brand hover:text-brand-foreground dark:hover:bg-brand dark:hover:text-brand-foreground'
    )}
  >
    <Link href={href} aria-current={isActive(href) ? 'page' : undefined}>
      {label}
    </Link>
  </Button>
  ```
  `aria-current="page"` stays on `Link` itself — it's a plain HTML
  attribute, not a `className`, so there is no `Slot`/`twMerge` merge
  concern for it. It's a small, tightly-scoped addition directly serving
  AC2's "visually distinguished" requirement for non-sighted users too
  (screen readers get no signal from color/background alone) — flagged
  explicitly per CLAUDE.md's CHORE-20 lesson so Challenge can independently
  confirm it's in-bounds rather than accepting this plan's own framing.
  Requires importing `cn` from `@/lib/utils` in `AppNav.tsx` (not currently
  imported there).
- No change to `min-w-0`/`flex-wrap`/`justify-end` layout classes (AC5).

**`components/UserWidgetMenu.tsx`**
- Add `text-foreground` to the dropdown panel `<div data-testid="user-widget-menu" className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-background ... shadow-md">`
  (Design decision 3 — required fix, not optional).
- No other changes: the `<summary>` trigger, avatar span, identity/role
  text, Settings link, and sign-out button all already have no explicit
  resting-state `color` (avatar span excepted — self-contained
  `bg-primary`/`text-primary-foreground` pair, unaffected) and will inherit
  correctly once the header sets `text-header-foreground` and the panel
  resets it back to `text-foreground`.

**`components/UserWidget.tsx`** — no changes; it only passes props through.

### e2e updates

1. **New file `e2e/header-surface-tokens.spec.ts`** (CI-safe, no auth —
   modeled on `e2e/design-language-foundation.spec.ts`, duplicating its
   HSL-extraction/contrast helpers per that file's own established
   precedent of not sharing a module across specs):
   - Static HSL-format check: `--header`, `--header-foreground`,
     `--header-muted`, `--header-border` all present in `H S% L%` format
     (not `oklch(...)`) in both `:root` and `.dark`.
   - Contrast check: `--header-foreground` on `--header` ≥ 4.5:1 in both
     themes; `--header-muted` on `--header` ≥ 4.5:1 in both themes.
   - Static check: `@theme inline` wires all four `--color-header*` lines.

2. **New file `e2e-integration/header-recolor.spec.ts`** (auth-gated via the
   existing `adminPage`/`memberPage` fixtures, runs unconditionally in CI
   per the BUGFIX-06 pattern — theme-invariant class assertions only; the
   static suite above already covers cross-theme color correctness, so no
   dark-mode cookie toggling is needed here):
   - AC1: `<header>` has `bg-header` and `text-header-foreground` classes.
   - AC2: on `/pt-PT/admin/people` (admin), the "Equipa" link has
     `bg-brand`/`text-brand-foreground` classes and `aria-current="page"`;
     the other three admin links have neither. Repeat on `/pt-PT/` for
     member: the sole "Disponibilidade" link is active.
   - AC2 (sub-route case): navigate to
     `/pt-PT/admin/people/<seeded-id>/skills` (or availability) as admin;
     assert "Equipa" is still marked active via the prefix-match logic —
     this is the regression test for the sub-route gap found during refine.
     `<seeded-id>` per Challenge Warning 3: use a worker-isolated
     `serviceClient` insert into `people` in `test.beforeEach`
     (`testInfo.workerIndex`-suffixed name, matching the STORY-14/25/27
     pattern already used in `e2e-integration/admin-availability.spec.ts`),
     with an unconditional hard-delete in `test.afterEach` — not an
     ad-hoc/assumed id.
   - AC2 (**critical regression test for the Challenge cycle-1 hover fix**):
     hover the active link (`page.hover(...)`) and assert its computed
     `background-color` (via `page.evaluate` /
     `getComputedStyle(...).backgroundColor`) still resolves to the
     `--brand` HSL value, not `--accent`, in **both** light and dark theme
     (toggle via the existing theme cookie helper used elsewhere in
     `e2e-integration/`). This is the assertion the Challenge review flagged
     as missing — resting-state class presence alone does not prove the
     hover override actually wins the `twMerge`/`Slot` merge.
   - AC3: wordmark `<Link name="Escala">` still navigates home (reuse the
     existing AC2 pattern from `e2e-integration/app-nav.spec.ts`) and has
     `font-bold`/`tracking-wider` classes.
   - AC4 (**critical regression test for Design decision 3**): open the
     user-widget dropdown; assert
     `page.getByTestId('user-widget-menu')` has class `text-foreground`
     (not relying on inherited navy text). This is the one assertion that
     would have caught the white-on-white bug found during refine.

3. **`e2e-integration/app-nav.spec.ts`**: no assertion changes needed — it
   only checks link presence/count/navigation, not color/class, and none of
   those are touched. Re-run unmodified per AC6/AC7 to confirm no
   regression (`min-h-[44px] px-3 text-sm` base classes are untouched).

4. **`e2e-integration/header-nav-mobile-overflow.spec.ts`**: no assertion
   changes needed (positional/tap-target checks only, no color/class
   assertions) — re-run unmodified to confirm AC5 (no layout regression).
   Screenshots captured by this spec will visually show the new navy
   surface; call this out in the PR description as expected, not a
   regression.

5. **`e2e-integration/home.spec.ts`**: no assertion changes needed — its
   `bg-brand`/`text-brand-foreground` checks target the Dashboard hero card
   (STORY-30/CHORE-25), unrelated to the header. Re-run unmodified.

6. **`e2e/header-identity-widget.spec.ts`, `e2e/design-system.spec.ts`**:
   `E2E_WITH_AUTH`-gated or `test.skip(true, …)`, no CI coverage either way,
   no assertions on color/class — no changes needed.

### Font treatment (AC3)

Wordmark `<Link>` classes: `text-lg font-semibold` → `text-lg font-bold
tracking-wider`. `font-sans` (Space Grotesk) is already the global default
per CHORE-23 — no font-family class needed. `tracking-wider` (0.05em) is
the closest Tailwind step to the mockup's `letterSpacing: 1` at its ~18–22px
wordmark size (1px / ~20px ≈ 0.05em); document this as an approximation,
not a pixel-exact port, since the mockup's `clamp()` font-size isn't being
adopted (AC3 doesn't ask for a size change, only weight/spacing).

### Step-by-step approach (test-first where practical)

1. Write `e2e/header-surface-tokens.spec.ts` first (red — tokens don't
   exist yet).
2. Add the four tokens + `@theme inline` mappings to `app/globals.css`;
   get the static suite green.
3. Write `e2e-integration/header-recolor.spec.ts` (red).
4. Update `AppHeader.tsx` (bg/border/text classes).
5. Update `AppNav.tsx` (active-state logic + classes + `aria-current`).
6. Update `UserWidgetMenu.tsx` (panel `text-foreground` fix).
7. Get `e2e-integration/header-recolor.spec.ts` green.
8. Re-run `e2e-integration/app-nav.spec.ts`,
   `e2e-integration/header-nav-mobile-overflow.spec.ts`,
   `e2e-integration/home.spec.ts` unmodified — confirm all still green.
9. `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e`.
10. Manual visual QA (dev server): both themes × both roles ×
    640px/1280px, per the story's existing Technical notes — pay specific
    attention to (a) the open user-widget dropdown in **light theme**
    (Design decision 3's fix) and (b) the active-nav-item fill on a
    sub-route page (Design decision "prefix match").

### Test plan mapped to acceptance criteria

- **AC1** (navy surface, both themes, contrast-verified): automated —
  `e2e/header-surface-tokens.spec.ts` (static + contrast) +
  `e2e-integration/header-recolor.spec.ts` AC1 (class presence, live DOM).
- **AC2** (active item brand fill, inactive items legible, incl. muted
  variant): automated — `e2e-integration/header-recolor.spec.ts` AC2 (live
  class/aria-current checks, incl. sub-route case) +
  `e2e/header-surface-tokens.spec.ts` (muted-on-header contrast).
- **AC3** (wordmark font, remains home link): automated —
  `e2e-integration/header-recolor.spec.ts` AC3 (class + navigation, reusing
  the existing wordmark-click pattern from `app-nav.spec.ts`).
- **AC4** (user widget / header controls legible, existing behavior
  unchanged): automated — `e2e-integration/header-recolor.spec.ts` AC4
  (dropdown panel `text-foreground` regression test) + unmodified
  `e2e/user-widget-click-outside.spec.ts` / `e2e/header-identity-widget.spec.ts`
  (manual/E2E_WITH_AUTH, confirm no regression) + manual visual QA step 10.
  **Challenge Warning 4 — explicit justification for relying on
  `E2E_WITH_AUTH`-gated coverage here**: this diff touches zero
  click-outside/Escape/sign-out *logic* in `UserWidgetMenu.tsx` — the only
  change is a `className` reset (`text-foreground`) on the panel `<div>`,
  and STORY-13/STORY-15's dismiss/sign-out handlers are untouched. Per
  CLAUDE.md's BUGFIX-06 lesson, an `E2E_WITH_AUTH`-only gap must be closed
  with unconditional `e2e-integration` coverage **when the underlying logic
  actually changes** (that lesson's worked example was a real nav-overflow
  layout bug). Here the CI-unconditional `header-recolor.spec.ts` AC4 test
  already covers the one thing that *did* change (the color-class fix); the
  existing `E2E_WITH_AUTH`-gated specs are retained only as a belt-and-
  suspenders check that the untouched interaction logic still works, not as
  the primary regression gate. This is why no new unconditional spec for
  dismiss/sign-out behavior is being added in this story.
- **AC5** (no layout regression at ≥640px/≥1280px): automated — unmodified
  `e2e-integration/header-nav-mobile-overflow.spec.ts` re-run green (its
  positional assertions are layout-only, unaffected by a pure recolor).
- **AC6** (existing specs pass, changes called out): automated — full
  `npm run test:e2e` run; PR description explicitly lists the zero
  color/class-assertion changes needed in the three named specs (a
  deliberate outcome of Design decisions 2 and 4 minimizing surface area).
- **AC7** (quality gates): automated — `npm run lint && npx tsc --noEmit &&
  npm run build && npm run test:e2e`, all exit 0.

### Risks and rollback

- **Risk**: the inherited-`color` dropdown-panel bug (Design decision 3) is
  the highest-risk item — easy to miss without live-rendering the open
  dropdown in light theme specifically (dark theme's panel `bg-background`
  is near-black, so near-white inherited text would look *correct* there,
  masking the bug in a dark-theme-only check). Mitigated by making it a
  named, automated regression test (AC4 above), not just a manual note.
- **Risk**: `twMerge` modifier-slot landmine on the active-item hover
  override (Design decision 4) — mitigated by matching every modifier
  combination the ghost variant declares (`hover:` and `dark:hover:`)
  rather than relying on CSS cascade specificity.
- **Risk**: prefix-match active-state logic could over-match if a future
  nav href is a prefix of another (e.g. hypothetical `/admin` and
  `/admin/roles`) — not an issue today (all four hrefs are already
  mutually non-prefixing leaf-ish paths), but flag in a code comment for
  future nav additions.
- **Rollback**: pure CSS-token + className diff, no data/schema/migration
  involved. Revert is a straightforward `git revert` of the single PR with
  no follow-up cleanup required.

### Complexity classification

**Standard** (confirmed, not upgraded to complex). Justification: touches
an inherited/global CSS property (`color`, via the new `text-header-foreground`
cascade) — per CLAUDE.md this is a `standard` floor regardless of diff size,
and refine's own exploration found a real inherited-color bug (Design
decision 3), confirming the floor is warranted, not just procedurally
applied. It does not reach `complex`: no auth, data integrity, concurrency,
money, or three-or-more-interacting-backend-systems are involved — this is
a single UI subsystem (header chrome) across four frontend files plus
tests.
