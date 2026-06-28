# ADR-006: Server-side Auth Guard for Route Handler Protection

**Status:** Accepted (STORY-04, PR #11)  
**Date:** 2026-06-28  
**Author:** Simão, Agent  
**Related issue:** STORY-04, EPIC-01

## Context

After user provisioning (STORY-03) assigns a role to each user, the system must enforce authorization at the API layer to prevent Members from calling Admin-only endpoints. Route Handlers (Next.js 16 API routes) are excluded from the middleware matcher and must self-protect.

Two architectural approaches are available:
1. **Reusable guard functions**: Create `requireAuth()` and `requireAdmin()` functions that Route Handlers call before processing requests.
2. **Inline checks**: Each Route Handler duplicates authentication and role-checking logic.

### Key Constraints

- Route Handlers have direct access to request cookies (writable), making them safe for session verification.
- The `createServerClient` from `@supabase/ssr` uses the authenticated session cookie and respects RLS policies.
- Role information is stored in `public.users` and must be queried per-request (no caching).
- Any error (missing env, network failure, invalid session) should fail securely (401) rather than throw a 500.
- TypeScript must narrow security-sensitive return values at the type level, not through bare `as` casts.

## Decision

Create **reusable server-only guard functions** (`lib/auth/guard.ts`) that return a **discriminated union** of success (`AuthUser`) or error (`NextResponse`). Callers use `instanceof NextResponse` to check the response type and propagate errors.

### Key Design Points

1. **Discriminated union via `instanceof NextResponse`**:
   - `requireAuth()` and `requireAdmin()` return either an `AuthUser` object or a `NextResponse` (error).
   - Callers check `if (result instanceof NextResponse) return result` to propagate 401/403 errors.
   - This avoids wrapping every response in `{ ok: boolean; data?: ... }` envelopes and keeps TypeScript inference clean.
   - `instanceof NextResponse` is stable within the Next.js App Router server bundle (single module graph); it does not depend on runtime environment or serialization.

2. **Single try/catch wrapping the entire Supabase block**:
   - The entire block (client construction, `getUser()`, role SELECT) is wrapped in one try/catch.
   - Any error (missing `NEXT_PUBLIC_SUPABASE_URL`, network failure, invalid cookies, missing role row) falls through as a 401 response, not a 500 error.
   - This pattern matches the error handling in `proxy.ts` (middleware) and prevents auth infrastructure failures from exposing stack traces.

3. **Runtime role validation with ternary, not bare `as` cast**:
   - Role validation uses `row.role === 'admin' ? ('admin' as const) : ('member' as const)` instead of `row.role as 'admin' | 'member'`.
   - If a DB value (e.g., from a stale migration or data corruption) bypassed the CHECK constraint and contained an invalid string, the bare `as` would silently carry the garbage through to the type system.
   - The ternary forces validation: only 'admin' is promoted; everything else is demoted to 'member' (safe default).

4. **Server-only guard module**:
   - `lib/auth/guard.ts` begins with `import 'server-only'` to prevent accidental Client Component imports at build time.
   - Guard functions use the session client (`createServerClient` from `@supabase/ssr`), which reads the authenticated user from cookies.

5. **`console.error` in catch blocks**:
   - Unlike middleware (which is global), Route Handlers run per-request with user context.
   - Emit `console.error('[functionName] unexpected error:', err)` in catch blocks so unexpected errors (env, network, auth failures) are logged for investigation.

6. **Guard composition for authorization hierarchy**:
   - `requireAuth()` returns the authenticated user.
   - `requireAdmin()` calls `requireAuth()` internally and checks `role === 'admin'` before returning a 403 (Forbidden) for non-admins.
   - This allows future authorization levels (e.g., `requireCoordinator()`) to extend the pattern without duplicating the authentication logic.

## Consequences

### Positive

- **Centralized, reusable logic**: Future Admin-only routes add a guard in three lines: import, call, propagate error. No duplication.
- **Type-safe error handling**: The `instanceof NextResponse` check is a first-class TypeScript guard; callers cannot accidentally forget to check errors.
- **Secure defaults**: Any error during auth/role lookup returns 401, not a 500 or a success. Matches principle of "fail securely."
- **Defense in depth**: The guard reads the user's role via the authenticated session (anon-key client), which respects RLS policies. Even if the guard code were somehow bypassed, RLS policies in `public.users` enforce authorization at the database layer (AC4).
- **Logging friendly**: Server-side guards are a natural place to emit error logs; provides visibility into auth failures without exposing details to the client.

### Negative / Trade-offs

- **Per-request role lookup latency**: The role is queried from `public.users` on every API call, adding ~10–50ms per request. Caching (e.g., in JWT custom claims) is not implemented; can be added in a later epic if performance becomes a bottleneck.
- **`instanceof NextResponse` stability**: While stable in current Next.js, a future major version could change the class hierarchy. Fallback: if this becomes an issue, switch to a tagged discriminated union (`{ ok: true; user } | { ok: false; response }`) without breaking callers beyond the check expression.
- **Session cookie availability**: Guards assume `next/headers` cookies are available (Route Handler context). They cannot be called from Server Components (read-only cookies) or Client Components (no cookies). The `import 'server-only'` prevents misuse but requires discipline.

## Alternatives Considered

1. **Middleware-based authorization**: Extend `proxy.ts` to check roles for all requests. Cons: middleware is global and runs on all requests (including static assets, health checks); authorization should be granular per endpoint. Would require complex URL matching logic and doesn't improve on reusable guards.

2. **Tagged discriminated union return type**: Return `{ ok: true; user } | { ok: false; response: NextResponse }` instead of `AuthUser | NextResponse`. Pros: no reliance on `instanceof`. Cons: every callsite must destructure or use conditional logic; less ergonomic than `instanceof`.

3. **Error wrapper object**: Return `{ success: boolean; data?: AuthUser; error?: NextResponse }`. Pros: explicit envelope. Cons: callers forget to check `success` field (TypeScript doesn't guard against this); incurs an extra object allocation; requires JSON serialization if error responses are logged.

4. **Service-role elevation for role lookups**: Use the service-role client to bypass RLS and query roles. Cons: would require `SUPABASE_SERVICE_ROLE_KEY` in every API route (credential sprawl); if the key were compromised, all role checks would be worthless; adds unnecessary privilege escalation for a read operation that RLS already permits.

## Related

- STORY-04: Server-side role permission enforcement
- STORY-03: User provisioning with role assignment
- ADR-004: Service-role client and callback-based user provisioning
- EPIC-01: Authentication and authorization

## Acceptance

This decision enables the system to enforce Admin-only access at the Route Handler level with reusable, type-safe guards that fail securely and log errors for visibility. The discriminated union pattern via `instanceof NextResponse` is ergonomic for callers (one line per route), reduces boilerplate, and pairs naturally with database-layer RLS policies for defense in depth.
