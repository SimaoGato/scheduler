# ADR-007: Per-Page Admin Guard Convention for Server Components

**Status:** Accepted (STORY-06, PR #14)  
**Date:** 2026-06-29  
**Author:** Simão, Agent  
**Related issue:** STORY-06, EPIC-01

## Context

After user provisioning (STORY-03) assigns roles and server-side enforcement (STORY-04) guards API routes, the frontend must also prevent members from viewing admin-only pages. This is a "belt-and-suspenders" principle: authentication is enforced at the middleware level (`proxy.ts`) for unauthenticated users, but member users who somehow reach an admin URL must be rejected and shown a graceful error message.

Two architectural approaches are available:

1. **Middleware-level guard**: Extend `proxy.ts` to check roles for all `/admin/*` requests, rejecting non-admins before the page renders.
2. **Per-page guard**: Each `app/[locale]/admin/*/page.tsx` checks the user's role and redirects non-admins to the home page with a `?denied=1` query param, which triggers an access-denied banner.

### Key Constraints

- Server Components (pages) are the natural place to fetch the user's role from the database.
- Middleware runs globally on all requests (including static assets, images, health checks), adding latency to non-admin traffic.
- Granular, per-route authorization is easier to audit and maintain than global middleware rules.
- A member reaching an admin URL should see a friendly "access denied" message, not a 403 error page.

## Decision

Use **per-page guards** in each `app/[locale]/admin/*/page.tsx` Server Component. The guard:
1. Fetches the current user and their role via `createClient()` (anon-key + RLS).
2. Checks `if (role !== 'admin') redirect(/${locale}/?denied=1)`.
3. The `?denied=1` param signals the home page to render an access-denied banner.

### Key Design Points

1. **Per-page responsibility**: Each admin page owns its authorization check. This makes the guard explicit and easy to audit: grep for `role !== 'admin'` to find all protected routes.

2. **`?denied=1` redirect pattern**: Redirect to the home page with `?denied=1` rather than rendering a 403 page. This leverages the home page's existing `showDeniedBanner` logic and provides a consistent, friendly UX. The home page must guard the banner with `role !== 'admin'` to prevent admins who happen to visit `/?denied=1` directly from seeing a false denial message.

3. **Guard ordering**: Follow the canonical order in the page component:
   - Fetch the user via `auth.getUser()`
   - Guard: `if (!user) redirect(...)` (null guard before any user.id access)
   - Fetch the role from `public.users`
   - Guard: `if (role !== 'admin') redirect(...)?denied=1)`
   - Proceed with admin-only logic

4. **Idempotent role fetch**: The role query includes `.single()` and wraps in try/catch. If the role row is missing (user not yet provisioned), `role` is null, which fails the `role !== 'admin'` check. The user is redirected gracefully rather than thrown a 500.

5. **Runtime role validation**: Use the ternary pattern (documented in ADR-006) to promote only 'admin' strings; all others are demoted to 'member'. This protects against DB constraint bypasses.

## Consequences

### Positive

- **Clear per-route authorization**: Grepping for `role !== 'admin'` finds all protected routes. No hidden rules in middleware.
- **Graceful member UX**: Non-admins see a friendly "access denied" message on the home page, not a raw 403 error.
- **Defense in depth**: Even if the page guard is somehow bypassed, the Route Handler guards (ADR-006) and RLS policies provide additional layers.
- **Minimal latency impact**: Unauthenticated traffic is still rejected by `proxy.ts` before the page runs; admin checks only run when a page is accessed. Non-admin pages incur no role fetch.

### Negative / Trade-offs

- **Per-page duplication**: Each admin page must include the same guard code. As the admin section grows (EPIC-02, EPIC-03+), this duplication becomes a maintenance burden.
- **No coverage for unauthenticated users**: `proxy.ts` redirects unauthenticated users to login before the page runs; they never reach the per-page guard. This is intentional (let middleware handle auth), but it means the per-page guard only covers members, not unauth.
- **Redirect latency**: A member reaching an admin URL incurs a page render + redirect roundtrip. Middleware-level rejection would fail faster. In practice, the difference is negligible (< 100ms).

## Migration Path

If per-page duplication becomes a burden (e.g., 5+ admin pages), migrate to a middleware-level guard:

1. Extract the per-page guard logic into a `config.matcher` exclusion + middleware logic in `proxy.ts`.
2. The middleware would check `if (pathname.startsWith('/admin') && role !== 'admin') return NextResponse.redirect(...)`.
3. Remove the per-page checks from each admin page.

This migration is non-breaking — the guard behavior (redirect to `/?denied=1`) remains the same.

## Alternatives Considered

1. **Middleware-level `/admin/*` guard**: Reject non-admins in `proxy.ts` before pages render. Pros: centralized, no duplication. Cons: middleware runs on all requests (static assets, images), adding latency to non-admin traffic; harder to audit because rules are distributed across URL matchers; doesn't integrate naturally with the "friendly error message on home page" UX (would need to craft a custom 403 response).

2. **Error boundary in `app/[locale]/admin/layout.tsx`**: A shared layout that guards all child pages. Pros: less code duplication. Cons: layouts are not async by default in Next.js 16; would require converting to an async layout or moving the guard to a thrown error (less explicit); doesn't scale to deeply nested admin sections with different role requirements.

3. **`<ProtectedRoute />` wrapper component**: A Client Component that checks role and shows an error. Cons: Client Components cannot perform DB queries; would require fetching role in a parent Server Component and passing as a prop, complicating the component tree; doesn't prevent the admin page's data fetches from running (wasteful).

4. **Server action with role check**: Defer the guard to a server action called on the client. Cons: poor UX (page renders, then redirects); exposes auth logic to the browser; harder to test.

## Related

- STORY-06: Member "no access yet" state & role-gated navigation
- STORY-04: Server-side role permission enforcement
- STORY-03: User provisioning with role assignment
- ADR-006: Server-side auth guard for Route Handler protection
- EPIC-01: Authentication and authorization

## Acceptance

This convention establishes a clear, auditable pattern for protecting admin pages. Per-page guards are explicit, leverage the existing Server Component pattern, and integrate naturally with a graceful user experience (friendly home-page error message). As the admin section grows, this decision can be revisited for a middleware-level migration if duplication becomes excessive.
