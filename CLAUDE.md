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

**Node.js and TypeScript:**
- When bumping the Node.js runtime version (in `.github/workflows/ci.yml` and `package.json`'s `engines` field), also bump `@types/node` to the same major version (e.g., Node 24 → `@types/node@^24`). TypeScript relies on `@types/node` for Node.js API definitions; mismatched versions cause false-positive type errors or incomplete intellisense.

**Next.js 16 + next-intl versioning:**
- Next.js 16 renamed `middleware.ts` → `proxy.ts`. The file **must** be named `proxy.ts`; `middleware.ts` is deprecated.
- `next-intl@^3` does not peer with Next.js 16; use `next-intl@^4`. The v4 API surface (e.g. `defineRouting`, `createNavigation`, `createMiddleware`, `getRequestConfig`) is identical for our usage.

**Tailwind v4:**
- `create-next-app` with Next.js 16 installs Tailwind v4, which uses `@import "tailwindcss"` instead of the old `@tailwind base/components/utilities` directives. Do not replace with the old syntax.
- **Shrink-to-fit trailing column for right-aligned table columns** (STORY-14): When an HTML `<table>` uses the browser's default `auto` layout (no `table-layout: fixed`) and needs a trailing column (e.g. actions) right-aligned at the table's edge without magic pixel widths, apply `w-[1%] whitespace-nowrap text-right` to both the `<th>` and `<td>` of that column. The `width: 1%` tells auto-layout to give the column only the bare minimum width; `white-space: nowrap` prevents the content from wrapping or shrinking below its intrinsic width, forcing auto-layout to assign remaining space to unconstrained (wider) columns. The result: the trailing column always stays shrink-to-fit and right-aligned at the table's trailing edge, regardless of translation string length or viewport width. This is more robust for i18n'd tables than hardcoded pixel widths with `table-layout: fixed`. Example: `<th className="w-[1%] whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th>`.

**HTML tables with inline-edit actions (STORY-14):**
- When a table row must support inline-edit mode where an `<input>` stays in one column (e.g. name) but its Save/Cancel buttons must move to a different column (e.g. actions, to avoid layout jump), use the HTML5 `form` **attribute association** instead of trying to nest a `<form>` tag across multiple `<td>` elements (which the HTML parser will foster-parent out of the table, silently breaking layout). Pattern: place the `<input>` in the first `<td>` with `form={editFormId}` attribute, then render a `<form id={editFormId}>` wrapping the Save/Cancel buttons in the target `<td>`. Each element remains a direct child of its own `<td>`, no foster-parenting risk, and Enter-to-submit behavior is preserved because the input's `form` attribute lets the browser associate it with the form in the other cell. Example: `<input form="pm-edit-form-123" ... />` (name column) paired with `<form id="pm-edit-form-123"><button type="submit">Save</button></form>` (actions column).

**shadcn/ui + Tailwind v4 integration:**
- `components.json` must have `"tailwind": { "config": "" }` (empty string, not a file path). The CLI auto-detects Tailwind v4 from `postcss.config.mjs`. If detection fails, create `components.json` manually.
- `npx shadcn@latest init` and `npx shadcn@latest add` may be blocked in sandboxed environments. In that case, create `components.json`, `lib/utils.ts`, and component files manually — the CLI output is deterministic and identical.
- Tailwind v4 CSS token layer: shadcn injects two `@layer base` blocks (custom properties in `:root` and property defaults on `*`/`body`) plus an `@theme inline` block mapping CSS variables to Tailwind utilities. Multiple `@layer base` declarations in one file are valid and merge correctly. The `@import "tailwindcss"` line must remain first.
- `components/ui/button.tsx` must have `'use client'` as its first line. It uses `React.forwardRef` and Radix `Slot`, both requiring the client runtime. Importing into server components is valid — Next.js treats the Button as a client boundary automatically.
- **Native `<details>`/`<summary>` as a lightweight dropdown**: When shadcn `DropdownMenu` is not installed and no React state is required (e.g., a simple show/hide panel), native HTML `<details>`/`<summary>` works in an async Server Component without `'use client'`. The browser handles open/close natively; `<summary>` receives `cursor-pointer` via CSS. As of STORY-13, click-outside and Escape dismissal are handled via a thin `'use client'` wrapper (ref + document-level `click`/`keydown` listeners) around the `<details>` node — see `components/UserWidgetMenu.tsx` for the reference pattern. The native element itself still requires no `'use client'` boundary for static/non-dismissible uses; add the wrapper only when outside-click or Escape dismissal is required. The outside-click listener must be attached on the plain bubble-phase `'click'` event — not `'mousedown'`, not `{ capture: true }` — so that `<summary>`'s native open/close toggle (which runs as the event's default action, after bubble-phase listeners) is not fought by the outside-click handler. When dismissing via Escape, restore focus to the trigger element (ARIA APG disclosure widget convention) to preserve keyboard user context.

