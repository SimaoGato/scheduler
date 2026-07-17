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
fully-rounded (`border-radius: 999px`) shapes for small interactive/status
elements — the persona-switch buttons, the CTA ("Manage availability", "Add
person"), the availability status badges, and team level badges — a
consistent, deliberate departure from the current shadcn default
(`--radius: 0.5rem`, `components/ui/button.tsx`'s default rounded-md/rounded
classes).

**Correction (post-Challenge):** the mockup itself is **not** uniformly
pill-shaped. Its top nav tab bar (`navBase`, Dashboard/Availability/Team)
uses `borderRadius: 6`, not 999, and its card/container elements
(`statCardStyle`, `heroStatStyle`, roster/availability row styles) use
`borderRadius: 8–10`. Only the small interactive/status elements listed
above are pill-shaped in the mockup. This story's shared `Button` primitive
change (see Implementation Plan → Design decision 1) still applies the pill
radius uniformly, including to `AppNav`'s nav links — but that is a
deliberate primitive-consistency decision grounded in AC1's unconditional
wording ("its default and any size variants"), **not** because the mockup
shows pill-shaped nav tabs. This app's `AppNav` ghost-variant links render
with no background at rest (unlike the mockup's filled `navBase` tab bar),
so there is no faithful analog of the mockup's 6px nav-tab value to
preserve; using the shared primitive's uniform pill radius is the lower-risk
reading, not a mockup-literal one. See Implementation Plan → Design
decision 1 for the full rationale.

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

## Implementation Plan

### Exploration findings (read before implementing)

- **CHORE-23 confirmed landed** (`git log`: `fc0539a feat(CHORE-23): load
  Space Grotesk + JetBrains Mono...`, `d3ad82a docs(CHORE-23): ... archive
  story`). Dependency satisfied.
- **`components/ui/` currently contains exactly three primitives**:
  `button.tsx` (`rounded-md` base, `rounded-md` repeated on `sm`/`lg` size
  variants), `select.tsx` (`rounded-md` trigger, `rounded-md` content panel,
  `rounded-sm` items), `card.tsx` (`rounded-xl`).
- **Mockup's actual computed radii are NOT uniformly 999px.** Reading
  `App design refinement/Escala Dashboard.dc.html`'s embedded script
  directly: `borderRadius: 999` (pill) is used only for small
  interactive/status elements — `ctaButtonStyle`, `pillButtonStyle`,
  `pillButtonDisabledStyle`, `teamPillStyle`, `personaSwitchWrapStyle` +
  its two buttons, `badgeStyle` (availability status), `levelBadgeStyle`
  (team level), `availBtnStyle` (per-row Availability button),
  `emptyStateBadgeStyle` ("Coming soon"). The top **nav tab bar**
  (Dashboard/Availability/Team, `navBase`) uses `borderRadius: 6`, and all
  **card/container** elements (`statCardStyle`, `heroStatStyle`,
  `emptyStateCardStyle`, `availSummaryCardStyle`, team roster row
  `rowStyle`, availability row `rowStyle`) use `borderRadius: 8–10`, not
  999. See Design decision 1 below for how this is resolved.
- **Only four files in the current codebase import the shared `Button`
  component** (verified via `grep -rl "<Button"`): `AppNav.tsx` (nav links,
  `variant="ghost"`, rendered in the header on every authenticated page),
  `app/[locale]/(app)/page.tsx` (admin "Quick links" `Button variant="ghost"
  asChild"`), `GoogleSignInButton.tsx` (login page, default variant),
  `ThemeToggle.tsx` (settings page, default/outline variants, `size="sm"`).
  No consumer currently passes `variant="destructive"`. The many other
  visually-button-like elements across the app (`RoleTable.tsx`,
  `PeopleTable.tsx`, `ClaimPersonForm.tsx`, `DisplayNameForm.tsx`,
  `UserTable.tsx`, `LanguageSwitcher.tsx`, the availability
  back-to-team link, etc.) are hand-rolled `<button>`/`<Link>` elements
  with their own `rounded-md` classes — **not** consumers of
  `components/ui/button.tsx`, and per the story's own Technical notes
  ("grep for hand-rolled ... usage ... for **badge-like elements**"), hand-
  rolled *buttons* are out of this chore's scope; only hand-rolled *badges*
  are in scope.
- **Hand-rolled badge-like `<span>` audit result**: the only existing
  badge-like span outside `components/ui/` is
  `components/AvailabilityToggleList.tsx` line 234 (the `isBlocked` status
  pill), which is **already** `rounded-full` — CHORE-19 shipped it that
  way, and CHORE-26's story file independently confirms this ("Badge
  shape/color — already pill-shaped and contrast-verified by CHORE-19").
  **No code change needed for this element.** The non-blocked state
  renders as plain text with no badge wrapper at all (no rounded classes
  to touch either way).
- **"Team level badge" and "'Coming soon' empty-state badge" (named in this
  story's Context/Technical notes) do not exist anywhere in the current
  codebase.** They are mockup-only elements belonging to future page
  builds — confirmed by reading CHORE-21 (Team page mobile actions,
  draft), CHORE-25 (Dashboard hero stat / empty-state card, draft — does
  not mention a "Coming soon" badge either), and CHORE-26 (Availability
  mono-digit rollout, draft). There is nothing to change for these two
  elements in this chore; flagging so Challenge/Review don't expect a diff
  against non-existent code, and so CHORE-21/25's implementers know to use
  `rounded-full` when they build them.
- **No existing e2e assertions key off computed border-radius or button
  geometry** (AC3). Searched `e2e/` and `e2e-integration/` for
  `border-radius|borderRadius|rounded|radius|999`; the only hit
  (`e2e/link-picker-color-scheme.spec.ts:46`) is the unrelated English
  phrase "blast radius" in a comment. **Nothing to update for AC3** — this
  search itself, repeated by the implementer immediately before coding (in
  case anything landed between refine and implementation), satisfies AC3.
- **tailwind-merge landmine**: `cn()` = `twMerge(clsx(inputs))`. `cva`
  concatenates `base` then the selected `size` variant string (no
  deduplication inside `cva` itself); `twMerge` keeps the **last**
  occurrence in a given class group. Today `sm`/`lg` size variants repeat
  `rounded-md` *after* the base string, so if only the base class is
  changed to `rounded-full` and the `sm`/`lg` variants keep their own
  `rounded-md`, **`sm` and `lg` buttons will silently stay square-cornered
  while `default`/`icon` become pill** — a subtle AC1 violation ("any size
  variants"). The `sm`/`lg` `rounded-md` must be removed (they're
  redundant once the base sets the radius) as part of this change, not
  left in place.
- **No `Badge` primitive exists yet in `components/ui/`.**

### Design decisions

1. **Apply pill radius uniformly to the shared `Button` primitive, across
   all variants and sizes — including nav usage.** AC1's text is explicit
   and unconditional ("its default and any size variants are updated ...
   matches the mockup's pill shape") and the Context frames this as "one
   change ... propagates to every consumer automatically." The mockup's
   own internal inconsistency (nav tabs at 6px vs. CTAs at 999px) is not
   treated as a blocker: this app's `AppNav` ghost-variant links don't
   render as a distinct filled tab-bar the way the mockup's `navBase`
   buttons do (no background box today), so the mockup's specific 6px nav
   value has no faithful analog to preserve — a uniform pill radius on the
   shared primitive is the more literal, lower-risk reading of AC1 and
   avoids inventing a second un-mockuped Button treatment. Flagging this
   explicitly per CLAUDE.md's CHORE-20 scope-enforcement lesson so
   Challenge can independently confirm against AC1's text rather than
   trusting this note alone.
2. **Defer `Badge` primitive extraction — keep the inline pill-shaped span
   as the interim outcome**, per the story's own Out-of-scope bullet
   (explicitly delegates this decision to Refine). Rationale: there is
   currently exactly one hand-rolled badge in the whole app
   (`AvailabilityToggleList.tsx`'s status pill), and it already conforms
   (`rounded-full`) — there is no second consumer today to justify
   extracting a shared primitive (YAGNI), and CHORE-21/25/26 will introduce
   the mockup's other badge-like elements (team level badge, "Coming soon"
   badge) later, at which point a `Badge` extraction can be reconsidered
   with real, multiple usages driving the API shape instead of a
   speculative one now.
3. **`components/ui/select.tsx` and `components/ui/card.tsx` are excluded
   from this chore's radius changes.** `select.tsx`'s trigger/content
   radius has zero mockup reference (no select/dropdown appears in
   `Escala Dashboard.dc.html`) — changing it would be a guess, not a
   mockup-grounded decision. `card.tsx`'s `rounded-xl` correctly stays as
   the "soft" container radius: every card/container style in the mockup
   uses 8–10px, never 999px — pill shape is reserved for small interactive
   controls and status badges, not content containers. This matches the
   Task's own phrasing ("Card-**adjacent** chrome", i.e. buttons/badges
   near or inside cards, not the card border itself).

### Step-by-step approach (test-first)

1. **Write the CI-safe regression tests first** (new file
   `e2e/button-pill-shape.spec.ts`), expected to fail against the current
   `rounded-md` code:
   - Static-source check reading `components/ui/button.tsx` via
     `fs.readFileSync` (BUGFIX-02 pattern, no live render needed):
     - assert the base `cva(...)` string contains `rounded-full`.
     - assert the base string does **not** contain `rounded-md`.
     - assert neither the `sm` nor `lg` size-variant strings contain
       `rounded-md` (guards the tailwind-merge landmine above).
     - assert none of the `variant` option strings (`default`,
       `destructive`, `outline`, `secondary`, `ghost`, `link`) contain any
       `rounded-` class — confirms radius stays variant-agnostic, which is
       how a single live instance can stand in for "any variant" in the
       live check below without needing a fixture page for the unused
       `destructive` variant.
     - assert `disabled:pointer-events-none` is still present (regression
       guard so this edit doesn't collide with `button-cursor.spec.ts`'s
       existing AC2 static check on the same file).
   - Live computed-style check against `/pt-PT/login` (unauthenticated,
     CI-safe): `getByTestId('google-signin-button')` — this is a distinct
     locator from `design-system.spec.ts`'s existing login-button test,
     which uses `getByRole('button', { name: 'Continuar com Google' })`;
     both resolve to the same element, this new test just uses the testid
     already present on `GoogleSignInButton.tsx` instead. Assert
     `getComputedStyle(el).borderRadius` reflects `rounded-full`'s raw
     computed value (Tailwind v4's `rounded-full` = `border-radius: calc(
     infinity)` legacy `9999px`; verify the exact string Tailwind v4
     actually emits by inspecting compiled CSS output first — do not guess
     the literal string, see Risks below).
2. Run the new tests, confirm they fail (red) against current code.
3. Edit `components/ui/button.tsx`:
   - base `cva` string: `rounded-md` → `rounded-full`.
   - `sm` variant: remove the redundant `rounded-md` token.
   - `lg` variant: remove the redundant `rounded-md` token.
   - leave `default` size and `icon` size untouched (no explicit radius
     override today; they inherit the base, which is now `rounded-full` —
     `icon` becomes a circular button, consistent with pill language for a
     square affordance).
4. Re-run `e2e/button-pill-shape.spec.ts`, confirm green.
5. Run existing full regression suites to catch anything unexpected:
   `npm run lint`, `npx tsc --noEmit`, `npm run build`,
   `npm run test:e2e` (smoke) — and, if a local Supabase + `E2E_WITH_AUTH`
   environment is available, the `integration-test` suite too (`AppNav`,
   `home.spec.ts`, `settings-display-name.spec.ts`,
   `header-nav-mobile-overflow.spec.ts` all touch Button consumers or
   coexist with them on the same pages).
6. Manual visual QA on the dev server (CLAUDE.md: "QA must visually render
   UI stories" — structural/computed-style checks alone are not enough):
   - `/pt-PT/login`: default variant, light + dark theme.
   - Authenticated session, both roles (admin, member): `AppNav` ghost
     links in the header, at 375px and 1280px, light + dark. **Explicitly
     check the `:hover` state**, not just the resting state — ghost-variant
     nav links have no background/border at rest, so the pill-shaped radius
     is only visually observable on the hover highlight
     (`hover:bg-accent`). Hovering at rest with no visible fill would give a
     false "looks unchanged" impression even though the radius class did
     change underneath.
   - `/pt-PT/settings`: `ThemeToggle`'s three buttons (`default`/`outline`
     variants, `size="sm"`), all three states (system/light/dark selected),
     light + dark theme, confirm no label clipping at the smaller `h-8`
     height now that corners are fully rounded.
   - Admin home page "Quick links" ghost buttons, 375px and 1280px.
   - Since no consumer uses `variant="destructive"` today, visually confirm
     it only by temporary local inspection (e.g. Tailwind's compiled CSS
     class output, or a throwaway local render) rather than shipping any
     new fixture route — do not add a permanent QA-only page to satisfy
     this, per BUGFIX-02's "do not add unauthenticated fixture routes"
     precedent (this isn't an auth-exemption-path risk specifically, but
     the same "don't ship throwaway UI" principle applies).
   - `secondary` and `link` variants also have zero live consumers today,
     same as `destructive`. Per Challenge finding #5, resolved as follows
     rather than duplicating the temporary-local-inspection step for each:
     `link` renders with no background/border of its own (`text-primary
     underline-offset-4 hover:underline` — a text-only treatment), so a
     radius change is visually inert for it regardless of confirmation
     method. `secondary` shares the same `bg-*`/`shadow-xs`/`hover:bg-*`
     shape pattern as `default` (`bg-secondary text-secondary-foreground
     shadow-xs hover:bg-secondary/80` vs. `default`'s `bg-primary
     text-primary-foreground shadow-xs hover:bg-primary/90` — same
     structure, different color tokens only), and the static "radius is
     variant-agnostic" proof (step 1's test) already establishes that no
     variant string carries its own `rounded-*` override, so `secondary`'s
     radius is adequately covered by `default`'s live proxy check without a
     separate live instance.
   - Confirm every page listed in AC2 (home, availability, team/admin
     people, admin users, admin roles, settings, login) still renders with
     no clipped/misaligned button label or icon at 375px and 1280px — most
     of these pages' buttons are hand-rolled and unaffected by this
     specific edit, so this pass is largely a "confirm no regression"
     sweep, not an expectation of visible change on those pages.
   - Record findings (pass/fail per page/viewport/theme) as a manual
     verification note in this story file before marking done, satisfying
     Definition of Done #5 for AC2.
7. Update this story's `Status` and add AC verification notes per the
   project's usual story-closeout convention once all gates pass.

### Test plan (mapped to acceptance criteria)

- **AC1** (Button pill shape, all variants/sizes, light+dark):
  - Automated: `e2e/button-pill-shape.spec.ts` static-source checks
    (base has `rounded-full`, no `rounded-md` anywhere in base/`sm`/`lg`,
    no `rounded-` in any `variant` option string) + live computed-style
    check on the login page's default-variant button.
  - Manual: dev-server visual pass listed in step 6 above, covering
    default, disabled (`ThemeToggle`'s non-selected state naturally
    exercises hover but not `disabled`; confirm `disabled:opacity-50`
    still renders correctly on a pill shape by temporarily disabling a
    button locally if no live disabled instance exists), and `asChild`
    link usage (`AppNav`), light + dark theme.
- **AC2** (no clipping across all 7 listed pages — home, availability,
  team/admin people, admin users, admin roles, settings, login —
  375px/1280px):
  - Manual only (documented in the story file per Definition of Done #5) —
    no existing automated test targets label/icon clipping specifically;
    the existing `documentElement.scrollWidth` overflow checks in
    `smoke.spec.ts` and `header-nav-mobile-overflow.spec.ts` provide
    partial, indirect coverage (they'd catch gross layout breakage but not
    icon/text clipping inside an unchanged-size button) and continue
    running as regression coverage.
- **AC3** (find/update stale border-radius e2e assertions):
  - Automated: none existed to update (search performed, see Exploration
    findings above; re-run the same grep immediately before coding as a
    final check). Satisfied by demonstrating the search, not by a new
    test.
- **AC4** (44px tap targets preserved):
  - Automated: existing tests already assert `min-h-[44px]` height via
    `boundingBox()`/class presence on the wrapping elements around Button
    usages (e.g. `design-system.spec.ts`'s skipped-but-present nav check,
    `button-cursor.spec.ts`, various `E2E_WITH_AUTH`-gated specs) — none of
    these are touched by this change (only `rounded-*` classes change, not
    `h-*`/`min-h-*`/padding), so they should pass unmodified. Add one
    direct regression assertion in the new spec: `getComputedStyle` height
    of the login button ≥ 44 (belt-and-suspenders, CI-safe, no auth
    needed).
  - Manual: confirm visually during step 6 that no tap target visually
    shrank.
- **AC5** (lint/tsc/build/test:e2e all exit 0):
  - Automated: run all four commands locally before marking ready; CI
    re-verifies on PR.

### Risks and rollback

- **Global blast radius**: this is exactly CLAUDE.md's "inherited/global
  CSS" complexity signal — a change in one file (`components/ui/button.tsx`)
  changes the rendered shape of every Button-based control across the
  entire authenticated app (nav, settings, quick links) and the login
  page, with only 4 direct import sites but many rendered instances (every
  nav link, on every page, for every signed-in user). A visual regression
  here is app-wide, not confined to one page — this is why the story is
  pre-tagged `standard` and why the manual visual QA sweep in step 6
  deliberately covers every AC2-listed page/viewport/theme combination,
  not just the 4 files that changed.
- **Tailwind v4 `rounded-full` computed-value uncertainty**: do not assume
  the exact computed `border-radius` string Tailwind v4 emits for
  `rounded-full` (older Tailwind used a literal `9999px`; v4's `@theme`
  defaults may differ, e.g. `calc(infinity * 1px)` in some v4 builds).
  Verify the actual compiled value from `.next/static/chunks/*.css` (per
  CLAUDE.md's Turbopack CSS output note) or via a quick local
  `getComputedStyle` probe before hardcoding the exact string in the new
  e2e assertion — assert a computed-style property that's stable across
  Tailwind patch versions if the raw string proves brittle (e.g., compare
  `borderRadius` against a fraction of `height` rather than an exact
  string, since a "full pill" is any radius ≥ half the element's height).
- **`sm`/`lg` tailwind-merge landmine** (see Exploration findings): the
  single highest-risk mechanical mistake in this chore — silently shipping
  a button that is pill at `default`/`icon` size but square-cornered at
  `sm`/`lg`. Directly guarded by the static-source test in step 1.
- **Rollback**: single-file, single-property change with no data/schema/API
  surface. Revert is a one-line `git revert` of the `button.tsx` edit (plus
  the new test file, if reverting the whole story) with no migration or
  cleanup needed.
- **Residual known gaps** (documented rather than blocking): `destructive`
  variant has no live consumer to visually spot-check in situ (covered by
  the static "radius is variant-agnostic" proof instead); "team level
  badge" and "Coming soon" badge don't exist yet so can't be verified now
  (deferred to CHORE-21/25 with a note to use `rounded-full`).

### Complexity classification

**standard** — kept at the story's pre-tagged priority per CLAUDE.md's
explicit instruction ("Touches inherited/global CSS properties ... Upgrade
from `trivial` to `standard` even if diff is tiny"). The `button.tsx` edit
itself is only a few tokens, but it is a shared, `cn()`-composed primitive
consumed (directly or via every rendered nav link) on every authenticated
page plus the login page — the blast radius is app-wide and only fully
confirmable by the full AC2 visual sweep across 7 pages × 2 viewports × 2
themes, not by the size of the diff. No auth/data-integrity/concurrency/
money/security dimension is present, so it does not rise to `complex`.

## AC verification notes (implementation)

- **AC1** (pill shape, all variants/sizes, light+dark): PASS.
  - Automated: `e2e/button-pill-shape.spec.ts` (5 tests, all green) —
    static-source checks (base has `rounded-full`, no `rounded-md`
    anywhere in base/`sm`/`lg`, no `rounded-` override in any `variant`
    option string) + live computed-style check on the login page's
    default-variant button (radius >= half of height, i.e. a true pill,
    both robust across Tailwind v4 patch versions — see Risks note on why
    an exact-string assertion was avoided).
  - Manual (screenshots captured against local dev build + local Supabase,
    admin and login sessions): login page default-variant button — pill in
    both light and dark theme, confirmed. `AppNav` ghost-variant nav
    links — resting state has no visible fill (as expected for `ghost`),
    **`:hover` state shows a pill-shaped highlight** in both light and dark
    theme (this is the only place the ghost variant's radius is visually
    observable — see Challenge finding re-check above). `ThemeToggle`'s
    three `size="sm"` buttons on `/pt-PT/settings` — pill-shaped, all three
    selection states, no label clipping at the smaller `h-8` height, both
    themes. Admin home "Quick links" ghost buttons — no clipping at 375px
    or 1280px. `disabled` state — verified by temporarily setting the
    `disabled` attribute on the live login button via
    `element.setAttribute('disabled', 'true')` in a throwaway script (no
    code/fixture route change): renders as a pill with `disabled:opacity-50`
    correctly applied, no shape regression. `destructive` variant (no live
    consumer) — verified via temporary local `cva()` inspection (not a
    fixture route): composed class string includes `rounded-full` and no
    variant-specific override, confirming the variant-agnostic radius
    claim programmatically. `secondary`/`link` variants — not separately
    spot-checked live; see Challenge finding #5 resolution above
    (structural/proxy reasoning, not a live screenshot) documented in the
    Implementation Plan.
- **AC2** (no clipping across all 7 listed pages, 375px/1280px): PASS.
  - Manual only, as planned. Screenshots taken (light/dark where
    applicable, 375px and 1280px viewports) for: `/pt-PT/login` (unauth),
    admin home `/` (authenticated), `/pt-PT/availability`,
    `/pt-PT/admin/people`, `/pt-PT/admin/users`, `/pt-PT/admin/roles`,
    `/pt-PT/settings`. No button label/icon clipping or misalignment
    observed on any page/viewport combination. All buttons on the
    availability/team/users/roles pages are hand-rolled (not `Button`
    consumers, per Exploration findings) and rendered unchanged, as
    expected — this pass confirmed no regression, not a visible shape
    change on those pages.
- **AC3** (stale border-radius e2e assertions): PASS. Re-ran the
  `border-radius|borderRadius|rounded|radius|999` grep across `e2e/` and
  `e2e-integration/` immediately before implementing; only hit was the
  unrelated "blast radius" comment noted in Exploration findings. Nothing
  to update.
- **AC4** (44px tap targets preserved): PASS.
  - Automated: `e2e/button-pill-shape.spec.ts`'s live check asserts the
    login button's computed height >= 44px (belt-and-suspenders,
    unmodified by this radius-only change). Existing `min-h-[44px]`
    class-based assertions elsewhere in the suite are untouched (only
    `rounded-*` classes changed, not `h-*`/`min-h-*`/padding).
  - Manual: confirmed no visual tap-target shrinkage across the AC2 sweep
    above.
- **AC5** (lint/tsc/build/test:e2e all exit 0): PASS — see PR description
  / DoD gate run for exact output. All four commands exited 0 locally;
  in addition, the full `integration-test` suite (74 tests,
  `--workers=1` to match CI's sequential execution) was run locally
  against a seeded local Supabase instance and passed, covering
  `AppNav`, `home.spec.ts`, `header-nav-mobile-overflow.spec.ts`, and
  other Button-consumer/coexisting specs per step 5 of the Implementation
  Plan.
