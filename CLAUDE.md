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

**shadcn/ui + Tailwind v4 integration:**
- `components.json` must have `"tailwind": { "config": "" }` (empty string, not a file path). The CLI auto-detects Tailwind v4 from `postcss.config.mjs`. If detection fails, create `components.json` manually.
- `npx shadcn@latest init` and `npx shadcn@latest add` may be blocked in sandboxed environments. In that case, create `components.json`, `lib/utils.ts`, and component files manually — the CLI output is deterministic and identical.
- Tailwind v4 CSS token layer: shadcn injects two `@layer base` blocks (custom properties in `:root` and property defaults on `*`/`body`) plus an `@theme inline` block mapping CSS variables to Tailwind utilities. Multiple `@layer base` declarations in one file are valid and merge correctly. The `@import "tailwindcss"` line must remain first.
- `components/ui/button.tsx` must have `'use client'` as its first line. It uses `React.forwardRef` and Radix `Slot`, both requiring the client runtime. Importing into server components is valid — Next.js treats the Button as a client boundary automatically.

**Locale layout pattern:**
- `app/layout.tsx` must be a minimal passthrough (no `<html>`/`<body>`); the locale layout `app/[locale]/layout.tsx` owns `<html lang={locale}>`, `<body>`, `NextIntlClientProvider`, and all persistent chrome (header, nav).
- **Global CSS must be imported in `app/layout.tsx`** — add `import './globals.css'` there. The locale layout does not import it. Without this, Tailwind generates no CSS and the app is completely unstyled in production.
- Pages only render their own content; shell belongs in the locale layout.
- Call `getMessages({ locale })` with the validated locale string, not `getMessages()` without arguments.

**Playwright:**
- **WSL2 gotcha**: Chromium headless requires `libnspr4.so` and other system libs that cannot be installed without root. In CI, use `npx playwright install --with-deps chromium`. Locally, developers can use `npx playwright install chromium` and accept that some tests may fail if libs are missing.
- **Config**: Always set `retries: process.env.CI ? 2 : 0` and `workers: process.env.CI ? 1 : undefined` in `playwright.config.ts`.
- **boundingBox() guard**: Always call `await expect(locator).toBeVisible()` before `boundingBox()`. The `boundingBox()` method is not auto-retried; calling it without a visibility wait produces confusing null failures on slow CI runners.
- **Tap targets (WCAG 44px minimum)**: Use `min-h-[44px]` (not `h-11`) for interactive elements. `h-11` (2.75rem) computes to exactly 44px only at the browser's default 16px/rem. `min-h-[44px]` is a hard pixel floor that holds regardless of font scale and makes tests flake-proof.
- **Multi-reporter pattern**: Set `reporter: [['html'], ['list']]` in `playwright.config.ts`. The `html` reporter generates the detailed report with screenshots; `list` preserves console output in CI logs for quick debugging. Use this pattern, not `[['html']]` alone.
- **Artifact uploads — `if-no-files-found: error`**: For deterministic output directories (e.g. `playwright-report/` from html reporter, `test-results/` from `screenshot: 'on'`), set `if-no-files-found: error` in `actions/upload-artifact@v4`. This creates a real CI gate and prevents silent failures. Reserve `warn` for optional/conditional outputs.
- **`if: always()` placement in CI**: In GitHub Actions, place `if: always()` at the step level (same indent as `uses:`), not at the job level. Correct placement ensures artifacts upload even when earlier steps fail.

**ESLint:**
- `"lint": "eslint"` with no path can silently pass in ESLint v9 flat config mode if no files match. Always use `"lint": "eslint ."`.

**CI environment:**
- Add dummy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Build step in CI pipelines now, before Supabase integration lands. `NEXT_PUBLIC_*` vars are inlined at build time and missing them can cause build failures downstream.