**Locale layout pattern:**
- `app/layout.tsx` must be a minimal passthrough (no `<html>`/`<body>`); the locale layout `app/[locale]/layout.tsx` owns `<html lang={locale}>`, `<body>`, `NextIntlClientProvider`, and all persistent chrome (header, nav).
- **Global CSS must be imported in `app/layout.tsx`** — add `import './globals.css'` there. The locale layout does not import it. Without this, Tailwind generates no CSS and the app is completely unstyled in production.
- Pages only render their own content; shell belongs in the locale layout.
- Call `getMessages({ locale })` with the validated locale string, not `getMessages()` without arguments.
- **Route groups for conditional chrome**: In Next.js App Router, nested layouts **compose inside** their parent — they do not replace or suppress parent content. To hide app chrome (e.g., `AppHeader`) on specific routes (login, marketing pages), use a route group `(app)/`. Move chrome-rendering code into `app/[locale]/(app)/layout.tsx` and move app pages into `app/[locale]/(app)/`. Routes outside `(app)/` (e.g., `app/[locale]/login/`) will not render the chrome. Route groups are invisible to URLs — `/[locale]/`, `/[locale]/admin/users`, etc. remain unchanged. This pattern prevents trying to use nested layouts to suppress parent content, which is not possible in Next.js. See STORY-10 and ADR-009 for context.

**i18n lazy-loading pattern in async Server Components:**
- In async Server Components with multiple role-based early returns (e.g. `home/page.tsx`), load translation namespaces **lazy** — only call `await getTranslations(...)` just before the branch that uses them. This avoids paying for namespaces that are never used on short-circuit paths. Example: if a member request returns early, the Admin-only `Home` namespace is never fetched.

**i18n key hygiene:**
- Only add keys to `messages/pt-PT.json` that are explicitly consumed in the current story. Plan-phase draft keys (e.g. `Member.role` with `{role}` interpolation) should be removed before implementation — orphaned keys are dead weight and confuse translators.
- **AO90 spelling for pt-PT**: Modern Portuguese (post-2012 Acordo Ortográfico) uses "ativa" (not "activa"), "ato" (not "acto"), "fato" (not "facto"). All new pt-PT strings must follow AO90.

