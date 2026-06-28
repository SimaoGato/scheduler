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
- **`__next-route-announcer__` strict-mode collision**: Next.js App Router always injects `<div role="alert" aria-live="assertive" id="__next-route-announcer__">` into every page for screen-reader route announcements. Any test using `page.locator('[role="alert"]')` will match this element AND any application error divs, triggering Playwright's strict-mode violation when there are 2+ matches. Fix: add `data-testid="auth-error"` (or equivalent) to application alert elements and use `[data-testid="auth-error"]` in tests instead of the generic `[role="alert"]` selector.

**ESLint:**
- `"lint": "eslint"` with no path can silently pass in ESLint v9 flat config mode if no files match. Always use `"lint": "eslint ."`.

**CI environment:**
- Add dummy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Build step in CI pipelines now, before Supabase integration lands. `NEXT_PUBLIC_*` vars are inlined at build time and missing them can cause build failures downstream.
- `NEXT_PUBLIC_*` vars must also be present at **runtime** in the Smoke test step (`npm run test:e2e`), not just build time. Set them in the Smoke test step's `env:` block with placeholder values (same as Build step).
- When documenting dev/prod credential separation in `.env.example`, use **bi-directional warnings**: explicitly warn against pasting prod keys into `.env.local` AND against pasting dev keys into Vercel. Reference the full story/doc file path (e.g., `docs/stories/CHORE-03-...md`) for setup procedures, not just ticket IDs.

**Third-party action pinning for production-write jobs:**
- Always pin third-party actions that write to production to immutable release tags (e.g. `@v1.7.1`), not mutable tags (`@v1`, `@v1.7`) or `@latest`. See ADR-005 for full guidance and rationale.
- Additionally, pin bundled CLI tools to specific semver versions (e.g. `version: 2.22.6`, not `latest`). Example: `supabase/setup-cli@v1.7.1` with `version: 2.22.6` inside the `with:` block.
- Include an explicit comment in the workflow YAML explaining the pinning strategy and when/how to update (e.g., "update intentionally, see release page for breaking changes").

**Supabase CLI in CI (database migrations):**
- **Migration idempotency**: `supabase db push` tracks applied migrations in `supabase_migrations.schema_migrations` table. Already-applied migrations are skipped automatically. The first CI run after manually-applied migrations (e.g., via SQL Editor) will attempt to re-apply them, which is safe only if SQL uses guards (`IF NOT EXISTS`, `DROP POLICY IF EXISTS CREATE POLICY`; PG15 compatible).
- **config.toml project_id vs --project-ref**: The `project_id` in `supabase/config.toml` is overridden by `--project-ref` CLI flag. CI jobs should always pass `--project-ref` explicitly so they target the correct environment regardless of config.toml. The config.toml can safely use a placeholder dev ref locally.
- **Vercel parallel deploy gap**: Vercel listens to the same GitHub push webhook and starts its build in parallel with GitHub Actions, not sequentially. A failing `migrate` job does NOT cancel an in-flight Vercel build. To close this gap, enable "Require CI to pass before deploying" in Vercel project settings → GitHub integration (manual operator step). Without this gate, code can deploy before migrations complete, causing runtime errors on missing tables/columns.
- **Add `SUPABASE_SERVICE_ROLE_KEY` to CI early**: Even before service-role operations are used at runtime, add `SUPABASE_SERVICE_ROLE_KEY: placeholder` to both Build and Smoke test env blocks in `.github/workflows/ci.yml`. This prevents future gaps when service-role operations are added; the placeholder allows builds to succeed without real credentials.

