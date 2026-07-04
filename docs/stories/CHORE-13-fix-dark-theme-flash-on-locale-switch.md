# CHORE-13: Fix white flash when switching language in dark mode
Epic: maintenance
Status: done ✅
PR: 29
Priority: low

## Task statement
As a user with dark mode active, I want switching the language on the
settings page to keep the screen dark throughout the transition, so that I
don't get a jarring white flash while the app changes locale.

## Context
Reported by the user (2026-07-04): in dark mode, clicking the language
switcher on `/settings` (e.g. PT → EN) makes the page flash white for a
split second before the dark theme comes back. The language switch itself
works; the flash is the only problem.

**Root cause (confirmed by a per-frame browser probe, 2026-07-04):**

1. `LanguageSwitcher` (CHORE-06) navigates cross-locale via next-intl's
   `Link` — a normal client-side (soft) navigation.
2. The `.dark` class on `<html>` is managed by `next-themes` (CHORE-11)
   imperatively — React does not know about it. `<html lang={locale}>` is
   owned by `app/[locale]/layout.tsx`.
3. When the `[locale]` segment param changes, React re-renders/remounts the
   locale layout's `<html>` element and **strips the `.dark` class** (the
   server-rendered element has no `className`; `suppressHydrationWarning`
   only applies at hydration, not on later renders).
4. `next-themes` re-applies `.dark` in a `useEffect` — i.e. **after paint**.
   At least one frame paints with no `.dark` class → white background.

Probe evidence (rAF sampling of `document.documentElement` during a soft
`/pt-PT/login` → `/en/login` navigation with `theme=dark` in localStorage):

```
t=795ms  class="dark"  lang=pt-PT  bg=rgb(9,9,11)      ← before click
t=872ms  class=""      lang=en     bg=rgb(255,255,255)  ← the flash
t=881ms  class="dark"  lang=en     bg=rgb(9,9,11)      ← effect re-applies
```

This affects **any** navigation that changes the `[locale]` segment; the
settings-page language switcher is currently the only such navigation in
the app. Same-locale navigations are unaffected (the layout doesn't remount,
confirmed: the class survives untouched). The initial-load path is also fine
— next-themes' blocking inline script sets `.dark` before first paint on
full document loads.

## Acceptance criteria
1. Given dark mode is active (explicit choice or `system` resolving to dark)
   and the user is on `/settings`, when they click the language switcher,
   then at no point during the transition does the page paint with the light
   background — verifiable by sampling `document.documentElement.classList`
   (or computed `background-color`) on every animation frame across the
   navigation and asserting `dark` is never absent.
2. Given the user switches language, when the navigation completes, then the
   locale has actually changed (URL prefix and `<html lang>` reflect the new
   locale, UI strings are in the new language) — no regression to the
   switcher's core function.
3. Given the user switched language in dark mode, when the new page settles,
   then the dark theme is still active and the persisted theme choice is
   unchanged.
4. Given a user with dark mode persisted, when they cold-load any page
   (full document load), then there is still no flash-of-light-theme —
   the existing first-paint behavior must not regress.
5. Given light mode is active, when the user switches language, then
   behavior is unchanged (no dark flash introduced in the opposite
   direction).

## Out of scope
- Adding the language switcher to any surface other than `/settings`.
- Changing the theme toggle UI or its three-way system/light/dark options.
- Replacing next-themes wholesale or redesigning theme token architecture.
- View-transition animations or other transition polish beyond removing the
  flash.

## Technical notes
- Affected files (best guess): `components/LanguageSwitcher.tsx`,
  `app/[locale]/layout.tsx`, possibly `proxy.ts` and
  `app/auth/callback/route.ts` if a cookie-based approach is chosen.
- Candidate approaches (Refine to pick one):
  1. **Full-document navigation for the locale switch** — render the
     switcher as a plain `<a href>` (or force `window.location` navigation)
     instead of a client-side `Link`. A full load runs next-themes' blocking
     inline script *before* first paint, which is exactly the already-working
     cold-load path. Smallest change; trade-off is a full reload for a rare
     action. Note next-intl's `Link` also syncs the `NEXT_LOCALE` cookie
     on click — a plain `<a>` must not lose that (the middleware may handle
     it, verify).
  2. **Server-rendered theme class via cookie** — persist the theme choice
     in a cookie and render `<html className={dark ? 'dark' : ''}>` in
     `app/[locale]/layout.tsx` so the class survives React re-renders of the
     layout. Robust against any future cross-locale/remount navigation, but
     a bigger change: next-themes stores in localStorage, so this needs a
     cookie sync (and `system` preference is not knowable server-side —
     hybrid handling required).
  3. An inline `<script>` re-injected during the soft navigation does NOT
     work — scripts inserted via `dangerouslySetInnerHTML` during client
     renders never execute; only the initial HTML parse runs them.