**Playwright:**
- **WSL2 gotcha**: Chromium headless requires `libnspr4.so` and other system libs that cannot be installed without root. In CI, use `npx playwright install --with-deps chromium`. Locally, developers can use `npx playwright install chromium` and accept that some tests may fail if libs are missing.
- **Config**: Always set `retries: process.env.CI ? 2 : 0` and `workers: process.env.CI ? 1 : undefined` in `playwright.config.ts`.
- **boundingBox() guard**: Always call `await expect(locator).toBeVisible()` before `boundingBox()`. The `boundingBox()` method is not auto-retried; calling it without a visibility wait produces confusing null failures on slow CI runners.
- **Tap targets (WCAG 44px minimum)**: Use `min-h-[44px]` (not `h-11`) for interactive elements. `h-11` (2.75rem) computes to exactly 44px only at the browser's default 16px/rem. `min-h-[44px]` is a hard pixel floor that holds regardless of font scale and makes tests flake-proof. When an interactive element contains a decorative icon or avatar, apply `min-h-[44px]` to the outer interactive element (e.g., `<summary>` or button), not to the inner visual component — the inner component can be smaller (e.g. `h-8 w-8` for an avatar) for compactness while the outer element provides the full tap target.
- **Multi-reporter pattern**: Set `reporter: [['html'], ['list']]` in `playwright.config.ts`. The `html` reporter generates the detailed report with screenshots; `list` preserves console output in CI logs for quick debugging. Use this pattern, not `[['html']]` alone.
- **Artifact uploads — `if-no-files-found: error`**: For deterministic output directories (e.g. `playwright-report/` from html reporter, `test-results/` from `screenshot: 'on'`), set `if-no-files-found: error` in `actions/upload-artifact@v4`. This creates a real CI gate and prevents silent failures. Reserve `warn` for optional/conditional outputs.
- **`if: always()` placement in CI**: In GitHub Actions, place `if: always()` at the step level (same indent as `uses:`), not at the job level. Correct placement ensures artifacts upload even when earlier steps fail.
- **`__next-route-announcer__` strict-mode collision**: Next.js App Router always injects `<div role="alert" aria-live="assertive" id="__next-route-announcer__">` into every page for screen-reader route announcements. Any test using `page.locator('[role="alert"]')` will match this element AND any application error divs, triggering Playwright's strict-mode violation when there are 2+ matches. **For dynamically injected error messages, use `aria-live="polite"` instead of `role="alert"`**. Combined with `data-testid="<error-name>"` for test targeting: `<div data-testid="um-error" aria-live="polite">`. This avoids the collision entirely while maintaining screen-reader announcements. Add `data-testid` to all interactive auth components (buttons, forms) from the start to avoid brittle text-based selectors.
- **Form input accessible labels (WCAG SC 1.3.1)**: Every `<input>` in a form must have a programmatically associated label. Using a visual `<h2>` or `<label>` text is not sufficient. Add `aria-label={t('keyName')}` directly to the input, or use `<label htmlFor="inputId">` + matching `id` on the input. Placeholder text disappears on focus and does not satisfy the criterion.
- **`aria-label` composition for identity widgets**: When a button or interactive element shows multiple pieces of information (e.g., user's name + a menu affordance), compose the `aria-label` to include all of it: `{displayName} — {t('menuLabel')}` (e.g., "Simão — Menu de utilizador"). A bare `t('menuLabel')` overrides the computed accessible name from visible text and hides the user's identity from screen readers. Always preserve the semantic data in the accessible name.
- **Auth-gated test pattern**: When e2e tests require Supabase auth that CI cannot provide, gate skipping on an env var: `test.skip(!process.env.E2E_WITH_AUTH, 'reason')`. This skips the test in CI (no env var) but allows developers with `E2E_WITH_AUTH=1` and real credentials to run it locally. Never use `test.skip(true, ...)` with a boolean literal — it permanently disables the test everywhere, even locally. Always bind to an env var for local opt-in.
- **Overflow measurement (DOM scrollWidth)**: For viewport overflow checks in Playwright, always use `document.documentElement.scrollWidth` (the `<html>` element), not `document.body.scrollWidth`. Overflow can sit on the root element when `body` doesn't extend there, giving false negatives. This matches the `smoke.spec.ts` pattern and is the correct canonical measurement.
- **Auth-gated test fixture cleanup with worker isolation** (STORY-14): When writing auth-gated tests that create temporary rows/fixtures in the database (e.g. a test person in the people-management table), use `test.beforeEach` with `testInfo.workerIndex` to generate unique fixture names per worker, avoiding cross-worker name collisions if tests run in parallel: `let testPersonName: string; test.beforeEach(({}, testInfo) => { testPersonName = \`Test Name (w${testInfo.workerIndex})\`; });`. Then use `test.afterEach` to unconditionally remove the fixture after every test (pass or fail), preventing leaks into the live data: `test.afterEach(async ({ page }) => { await removeFixtureIfPresent(page, testPersonName); });`. This pattern is essential for local developer testing where tests may run in parallel without CI's sequential constraint.
- **Known issue: app header/nav horizontal overflow at 375px viewport**: The app's persistent `<header>` and nav chrome overflow the 375px mobile viewport by approximately 16px (`document.documentElement.scrollWidth` ≈ 391px vs 375px viewport), confirmed on both `/pt-PT/admin/people` and `/pt-PT/` home page. This is unrelated to table components and is a separate story-level issue. **Impact on tests**: any Playwright test asserting `document.documentElement.scrollWidth <= 375` (e.g. STORY-14's AC3) will fail with a misleading signal once run with real auth credentials, even if the table/form itself does not overflow. The test assertion is correct and the overflow is real — the failure is not a false positive on the table component, but correctly flags the header overflow. When this header issue is fixed, the test will pass. Until then, local developers running auth-gated tests should be aware this overflow exists and is not caused by the feature under test.

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

