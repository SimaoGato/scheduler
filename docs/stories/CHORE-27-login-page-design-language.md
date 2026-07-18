# CHORE-27: Roll out design language on the login page
Epic: maintenance
Priority: standard — visual-only, part of the pre-EPIC-04 UI push
Status: draft
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: updated mockup in `App design refinement/Escala Dashboard.dc.html`
(login screen, `loginWrapStyle`/`loginCardStyle` block), STORY-10 (login
page minimal shell)

## Task
As any user landing on the login page, I want it to reflect the approved
"Escala" design language (dark navy backdrop, wordmark card with the brand
offset-shadow, mono tagline), so the first screen anyone sees matches the
redesigned app instead of the old neutral shell.

## Context
The updated mockup's login screen shows: a full-viewport dark navy backdrop
(the mockup's `t.header` color), a centered white/dark card with a flat
brand offset shadow (`box-shadow: 0 6px 0 0 <brand>` — same treatment
CHORE-25 used for the Dashboard hero card), the "ESCALA" wordmark in the
display font, a monospace tagline, and a pill-shaped brand CTA.

The mockup renders email/password fields, but that is mockup artifice — this
app authenticates exclusively via Google OAuth (PRD #18, STORY-02). The
real page keeps only the existing `GoogleSignInButton` as its CTA. Do not
add email/password inputs.

The current page (`app/[locale]/login/page.tsx`) is a plain `bg-card`
rounded box on the default page background, with no brand color anywhere.

## Acceptance criteria
1. Given the login route, when rendered, then the page backdrop uses the
   dark header/navy surface (in both light and dark theme, per the mockup's
   navy-backdrop-in-both-themes choice) and the centered card carries the
   brand offset-shadow treatment consistent with CHORE-25's hero card.
2. Given the card, when rendered, then the app name renders as a wordmark
   in the display font and the tagline renders in the mono font, both
   sourced from existing i18n keys (`App.name`, `App.tagline`) — no new
   hardcoded strings.
3. Given the Google sign-in CTA, when rendered, then it keeps its existing
   `data-testid="google-signin-button"`, pill shape (CHORE-24), ≥44px tap
   target, and all existing behavior — no changes to the OAuth flow or
   error-message handling (`auth-error` testid preserved).
4. Given light and dark theme, when the page renders, then all
   text/background pairs (including the error banner on the new backdrop)
   meet WCAG AA 4.5:1, measured with the established HSL→luminance→ratio
   method — no eyeballed colors; reuse existing verified tokens where
   possible.
5. Given a 375px viewport, when rendered, then no horizontal overflow
   (`document.documentElement.scrollWidth` ≤ viewport) — the existing
   smoke-spec check for `/pt-PT/login` must keep passing.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0. Existing login-page e2e assertions
   (`design-system.spec.ts`, `button-pill-shape.spec.ts`,
   `smoke.spec.ts`) pass, updated only where they assert the old visual
   treatment (call any such update out in the PR).

## Out of scope
- Email/password authentication or any auth-flow change — Google OAuth only.
- The `/claim` page — separate surface; file a follow-up if it should get
  the same backdrop treatment.
- Header/nav chrome — CHORE-28/CHORE-22.

## Technical notes
- Primary files: `app/[locale]/login/page.tsx`, possibly
  `app/[locale]/login/layout.tsx` (or wherever the login route group's
  backdrop is set — login sits outside `(app)/` per ADR-009).
- The navy backdrop color should come from a token. The mockup uses its
  header color (`oklch(0.22 0.035 250)` light / `oklch(0.20 0.03 250)`
  dark). If CHORE-28 (header recolor) lands first, reuse its token; if this
  lands first, introduce the token here with contrast verification and let
  CHORE-28 consume it — whichever lands second must not duplicate the
  value. Coordinate per CLAUDE.md's multi-story shared-file guidance.
- The brand offset-shadow treatment already exists from CHORE-25's hero
  card — check for a reusable class/pattern before re-implementing.
- Visually render (dev server) both themes at 375px and 1280px before
  marking done.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Pre-flight findings (verified against current code, not the mockup alone)

- **CHORE-28 has already landed** (confirmed via `git log`: CHORE-28 merged
  before CHORE-22, both `done`). `app/globals.css` already defines
  `--header` / `--header-foreground` / `--header-muted` / `--header-border`
  in both `:root` and `.dark`, wired into `@theme inline`
  (`--color-header*`), and verified in
  `e2e/header-surface-tokens.spec.ts`. **Per the story's own branch logic:
  this story reuses CHORE-28's token — no new CSS token is introduced.**
  Critically, `--header` is *already dark navy in both themes*
  (`210 52% 11%` light / `210 52% 9%` dark — CHORE-28 deliberately made the
  header chrome always-dark regardless of app theme). Applying `bg-header`
  to the login backdrop mechanically satisfies AC1's "navy backdrop in both
  light and dark theme" — no conditional/dark: variant classes needed.
- **CHORE-25's offset-shadow pattern**: `app/[locale]/(app)/page.tsx` line
  346, on the admin hero stat card:
  `className="rounded-lg bg-brand p-5 text-brand-foreground shadow-[0_4px_0_0_hsl(var(--brand)/55%)]"`.
  This is the reusable technique: a flat, zero-blur offset shadow built from
  `hsl(var(--brand)/<alpha>%)`. Reuse the same construct on the login card,
  changed only in offset distance (mockup specifies `0 6px 0 0` for the
  login card vs. `0 4px 0 0` for the hero stat — two different mockup
  components, both already pinned to explicit px values) → 
  `shadow-[0_6px_0_0_hsl(var(--brand)/55%)]`. Do not introduce the mockup's
  separate `accentHover` value (a hand-picked darker shade) as a new token —
  reusing the already-verified `--brand` at the same 55% alpha CHORE-25
  established keeps this a zero-new-token change.
- **Login route structure**: `app/[locale]/login/layout.tsx` is the
  route-group-local backdrop (`flex min-h-screen ... bg-muted/50 px-4`,
  `data-testid="login-centering-root"`); `app/[locale]/login/page.tsx` is
  the card (`<main className="w-full max-w-sm rounded-xl border bg-card p-8
  shadow-sm">`). Per ADR-009 the login route sits outside `(app)/` and does
  not get `AppHeader`/`BottomNav` — confirmed, nothing to change there
  (header/nav chrome is explicitly out of scope for this story).
- **i18n keys already exist and are correct**: `App.name` = "Escala" /
  "Escala" (pt-PT/en), `App.tagline` = "Gestão de escalas para equipas de
  serviço" / "Schedule management for service teams". No new keys needed —
  AC2 is satisfied by adding font/case utility classes to the existing
  `tApp('name')` / `tApp('tagline')` renders, not new strings.
- **GoogleSignInButton.tsx**: already has `data-testid="google-signin-button"`,
  pill shape (via shared `buttonVariants`, CHORE-24), `min-h-[44px]`. Its
  OAuth call and error-state logic are untouched by this story (AC3). It
  also renders its own **separate** inline error paragraph
  (`<p role="alert" className="mt-3 text-sm text-destructive">`) for
  client-side `signInWithOAuth` failures — distinct from `page.tsx`'s
  server-rendered `data-testid="auth-error"` banner (URL-param-driven). Both
  render inside the same login page and both are in scope for AC4's
  contrast check (see Finding below).
- **Pre-existing WCAG contrast bug found in the error paths, confirmed by
  direct HSL→luminance→ratio computation using the existing tokens (not
  eyeballed)**:
  - `page.tsx`'s `auth-error` banner uses `bg-destructive/10 text-destructive`
    (translucent tint). Computed: **4.14:1 light (fails AA), 1.93:1 dark
    (fails badly)** — this is the exact combo CLAUDE.md's CHORE-19 note
    already documents as failing, and it is currently shipped, unfixed, on
    the login page.
  - `GoogleSignInButton.tsx`'s inline alert uses plain `text-destructive` on
    `bg-card` (no tint box). Computed: **4.83:1 light (passes, thin margin),
    1.99:1 dark (fails badly)**.
  - AC4 explicitly says "all text/background pairs (including the error
    banner...) meet WCAG AA... no eyeballed colors" — this is a page-wide
    requirement, not scoped to only the backdrop-adjacent elements, so both
    of the above pre-existing failures are in scope to fix here (this is the
    literal text of AC4, not scope creep — flagging per CLAUDE.md's Scope
    enforcement lesson so Challenge can independently confirm this reading).
  - **Fix**: apply the already-established solid-fill remediation pattern
    (CHORE-19 / `AvailabilityToggleList.tsx`: `bg-destructive
    text-destructive-foreground`, no `/10` tint, no separate border) to
    both. Computed: **4.62:1 light / 9.59:1 dark** (already verified
    generically as a token pair by
    `e2e/availability-destructive-contrast.spec.ts`'s
    `--destructive-foreground` on solid `--destructive` test — that test
    covers the token math; this story adds a source-level regression guard
    that these two specific call sites actually use the solid classes).
- **Dark-theme card/backdrop separation checked and accepted**: computed
  `--card` (dark) vs `--header` (dark) ≈ **1.10:1** (both are near-black —
  shadcn's default dark `--card` equals dark `--background`). Neither the
  default `--border` (1.22:1) nor `--header-border` (1.69:1) clears 3:1
  against `--header` in dark theme either. This means the card will have
  very little fill/border separation from the backdrop in dark mode.
  However, `--brand` vs `--header` computes to **7.45:1 dark / 7.09:1
  light** — strong contrast — so the new offset-shadow itself (not the
  border) is what visually demarcates the card against the navy backdrop in
  both themes, matching the mockup's own design intent (the flat shadow is
  the primary boundary device). No component contrast fix is required for
  this; call it out explicitly in manual verification (visually confirm the
  card reads as a distinct surface in dark theme at both viewports) since it
  is a real but accepted design characteristic, not a bug.

### Design decisions (transparent, flagged for Challenge to independently verify against ACs — not self-authorizing)

1. Reuse `--header` (not a new token) for the backdrop — justified above by
   CHORE-28 already landing with a token that is dark-navy in both themes.
2. Reuse `--brand` at 55% alpha (CHORE-25's exact construct) for the shadow
   color instead of a new "accentHover" token, at a 6px offset per the
   mockup's login-specific value (vs. CHORE-25's 4px on the hero stat).
3. Render the wordmark uppercase with wider tracking
   (`uppercase tracking-wide`, replacing `tracking-tight`) to match the
   mockup's "ESCALA" logotype look, entirely via CSS `text-transform` — the
   underlying i18n string and DOM text content stay `"Escala"`, so
   `smoke.spec.ts`'s `toContainText('Escala')` is unaffected.
4. Fix the two pre-existing WCAG-failing error-message color combos on this
   page (`auth-error` banner and `GoogleSignInButton`'s inline alert) as
   part of AC4, reusing the CHORE-19 solid-fill pattern. This is a
   behavior-neutral class-only change (no OAuth flow/logic edits), so it
   does not conflict with AC3's "no changes to... error-message handling."

### Files to touch

1. `app/[locale]/login/layout.tsx` — change backdrop wrapper from
   `bg-muted/50` to `bg-header`. Keep `flex min-h-screen flex-col
   items-center justify-center px-4` and the `login-centering-root` testid
   unchanged.
2. `app/[locale]/login/page.tsx`:
   - Card (`<main>`): replace `shadow-sm` with
     `shadow-[0_6px_0_0_hsl(var(--brand)/55%)]`; keep `rounded-xl border
     bg-card p-8` unchanged.
   - Wordmark `<h1>`: change `text-3xl font-bold tracking-tight` to
     `text-3xl font-bold uppercase tracking-wide`. Keep
     `data-testid="login-app-name"` and `{tApp('name')}` unchanged.
   - Tagline `<p>`: add `font-mono` to the existing `mt-1.5 text-sm
     text-muted-foreground` classes.
   - `auth-error` banner: change classes from `border border-destructive
     bg-destructive/10 text-destructive` to `bg-destructive
     text-destructive-foreground` (drop the border — solid fill doesn't
     need it, matching `AvailabilityToggleList.tsx`'s precedent). Keep
     `data-testid="auth-error"`, `aria-live="polite"`, and all text-content
     logic unchanged.
3. `app/[locale]/login/GoogleSignInButton.tsx` — change the inline alert
   `<p>` classes from `mt-3 text-sm text-destructive` to `mt-3 rounded-md
   bg-destructive px-3 py-2 text-sm text-destructive-foreground`. Keep
   `role="alert"` and all logic unchanged.
4. New e2e spec: `e2e/login-design-language.spec.ts` (CI-safe, no auth
   required — login page is reachable unauthenticated):
   - Static-source checks: `login/layout.tsx` uses `bg-header` (not
     `bg-muted`); `login/page.tsx`'s card className matches
     `/shadow-\[0_6px_0_0_hsl\(var\(--brand\)\/55%\)\]/`; `auth-error`
     banner and `GoogleSignInButton`'s alert both use `bg-destructive` +
     `text-destructive-foreground` (regression guard against the
     translucent-tint combo silently coming back).
   - Live-DOM checks (no auth): navigate to `/pt-PT/login`; assert
     `getComputedStyle` of `login-centering-root` has a background-color
     matching `--header`'s light-theme HSL (converted to rgb) by default;
     use `page.emulateMedia({ colorScheme: 'dark' })` **before** `goto` (the
     app's `defaultTheme: 'system'` + `enableSystem` picks this up) and
     re-assert against `--header`'s dark-theme HSL.
   - Live-DOM: assert the card's `getComputedStyle(...).boxShadow` is not
     `'none'` and its vertical offset is `6px` (parse the computed
     `boxShadow` string, do not hardcode the full rgba string — Chromium
     renders computed shadow color as `rgb(...)`/`rgba(...)`, not the
     original hsl()).
   - Reuse (do not duplicate) `e2e/availability-destructive-contrast.spec.ts`'s
     existing generic `--destructive-foreground` on solid `--destructive`
     token-pair test — it already proves the math for both themes.

### Test plan (AC → test)

| AC | Test |
|----|------|
| AC1 (navy backdrop both themes, brand shadow) | New spec: static class checks + live-DOM background-color assertion (light + dark via `emulateMedia`) + boxShadow presence/offset assertion. |
| AC2 (wordmark display font, tagline mono font, i18n-sourced) | New spec: static class check for `uppercase`/`tracking-wide` on the `login-app-name` element and `font-mono` on the tagline; existing `smoke.spec.ts`'s `toContainText('Escala')` keeps passing (proves no new hardcoded string). |
| AC3 (CTA testid/pill/tap-target/behavior unchanged) | Existing `e2e/button-pill-shape.spec.ts` live check (radius/height) and `e2e/design-system.spec.ts` (button role/name) re-run unmodified — must still pass with zero edits, proving no behavioral regression. |
| AC4 (WCAG AA on all text/background pairs incl. error banners, both themes) | New spec's static regression guard (solid-fill classes present) + reuse of `availability-destructive-contrast.spec.ts`'s token-pair math test + `header-surface-tokens.spec.ts`'s existing `--header-foreground`/`--header` test (unchanged, still relevant since no new text sits directly on the backdrop). Manual: visually confirm in both themes at 375px/1280px that the card reads as a distinct surface (documented dark-theme low-fill-contrast finding above). |
| AC5 (no horizontal overflow at 375px) | Existing `smoke.spec.ts` "login shell: no horizontal overflow at mobile width (375 px)" re-run unmodified — must still pass. |
| AC6 (lint/tsc/build/test:e2e all green; existing specs pass, updates called out) | CI gates + this plan's explicit call-out of which specs change (none of the three named specs — `design-system.spec.ts`, `button-pill-shape.spec.ts`, `smoke.spec.ts` — need edits; only a new spec file is added, per the finding above that none of their assertions touch the classes being changed). |

### Manual verification (dev server, both themes, 375px + 1280px)

- Visually confirm the navy backdrop, offset-shadow card, uppercase
  wordmark, and mono tagline match the mockup's login screen in both light
  and dark theme.
- Visually confirm the card is legibly distinct from the backdrop in dark
  theme despite the low fill/border contrast finding above (shadow-driven
  separation).
- Trigger both error states (`?error=access_denied` query param for the
  server banner; temporarily force `signInWithOAuth` to reject, or inspect
  in devtools, for the client alert) and confirm both read clearly in both
  themes.

### Risks / rollback

- Risk: uppercase-via-CSS wordmark could look off for some future locale
  with different casing conventions — low risk (pt-PT/en only today), easy
  to revert to `tracking-tight` non-uppercase in a follow-up if a future
  locale complains.
- Risk: fixing the two pre-existing destructive-contrast bugs touches a
  component (`GoogleSignInButton.tsx`) that error-handles the OAuth flow —
  mitigated by touching only `className` strings, zero logic/behavior
  changes, and re-running `design-system.spec.ts` unmodified to prove no
  regression.
- Rollback: all changes are className-level edits to 3 files plus one new
  additive test file — revertible with a single `git revert` with no data
  or migration implications.

### Complexity tag: **standard**

Multi-file (route layout, page, a shared client component used by the auth
flow, new test spec), requires cross-referencing two prior stories'
established patterns (CHORE-25's shadow construct, CHORE-28's header token)
correctly rather than reinventing them, and requires genuine WCAG contrast
reasoning/computation (not just copy/config) to identify and fix two
pre-existing accessibility bugs uncovered during refinement. Per CLAUDE.md's
reasoning-risk signals, contrast-verification work on shared color tokens
warrants at least `standard` even though no new CSS custom property is being
introduced this time — the story is not touching `globals.css` at all, but
it is making a live-usage decision about where two already-global tokens
(`--header`, `--destructive`) get applied, on an unauthenticated,
security-adjacent page (login).
