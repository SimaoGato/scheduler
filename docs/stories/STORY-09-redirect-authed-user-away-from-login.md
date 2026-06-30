# STORY-09: Redirect authenticated users away from the login page
Epic: EPIC-01
Status: draft

## User story
As a logged-in user, I want to be automatically redirected away from the login
page, so that I never see the login form while already authenticated.

## Context
`proxy.ts` guards unauthenticated users → login, but has no reverse guard.
A logged-in user who reaches `/pt-PT/login` (via back-button, bookmark, or
stale link) sees the authenticated `AppHeader` (correct name, role, sign-out)
alongside the "Entrar no Escala / Continuar com Google" login form — a
contradictory and confusing state. Observed intermittently in production.

Root cause: `proxy.ts` line 49 only checks `!user && !isLoginPath`. There is
no `user && isLoginPath` branch to redirect to home. See also
`app/[locale]/layout.tsx`, which wraps all locale routes (including login) with
`AppHeader`, so the header renders with real auth state regardless of page.

## Acceptance criteria
1. Given a logged-in user, when they navigate directly to `/pt-PT/login` (or
   any locale-prefixed login URL), then they are immediately redirected to the
   home page (`/pt-PT/`) without seeing the login form.
2. Given an unauthenticated user, when they navigate to `/pt-PT/login`, then
   they see the login page normally (no regression).
3. Given a logged-in user who signs out and then navigates to `/pt-PT/login`,
   then they see the login page normally (no regression after sign-out).
4. Given a logged-in user who is redirected from login to home, when the home
   page renders, then it shows their correct member or admin view (no blank or
   error state).

## Out of scope
- Changing the login page layout (removing `AppHeader` from the login route).
- Any new auth flows or OAuth changes.
- Handling the `/auth/callback` route (already excluded from the matcher).

## Technical notes
- Fix is a one-liner in `proxy.ts`: add `if (user && isLoginPath) redirect to
  /${routing.defaultLocale}/` mirroring the existing unauthenticated guard.
- Must copy Supabase cookies onto the redirect response (same pattern as the
  existing unauthenticated redirect at proxy.ts lines 53–58).
- Automated test: Playwright test that visits `/pt-PT/login` with a valid
  session cookie (storage-state fixture) and asserts the page URL is `/pt-PT/`
  and the login form is not visible. If session fixture is unavailable, use an
  HTTP-level test against the middleware response code + Location header.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

**Complexity: `standard`**
Justification: touches auth middleware (`proxy.ts`), which CLAUDE.md explicitly
lists as a reason to classify at least `standard`. Single-file code change, but
auth-adjacent with a regression surface across all protected routes.

### Affected areas
- **backend / middleware**: `proxy.ts` — one new conditional block (~7 lines)
- **tests**: `e2e/login-redirect.spec.ts` — new spec file (AC1 manual, AC2
  automated, AC3 manual, AC4 manual)

### Step-by-step approach

#### 1. Add the reverse guard to `proxy.ts`

Insert the following block immediately after the closing brace of the existing
unauthenticated redirect guard (currently line 59 in `proxy.ts`), before the
`intlMiddleware` call:

```typescript
// Reverse guard: redirect authenticated users away from login
if (user && isLoginPath) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${routing.defaultLocale}/`;
  redirectUrl.search = '';
  const redirectResponse = NextResponse.redirect(redirectUrl);
  supabaseResponse.cookies.getAll().forEach(cookie => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectResponse;
}
```

This exactly mirrors the existing unauthenticated guard pattern (lines 49–58),
reuses the already-computed `isLoginPath` regex result and `supabaseResponse`
cookies, and preserves the cookie-copy convention required by CLAUDE.md.

No new i18n keys are required (this is a server-side redirect with no UI
string).

#### 2. Write `e2e/login-redirect.spec.ts`

Create a new spec file dedicated to STORY-09 coverage. Pattern matches all
existing spec files in `e2e/`.

**AC2 — automated, CI-safe**: Assert that an unauthenticated visit to
`/pt-PT/login` still renders the login page normally (regression guard that
the new branch does not break the `!user && isLoginPath` pass-through path).
This test runs with placeholder Supabase credentials (user = null), so the new
`user && isLoginPath` branch is never taken — but the `!user && isLoginPath`
pass-through remains unblocked, and the test confirms the login form is visible.

**AC1, AC3, AC4 — manual verification**: With placeholder Supabase credentials
in CI, `supabase.auth.getUser()` always returns null; there is no CI-safe way to
inject a valid session. These ACs require a real `.env.local` with Supabase
credentials and a live Google OAuth session. Document manual steps in the spec
file's header comment (following the same pattern as `auth.spec.ts`).

### Test plan mapped to acceptance criteria

| AC | Test type | Rationale |
|----|-----------|-----------|
| AC1: logged-in user → `/pt-PT/login` → redirected to `/pt-PT/` | Manual | Requires real Supabase session; `supabase.auth.getUser()` returns null in CI with placeholder creds. Manual step: sign in, navigate to `/pt-PT/login`, confirm redirect to home. |
| AC2: unauthenticated user → `/pt-PT/login` → login page (no regression) | Automated | CI-safe. `user` is null → new branch not taken → existing pass-through unchanged. Assert login button is visible. |
| AC3: signed-out user → `/pt-PT/login` → login page (no regression after sign-out) | Manual | Requires real OAuth flow. Manual step: sign out, navigate to `/pt-PT/login`, confirm login form renders. |
| AC4: redirected user lands on home showing correct role view | Manual | Requires real session with role-provisioned row. Manual step: as a logged-in member or admin, visit `/pt-PT/login`, confirm redirect to home shows the correct member or admin view. |

### Risks and rollback notes

**Risk 1 — `search = ''` drops query params**: The redirect clears query params
from the login URL (e.g., `/pt-PT/login?error=access_denied`). An authenticated
user who somehow bookmarks `/pt-PT/login?error=access_denied` would lose the
error param on redirect. This is acceptable: authenticated users should never
see login error messages.

**Risk 2 — Redirect target locale**: `routing.defaultLocale` is `'pt-PT'`
(from `i18n/routing.ts`). The redirect target `/pt-PT/` is always valid;
there is no risk of a loop because `/pt-PT/` does not match the `isLoginPath`
regex.

**Risk 3 — Cookie copy with empty supabaseResponse**: If no token refresh
occurred (the common case when the session is still valid), `supabaseResponse
.cookies.getAll()` returns an empty array. The forEach loop is a no-op, which
is correct.

**Rollback**: Remove the single `if (user && isLoginPath)` block from `proxy.ts`
and delete `e2e/login-redirect.spec.ts`. No database migrations or env changes
are involved; rollback is instantaneous.