**Next.js 16 Route Handler dynamic params with auth guards:**
- When a dynamic Route Handler has both an auth guard AND `{ params }: { params: Promise<...> }`, always call the guard FIRST before awaiting params. The guard can short-circuit with 401/403 before params are resolved. Even though `await params` is cheap (URL parsing), this ordering is canonical: `const result = await requireAdmin(request); if (result instanceof NextResponse) return result; const { id } = await params; ...`

**Route Handler input validation (JSON body + path params):**
- **Invalid JSON body → 400, not 500**: Wrap `request.json()` in its own `try/catch` BEFORE the outer DB try block. A SyntaxError from malformed JSON must return HTTP 400, not 500. Pattern: `let body; try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }`
- **UUID path param validation → 400, not 500**: Dynamic Route Handlers must validate UUID format before querying Supabase. PostgreSQL error `22P02` (invalid_text_representation) surfaces as 500 without this guard. Use `const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })`

**Shared types between Server and Client Components:**
- When an interface is used in both a Server Component and a `'use client'` Client Component, place it in `types/<domain>.ts` with zero server dependencies (no `import 'server-only'`; no server-only imports). Both components import with `import type { Interface } from '@/types/<domain>'`. This avoids `server-only` module contamination if the type were co-located with server code. Example: `types/user-management.ts` exports `UserRow` used by both `app/[locale]/admin/users/page.tsx` and `components/UserTable.tsx`.

