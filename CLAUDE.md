@AGENTS.md

# CLAUDE.md

## Definition of Done

A story is done when ALL of the following are true:

1. **Lint clean** — `npm run lint` exits 0 (Next.js ESLint config).
2. **Type-safe** — `npx tsc --noEmit` exits 0.
3. **Build succeeds** — `npm run build` exits 0.
4. **Tests pass** — `npm run test:e2e` exits 0 (smoke + story-specific tests).
5. **AC coverage** — every acceptance criterion has at least one automated test
   or a documented manual verification step in the story file.
6. **No hardcoded UI strings** — all user-facing text comes from
   `messages/pt-PT.json`; no raw Portuguese (or any language) string literals
   in component JSX.
7. **No regressions** — previously passing tests still pass.

## Quality gates (CI enforces these)

- `npm run lint`
- `npm run build`
- `npm run test:e2e` (Playwright smoke suite)

## Retry budget

Implementation agents have **2 fix cycles** after first review before the issue
is escalated to a human.

## Model routing

| Task                           | Model             |
|--------------------------------|-------------------|
| Story refiner                  | claude-sonnet-4-6 |
| Implementer (standard/complex) | claude-sonnet-4-6 |
| Implementer (trivial only)     | claude-haiku      |

## Complexity classification

- **trivial** — mechanical change, single file, no reasoning risk.
- **standard** — multi-file, requires understanding of at least two modules; default.
- **complex** — auth, data integrity, concurrency, security, or three or more interacting systems.

When in doubt, classify as `standard`.

## Stack notes

**Next.js 16 + next-intl versioning:**
- Next.js 16 renamed `middleware.ts` → `proxy.ts`. The file **must** be named `proxy.ts`; `middleware.ts` is deprecated.
- `next-intl@^3` does not peer with Next.js 16; use `next-intl@^4`. The v4 API surface (e.g. `defineRouting`, `createNavigation`, `createMiddleware`, `getRequestConfig`) is identical for our usage.

**Tailwind v4:**
- `create-next-app` with Next.js 16 installs Tailwind v4, which uses `@import "tailwindcss"` instead of the old `@tailwind base/components/utilities` directives. Do not replace with the old syntax.

**Locale layout pattern:**
- `app/layout.tsx` must be a minimal passthrough (no `<html>`/`<body>`); the locale layout `app/[locale]/layout.tsx` owns `<html lang={locale}>`, `<body>`, `NextIntlClientProvider`, and all persistent chrome (header, nav).
- Pages only render their own content; shell belongs in the locale layout.
- Call `getMessages({ locale })` with the validated locale string, not `getMessages()` without arguments.

**Playwright:**
- **WSL2 gotcha**: Chromium headless requires `libnspr4.so` and other system libs that cannot be installed without root. In CI, use `npx playwright install --with-deps chromium`. Locally, developers can use `npx playwright install chromium` and accept that some tests may fail if libs are missing.
- **Config**: Always set `retries: process.env.CI ? 2 : 0` and `workers: process.env.CI ? 1 : undefined` in `playwright.config.ts`.

**ESLint:**
- `"lint": "eslint"` with no path can silently pass in ESLint v9 flat config mode if no files match. Always use `"lint": "eslint ."`.

**CI environment:**
- Add dummy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Build step in CI pipelines now, before Supabase integration lands. `NEXT_PUBLIC_*` vars are inlined at build time and missing them can cause build failures downstream.