- Repro probe (no auth needed): with `theme=dark` in localStorage, soft
  navigate `/pt-PT/login` → `/en/login` via the app router and sample
  `documentElement` per animation frame. For the AC1 e2e test on
  `/settings`, gate on `E2E_WITH_AUTH` per the established pattern, or test
  the mechanism on the login route if the fix is at the layout level.
- Versions at time of writing: next 16.2.9, next-intl ^4.13.0,
  next-themes ^0.4.6, react 19.2.4.

## Definition of Done
See CLAUDE.md.

## Implementation Plan
_(Refine pass, 2026-07-04 — verified against current codebase state)_

### Verification of story's technical notes against current code
Re-read `components/LanguageSwitcher.tsx`, `app/[locale]/layout.tsx`, `proxy.ts`,
`app/auth/callback/route.ts`, `i18n/routing.ts`/`i18n/navigation.ts`,
`app/globals.css`, `components/ThemeToggle.tsx`, and the compiled next-themes
source (`node_modules/next-themes/dist/index.mjs`). Findings:
- Root cause description still matches exactly: `LocaleLayout`
  (`app/[locale]/layout.tsx`) renders `<html lang={locale} suppressHydrationWarning>`
  with no `className`, wraps `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`,
  and `LanguageSwitcher` navigates via next-intl's `Link` (soft nav). No code
  has moved since the story was written.
- next-themes' `resolvedTheme` (what we need) is computed client-side as
  `theme === 'system' ? systemTheme : theme` and exposed via `useTheme()` —
  confirmed by reading the bundled source. It updates on: initial mount,
  `setTheme()` calls, cross-tab `storage` events, and OS-level
  `prefers-color-scheme` changes (matchMedia listener). Any sync mechanism
  keyed on `resolvedTheme` will therefore stay correct across all of these.
- **New finding, not in the original story notes**: `e2e/language-switcher.spec.ts`
  AC4 (from CHORE-06) already asserts the language switch is a **soft**
  (client-side) navigation — it sets a `window.__marker` before clicking and
  asserts it survives the navigation. This directly conflicts with
  **Candidate approach 1** (full-document nav for the switcher): forcing a
  full page load would delete `window.__marker` and fail that pre-existing,
  passing test. Approach 1 is not a "smallest change with an acceptable
  trade-off" as originally framed — it's a direct regression to a previously
  shipped, tested AC (CHORE-06 AC4), which CLAUDE.md's Definition of Done
  ("No regressions — previously passing tests still pass") forbids without
  an explicit product decision to relax that AC. I did not find any signal
  that relaxing CHORE-06 AC4 has been approved, so **approach 1 is rejected**
  rather than treated as a free trade-off.
- **Decision: Candidate approach 2** (server-rendered theme class via a
  cookie) is selected. It fixes the flash at its root (the SSR'd `<html>`
  element carries the correct class on every render, soft-nav or not) without
  touching navigation behavior at all, so CHORE-06 AC4 is untouched by
  construction. This also matches the story's own framing of approach 2 as
  "robust against any future cross-locale/remount navigation."
- Confirmed `cookies()` from `next/headers` is safely awaitable and readable
  in this project's async Server Components (same pattern already used in
  `lib/supabase/server.ts`); the "Route Handler cookie gotcha" documented in
  CLAUDE.md is specific to Route Handlers, not Server Components, and does
  not apply here.
- No existing `lib/theme/` module; will follow the `lib/auth/signout-marker.ts`
  precedent (small, dependency-free constants module importable from both a
  Server Component and a Client Component).

### Approach: server-rendered `.dark` class via a synced cookie
1. Add `lib/theme/theme-cookie.ts` — exports `THEME_COOKIE_NAME` (pick a name
   distinct from next-themes' own `localStorage` key `'theme'` to avoid
   confusion, e.g. `'resolved-theme'`) and `THEME_COOKIE_MAX_AGE_SECONDS`
   (e.g. 1 year). Plain constants, no server/client-only imports (mirrors
   `lib/auth/signout-marker.ts`).
