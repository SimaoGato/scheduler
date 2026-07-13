# STORY-02: Google sign-in / sign-out with persistent session
Epic: EPIC-01
PR: 5
Status: done ✅

## User story
As a user, I want to sign in and out with my Google account, so that I can
securely access the app without managing a password.

## Context
Second slice of EPIC-01. Wires the auth/database provider (Supabase or
equivalent free tier) and Google OAuth. See PRD §6 (FR18: Google login for all
users) and §7 (security: Google OAuth). User provisioning/roles come next
(STORY-03).

## Acceptance criteria
1. Given a logged-out visitor, when they open a protected page, then they are
   directed to a sign-in screen offering **"Continue with Google"**.
2. Given the sign-in screen, when the user completes Google OAuth successfully,
   then they are returned to the app in an authenticated state showing their
   Google display name/email.
3. Given an authenticated user, when they reload or revisit the app, then their
   session persists (they are not asked to log in again until it expires/logs
   out).
4. Given an authenticated user, when they click sign-out, then the session is
   cleared and a subsequent visit to a protected page requires logging in again.
5. Given a failed or cancelled Google login, when control returns to the app,
   then a clear pt-PT error/notice is shown and the user remains logged out.

## Out of scope
- Creating the application user record / assigning roles (STORY-03).
- Admin vs Member authorization rules (STORY-04).
- Non-Google login methods.

## Technical notes
- Supabase Auth (Google provider) or equivalent; configure OAuth client + redirect URLs.
- Session handling via the provider's SDK; protect routes via middleware.
- Store provider secrets in env vars wired in STORY-01.

## Definition of Done
See CLAUDE.md.

---

## Implementation plan

**Complexity: complex** — touches auth (Supabase OAuth + PKCE), cookie-based session
management, a security middleware boundary, four interacting modules (proxy,
route handler, server actions, client components), and CI env configuration.

---

### Affected areas

| Area | What changes |
|------|-------------|
| **backend** | `app/auth/callback/route.ts` (OAuth code exchange), `app/[locale]/login/actions.ts` (server actions for sign-in and sign-out), `lib/supabase/server.ts` (server-side Supabase client helper) |
| **frontend** | `app/[locale]/login/page.tsx` (new login page), `app/[locale]/login/GoogleSignInButton.tsx` (client component for OAuth initiation), `components/AppHeader.tsx` (make async, add user display + sign-out form), `lib/supabase/client.ts` (browser client helper) |
| **infra** | `proxy.ts` (chain Supabase session refresh + auth guard + next-intl), `package.json` (add `@supabase/supabase-js` and `@supabase/ssr`), `.github/workflows/ci.yml` (add Supabase env vars to Smoke test step), `.env.example` (confirm vars documented) |
| **ux** | Login page layout: app name, "Continue with Google" button (44 px min-height, i18n string), pt-PT error notice for failed/cancelled OAuth |
| **ai-ml** | none |
| **data** | none (user provisioning is STORY-03) |

---

### Prerequisites (manual, done before implementation starts)

These require human action in external systems and are not automated by this story:

1. **Supabase project** — create a free project at supabase.com; note URL and anon key.
2. **Google OAuth credentials** — in Google Cloud Console, create an OAuth 2.0 client
   (type: Web). Authorized redirect URIs must include:
   - `https://<supabase-project>.supabase.co/auth/v1/callback` (Supabase's own OAuth handler)
   - `http://localhost:3000/auth/callback` (local dev)
   - `https://<vercel-domain>/auth/callback` (production Vercel URL)
3. **Supabase Google provider** — in the Supabase dashboard → Authentication → Providers
   → Google: enable, paste the Google Client ID and Secret.
4. **Allowed redirect URLs in Supabase** — Authentication → URL Configuration: add
   `http://localhost:3000/**` and `https://<vercel-domain>/**`.
5. **Env vars** — put real values in `.env.local` (not committed). Add secrets to Vercel
   and to GitHub Actions as repository secrets if needed for production CI.

---

### Step 1 — Install Supabase packages

```bash
npm install @supabase/supabase-js @supabase/ssr
```

No other dependency changes needed.

---

### Step 2 — Create Supabase client helpers

**`lib/supabase/server.ts`** — async factory for server-side usage (Server Components,
Route Handlers, Server Actions). Wraps `@supabase/ssr`'s `createServerClient` with
`next/headers` cookies. The `setAll` implementation uses a try/catch because calling
it from a Server Component (read-only cookie store) throws; the middleware path never
hits that branch.

**`lib/supabase/client.ts`** — synchronous factory for Client Components. Wraps
`createBrowserClient` from `@supabase/ssr`. Uses the two `NEXT_PUBLIC_*` vars already
present in `.env.local` and `.env.example`.

---

### Step 3 — Update `proxy.ts` (auth guard + session refresh + next-intl chain)

`proxy.ts` currently only runs next-intl middleware. Replace the default export with a
full `async function middleware(request: NextRequest)` that chains three concerns:

1. **Supabase session refresh** — create a server client using request cookies; wrap the
   **entire block** (client construction + `supabase.auth.getUser()`) in a single
   try/catch so that missing/invalid env vars or network errors at client construction
   time also fall through gracefully as "unauthenticated" rather than throwing a 500.
   Copy any new cookies set by Supabase onto the outgoing response.

2. **Auth guard** — if `user` is null and the request path is not a login or auth
   callback path, redirect to `/${routing.defaultLocale}/login` (import `routing`
   from `@/i18n/routing` — do **not** hardcode the raw string `'/pt-PT/login'`).
   The redirect response must carry the Supabase cookies (important: copy them
   explicitly).

   Path exemptions from the guard:
   - `/[locale]/login` (matched by regex `/\/[^/]+\/login/`)
   - `/auth/callback` (OAuth code exchange, handled by the route handler)

3. **next-intl routing** — call `intlMiddleware(request)` for all requests that pass
   the guard; copy Supabase cookies onto the intl response and return it.

Update the `config.matcher` to exclude `/auth/*` paths so next-intl never tries to
locale-prefix the callback URL:

```typescript
matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)',]
```

Assumption: the `intlMiddleware` return value always accepts `.cookies.set()` — this
is true for both `NextResponse.redirect()` and `NextResponse.next()` from next-intl.

---

### Step 4 — OAuth callback route handler

**`app/auth/callback/route.ts`** — GET handler. This file lives outside `[locale]`
so Supabase's redirect (`/auth/callback?code=...`) hits it directly.

Logic:
- If `searchParams.get('error')` is set (user cancelled or OAuth failed): redirect to
  `/pt-PT/login?error=<encoded-error-code>`.
- If `code` is present: call `supabase.auth.exchangeCodeForSession(code)`. On success,
  redirect to `/pt-PT/`. On exchange failure, redirect to
  `/pt-PT/login?error=exchange_failed`.
- Fallback (no code, no error): redirect to `/pt-PT/login`.

Note: the `/pt-PT/` prefix is deliberate here since this route handler runs outside the
`[locale]` segment and has no i18n context. Import `routing` from `@/i18n/routing` and
use `/${routing.defaultLocale}/login` (not the raw string `'/pt-PT/login'`) so the path
stays DRY if the default locale is ever renamed.

Use `createServerClient` from `lib/supabase/server.ts`. Because this is a Route
Handler, the cookie store is writable; no try/catch needed for `setAll`.

---

### Step 5 — i18n strings

Add the following keys to `messages/pt-PT.json` under a new `"Auth"` namespace:

```json
"Auth": {
  "signInTitle": "Entrar no Escala",
  "continueWithGoogle": "Continuar com Google",
  "signOut": "Sair",
  "errorAccessDenied": "Início de sessão cancelado.",
  "errorExchangeFailed": "Não foi possível completar o início de sessão. Tente novamente.",
  "errorDefault": "Ocorreu um erro durante o início de sessão. Tente novamente.",
  "userGreeting": "Olá, {name}"
}
```

---

### Step 6 — Login page

**`app/[locale]/login/page.tsx`** — async Server Component. `searchParams` in
Next.js 16 is a `Promise`; type the prop as `Promise<{ error?: string }>` and
`await` it before reading `.error`. Renders:
- App name / page title from `Auth.signInTitle`
- Conditionally: a pt-PT error notice derived from the error code (mapping
  `access_denied` → `Auth.errorAccessDenied`, `exchange_failed` →
  `Auth.errorExchangeFailed`, anything else → `Auth.errorDefault`)
- `<GoogleSignInButton />` (client sub-component, see below)

The page **must** use `<main className="flex-1 container mx-auto px-4 py-8">` as its
content wrapper (matching the home page pattern) so that the existing responsive-shell
smoke tests that assert `page.locator('main').toBeVisible()` continue to pass once
unauthenticated requests are redirected here.

The page is inside the `[locale]` segment so it inherits the locale layout (header,
nav, NextIntlClientProvider).

**`app/[locale]/login/GoogleSignInButton.tsx`** — `'use client'` component. Renders a
`<Button>` that on click calls `createBrowserClient().auth.signInWithOAuth()` with:
- `provider: 'google'`
- `redirectTo: \`${window.location.origin}/auth/callback\``

Using the browser client here means no `NEXT_PUBLIC_SITE_URL` env var is needed.
The server component reads `Auth.continueWithGoogle` via `getTranslations` and passes
it as a `label: string` prop to `GoogleSignInButton`. The client component does not
call `useTranslations` — it receives the string as a prop. Button must use
`min-h-[44px]` for WCAG compliance.

---

### Step 7 — Server actions (sign-in and sign-out)

**`app/[locale]/login/actions.ts`**

- `signOut()` — `'use server'`. Creates a server-side Supabase client, calls
  `supabase.auth.signOut()`, then redirects to `/${routing.defaultLocale}/login`
  (importing `routing` from `@/i18n/routing`) via Next.js `redirect()`. Do not
  hardcode the raw string `'/pt-PT/login'`.

(The sign-in OAuth initiation is handled client-side in `GoogleSignInButton.tsx` to
avoid needing a site URL env var, so no `signInWithGoogle` server action is needed.)

---

### Step 8 — AppHeader: show user info and sign-out

Convert `components/AppHeader.tsx` from a sync to an `async` Server Component.

Inside it:
1. Wrap the Supabase calls in a try/catch (or rely on placeholder env vars per Step 10
   ensuring `createServerClient` never throws for valid-shaped but unreachable URLs).
   The `@supabase/ssr` SDK returns `{ data: { user: null }, error }` on network failure
   rather than throwing, so `getUser()` itself is safe; guard `createServerClient` by
   ensuring `NEXT_PUBLIC_SUPABASE_URL` is always set (placeholder value is fine).
2. Call `createClient()` from `lib/supabase/server.ts`, then `getUser()`.
3. If a user is found, render the user's display name / email (from
   `user.user_metadata.full_name` or `user.email`) and a sign-out form:

```tsx
<form action={signOut}>
  <button type="submit" className="...min-h-[44px]...">
    {t('Auth.signOut')}
  </button>
</form>
```

Where `signOut` is the server action from `app/[locale]/login/actions.ts`.

The user greeting string uses `Auth.userGreeting` with the `{name}` interpolation.

If no user (e.g., on the login page), render nothing in that slot.

Note: `AppHeader` currently uses `useTranslations` which is a client hook. Async
server components cannot use client hooks. Convert to `getTranslations` from
`next-intl/server` instead (server-side equivalent). `AppNav` stays client.

---

### Step 9 — Update smoke tests

`e2e/smoke.spec.ts` test `'app name rendered from i18n catalog'` currently asserts
`main` contains "Bem-vindo". After this story, unauthenticated visitors are redirected
to the login page, so `main` will show login page content. Update that test to:
- Still verify `header` contains "Escala" and `nav` contains "Início"
- Change the `main` assertion to check for the "Continuar com Google" button (or the
  sign-in title) instead of "Bem-vindo"

The two **responsive-shell tests** (`'renders shell on mobile'` and `'renders shell on
desktop'`) assert `page.locator('main').toBeVisible()`. After this story those tests
land on the login page. They continue to pass without modification — **provided** the
login page uses `<main>` as its wrapper (required in Step 6). Verify this explicitly;
do not change the responsive tests themselves.