**Supabase SSR Auth (Next.js 16):**
- **Packages**: Install `@supabase/supabase-js` and `@supabase/ssr`.
- **Server client** (`lib/supabase/server.ts`): Use `createServerClient` from `@supabase/ssr` with `next/headers` cookies. The `setAll` method must be wrapped in try/catch because Server Components have read-only cookie stores; calling `setAll` in a Server Component throws. The proxy.ts (middleware) path never calls `setAll` — only Route Handlers (writable) do.
- **Route Handler cookie gotcha (Next.js 16)**: `await cookies()` from `next/headers` does NOT reliably forward the browser's cookies to Route Handlers — `auth.getUser()` returns null with no outgoing request despite cookies being present in the browser. Use `request.cookies.getAll()` directly (the same approach as proxy.ts). Auth guard functions and any Route Handler that reads the session MUST accept a `NextRequest` parameter and read `request.cookies`. Do not use `createClient()` from `lib/supabase/server.ts` inside Route Handlers; construct the Supabase client directly with `request.cookies`.
- **Route Handler `setAll` must write to `request.cookies`**: With `setAll` as a no-op, an expired access token causes `auth.getUser()` to fail even after a successful server-side refresh — the Supabase client's in-memory session is not updated if `setAll` does nothing. In the guard's `setAll`, call `request.cookies.set(name, value)` for each refreshed cookie. This updates the in-memory request object so the client can use the new access token for the current request. The browser receives updated tokens on the next page navigation via proxy.ts.
- **Server-side auth guard pattern** (`lib/auth/guard.ts`): Export `requireAuth(request: NextRequest)` and `requireAdmin(request: NextRequest)`. Both return `AuthUser | NextResponse`. Callers check `if (result instanceof NextResponse) return result`. The guard reads cookies from `request.cookies` (not `next/headers`). Future Admin-only Route Handlers follow the same pattern: `const result = await requireAdmin(request); if (result instanceof NextResponse) return result; ...`.
- **Runtime role validation**: Never use bare `as 'admin' | 'member'` casts on DB values. Use a ternary: `row.role === 'admin' ? ('admin' as const) : ('member' as const)`. A DB value that bypassed the CHECK constraint otherwise silently passes into the type system.
- **`console.error` in Route Handler catch blocks**: Always bind `catch (err)` and log `console.error('[guardName] unexpected error:', err)`. Route Handlers are a better log site than middleware — they run per-request with user context.
- **Supabase client error field in Server Components and Route Handlers**: The Supabase JS client does NOT throw on query errors — it returns `{ data: null, error: {...} }`. Always destructure `{ data, error }` and log `console.error` when `error` is truthy **before** treating it as success. A bare try/catch only catches JS exceptions (network failure, SyntaxError). Without checking the `error` field, silently returns empty data when the query fails. Pattern: `const { data, error } = await client.from('table').select(...); if (error) { console.error('[fnName] DB error:', error); ... return []; }`. This applies to all Supabase queries in Server Components, Route Handlers, and async helpers like `session.ts`. **Existing gap**: `app/[locale]/admin/users/page.tsx` has this bug (line 47 only destructures `{ data }`, not `{ data, error }`). Fix it in the next story that touches that file.
- **Browser client** (`lib/supabase/client.ts`): Use `createBrowserClient` from `@supabase/ssr`; synchronous factory for Client Components. Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **OAuth initiation**: Call `signInWithOAuth` from the browser client with `provider: 'google'` and `redirectTo: window.location.origin + '/auth/callback'`. This avoids needing a `NEXT_PUBLIC_SITE_URL` env var. Always destructure `{ error }` synchronously and render an alert if present — the call does not redirect to the browser if the provider is misconfigured.
- **Multi-environment OAuth**: A single OAuth client (e.g., Google Client ID/Secret) can have multiple redirect URIs, allowing it to be reused across dev and prod Supabase projects. Add both `http://localhost:3000/auth/callback` (dev) and `https://yourdomain.com/auth/callback` (prod) as authorized redirect URIs in Google Cloud Console; both Supabase projects reference the same OAuth client.
- **Session refresh in proxy.ts**: Wrap the **entire** Supabase block (client construction + `getUser()`) in a single try/catch. Any error (missing env, network failure, invalid creds) falls through as `user = null` rather than throwing a 500. Copy `Set-Cookie` headers from the Supabase response onto the outgoing next-intl response.
- **Bidirectional auth guards in proxy.ts**: When adding guards, consider BOTH directions: `!user && !isLoginPath` (unauthenticated users on protected routes) AND `user && isLoginPath` (authenticated users on login). Both branches must copy Supabase cookies onto the redirect response (STORY-09).
- **Sign-out race condition and marker-cookie fix** (STORY-15): `@supabase/auth-js`'s `_signOut()` never clears the session cookie until after its network revoke call completes — there is no synchronous local clear, so client code cannot "race" the network with a timeout. A "sign out then navigate to /login" flow will hit proxy.ts's reverse-guard (`if (user && isLoginPath)`) bounce-back whenever the real signOut network call is still in flight. The structural fix: have the client synchronously set a short-lived, first-party marker cookie (e.g. `app-signout-pending=1`, `max-age=15`) via `document.cookie` **before** navigating (zero network, zero wait), then have proxy.ts read this marker and skip the Supabase session lookup entirely, treating `user` as `null` for that request. The marker only ever forces the stricter (logged-out) branch of either guard, never grants access, so it introduces no privilege-escalation risk. Extract the marker cookie name and max-age into a shared constants module (e.g. `lib/auth/signout-marker.ts`) imported by all consumers (middleware, client component, Route Handler). The marker must be cleared on every response path in the OAuth callback route (`app/auth/callback/route.ts`), so a sign-out-then-immediate-re-login isn't shadowed by a stale marker. See proxy.ts, components/UserWidgetMenu.tsx, and app/auth/callback/route.ts for the implementation pattern.
- **Auth guard regex**: Match protected paths with `/^\/[^/]+\/(login|auth)(\/|$)/` or segment anchors, **not** substring matchers like `\/login/`. Substrings incorrectly match `/pt-PT/login-admin` and bypass the guard. The matcher should exclude `/auth/*` from next-intl processing so OAuth callbacks are never locale-prefixed.
- **Middleware matcher comment**: Add an explicit comment near `config.matcher` noting that `/auth/*` exclusion makes any `isAuthCallback` checks inside the middleware function dependencies — if a future dev removes the exclusion, those checks become dead code. This prevents silent bugs.
- **searchParams Promise**: In Next.js 16, page props have `searchParams: Promise<object>`. Type it as `Promise<{ error?: string }>` and `await` before reading properties.
- **signOut server action**: Wrap `createClient()` + `signOut()` in try/catch. Always call `redirect()` unconditionally after the catch block, so the user reaches login regardless of errors. Use `routing.defaultLocale` (from `@/i18n/routing`) for the redirect path, not hardcoded strings.
- **User display fallback**: Optional user metadata fields (e.g. `user.user_metadata.full_name`) may be absent. Always provide a non-empty fallback when rendering user greetings (e.g. via an i18n key like `Auth.userFallback` that covers "Olá, " with a default name) so the UI never shows truncated text like "Olá, ".
- **Access-denied banner guard in Server Components**: When a query param (e.g. `?denied=1`) drives a UI denial message, always guard it with `role !== <privileged_role>`. Without the guard, a privileged user who bookmarks or crafts a `?denied=1` URL sees a misleading "you don't have permission" message. Pattern: `const showDeniedBanner = denied === '1' && role !== 'admin'`. Apply `showDeniedBanner` to all code paths that render user-facing content, not just the denial branch.