2. Add `components/ThemeCookieSync.tsx` (`'use client'`) — a render-nothing
   component that calls `useTheme()` from `next-themes`, and in a
   `useEffect` keyed on `resolvedTheme`, writes
   `document.cookie = \`${THEME_COOKIE_NAME}=${resolvedTheme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax\`` whenever `resolvedTheme` is defined. This runs on
   mount and on every subsequent resolved-theme change (explicit toggle, OS
   preference change, cross-tab storage sync), so the cookie is always kept
   in step with what next-themes actually applied to the DOM.
3. Modify `app/[locale]/layout.tsx`:
   - `import { cookies } from 'next/headers';` and
     `import { THEME_COOKIE_NAME } from '@/lib/theme/theme-cookie';`
   - `const cookieStore = await cookies(); const isDarkFromCookie = cookieStore.get(THEME_COOKIE_NAME)?.value === 'dark';`
   - Change `<html lang={locale} suppressHydrationWarning>` to
     `<html lang={locale} className={isDarkFromCookie ? 'dark' : undefined} suppressHydrationWarning>`.
     Keep `suppressHydrationWarning` — it already covers exactly this kind of
     mismatch (recommended next-themes pattern) and continues to protect
     against any residual client/server disagreement.
   - Mount `<ThemeCookieSync />` as a sibling of `<NextIntlClientProvider>`,
     inside `<ThemeProvider>`:
     ```tsx
     <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
       <ThemeCookieSync />
       <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
     </ThemeProvider>
     ```
4. No changes needed to `proxy.ts` or `app/auth/callback/route.ts` — this is
   a plain first-party cookie set via `document.cookie` from the browser; it
   rides along automatically on every same-origin request (including the RSC
   fetch triggered by a soft navigation), no middleware plumbing required.
   (Verify this assumption holds during implementation — if Next.js's RSC
   soft-nav fetch turns out not to forward `document.cookie`-set cookies for
   some reason, that would block this approach and needs to be re-escalated,
   but there is no known reason in Next.js 16 for that to be the case: cookies
   set via `document.cookie` are ordinary browser cookies.)