**Supabase SSR Auth (Next.js 16):**
- **Packages**: Install `@supabase/supabase-js` and `@supabase/ssr`.
- **Server client** (`lib/supabase/server.ts`): Use `createServerClient` from `@supabase/ssr` with `next/headers` cookies. The `setAll` method must be wrapped in try/catch because Server Components have read-only cookie stores; calling `setAll` in a Server Component throws. The proxy.ts (middleware) path never calls `setAll` — only Route Handlers (writable) do.
- **Browser client** (`lib/supabase/client.ts`): Use `createBrowserClient` from `@supabase/ssr`; synchronous factory for Client Components. Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **OAuth initiation**: Call `signInWithOAuth` from the browser client with `provider: 'google'` and `redirectTo: window.location.origin + '/auth/callback'`. This avoids needing a `NEXT_PUBLIC_SITE_URL` env var. Always destructure `{ error }` synchronously and render an alert if present — the call does not redirect to the browser if the provider is misconfigured.
- **Multi-environment OAuth**: A single OAuth client (e.g., Google Client ID/Secret) can have multiple redirect URIs, allowing it to be reused across dev and prod Supabase projects. Add both `http://localhost:3000/auth/callback` (dev) and `https://yourdomain.com/auth/callback` (prod) as authorized redirect URIs in Google Cloud Console; both Supabase projects reference the same OAuth client.
- **Session refresh in proxy.ts**: Wrap the **entire** Supabase block (client construction + `getUser()`) in a single try/catch. Any error (missing env, network failure, invalid creds) falls through as `user = null` rather than throwing a 500. Copy `Set-Cookie` headers from the Supabase response onto the outgoing next-intl response.
- **Auth guard regex**: Match protected paths with `/^\/[^/]+\/(login|auth)(\/|$)/` or segment anchors, **not** substring matchers like `\/login/`. Substrings incorrectly match `/pt-PT/login-admin` and bypass the guard. The matcher should exclude `/auth/*` from next-intl processing so OAuth callbacks are never locale-prefixed.
- **Middleware matcher comment**: Add an explicit comment near `config.matcher` noting that `/auth/*` exclusion makes any `isAuthCallback` checks inside the middleware function dependencies — if a future dev removes the exclusion, those checks become dead code. This prevents silent bugs.
- **searchParams Promise**: In Next.js 16, page props have `searchParams: Promise<object>`. Type it as `Promise<{ error?: string }>` and `await` before reading properties.
- **signOut server action**: Wrap `createClient()` + `signOut()` in try/catch. Always call `redirect()` unconditionally after the catch block, so the user reaches login regardless of errors. Use `routing.defaultLocale` (from `@/i18n/routing`) for the redirect path, not hardcoded strings.
- **User display fallback**: Optional user metadata fields (e.g. `user.user_metadata.full_name`) may be absent. Always provide a non-empty fallback when rendering user greetings (e.g. via an i18n key like `Auth.userFallback` that covers "Olá, " with a default name) so the UI never shows truncated text like "Olá, ".

**Supabase service-role client:**
- **Service-role client pattern**: Use `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`; no cookie management needed). Add `import 'server-only'` as the first line of `lib/supabase/service.ts` to prevent accidental browser imports. Create the client lazily inside the factory function (not at module level) so missing env vars (e.g. `SUPABASE_SERVICE_ROLE_KEY`) don't throw at module-load time in CI builds with placeholder credentials.
- **`CREATE POLICY IF NOT EXISTS` is PG17+ only**: Supabase runs PostgreSQL 17 (as of mid-2025). However, `DROP POLICY IF EXISTS "name" ON table; CREATE POLICY ...` is the safer pattern — it works on PG15 and later and makes intent explicit.
- **`User.email` is `string | undefined`**: The Supabase JS `User` type has `email?: string`. Always guard with `if (!user.email) { throw ... }` before any DB write that requires email. TypeScript narrows after the guard so no further casts are needed.
- **Provisioning in callback route, not DB trigger**: User provisioning (INSERT/UPDATE) belongs in `app/auth/callback/route.ts` (runs on every login), not a Supabase trigger on `auth.users` INSERT (only fires on new account creation, misses pre-existing accounts that logged in before the trigger was deployed). Callback-based provisioning is always safe (idempotent upsert) and handles all users correctly (STORY-03, ADR-004).
- **`SUPABASE_SERVICE_ROLE_KEY` in CI**: Add `SUPABASE_SERVICE_ROLE_KEY: placeholder` to both Build and Smoke test env blocks in `.github/workflows/ci.yml`, following the same pattern as `NEXT_PUBLIC_*` vars — even before the key is actually used at runtime, to prevent future gaps when service-role operations are added.
- **Bootstrap-first-admin guard**: Count rows in `public.users` (not `auth.users`). After the count query, guard `count === null` with a throw before checking `count === 0`. Do not use `count ?? -1` after a null-throw — it's dead code. Null count means the query itself failed; treat as a fatal error to prevent incorrect admin promotion.
