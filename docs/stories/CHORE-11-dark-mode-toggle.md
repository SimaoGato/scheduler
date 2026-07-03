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

---

## Implementation Plan

### Delivery context (important)
This story lands in the **same PR/branch as CHORE-06** (add English locale +
language switcher), implemented by the same pass, **in a fixed order set by
the orchestrator: CHORE-06 lands FIRST, CHORE-11 (this story) lands SECOND**
in that shared branch/PR. This is not a coincidental ordering choice made by
either story's plan — it is an orchestrator decision and must be treated as
given.

Concretely, this means by the time this story is implemented:
- `app/[locale]/(app)/settings/page.tsx` will **already** contain a
  `<div className="flex flex-col gap-8">` wrapper with `<DisplayNameForm />`
  and `<LanguageSwitcher />` rendered as siblings inside it (CHORE-06's work).
  This story does **not** establish the first section pattern on the page —
  it must read the post-CHORE-06 state of the file before editing and add
  `ThemeToggle` (or its wrapping `<section>`) as a **third sibling inside that
  existing wrapper div**, not as a new/second wrapper or a competing layout
  structure.
- `messages/en.json` will **already exist** as a full mirror of
  `messages/pt-PT.json` (CHORE-06's work). See the updated Decision 2 below —
  this is no longer conditional.

The step-by-step approach and grounding notes below have been updated to
reflect this fixed ordering; do not fall back to the "establishes the first
pattern" framing that appeared in an earlier draft of this plan.

### Complexity tag
**standard** — small surface (4-5 files touched) but it changes root-layout
hydration behaviour (`app/[locale]/layout.tsx`, `suppressHydrationWarning`),
redefines a global Tailwind variant that every current and future `dark:`
utility depends on (`@custom-variant dark`), and adds a new runtime dependency
(`next-themes`). Not `trivial` (hydration-timing correctness and a global CSS
variant redefinition carry real regression risk if misordered); not `complex`
(no auth, data integrity, concurrency, or money involved, and it's confined to
the frontend/rendering layer).

### Affected areas
- **frontend** — `app/[locale]/layout.tsx` (ThemeProvider + suppressHydrationWarning),
  `app/globals.css` (`@custom-variant dark`), new `components/ThemeToggle.tsx`,
  `app/[locale]/(app)/settings/page.tsx` (wire in the new section), `package.json`/lockfile
  (new dependency `next-themes`).
- **ux** — toggle control design (3-way System/Light/Dark button group), tap-target sizing, no-FOUC behaviour.
- **data/i18n** — `messages/pt-PT.json` (`Settings` namespace: new theme-related keys); `messages/en.json` (same keys, unconditionally — see Decision 2 below).
- **tests** — new `e2e/dark-mode.spec.ts`.

### Grounding notes (repo state verified before writing this plan)
- `next-themes` is **not** currently a dependency (checked `package.json`) — must be added (`^0.4.6`, which lists `react: '^16.8 || ^17 || ^18 || ^19'` as a peer, compatible with this project's React 19.2.4). Do not pin the `1.0.0-beta.0` prerelease.
- `app/globals.css` already has the full `.dark { … }` token block (lines 26-46) from CHORE-01, but **no** `@custom-variant dark` directive — confirms the story's stated "latent inconsistency" is real today: `dark:` utilities in `components/ui/button.tsx` (e.g. `dark:bg-input/30`, `dark:hover:bg-accent/50`) currently key off Tailwind v4's default `prefers-color-scheme` media query, independent of the `.dark` class.
- `app/[locale]/layout.tsx` currently owns `<html lang={locale}>`/`<body>` with no theme-related code; `<html>` has no `suppressHydrationWarning` today.
- `components/ui/button.tsx` is the only file with `dark:` utility classes in the codebase today (per a fresh grep — matches the story's claim, re-verify at implementation time since new components may have landed since).
- `app/[locale]/(app)/settings/page.tsx` is currently (pre-CHORE-06, at the time this plan was written) a thin Server Component rendering only an `<h1>` + `<DisplayNameForm />`. **This is not the state the implementer will see.** Per the fixed CHORE-06-then-CHORE-11 ordering above, by the time this story is implemented the file will already have a `<div className="flex flex-col gap-8">` wrapper with `<DisplayNameForm />` and `<LanguageSwitcher />` as siblings. Re-read the file fresh at implementation time and add `ThemeToggle` as a third sibling in that wrapper — do not re-derive or recreate the wrapper structure from this (stale) grounding note.
- `messages/pt-PT.json`'s `Settings` namespace currently has only `title`, `nameLabel`, `saveButton`, `savingLabel`, `successMessage`, `errorEmpty`, `errorGeneric` — no theme-related keys yet. `messages/en.json` does not exist yet at the time this plan was written, but per the fixed ordering above **will exist** (as CHORE-06's full mirror of `pt-PT.json`) by the time this story is implemented — see Decision 2.
- No accessibility-audit tooling (e.g. `@axe-core/playwright`) is installed — AC7 (contrast) cannot be fully automated with what's in the repo today.

### Decisions made explicitly (not blocking, but flagged for visibility)
1. **Toggle shape**: a 3-way **System / Light / Dark** button group (not a
   binary on/off switch). AC2 requires "system" to be a real, resolvable
   default state; a plain binary switch would strand a user who explicitly
   picked light/dark and later wants to return to following the OS setting.
   This is `next-themes`' standard recommended pattern and needs no new
   shadcn install (built from the existing `components/ui/button.tsx`).
2. **`messages/en.json`**: per the fixed CHORE-06-then-CHORE-11 delivery
   order (orchestrator decision, see "Delivery context" above), `en.json`
   **will already exist** as a full mirror of `pt-PT.json` by the time this
   story is implemented — this is not conditional. This story therefore
   **unconditionally** adds the four new `Settings.theme*` keys (translated
   to English) to `messages/en.json` in the same commit/step as the
   `pt-PT.json` addition. As a final step, re-run CHORE-06's key-parity check
   script (whatever CHORE-06 introduced to diff keys between the two locale
   files) to confirm no keys are missing across both files combined after
   this story's additions.

### Step-by-step approach (test-first where practical)
1. **Add dependency**: `npm install next-themes@^0.4.6`.
2. **`app/globals.css`**: add `@custom-variant dark (&:is(.dark *));` immediately
   after `@import "tailwindcss";` (before the existing `@layer base` block).
   No other CSS changes — the `.dark` token block is untouched.
3. **`app/[locale]/layout.tsx`**:
   - `import { ThemeProvider } from 'next-themes';`
   - Add `suppressHydrationWarning` to the `<html>` tag only (not `<body>`) —
     this is required because `next-themes` sets the class client-side via an
     inline script before hydration, which otherwise trips React's
     server/client mismatch warning on `<html>`.
   - Wrap the existing `<NextIntlClientProvider>` with
     `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
     inside `<body>`. No `'use client'` directive is needed on the layout
     itself — `ThemeProvider` is next-themes' own client component, and a
     Server Component may render a client component as a child directly
     (same pattern already used for `NextIntlClientProvider` in this file).
4. **`components/ThemeToggle.tsx`** (new, `'use client'`):
   - Use `useTheme()` from `next-themes`.
   - Guard the hydration-mismatch window: `next-themes` cannot know the
     resolved theme on the server, so `theme`/`resolvedTheme` are `undefined`
     until mounted. Use a `mounted` boolean (`useState` + `useEffect`) and
     render a same-size placeholder (to avoid layout shift) until mounted,
     matching the library's documented pattern.
   - Render a `role="group"` container with three buttons (System/Light/Dark),
     built from the existing `Button` component (`variant="outline"`,
     `size="sm"` or similar — no new shadcn install). Each button:
     `aria-pressed={theme === 'system' | 'light' | 'dark'}`,
     `min-h-[44px] min-w-[44px]` (AC6 tap-target floor), `onClick={() => setTheme(...)}`.
   - Labels via `useTranslations('Settings')`: `themeSectionTitle`,
     `themeSystem`, `themeLight`, `themeDark`.
5. **Wire into the settings page** (`app/[locale]/(app)/settings/page.tsx`):
   **first, re-read the file's current (post-CHORE-06) contents** — do not
   assume the pre-CHORE-06 shape described in the grounding notes above. It
   will contain a `<div className="flex flex-col gap-8">` wrapper with
   `<DisplayNameForm />` and `<LanguageSwitcher />` as siblings. Add a
   `<section aria-labelledby="theme-section-title">` as a **third sibling
   inside that existing wrapper div** (not a new/second wrapper), with its
   own `<h2 id="theme-section-title">` reading `t('themeSectionTitle')`,
   containing `<ThemeToggle />`. Written as a self-contained addition (own
   `<section>`, own heading id) so it is a pure addition alongside CHORE-06's
   `LanguageSwitcher` section, not an edit to CHORE-06's markup.
6. **`messages/pt-PT.json`** — add to the `Settings` namespace (AO90 spelling,
   all already compliant):
   - `themeSectionTitle`: `"Tema"`
   - `themeSystem`: `"Sistema"`
   - `themeLight`: `"Claro"`
   - `themeDark`: `"Escuro"`
   **Unconditionally mirror the same four keys (translated to English) into
   `messages/en.json`** — per the fixed delivery order, that file will
   already exist as CHORE-06's full mirror by this point, so this is not a
   conditional step. After both files are updated, re-run CHORE-06's
   key-parity check script to confirm no keys are missing across either
   locale file.
7. **Tests** — new `e2e/dark-mode.spec.ts` (see Test plan below), including a
   lightweight assertion that `/en/settings` renders no raw i18n key strings
   for the theme toggle (e.g. the literal key name `themeSectionTitle` never
   appears anywhere in the rendered DOM) — a cheap regression guard against a
   missed/mistyped key in `en.json`. Run the full DoD gate (`npm run lint`,
   `npx tsc --noEmit`, `npm run build`, `npm run test:e2e`).

### Test plan (mapped 1:1 to acceptance criteria)
- **AC1** (`.dark` on `<html>`, all pages readable, no leftover light surfaces):
  - Automated, non-auth: `page.emulateMedia({ colorScheme: 'dark' })` before
    `page.goto('/pt-PT/login')` (public route) with a fresh context (no
    `theme` localStorage key) → assert `<html>` has `class="dark"` and the
    computed `background-color` of `<body>` matches the dark `--background`
    token, not the light one.
  - Automated, `E2E_WITH_AUTH`-gated (mirrors existing convention in
    `settings-display-name.spec.ts`): pre-set `localStorage.theme = 'dark'`
    via `page.addInitScript` before visiting `/`, `/pt-PT/admin/users`
    (Utilizadores), `/pt-PT/admin/people` (Equipa); assert `<html>` has
    `class="dark"` on each and no console errors.
  - Manual/documented: visual spot-check screenshots of these four pages in
    dark mode for unreadable text / leftover light surfaces (no axe-core or
    contrast tooling in the repo to automate this fully — see AC7 below).
- **AC2** (defaults to system on first visit): non-auth test on
  `/pt-PT/login` with a **fresh context** (no persisted `theme` key) —
  `emulateMedia({ colorScheme: 'dark' })` → assert `<html class="dark">` after
  load; companion test with `colorScheme: 'light'` → assert no `dark` class.
- **AC3** (explicit choice persists and overrides OS): `E2E_WITH_AUTH`-gated
  on `/pt-PT/settings` — with OS emulated `light`, click "Escuro"; reload (or
  open a new page in the same context, OS still emulated `light`) and assert
  `<html>` still has `class="dark"` (proves `localStorage` persistence
  overrides the OS preference). Repeat in reverse (pick "Claro" with OS
  emulated `dark`).
- **AC4** (no FOUC — class set before hydration): automated proxy check —
  with OS emulated `dark` and no persisted preference, listen for the
  `domcontentloaded` event and assert `<html>` already has `class="dark"` at
  that point (i.e., before React hydration/paint settles), proving the class
  is set by `next-themes`' inline pre-hydration script, not by a post-mount
  effect. True "was there a visible flash" is not reliably assertable in
  Playwright — supplement with a **documented manual check**: open the app
  with network throttled (Slow 3G) and OS set to dark, confirm no light flash
  before the themed page appears.
- **AC5** (`dark:` is class-driven, not media-driven): **static build-artifact
  assertion, not a browser/Playwright test.** `browser.newContext({
  javaScriptEnabled: false })` combined with `page.evaluate(...)` does not
  work — Playwright's `javaScriptEnabled: false` disables page-context script
  execution entirely, and `evaluate()`/`locator.evaluate()` execute through
  that same disabled scripting context, so they would fail (or silently no-op)
  rather than prove anything. Replace with: after `npm run build`, grep the
  compiled Tailwind CSS output (`.next/static/css/*.css`, or the equivalent
  build output path — confirm exact path at implementation time since it may
  be nested under a build-id hash) for the generated `dark:`-prefixed utility
  selectors (e.g. the compiled selector for `dark:bg-input/30`) and assert:
  1. the selector text contains `.dark` (i.e. matches the `&:is(.dark *)`
     shape emitted by `@custom-variant dark (&:is(.dark *));`), and
  2. there is **no** bare `@media (prefers-color-scheme: dark)` block gating
     those same utility class names anywhere in the compiled CSS (a regex/
     string search ruling out the pre-fix default media-query behaviour).
  This can be a small Node/shell script invoked as an `e2e`-adjacent check (or
  a Playwright test that reads the file from disk with `fs.readFileSync`
  rather than driving a browser) — it verifies the `@custom-variant dark`
  change directly against the actual compiled CSS, sidestepping the
  browser-based approach entirely. This directly regression-tests the "latent
  inconsistency" called out in the story's Context section.
- **AC6** (toggle label from i18n + 44px tap target): `E2E_WITH_AUTH`-gated —
  assert each toggle button's accessible name resolves to the translated
  string (not a hardcoded literal) and, after `expect(locator).toBeVisible()`
  (boundingBox guard convention), `boundingBox()` height and width are both
  `>= 44`.
- **AC7** (WCAG AA contrast, no regressions): **documented manual
  verification** — no axe-core/contrast tooling exists in this repo yet.
  Capture screenshots of home/login/admin pages plus the new
  `ThemeToggle` control in dark mode and visually confirm text passes AA;
  note that the underlying dark tokens are the stock shadcn values already
  audited in CHORE-01 (unchanged by this story), so residual risk is
  concentrated in the **new** `ThemeToggle` markup only.
  **Implementer reminder (CLAUDE.md DoD #5 audit trail):** performing this
  check is not enough on its own — after actually running the manual contrast
  check, append a "Manual verification" note directly to this story file
  (e.g. under a new subsection near the bottom, or inline under AC7) stating
  what was checked, on which pages/components, and the outcome (pass/fail +
  any follow-up). A plan describing the check is not the same as a record
  that it happened; the record must exist in the story file itself, not only
  in this plan.

### Risks and rollback
- **Risk**: `suppressHydrationWarning` must be on `<html>` only — placing it
  on `<body>` (or omitting it) either hides real bugs elsewhere or leaves a
  spurious console warning on every load.
- **Risk**: `@custom-variant dark` changes the activation mechanism for
  *every* existing `dark:` utility class in the codebase at once
  (`components/ui/button.tsx` today). Re-grep for `dark:` usages at
  implementation time in case new components added `dark:` classes since
  this plan was written, and manually confirm each still looks correct once
  gated behind `.dark`.
- **Risk**: shared-file contention with CHORE-06 on
  `app/[locale]/(app)/settings/page.tsx` and `messages/en.json` — mitigated by
  the fixed delivery order (CHORE-06 lands first, CHORE-11 second in the same
  PR) plus this story adding an independent sibling `<section>` inside
  CHORE-06's existing wrapper div rather than editing CHORE-06's markup. The
  main failure mode to guard against is the implementer working from a stale
  mental model of the settings page (e.g. this plan's own grounding notes,
  written pre-CHORE-06) instead of the actual file contents at implementation
  time — mitigated by the explicit "re-read the file first" instruction in
  step 5 above.
- **Rollback**: fully revertible in one commit — remove the `next-themes`
  dependency, revert `app/globals.css`, `app/[locale]/layout.tsx`, delete
  `components/ThemeToggle.tsx`, and remove its `<section>` from
  `settings/page.tsx`. No DB/migration/API surface is touched.

### Blocking questions
None. The story's own Technical notes are specific enough (library choice,
exact `@custom-variant` snippet, provider config, settings-page placement) to
produce a confident plan without further product input, and the orchestrator
has fixed the CHORE-06-then-CHORE-11 delivery order (see "Delivery context"
above), removing what was previously an open conditional. The one remaining
judgment call made above (toggle shape as a 3-way group) is documented, not
blocking.

## Manual verification notes (post-implementation)

**Environment constraint:** the implementation sandbox is WSL2 without
passwordless root (`sudo` requires an interactive password; `npx playwright
install-deps` fails for this reason — the same documented limitation as
CLAUDE.md's Playwright "WSL2 gotcha"). No Chromium/Firefox/WebKit browser
could be launched locally, so a literal screenshot-based visual spot-check
(as the plan's AC1/AC4/AC7 test-plan entries call for) could not be
performed in this pass. The checks below are the closest available
substitute, performed directly against the compiled build artifacts and the
design-token source of truth; a follow-up human/CI pass with a working
browser should still do the literal screenshot spot-check described in the
plan's AC1 and AC7 test-plan entries.

- **AC7 (WCAG AA contrast)**: computed WCAG relative-luminance contrast
  ratios directly from the `.dark` HSL custom properties in
  `app/globals.css` (unchanged stock shadcn dark tokens, same values audited
  in CHORE-01) for every colour pair actually used by pages in this repo
  plus the new `ThemeToggle` component's `Button` variants:
  - Body text on background (`--foreground` on `--background`): **19.06:1**
  - Primary button text on primary bg (`ThemeToggle`'s selected/`default`
    variant button): **16.97:1**
  - Accent text on accent bg (hover state on outline buttons):
    **14.27:1**
  - Muted-foreground secondary text on background: **7.76:1**
  - Destructive-foreground on destructive bg: **9.60:1**
  - Foreground text on the outline/unselected `ThemeToggle` button's
    `dark:bg-input/30`-tinted background: **14.27:1**
  All six ratios clear WCAG AA's 4.5:1 (normal text) and 3:1 (large
  text/UI component) thresholds by a wide margin — the lowest is 7.76:1.
  Outcome: **pass**. Since these are the pre-existing, unchanged dark
  tokens and the new `ThemeToggle` markup reuses the existing `Button`
  component's `default`/`outline` variants (no new colour combinations
  introduced), residual risk is effectively nil. No follow-up needed, though
  a literal visual screenshot pass is still recommended when a working
  browser is available, per the plan.
- **AC1 (no unreadable text / leftover light surfaces) and AC5 (`dark:` is
  class-driven)**: verified against the actual Turbopack-compiled CSS output
  (`.next/static/chunks/*.css` — note: the plan anticipated
  `.next/static/css/*.css`, but Turbopack emits it under `chunks/`; the
  automated AC5 test in `e2e/dark-mode.spec.ts` globs recursively under
  `.next/static` to be resilient to this). Confirmed `dark:*` utility
  classes (e.g. `dark:bg-input/30`, `dark:border-input`,
  `dark:hover:bg-input/50` from `components/ui/button.tsx`) compile to
  `:is(.dark *)`-gated selectors, and grepped the full compiled output for
  `@media (prefers-color-scheme: dark)` — zero matches gate any `dark:`
  utility class name. This directly confirms the "latent inconsistency"
  described in the story's Context section is fixed: dark styling is now
  100% class-driven, not media-query-driven.
- **AC4 (no FOUC)**: automated coverage confirms `.dark` is present on
  `<html>` at the `domcontentloaded` event (before hydration), which is the
  structural guarantee `next-themes`' pre-hydration inline script provides.
  The subjective "was there a visible flash" check (network-throttled,
  human-observed) could not be performed in this sandbox (no browser
  available) — recommend a human do a quick Slow-3G-throttled load with OS
  dark preference set, per the plan, before or shortly after merge.

## PR #27 review fixes

**CRITICAL — hydration mismatch, not avoidance**: The original
`ThemeToggle.tsx` branched on `theme === undefined` to decide whether to
render the placeholder. Verified against the bundled `next-themes@0.4.6`
source that this does NOT defer to a post-hydration render: on the client
bundle, `useTheme()` synchronously reads `localStorage` and returns a real
theme string on the very first client render (the hydration pass itself), so
SSR renders one branch and hydration renders another — a genuine mismatch.
`suppressHydrationWarning` on `<html>` (app/[locale]/layout.tsx) does not
cover this since it only suppresses the exact node it's applied to, not
descendants.

Fixed with a `mounted` guard, per the plan's original intent (step 4), but
implemented via `useSyncExternalStore` rather than a literal
`useState`+`useEffect(() => setMounted(true), [])` pair: the repo's
`react-hooks/set-state-in-effect` lint rule (part of
`eslint-plugin-react-hooks@7.1.1`'s recommended config, bundled with
`eslint-config-next@16.2.9`) flags any direct `setState` call in a `useEffect`
body as an error, with no exception for the mount-detection idiom. The
`useSyncExternalStore(subscribe, () => true, () => false)` pattern achieves
the identical hydration contract — `getServerSnapshot` (`false`) is used for
both the server render and the client's initial hydration render so they
match, then React performs exactly one client-only re-render with
`getSnapshot` (`true`) right after hydration commits — without any `setState`
call in an effect body, so it satisfies the lint rule while preserving the
same "post-hydration-only" render-order guarantee the plan called for. See
`components/ThemeToggle.tsx` for the implementation and inline rationale.

Also addressed in the same review pass:
- `i18n/routing.ts`: added an inline comment explaining why
  `localeDetection: false` is required (prevents next-intl's Accept-Language
  negotiation from auto-redirecting `/` away from pt-PT).
- `e2e/dark-mode.spec.ts` AC5: replaced the `[^}]*\{[^}]*\}` regex (which only
  captured the first CSS rule inside a `@media (prefers-color-scheme: dark)`
  block) with a brace-balancing extraction function so the full block is
  inspected regardless of how many rules it contains.
- `e2e/dark-mode.spec.ts` AC1: added `/pt-PT/settings` to the path list (the
  only page where `ThemeToggle` renders), so a real hydration-mismatch
  regression is caught by CI instead of only manual inspection.
- `components/ThemeToggle.tsx`: removed the inner `role="group"`'s redundant
  `aria-label` (the enclosing `<section aria-labelledby="theme-section-title">`
  in `settings/page.tsx` already supplies the accessible name; the duplicate
  caused some screen readers to announce "Tema" twice).
- `components/LanguageSwitcher.tsx`: mirrored the same
  `id`/`aria-labelledby` pattern on its `<section>` for consistency with
  `ThemeToggle`'s section.
