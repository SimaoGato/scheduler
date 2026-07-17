# CHORE-23: Adopt "Escala" design-language foundation (color tokens + type)
Epic: maintenance
Priority: low — timing/sequencing is a product decision, not urgent; scope
deliberately limited to shared foundations only, not a full re-theme
Status: draft
Related: CHORE-18 (home page redesign), CHORE-19 (availability page
redesign), CHORE-21 (team page mobile redesign, draft), CHORE-22 (header/nav
redesign, draft), user-provided mockup in `App design refinement/`

## Task
As the coordinator (Simão), I want the app's core design tokens (color
palette, typography, and button/card shape language) updated to match the
direction explored in the `App design refinement/Escala Dashboard.dc.html`
mockup, so that future page redesigns build on one consistent, approved
visual foundation instead of each page inventing its own colors/fonts.

## Context
`App design refinement/Escala Dashboard.dc.html` (+ `support.js`) is a
standalone, self-contained interactive HTML/JS prototype the user built with
Claude's design/artifact tooling. It is **not** portable Next.js/React
code — it uses its own tiny templating runtime (`sc-if`, `sc-for`,
`{{ }}` bindings) unrelated to this app's stack. Treat it purely as a visual
reference for a redesigned Dashboard/Availability/Team screen set, with a
built-in Member/Admin persona switcher and light/dark toggle for demo
purposes.

Key visual decisions it encodes, compared to the app's current shadcn
neutral gray/zinc theme (`app/globals.css`, no custom fonts, 0.5rem radius,
no accent color beyond near-black/white):
- Two Google Fonts: **Space Grotesk** (display/headings/UI text) and
  **JetBrains Mono** (dates, counts, stat numbers, status badges).
- An OKLCH-defined warm amber/orange accent (`oklch(0.74 0.17 55)`)
  replacing the current neutral black/white primary.
- A near-black/navy header in both light and dark theme, rather than a
  header that matches the page background.
- Fully pill-shaped buttons (radius 999) instead of the current 0.5rem.
- Dashed-border "empty state" cards (e.g. "No schedule published yet").
- A solid-accent "hero" stat card with a flat offset shadow
  (`box-shadow: 0 4px 0 0 <accentHover>`) for the primary admin metric.
- Monospace treatment for all numeric/date data (Sunday dates, counts,
  badges) to visually distinguish data from prose.

Overall it reads as a more distinctive, branded direction than the current
generic shadcn defaults, and is a reasonable style to move toward. The
main risk is that this project has hit real WCAG AA contrast regressions
every time a new palette/token was introduced without measuring actual
ratios (STORY-19, CHORE-17, CHORE-19) — the mockup's colors were tuned by
eye in a design tool, not contrast-checked, so they cannot be copied
verbatim.

This chore intentionally covers **only** the shared foundation (tokens +
fonts), not any page's visual rewrite, so the "when and how" question for
full rollout stays a deliberate, separate decision rather than something
this chore presupposes.

## Acceptance criteria
1. Given `app/globals.css`, when new accent tokens are added, then they
   express the mockup's warm accent color as HSL (matching the existing
   `--primary`/`--accent`/etc. token format), not raw OKLCH copy-pasted, and
   are verified for WCAG AA contrast (≥4.5:1 for normal text) against both
   light and dark theme backgrounds using the project's established
   HSL→luminance→ratio method (CLAUDE.md, `e2e/card-ui-primitive.spec.ts`
   pattern) before merging.
2. Given the new palette, when checked against every existing semantic-token
   consumer (buttons, badges, destructive/warning banners), then no
   currently-passing WCAG AA text/background combination regresses below
   4.5:1 in either theme.
3. Given the two new Google Fonts, when added, then they are loaded via
   `next/font/google` (not a runtime `<link>` tag, to avoid layout shift and
   an uncontrolled external request) and wired into Tailwind's font-family
   theme, with a documented fallback stack for both.