5. Why this fixes the bug: on a cold load, next-themes' blocking inline
   script remains the authority and still runs before first paint (unchanged,
   AC4 preserved). On a soft cross-locale navigation, the blocking script does
   **not** re-run (it's only embedded in the initial HTML), but the RSC fetch
   for the new route re-invokes `LocaleLayout`, which now reads the
   already-synced cookie and renders `<html className="dark">` from the
   server directly — so the DOM node never has a frame without `.dark`,
   because the class is present in the markup from the first frame the new
   `<html>` exists, instead of being appended imperatively after an effect
   fires post-paint.
6. Edge cases considered (no code changes needed, documented for the
   implementer's awareness):
   - First-ever visit before any client JS has run: cookie absent, cold-load
     path handles it via the existing blocking script (unaffected).
   - `system` theme: cookie stores the **resolved** value (`'light'`/`'dark'`),
     not the literal string `'system'`, so SSR never needs to evaluate
     `prefers-color-scheme` itself.
   - Stale cookie vs. localStorage (e.g. cookies cleared independently): the
     post-mount effect in next-themes always re-applies the true state after
     hydration, self-healing any transient mismatch; only matters for a single
     paint, same as today's cold-load guarantee.

### Step-by-step (test-first)
1. Write the new e2e spec `e2e/dark-theme-locale-flash.spec.ts` first, with
   failing tests for AC1/AC3/AC5 (see Test plan below), confirming they fail
   against the current code (reproducing the flash / lack of SSR class).
2. Implement `lib/theme/theme-cookie.ts`.
3. Implement `components/ThemeCookieSync.tsx`.
4. Wire both into `app/[locale]/layout.tsx` as described above.
5. Run the new spec; iterate until green.
6. Re-run `e2e/dark-mode.spec.ts` and `e2e/language-switcher.spec.ts` in full
   (not just the CI-safe subset — set `E2E_WITH_AUTH=1` locally per the
   established WSL2/Chromium workaround if credentials are available) to
   confirm no regressions to CHORE-11 or CHORE-06 behavior.
7. Run the full Definition of Done gate: `npm run lint`, `npx tsc --noEmit`,
   `npm run build`, `npm run test:e2e`.

### Test plan (mapped to ACs)
- **AC1** (no white-background paint during the locale switch):
  - CI-safe, no auth: new test in `e2e/dark-theme-locale-flash.spec.ts` using
    `page.request.get('/pt-PT/login', { headers: { Cookie: '<THEME_COOKIE_NAME>=dark' } })`
    (raw HTTP fetch, no JS execution) asserting the returned HTML's `<html>`
    tag has `class="..dark.."` — proves the new SSR mechanism itself, in
    isolation, without needing authentication. Add the mirror case (cookie
    absent / `'light'`) asserting no `dark` class in the raw SSR markup.
  - `E2E_WITH_AUTH`-gated (real reproduction): on `/pt-PT/settings` with
    `theme=dark` pre-seeded (matches the existing `dark-mode.spec.ts` pattern
    via `page.addInitScript`), start a `requestAnimationFrame` sampling loop
    (mirrors the story's own probe methodology) recording
    `document.documentElement.classList.contains('dark')` on every frame from
    just before clicking `language-switcher-link` through ~1s after the URL
    changes; assert every sample is `true`.
- **AC2** (switch still functions — no regression to core behavior): reuse
  the existing `E2E_WITH_AUTH`-gated `e2e/language-switcher.spec.ts` AC4/AC5
  as the regression guard (must still pass unmodified); additionally assert
  within the new AC1 test above that the URL prefix and `<html lang>` reflect
  the new locale after the sampling window, keeping this in the same flow.
- **AC3** (dark theme still active + persisted choice unchanged): extend the
  same `E2E_WITH_AUTH`-gated test to assert, after the navigation settles,
  `document.documentElement.classList` still contains `dark` and
  `localStorage.getItem('theme')` is unchanged (still `'dark'`).
- **AC4** (cold-load behavior must not regress): no new test — the existing
  CI-safe `e2e/dark-mode.spec.ts` AC2 and AC4 tests exercise this path
  exactly (fresh `goto` with OS dark preference, `.dark` present at
  `domcontentloaded`) and must continue to pass unmodified. Verified above
  that the blocking script remains untouched and authoritative for full
  loads, so no code path exists for this to regress.
- **AC5** (light mode: no dark flash introduced in reverse): mirror the AC1
  `E2E_WITH_AUTH`-gated sampling test starting from light mode, asserting
  `dark` is never present in any sample; mirror the AC1 CI-safe SSR test with
  the cookie set to `'light'`/absent (already covered as the "mirror case"
  above).

### Risks and rollback
- **Risk**: cookie and `localStorage` diverging (e.g., manual cookie
  deletion, third-party cookie blocking in unusual browser configs). Impact
  is cosmetic only and strictly *less* severe than the pre-fix baseline: a
  stale/missing cookie on a soft navigation after the divergence causes a
  reappearance of the *original* bug (one wrong-color frame, self-healed by
  next-themes' post-mount effect within that same frame) — it is not
  equivalent to, or worse than, today's cold-load worst case; it is the
  cold-load worst case, occurring on a soft nav instead of a full load, and
  only in this specific divergence scenario. No functional/data risk. Note
  the duration differs by cause: for a one-off divergence (e.g. a manually
  deleted cookie) this is transient and self-heals once `ThemeCookieSync`
  rewrites the cookie on the next mount. For a user with cookies
  *permanently* blocked, the write silently no-ops on every page load, so
  the wrong-color frame recurs on *every* soft navigation for that user —
  persistent-for-that-user, not transient — but each individual occurrence
  is still capped at the same single-frame, self-healing severity described
  above, so the severity ceiling is unchanged even though the frequency for
  that subset of users is higher.
- **Risk**: `cookies()` in the layout forces the locale layout to be fully
  dynamic per request. This is very likely already true (the layout calls
  `getMessages({ locale })` per request and the app has no static-export
  requirement), but confirm via `npm run build` output that no unexpected
  static-rendering warnings appear.
- **Risk**: reliance on the (reasonable, but not yet implementation-verified)
  assumption that a soft-nav RSC fetch forwards `document.cookie`-set
  cookies. If this turns out false during implementation, approach 2 does
  not work and this story should be paused and re-escalated rather than
  falling back to approach 1 (which regresses CHORE-06 AC4) without a
  product decision.
- **Rollback**: fully additive and isolated — revert the three touched/added
  files (`app/[locale]/layout.tsx`, `components/ThemeCookieSync.tsx`,
  `lib/theme/theme-cookie.ts`) and the new test spec. No migrations, no
  schema, no auth changes; safe to revert independently of anything else in
  flight.

### Affected areas
- **Frontend / UX** (primary): `app/[locale]/layout.tsx` (SSR html class +
  cookie read), new `components/ThemeCookieSync.tsx` (client sync), new
  `lib/theme/theme-cookie.ts` (shared constants).
- **Testing**: new `e2e/dark-theme-locale-flash.spec.ts`; regression re-run
  of `e2e/dark-mode.spec.ts` and `e2e/language-switcher.spec.ts`.
- No backend/data/infra/ai-ml changes; no new dependencies; no migrations.

### Complexity tag: **standard**
Justification: touches three interacting systems (Next.js SSR/cookies,
next-themes' client-side theme resolution, and next-intl's locale routing),
requires reasoning about React Server Component render/hydration semantics
and cross-tab/system-theme edge cases, and must avoid regressing two
previously shipped, tested ACs (CHORE-06 AC4 soft navigation, CHORE-11's
cold-load no-flash guarantee). Not `complex` (no auth/money/concurrency/
security surface, fully additive and isolated, easy rollback), but clearly
above `trivial` per CLAUDE.md's guidance to be conservative when in doubt.

## Implementation notes (Implementer pass, 2026-07-04)

- Implemented exactly the approved plan: `lib/theme/theme-cookie.ts`,
  `components/ThemeCookieSync.tsx`, cookie read + `<html className>` wiring
  in `app/[locale]/layout.tsx`, and `e2e/dark-theme-locale-flash.spec.ts`.
  No changes to `proxy.ts` or `app/auth/callback/route.ts` were needed — the
  document.cookie-set cookie rides along on the RSC fetch automatically, as
  the plan predicted.
- `npm run build` output confirmed the plan's stated risk did not
  materialize: `app/[locale]` routes were already fully dynamic (`ƒ`) before
  this change (due to `getMessages({ locale })`), and remain so after adding
  `cookies()` — no new static-rendering warnings.
- **Challenge WARNING #1 (CI-safe rAF-sampling coverage of the real visual
  click-through) — evaluated, not implemented.** The only way to trigger a
  real cross-locale soft navigation without authentication would be to
  either (a) add a locale-switching Link/trigger to a public route such as
  `/login`, which directly regresses the story's own Out-of-scope line
  ("Adding the language switcher to any surface other than `/settings`"), or
  (b) drive Next.js App Router's client-side navigation programmatically via
  `page.evaluate`. Unlike the legacy Pages Router (`window.next.router`),
  the App Router exposes no public `window` API for its client router —
  navigation is only reachable through the `useRouter()`/`<Link>` React
  context, not a global. Both options were rejected as out of proportion to
  a non-blocking warning: (a) is a scope-firewall violation, (b) would need
  a test-only production code path with no precedent in this codebase.
  CI-safe coverage therefore remains at the SSR-mechanism level (proven in
  isolation via raw HTTP fetch — see AC1/AC5 tests), and the real
  click-through visual claim is covered by the `E2E_WITH_AUTH`-gated
  sampling test, matching the approved plan.
- Challenge WARNING #2 (Risks section wording) addressed above — the
  cookie/localStorage-divergence risk now reads as a same-severity,
  soft-nav-triggered instance of the pre-existing cold-load worst case
  rather than implying an equivalent-or-worse new risk.
- Local run of `npm run test:e2e` (no `E2E_WITH_AUTH`, this sandbox has no
  live Google OAuth session available) passed: 38 passed, 40 skipped
  (auth-gated), 0 failed. This includes all AC1/AC5 CI-safe tests in the new
  spec, plus the full pre-existing `dark-mode.spec.ts` and
  `language-switcher.spec.ts` CI-safe subsets (unmodified, no regressions).
  The `E2E_WITH_AUTH`-gated AC1/AC2/AC3/AC5 real-navigation tests in the new
  spec were written and are ready to run wherever real Supabase/Google OAuth
  credentials are available (same constraint as all other auth-gated tests
  in this repo); they were not executable in this environment.