Also update `e2e/design-system.spec.ts`: the first test (`'design-system AC1: shadcn
Button is rendered on the home page'`) navigates to `/` and asserts "Ver escala" is
visible. After the auth guard it will land on the login page instead. Update it to
navigate to `/pt-PT/login` and assert the "Continuar com Google" `<Button>` is visible
— the shadcn Button component is still exercised there. The other two design-system
tests (`nav contains anchor links`, `nav tap targets 44 px`) navigate to `/` and check
the nav, which is present on the login page, so they need no changes.

---

### Step 10 — CI: add env vars to Smoke test step

The Smoke test step runs `npm start` which uses server-side `process.env` at runtime.
The `NEXT_PUBLIC_*` vars must be present. Add them to `.github/workflows/ci.yml` under
the `Smoke test` step (same placeholder values already used for Build):

```yaml
- name: Smoke test
  env:
    NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
  run: npm run test:e2e
```

---

### Step 11 — New e2e test file

**`e2e/auth.spec.ts`**

| Test | AC | Automated? |
|------|----|-----------|
| Unauthenticated visit to `/pt-PT/` redirects to `/pt-PT/login` and shows "Continuar com Google" button | AC1 | Yes |
| Login page at `/pt-PT/login` renders without error message by default | AC1 | Yes |
| Visit `/pt-PT/login?error=access_denied` shows pt-PT cancellation notice | AC5 | Yes |
| Visit `/pt-PT/login?error=exchange_failed` shows pt-PT generic error notice | AC5 | Yes |
| After successful Google OAuth, header shows user name/email and sign-out button | AC2 | Manual verification (see below) |
| Session persists across page reload | AC3 | Manual verification (see below) |
| Sign-out clears session; next protected page visit redirects to login | AC4 | Manual verification (see below) |

All automated tests work without real Supabase credentials because:
- The redirect to login happens purely from the middleware auth guard (Supabase error
  → user = null → redirect)
- The error display is purely query-param-driven, no Supabase call needed

**Manual verification steps (documented in story file, satisfies AC coverage requirement):**

To verify AC2, AC3, AC4 manually (requires real Supabase project with Google provider
and a filled-in `.env.local`):

1. Start `npm run dev`. Open `http://localhost:3000`. Confirm redirect to
   `/pt-PT/login`.
2. Click "Continuar com Google". Complete the Google OAuth flow.
3. Confirm return to `http://localhost:3000/pt-PT/` showing the home page with the
   user's name in the header. (AC2)
4. Reload the page. Confirm still authenticated (no redirect to login). (AC3)
5. Click "Sair". Confirm redirect to `/pt-PT/login` with no session.
6. Manually navigate to `http://localhost:3000/pt-PT/`. Confirm redirect to login.
   (AC4)

---

### Risks and rollback notes

| Risk | Mitigation |
|------|-----------|
| CI smoke tests break when home page is protected and Supabase returns network error → unauthenticated → redirect to login | This is intentional; the login page still has header/nav/main. Only the "Bem-vindo" check needs updating (Step 9). |
| Supabase `getUser()` in middleware hangs under network failures | Wrap in try/catch; default to unauthenticated on any error. Set a deadline-based fallback if needed. |
| next-intl middleware trying to locale-prefix `/auth/callback` | Excluded from matcher (Step 3). |
| Cookie copying between Supabase response and intl response missing a header | Test with `console.log(response.headers.getSetCookie())` locally; all `Set-Cookie` headers must pass through. |
| `AppHeader` `useTranslations` → `getTranslations` migration breaks i18n | Straightforward API swap; `getTranslations('App')` replaces `useTranslations('App')`. All keys are identical. |
| Real OAuth can't be tested in CI | Accepted; AC2/3/4 documented as manual steps. Infrastructure for mocking OAuth is STORY-02 out-of-scope. |

**Rollback**: if the auth middleware causes regressions, reverting `proxy.ts` to the
original 8-line next-intl-only version restores all prior behaviour instantly. The new
files (login page, callback route, Supabase libs) are additive and do not affect
existing pages when the middleware guard is removed.