4. Given the change, when `npm run lint && npx tsc --noEmit && npm run
   build && npm run test:e2e` are run, then all exit 0, with no visual
   regression on pages CHORE-18/19 already redesigned (spot-checked
   manually per CLAUDE.md's "QA must visually render UI stories" pattern).
5. Given this chore ships, when the PR is opened, then its description
   explicitly states that page-level adoption (hero stat cards, pill
   buttons, dashed empty states, mono-digit treatment, header recolor) is
   deliberately **not** included — this chore only lands shared tokens and
   fonts so later, separate chores can consume them incrementally.

## Out of scope
- Rewriting any actual page (home, availability, team, admin pages) to use
  the new shapes/components — separate, later chores, sequenced by the user.
- Changing shared shadcn primitives' shape (`Button`, `Card`, `Badge` radius,
  pill styling) — a follow-up chore once the token foundation itself is
  approved and shipped; this touches every consumer app-wide, so keep it
  isolated from the token change.
- The `App design refinement/` mockup files themselves — reference only,
  never imported into or wired up inside the running app.
- Deciding whether/when to start page-level rollout, and in what order
  (dashboard vs. availability vs. team vs. admin pages) — that is the human
  decision the user flagged as still open ("not sure when and how"); this
  chore does not resolve it.

## Technical notes
- Mockup source: `App design refinement/Escala Dashboard.dc.html` +
  `support.js`.
- This directly triggers CLAUDE.md's "Touches inherited/global CSS
  properties" complexity-upgrade rule — classify Implementation as
  `standard` minimum even if the token diff is small, since the blast radius
  is every component app-wide.
- Do not eyeball-port the OKLCH values from the mockup; convert to HSL and
  re-measure actual contrast ratios in both themes, per this repo's
  established pattern, before considering any acceptance criterion met.
- `next/font/google` fetches font files at build time; confirm this doesn't
  break under CI's network conditions (or self-host the font files if it
  does).

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **frontend** — `app/globals.css` (Tailwind v4 `@theme` token layer),
  `app/[locale]/layout.tsx` (root `<html>` className wiring).
- **ux** — new color token pair + typography change is a real, measurable
  visual-design decision (contrast ratios, font pairing), not a mechanical
  refactor.
- No backend/data/infra/ai-ml files touched. This triggers CLAUDE.md's
  "Touches inherited/global CSS properties" complexity-upgrade rule (see
  Complexity tag below) even though the diff is small — `app/globals.css`'s
  `:root`/`.dark`/`@theme inline` blocks are inherited by every component
  app-wide.

### Design decisions (read before implementing)

**Decision 1 — new tokens are additive, not a replacement of `--primary`/
`--accent`.** The Context section says the mockup's accent "replac[es] the
current neutral black/white primary," but AC1 only requires new tokens to be
*added*, AC2 requires *no regression* to any currently-passing pair, AC4
requires *no visual regression* on CHORE-18/19 pages, and AC5 explicitly
excludes "header recolor" and other page-level adoption from this chore.
CHORE-24's own dependency note is decisive: "must land first so this chore
[CHORE-24] consumes verified tokens rather than introducing new ones" — i.e.
CHORE-23's color tokens are expected to sit **unconsumed** until CHORE-24
wires them into `Button`/`Badge`. Therefore: **do not** modify the values of
`--primary`, `--accent`, `--secondary`, `--ring`, or any other existing
token. Add two brand-new CSS custom properties instead:
`--brand` / `--brand-foreground`.

