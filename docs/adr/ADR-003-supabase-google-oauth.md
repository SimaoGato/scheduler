# ADR-003: Supabase Google OAuth with SSR Session Management

**Status:** Accepted (STORY-02, PR #5)  
**Date:** 2026-06-28  
**Author:** Simão, Agent  
**Related issue:** STORY-02, EPIC-01

## Context

The app requires secure, persistent user authentication so registered users can sign in, stay logged in across sessions, and sign out. The PRD specifies Google OAuth as the sole login method (FR18), eliminating password management.

We need:
1. OAuth provider integration (Google)
2. Persistent session storage that survives page reloads and app restarts
3. Auth middleware that redirects unauthenticated visitors to a login page
4. Server-side and client-side auth primitives for different rendering contexts

Choosing an auth solution early avoids retrofitting session handling, middleware rewrites, or auth library changes after user data is live.

## Decision

Use **Supabase Auth** with **@supabase/ssr** for OAuth and session management, integrated via middleware (`proxy.ts`) for Next.js 16 SSR and server-side rendering.

### Key Design Points

1. **Supabase Auth + Google OAuth**: Supabase Auth is a free-tier service that handles OAuth redirect flows, token exchange, and PKCE. Google is configured as the OAuth provider in the Supabase dashboard. This eliminates the need for a custom auth backend.

2. **Session via HTTP-only cookies**: Supabase Auth stores session tokens in HTTP-only cookies (set during OAuth callback). Subsequent requests automatically include them. The `@supabase/ssr` SDK abstracts cookie handling for both server and browser contexts.

3. **Dual-client pattern**:
   - **Server client** (`createServerClient` from `@supabase/ssr`): For Server Components, Route Handlers, and Server Actions. Uses `next/headers` to read/write cookies synchronously via a writable store (Route Handlers) or read-only store (Server Components).
   - **Browser client** (`createBrowserClient`): For Client Components. Synchronous factory; uses `NEXT_PUBLIC_*` vars.

4. **Session refresh in middleware**: `proxy.ts` wraps the Supabase session refresh in try/catch. On every request, the middleware creates a server client, calls `getUser()`, and copies any new cookies onto the outgoing response. This ensures:
   - New access tokens from refresh flows are sent to the browser.
   - Errors (network, misconfiguration) default to "unauthenticated" rather than throwing 500.
   - The auth guard (redirect to login) applies to all routes consistently.

5. **OAuth callback outside `[locale]`**: The OAuth callback route (`app/auth/callback/route.ts`) lives at the root level (not inside `[locale]`), so Supabase can redirect to `/auth/callback?code=...` without locale context. It exchanges the code for a session and redirects to `/${defaultLocale}/`.

6. **Browser-initiated OAuth**: The sign-in button uses `signInWithOAuth({ provider: 'google', redirectTo: window.location.origin + '/auth/callback' })`. This avoids a `NEXT_PUBLIC_SITE_URL` env var — the redirect target is inferred from `window.location.origin` at runtime. The call is client-side (no server action needed) for simplicity.

## Consequences

### Positive

- **Persistent session**: Tokens stored in HTTP-only cookies; no client-side storage of secrets.
- **Free tier**: Supabase Auth is included in the free project; no additional billing.
- **Zero custom auth backend**: Google OAuth is handled entirely by Supabase. We only validate the session in middleware.
- **Type-safe**: `@supabase/ssr` is typed for both server and browser contexts.
- **Works with next-intl**: Middleware chain: Supabase session refresh → auth guard → next-intl routing.

### Negative / Trade-offs

- **Runtime env vars in CI**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set at **runtime** (not just build time) so middleware can create a server client. In CI, placeholder values are used; real OAuth cannot be tested without a live Supabase project.
- **Session refresh on every request**: The middleware calls `getUser()` on every request, adding latency. This is unavoidable with cookie-based sessions; Supabase handles it efficiently (local token parsing, network refresh only if needed).
- **Coupling to Supabase**: Switching auth providers later requires rewriting middleware, client factories, and all auth-dependent pages. The decision is reversible but not trivial.
- **No client-side logout feedback**: `signOut()` is a server action that always redirects, preventing inline error handling. Users see a brief redirect rather than a spinny button.

### Implementation Notes

1. **Cookie handling in Server Components**: `createServerClient().auth.setAll()` throws if called from a Server Component (read-only cookie store). It only works in Route Handlers (writable store). Server Components that need to refresh session data should call `getUser()` without `setAll`, relying on middleware to handle cookie updates.

2. **Middleware error handling**: Wrapping the **entire** Supabase block (client construction + `getUser()`) in try/catch ensures network errors, missing env vars, and invalid credentials all result in "unauthenticated" (redirect to login), not 500 errors.

3. **Auth guard regex**: Use segment boundary anchors (`/^\/[^/]+\/login(\/|$)/`) not substrings (`/\/login/`), so `/pt-PT/login-admin` does not accidentally bypass the guard.

4. **Middleware matcher**: Exclude `/auth/*` from `config.matcher` so next-intl never tries to locale-prefix the OAuth callback. Document this dependency near `config.matcher` to prevent accidental removal.

5. **Real OAuth cannot be tested in CI**: CI runs with placeholder Supabase credentials (intentionally unreachable). OAuth flows must be tested manually with a real project and `.env.local`. Acceptance criteria AC2, AC3, AC4 are verified manually; automated tests cover the middleware guard and error query params.

## Alternatives Considered

1. **NextAuth.js**: Provides a managed solution but adds a Node.js API layer and database. Overkill for MVP; Supabase Auth is simpler and free.

2. **Custom JWT + refresh flow**: Full control but requires building token validation, refresh logic, and secure storage. Supabase abstracts these; adoption is faster.

3. **Okta, Auth0, or other SaaS**: Feature-complete but paid after a quota. Supabase free tier suits MVP; migration is possible later if needed.

4. **Store session in client state (Context, Zustand, localStorage)**: Unsafe for tokens; HTTP-only cookies are more secure. Supabase enforces this pattern.

## Related

- STORY-02: Google sign-in / sign-out with persistent session
- EPIC-01: Authentication and user provisioning
- STORY-03: User provisioning and role assignment
- Next iteration: mocking OAuth for CI tests (if infrastructure complexity justifies it)

## Acceptance

This decision enables users to sign in with Google, maintain sessions across reloads, and sign out. The Supabase + next-intl + middleware chain is production-ready and covers all acceptance criteria (AC1–AC5). Manual verification steps document the out-of-scope real OAuth flow (AC2, AC3, AC4).