**React cache() for auth deduplication:**
- Create `lib/auth/session.ts` with `getSessionUser` and `getUserRole(userId)` wrapped in `cache()` from `'react'`. These are the canonical helpers for all Server Components needing the current user or role.
- Do NOT add `import 'server-only'` — `next/headers` (imported transitively via `createClient`) is a sufficient bundler boundary; `server-only` would be redundant and block test file imports.
- `React.cache()` scopes memoisation to a single server render tree — there is no cross-request cache leak risk.
- `supabase.auth.getUser()` returns `{ data: { user: User | null } }`. The `user` field is `User | null`, never `undefined`. Do not add `?? null` — it is dead code.
- All catch blocks must bind `catch (err)` and call `console.error('[fnName] unexpected error:', err)` before returning null. Bare `catch {}` is not acceptable in server helpers.
- The middleware (`proxy.ts`) runs in a different execution context and cannot share the React cache — it must keep its own `auth.getUser()` call.

**Client-side sort order (Optimistic updates in Client Components):**
- When a Server Component fetches data with `.order('name', { ascending: true })` and passes it to a `'use client'` Client Component, any optimistic state update (add/edit/remove) that inserts or modifies rows must maintain the server's sort order. After a successful API call, re-sort the state array using the same criteria: `setRows(prev => [...prev, newRow].sort((a, b) => a.name.localeCompare(b.name, 'pt')))`. Failing to re-sort breaks the UI sort order until the next page reload.

**Per-page admin guard convention (Server Components):**
- Every `app/[locale]/admin/*/page.tsx` must include a role-guard redirect until a middleware-level guard is introduced. This is belt-and-suspenders: `proxy.ts` guards unauthenticated access, but members who somehow reach an admin URL need per-page rejection.
- Pattern: Fetch the user's role, check `if (role !== 'admin') redirect(\`/${routing.defaultLocale}/?denied=1\`)`. The `?denied=1` query param signals the home page to show an access-denied banner (use the `showDeniedBanner` guard pattern documented in Supabase SSR Auth).
- This convention is per-page opt-in — there is no structural enforcement at the framework level in the current architecture (see ADR-007 for the rationale). As the admin section grows, migrate to a middleware-level guard if page duplication becomes burdensome.