**Decision 2 — token name is `--brand`, not `--accent`.** The mockup calls
its warm color `accent`, but this codebase's shadcn `--accent` /
`--accent-foreground` tokens are already live and heavily consumed (verified
via grep: `components/ui/button.tsx` outline/ghost hover states,
`components/ui/select.tsx` item focus state, and ~30 hand-rolled
`hover:bg-accent` buttons across `PeopleTable.tsx`, `RoleTable.tsx`,
`UserTable.tsx`, `AvailabilityToggleList.tsx`, `PersonSkillsEditor.tsx`,
`ClaimPersonForm.tsx`, `UserWidgetMenu.tsx`, `LanguageSwitcher.tsx`, both
availability/home pages). Naming the new warm color `--accent` would
silently overwrite every one of those neutral-gray hover states with bright
orange — an unintended, app-wide regression, not a foundation addition. Use
`--brand` / `--brand-foreground` (grep-confirmed: no existing collision).
No `--brand-hover` token — every other colored token in this file
(`--primary`, `--destructive`, `--secondary`) relies on Tailwind opacity
modifiers for hover (`hover:bg-primary/90`), not a dedicated hover token;
follow that precedent instead of adding an unused, unverified extra token
(the mockup's `accentHover`/box-shadow hero-card treatment is explicitly
CHORE-25's job, out of scope here).

**Decision 3 — fonts ARE wired as the actual global defaults; colors are
NOT.** This is the one asymmetry in the plan and is worth flagging
explicitly to Challenge/Review against AC4/AC5 (CLAUDE.md's CHORE-20 lesson:
transparency doesn't self-exempt from scope enforcement).
  - Evidence for wiring fonts globally: AC3 requires fonts to be "wired into
    Tailwind's font-family theme" (stronger language than AC1's "tokens are
    added"). More importantly, CHORE-26 AC1/AC2 assume the "display font" is
    *already* the ambient default by the time it runs ("labels... keep the
    display font") — no chore between CHORE-23 and CHORE-26 applies a
    display-font utility class to existing prose/labels page-by-page, so the
    only way that AC is satisfiable is if CHORE-23 makes Space Grotesk the
    literal default body font (Tailwind's `--font-sans` token, which
    Tailwind v4's preflight maps to `html { font-family: ... }` via
    `--default-font-family: --theme(--font-sans, initial)` —
    confirmed in `node_modules/tailwindcss/theme.css`).
  - Evidence for keeping colors dormant: font-family changes carry no WCAG
    contrast risk (CHORE-26 AC4 says so explicitly), so a global swap is low
    risk. Color changes are exactly what has caused every prior contrast
    regression in this project (STORY-19, CHORE-17, CHORE-19) — keeping
    `--brand` unconsumed until CHORE-24/25 do per-component contrast
    verification for their specific (larger, bolder) use cases is the
    conservative choice explicitly foreshadowed by CHORE-25 AC4 ("do not
    assume the accent/foreground pairing verified in CHORE-23 for small text
    automatically holds for this larger stat-number use").
  - Net effect: after this chore ships, **every page's body text visibly
    renders in Space Grotesk instead of the current system-font stack** —
    this is an intentional, real visual change, not a bug. No button/card/
    badge/header color changes anywhere. This must be stated plainly in the
    PR description per AC5, in addition to the excluded pill/hero/dashed/
    header-recolor/mono-rollout items already required.
  - `--font-mono` (JetBrains Mono) is also wired as Tailwind's reserved
    `--font-mono` key. This is much lower blast radius than `--font-sans`:
    it only (a) enables the `font-mono` utility class for later chores
    (CHORE-25/26 will apply it per-element to dates/numbers) and (b)
    overrides Tailwind's default `code`/`pre`/`kbd`/`samp` font — grep
    confirms none of those elements exist anywhere in `app/` or
    `components/` today, so (b) has zero current effect.

**Decision 4 — accent color math.** The mockup's `oklch(0.74 0.17 55)`
converts (via standard OKLab→linear-sRGB→sRGB matrices, CSS Color 4 spec) to
approximately `hsl(27.7, 95.5%, 56.7%)` (a saturated warm orange). Checked
against the project's HSL→luminance→ratio method:
  - `black text on this background` → 8.65:1 (comfortably ≥4.5:1)
  - `white text on this background` → 2.43:1 (fails badly)
  This matches the mockup's own actual usage: grepping `support.js` /
  the mockup HTML shows `t.accent` is **only ever used as a background fill**
  paired with `t.accentText` (near-black), never as bare text color on the
  page background. So the token pair to ship is:
  - `--brand: 27.7 95.5% 56.7%;` (same value in `:root` and `.dark` — the
    pair's contrast is self-contained and does not depend on the page
    background, matching the mockup's own choice to reuse one accent value
    in both themes)
  - `--brand-foreground: 240 10% 3.9%;` (near-black, reusing the same scale
    already used by `--foreground` in this file, in both `:root` and
    `.dark`, so it always reads as dark text regardless of theme)
  - Measured: `--brand-foreground` on `--brand` = **8.31:1** in both blocks
    (comfortably ≥4.5:1 AA for normal text).
  - Explicit limitation to document in the token's CSS comment: `--brand`
    has **not** been verified as a standalone text color on `--background`/
    `--card` (that pairing measures only ~2.4:1 and would fail) — any future
    story that wants `text-brand` directly on the page background must
    re-verify contrast independently or introduce a separate, darker token
    for that use. This chore only ships the bg+foreground pair the mockup
    itself actually uses.

### Step-by-step approach (test-first)

1. **Write failing tests first** in a new `e2e/design-language-foundation.spec.ts`
   (CI-safe, static/filesystem + one HTTP-fetch check, no auth needed — same
   category as `e2e/card-ui-primitive.spec.ts`):
   - AC1a (static): regex-assert `--brand` and `--brand-foreground` exist in
     both the `:root` and `.dark` blocks of `app/globals.css`, in
     `H S% L%` HSL format (not `oklch(...)`).
   - AC1b (computed contrast): reuse the HSL→sRGB→luminance→ratio helper
     functions from `e2e/card-ui-primitive.spec.ts` (duplicate them locally
     in the new spec file — that file doesn't export them either, so this
     matches existing precedent) and assert `contrastRatio(brand-foreground,
     brand) >= 4.5` for both the `:root` values and the `.dark` values.
   - AC2 (no regression): loop over every existing semantic pair already in
     `app/globals.css` — `background`/`foreground`, `card`/`card-foreground`,
     `popover`/`popover-foreground`, `primary`/`primary-foreground`,
     `secondary`/`secondary-foreground`, `muted`/`muted-foreground`,
     `accent`/`accent-foreground`, `destructive`/`destructive-foreground`,
     `warning`/`warning-foreground` — and assert each still measures
     ≥4.5:1 in both `:root` and `.dark` blocks. (This is a snapshot-style
     regression test: since Decision 1 means none of these values change,
     the test should pass immediately once written and stay green through
     implementation — if it goes red, an existing token was touched by
     mistake.)
   - AC3a (static): assert `lib/fonts.ts` imports `Space_Grotesk` and
     `JetBrains_Mono` from `'next/font/google'` (not a `<link>` tag anywhere
     in `app/[locale]/layout.tsx`), and that `app/globals.css`'s
     `@theme inline` block defines `--font-sans` and `--font-mono` each
     referencing a `var(--font-space-grotesk)` / `var(--font-jetbrains-mono)`
     CSS variable with a documented fallback stack.
   - AC3b (compiled output, requires prior `npm run build`, skip if absent
     like the card-ui-primitive.spec.ts pattern): fetch `/pt-PT/login`
     (unauthenticated, CI-safe) and assert the response HTML contains **no**
     `<link ... href="https://fonts.googleapis.com` tag, and that the
     compiled CSS under `.next/static` contains a `@font-face` rule whose
     `src` points at a local `/_next/static/media/` path (proves
     self-hosting, not a runtime Google request).
   - AC4 (overflow regression from the global font swap): extend the
     existing 375px-viewport `scrollWidth`-based smoke pattern
     (`e2e/smoke.spec.ts`) to also check `/pt-PT/login` and `/pt-PT/claim`
     (public, unauthenticated pages) at 375px after the font change — a
     wider display font can shift text width enough to reintroduce overflow
     that was previously fixed for the old font's metrics (BUGFIX-02/BUGFIX-06
     precedent). This is necessarily narrower than full coverage since most
     pages require auth; document the gap and rely on manual visual
     spot-checks (see step 5) for the authenticated pages.
   - AC5: no automated test possible (PR description content) — documented
     as a manual step only, per Definition of Done point 5.
   - Confirm all new tests fail against the current `app/globals.css` /
     absent `lib/fonts.ts` before writing any implementation code.

2. **Implement `app/globals.css` token changes**:
   - In `:root`, add after `--warning-foreground`:
     ```css
     /* CHORE-23: mockup's oklch(0.74 0.17 55) converted to HSL via standard
        OKLab->linear-sRGB->sRGB matrices (CSS Color 4), then measured (not
        eyeballed) with this repo's HSL->luminance->ratio method. Verified:
        --brand-foreground on --brand = 8.31:1 (WCAG AA normal text, both
        themes — see e2e/design-language-foundation.spec.ts). NOT verified as
        a standalone text color on --background/--card (~2.4:1, fails) — the
        mockup itself only ever uses this as a bg-fill + dark-text pair, and
        this chore ships only that pairing. Unconsumed by any component in
        this diff; CHORE-24 wires it into Button/Badge. */
     --brand: 27.7 95.5% 56.7%;
     --brand-foreground: 240 10% 3.9%;
     ```
   - In `.dark`, add the same two lines with a short comment noting the pair
     is intentionally identical across themes (self-contained contrast,
     matches the mockup's own single-value reuse).
   - In `@theme inline`, add `--color-brand: hsl(var(--brand));` and
     `--color-brand-foreground: hsl(var(--brand-foreground));` next to the
     existing `--color-warning*` lines (enables `bg-brand`/`text-brand`/
     `text-brand-foreground` utilities — unused by any component yet).
   - Also in `@theme inline`, add:
     ```css
     --font-sans: var(--font-space-grotesk), ui-sans-serif, system-ui,
       sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
     --font-mono: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular,
       Menlo, Consolas, "Liberation Mono", monospace;
     ```
   - Update the "Design tokens" doc comment block (lines ~104-117) to
     mention `bg-brand`/`text-brand-foreground` and the new font stack.

3. **Add font loader module** `lib/fonts.ts`:
   ```ts
   import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';

   // CHORE-23: variable fonts — no `weight` needed (Next.js recommendation).
   // subsets include 'latin-ext' alongside 'latin' to guarantee full pt-PT
   // glyph coverage (ã, õ, ç, etc.) rather than assuming the base 'latin'
   // subset covers them.
   export const spaceGrotesk = Space_Grotesk({
     subsets: ['latin', 'latin-ext'],
     display: 'swap',
     variable: '--font-space-grotesk',
   });

   export const jetbrainsMono = JetBrains_Mono({
     subsets: ['latin', 'latin-ext'],
     display: 'swap',
     variable: '--font-jetbrains-mono',
   });
   ```

4. **Wire into `app/[locale]/layout.tsx`**: import both font objects, and
   compose the `<html>` className from three sources (font variables +
   conditional dark class) instead of the current single ternary:
   ```ts
   const htmlClassName = [spaceGrotesk.variable, jetbrainsMono.variable, isDarkFromCookie ? 'dark' : null]
     .filter(Boolean)
     .join(' ');
   ```
   and `<html lang={locale} className={htmlClassName} suppressHydrationWarning>`.
   Do not use `cn()`/`twMerge` here — plain array-join avoids any risk of
   `twMerge` misinterpreting the hashed font-variable class names, and
   matches Next.js's own documented multi-font pattern.

5. **Run the full gate and spot-check visually**:
   - `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e`
     — confirm all exit 0, including the new spec file's tests (now green).
   - Confirm `npm run build` actually reaches out to `fonts.googleapis.com`
     successfully in this environment (verified reachable during
     refinement: `curl -s -o /dev/null -w '%{http_code}' https://fonts.googleapis.com/css2?family=Space+Grotesk` → `200`). If a future CI run fails on
     this fetch, the fallback is self-hosting the two `.woff2` files under
     `public/fonts/` and switching to `next/font/local` — out of scope for
     this implementation unless the live CI run actually fails.
   - Manually run the dev server and visually render (per CLAUDE.md's "QA
     must visually render UI stories" pattern): home, availability, team/
     people (admin), admin users, admin roles, login, claim — in both light
     and dark theme, at 375px and 1280px. Specifically check the
     overflow-sensitive dense tables (`PeopleTable.tsx`, `RoleTable.tsx`,
     `UserTable.tsx`) at 375px, since BUGFIX-02/BUGFIX-06's flex-wrap
     breakpoints were tuned against the previous system-font metrics and a
     wider display font could reintroduce wrapping/overflow. Screenshot any
     page where text now looks cramped or clipped.
   - Confirm no `--brand`/`brand-foreground` classes render anywhere (they
     shouldn't — nothing consumes them yet); this is a quick grep, not a
     visual check.

6. **PR description** (AC5): state explicitly, in plain language:
   - "Page-level adoption (hero stat cards, pill buttons, dashed empty
     states, mono-digit treatment, header recolor) is deliberately NOT
     included in this chore."
   - "This chore DOES change the app's default body font everywhere (Space
     Grotesk replaces the previous system-font stack) — this is intentional
     per AC3, not a scope violation; no colors change anywhere."

### Test plan (1:1 with acceptance criteria)

| AC | Automated test | Manual verification |
|----|-----------------|----------------------|
| AC1 | `e2e/design-language-foundation.spec.ts` — static HSL-format check + computed contrast ≥4.5:1 for `--brand-foreground`/`--brand`, both themes | — |
| AC2 | Same spec file — loop over all 9 existing semantic pairs, assert ≥4.5:1 unchanged, both themes | — |
| AC3 | Same spec file — static import/theme-wiring check + compiled-CSS self-hosting check (no Google `<link>`, local `@font-face` src) | — |
| AC4 | `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e` (CI); extended 375px scrollWidth check on public pages | Visual spot-check of home/availability/team/admin-users/admin-roles/login/claim, both themes, 375px + 1280px, per CLAUDE.md's visual-QA note; specifically re-check dense tables for font-driven overflow |
| AC5 | — | PR description explicitly states the two bullet points in step 6 above |

### Risks and rollback

- **Risk**: hand-derived OKLCH→HSL conversion arithmetic error. Mitigation:
  the shipped AC1 test measures contrast directly from whatever HSL value
  actually lands in `globals.css`, so AC1 compliance does not depend on the
  conversion being exact — only on the final numbers passing; still worth a
  second independent check (e.g. https://oklch.com or the `culori` npm
  package) during implementation before committing the values.
- **Risk**: global font swap (Decision 3) shifts text width enough to
  reintroduce a horizontal-overflow or flex-wrap regression on pages tuned
  for the previous font's metrics (BUGFIX-02, BUGFIX-06). Mitigation: step 5's
  explicit re-check of the dense admin tables and the extended smoke check;
  if any real regression is found, the fix belongs in this same PR (adjust
  the affected component's wrap/width classes), not deferred.
- **Risk**: `next/font/google`'s build-time fetch fails in a future CI
  network-restricted environment. Mitigation noted in step 5; not expected
  given confirmed reachability, but self-hosting via `next/font/local` is
  the documented fallback if it ever occurs.
- **Rollback**: the entire change is confined to `app/globals.css`,
  `lib/fonts.ts` (new file), and `app/[locale]/layout.tsx` (small diff) —
  a single revert of this PR fully restores the previous system-font/
  neutral-palette state with no data migration or follow-up cleanup needed.

### Complexity tag

**standard** — CLAUDE.md's explicit rule: this touches inherited/global CSS
properties (`app/globals.css`'s `:root`/`.dark`/`@theme` blocks, consumed by
every component app-wide) and changes the default `font-family` resolution
for the entire application, so it is `standard` minimum regardless of the
small diff size. It is not `complex` (no auth/data-integrity/concurrency/
money/security surface, and the color tokens are deliberately inert/
unconsumed), but the global-blast-radius font change and the WCAG
contrast-measurement rigor this project has repeatedly gotten wrong in the
past (STORY-19, CHORE-17, CHORE-19) both argue against `trivial`.

### Open questions (non-blocking — flagged for Challenge/Review per
CLAUDE.md's CHORE-20 lesson, plan proceeds with the stated interpretation)

1. Decision 3 (fonts globally live, colors dormant) is inferred from
   cross-referencing CHORE-25/26's already-drafted ACs, not from CHORE-23's
   own AC text alone, which is silent on whether the font change is global
   or opt-in. If Simão intended the fonts to also stay opt-in/unconsumed
   until a later chore, say so before Implementation starts — it changes
   step 4 (no `<html>` className change) and significantly narrows the test
   plan's AC4 overflow-risk section.
2. Decision 2's token name (`--brand`) is a naming choice, not dictated by
   any AC. If a different name is preferred (e.g. `--warm-accent`), it's a
   trivial rename before implementation — flagging only so Challenge
   doesn't need to independently re-derive the `--accent` collision risk
   already documented here.

## Implementation notes (post-delivery)

Status: implemented on `story/CHORE-23-adopt-design-language-foundation`.

### AC verification

- **AC1** (`--brand`/`--brand-foreground` HSL tokens, WCAG AA contrast
  verified) — automated: `e2e/design-language-foundation.spec.ts` AC1a
  (static HSL-format check, both `:root`/`.dark`) and AC1b (computed
  contrast via the HSL→sRGB→luminance→ratio helper, 8.31:1 in both themes,
  matching the plan's independently pre-verified math). Both pass.
- **AC2** (no regression on any existing semantic pair) — automated: all 8
  remaining pre-existing pairs (`background`/`foreground`,
  `card`/`card-foreground`, `popover`/`popover-foreground`,
  `primary`/`primary-foreground`, `secondary`/`secondary-foreground`,
  `accent`/`accent-foreground`, `destructive`/`destructive-foreground`,
  `warning`/`warning-foreground`) pass unchanged in both themes. One finding
  during test-first authoring, unrelated to this chore's diff:
  `--muted`/`--muted-foreground` as a *solid*, 100%-opacity pairing already
  measured 4.39:1 in light theme (below AA) **before** any change in this
  PR — pre-existing, and grep-confirmed never consumed as a solid pairing
  anywhere in the app (every live `bg-muted` usage is `bg-muted/25` or
  `bg-muted/50`, translucent over `--background`). Per Decision 1, no
  existing token value was touched to "fix" this — it is pinned in a
  dedicated test (not gated at 4.5) so a future accidental change is still
  caught, and documented here for visibility/triage as a separate, future
  concern.
- **AC3** (fonts via `next/font/google`, wired into Tailwind theme, no
  runtime `<link>`, documented fallback stacks) — automated:
  `e2e/design-language-foundation.spec.ts` AC3a (static: `lib/fonts.ts`
  imports, `@theme inline` wiring) and AC3b (compiled output: no
  `fonts.googleapis.com`/`fonts.gstatic.com` reference anywhere in the
  response HTML or compiled CSS; `@font-face` `src` resolves to a
  build-relative, self-hosted `url(../media/<hash>.woff2)` path). All pass.
  Also verified during implementation that JetBrains Mono **does** publish
  a `latin-ext` subset on Google Fonts (the story's flagged risk did not
  materialize) — `npm run build` succeeded without needing a fallback to
  `latin`-only or `next/font/local`.
- **AC4** (lint/tsc/build/test:e2e all exit 0, no visual regression on
  CHORE-18/19 pages) — `npm run lint`, `npx tsc --noEmit`, and
  `npm run build` all exit 0. `npm run test:e2e` (smoke suite) exits 0: 101
  passed, 91 skipped (auth-gated, expected — no `E2E_WITH_AUTH`/browser
  OAuth creds in this sandbox), 0 failed. Manual visual QA below.
- **AC5** (PR description states page-level adoption is excluded and the
  font swap is global/intentional) — manual: stated verbatim in the PR
  description (see the two required bullet points).

### Manual visual verification (dev server, local Supabase, both themes, both viewports)

Started a local Docker Supabase instance (`supabase status`/`supabase db
push --local`, already running in this environment), seeded the CHORE-05
`ci-admin@example.test`/`ci-member@example.test` test accounts, ran
`npm run dev` pointed at it, and captured real-session screenshots (same
`signInWithPassword` cookie-capture technique as
`e2e-integration/fixtures.ts`) at 375px/1280px × light/dark for: login,
`/claim` (redirect target), home (admin + member), availability (admin +
member), team/people admin, admin users, admin roles.

- Space Grotesk renders as the default body/heading font everywhere,
  including the login screen, nav, table headers, and Card titles — reads
  as intentional, not broken, in both themes. JetBrains Mono is not visibly
  used anywhere yet (unconsumed by any component in this diff, as intended).
- No color changes are visible anywhere — buttons, badges, nav, and Card
  borders all render in the same neutral gray/black/white palette as
  before. `--brand`/`--brand-foreground` do not appear anywhere (grep
  confirms zero consumers).
- `document.documentElement.scrollWidth` measured at 375px on
  `/pt-PT/login`, `/pt-PT/claim`, `/pt-PT/`, `/pt-PT/availability`,
  `/pt-PT/admin/people`, and `/pt-PT/admin/users` all equal exactly 375 (no
  overflow) on this branch — identical to `main`.
- **Finding, confirmed pre-existing and unrelated to this diff**:
  `/pt-PT/admin/roles` at 375px has real page-level horizontal overflow
  (`scrollWidth` 410 on this branch). To isolate whether the global font
  swap caused or worsened this, the same page was measured against `main`
  (pre-CHORE-23, via a disposable `git worktree`) under identical
  conditions: `main` measures **419** — i.e. the pre-existing bug is
  already present on `main` and is not introduced or worsened by this
  chore's font change (this branch is actually 9px narrower). Root cause is
  unrelated to fonts: `RoleTable.tsx`'s table is wrapped in
  `overflow-x-auto` (a self-contained scrollable box, same as
  `PeopleTable.tsx`/`UserTable.tsx`), but at 375px with 3 seeded roles the
  "Nome"/"Vagas por domingo"/"Editar"/"Remover" columns together exceed
  even the outer page width, not just the box — this pre-dates CHORE-23 and
  is out of scope here per Decision 1/the story's "no page rewrites"
  exclusion. Recommend a follow-up bugfix ticket (candidate: fold into
  CHORE-21's team-page mobile-actions redesign, or a standalone BUGFIX)
  rather than fixing it in this token/font-only PR.
- Admin `PeopleTable`/`UserTable` render seeded rows (including a long pt-PT
  name, "Ana Beatriz Ferreira de Almeida Rodrigues") with `overflow-x-auto`
  containing the horizontal scroll as designed — no page-level overflow, no
  regression from the font change.