**GRANT before RLS (PostgreSQL prerequisite):**
- PostgreSQL checks table-level privileges BEFORE evaluating RLS policies. If `authenticated` (or `anon`) has no SELECT privilege on a table, every query returns `42501 permission denied` — RLS policies are never consulted. Always include `GRANT SELECT ON public.<table> TO authenticated;` (and other verbs as needed) in the same migration that creates the table and enables RLS. Symptom: Supabase client returns `{ code: '42501', message: 'permission denied for table <name>' }` even though the row exists and the user is authenticated.
- **`service_role` also needs explicit GRANTs**: The service-role client (used in admin Route Handlers) connects as `service_role`, not `authenticated`. PostgreSQL still checks table-level privileges for `service_role` even though it bypasses RLS. Every migration that creates a table used by Route Handlers must include **both**: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated;` AND `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO service_role;`. Missing the `service_role` grant causes `42501` in Route Handlers while the page (which reads via the same client but hits the anon path) silently returns an empty list.

**Supabase service-role client:**
- **Service-role client pattern**: Use `createClient` from `@supabase/supabase-js` (not `@supabase/ssr`; no cookie management needed). Add `import 'server-only'` as the first line of `lib/supabase/service.ts` to prevent accidental browser imports. Create the client lazily inside the factory function (not at module level) so missing env vars (e.g. `SUPABASE_SERVICE_ROLE_KEY`) don't throw at module-load time in CI builds with placeholder credentials.
- **`CREATE POLICY IF NOT EXISTS` is PG17+ only**: Supabase runs PostgreSQL 17 (as of mid-2025). However, `DROP POLICY IF EXISTS "name" ON table; CREATE POLICY ...` is the safer pattern — it works on PG15 and later and makes intent explicit.
- **`User.email` is `string | undefined`**: The Supabase JS `User` type has `email?: string`. Always guard with `if (!user.email) { throw ... }` before any DB write that requires email. TypeScript narrows after the guard so no further casts are needed.
- **Provisioning in callback route, not DB trigger**: User provisioning (INSERT/UPDATE) belongs in `app/auth/callback/route.ts` (runs on every login), not a Supabase trigger on `auth.users` INSERT (only fires on new account creation, misses pre-existing accounts that logged in before the trigger was deployed). Callback-based provisioning is always safe (idempotent upsert) and handles all users correctly (STORY-03, ADR-004).
- **`SUPABASE_SERVICE_ROLE_KEY` in CI**: Add `SUPABASE_SERVICE_ROLE_KEY: placeholder` to both Build and Smoke test env blocks in `.github/workflows/ci.yml`, following the same pattern as `NEXT_PUBLIC_*` vars — even before the key is actually used at runtime, to prevent future gaps when service-role operations are added.
- **Bootstrap-first-admin guard**: Count rows in `public.users` (not `auth.users`). After the count query, guard `count === null` with a throw before checking `count === 0`. Do not use `count ?? -1` after a null-throw — it's dead code. Null count means the query itself failed; treat as a fatal error to prevent incorrect admin promotion.
- **SECURITY DEFINER + REVOKE/GRANT for RLS helper functions**: When an RLS policy needs to read from the same table it protects (risking infinite recursion), use a `SECURITY DEFINER` function with `SET search_path = ''`. Immediately after `CREATE OR REPLACE FUNCTION`, add `REVOKE EXECUTE ON FUNCTION fn() FROM PUBLIC; GRANT EXECUTE ON FUNCTION fn() TO authenticated;` — this prevents unauthenticated callers from invoking it directly. See `supabase/migrations/20260628000002_rls_admin_policies.sql`.
- **Supabase Table Editor and SQL Editor bypass RLS**: Both tools connect as the postgres superuser and ignore all RLS policies. Never use them to verify that RLS is working correctly. Instead, test via `fetch('/api/...')` from an authenticated browser session — this goes through the anon-key client and respects RLS.
- **`DROP FUNCTION IF EXISTS` before `CREATE OR REPLACE FUNCTION` is redundant**: `CREATE OR REPLACE FUNCTION` handles the existing-function case idempotently. The preceding DROP is unnecessary and creates a brief functional gap. Use only `CREATE OR REPLACE FUNCTION` in migrations.
