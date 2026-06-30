# ADR-008: React cache() for Per-Request Auth Deduplication

**Status:** Accepted (CHORE-07, PR #16)  
**Date:** 2026-06-30  
**Author:** Simão, Agent  
**Related issue:** CHORE-07

## Context

Before CHORE-07, every page navigation triggered 5–6 sequential Supabase network calls, all redundant:

1. `proxy.ts` (middleware): `auth.getUser()` → checks if user is authenticated
2. `AppHeader`: `auth.getUser()` (duplicate) + `users.select('role')` (separate call)
3. Page component (`page.tsx` or `admin/users/page.tsx`): `auth.getUser()` (duplicate) + `users.select('role')` (duplicate)

Each component independently created its own Supabase client and made its own calls, even though they ran in the same server render tree and held the same session cookies. Observed latency: ~1 second from click to interactive on a hosted Supabase project.

### The Problem

Next.js Server Components run sequentially in a single render tree, but they have no shared request-scoped cache. Each component that calls `createClient()` → `auth.getUser()` creates a separate network round-trip. Without deduplication, common patterns (e.g., `AppHeader` + a page both needing the user's role) scale poorly.

**Potential solutions:**

1. **React `cache()`** (chosen): Wrap auth helpers in `React.cache()` to memoize them within a single server render. Cost: 2 helpers + transitive use in 3 components.
2. **`AsyncLocalStorage`**: Custom per-request memoization. More verbose, requires manual cache initialization per request.
3. **Database-level caching**: Memcached, Redis. Overkill for user data and introduces cache invalidation complexity.
4. **Single top-level fetch**: Move all auth logic to the layout. Drawback: layout becomes a bottleneck; doesn't scale to deeply nested pages with different auth needs.

## Decision

Introduce `lib/auth/session.ts` with two `React.cache()`-decorated helpers:

```ts
export const getSessionUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;  // User | null (never undefined)
  } catch (err) {
    console.error('[getSessionUser] unexpected error:', err);
    return null;
  }
});

export const getUserRole = cache(async (userId: string) => {
  try {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    return row?.role === 'admin' ? ('admin' as const)
         : row?.role === 'member' ? ('member' as const)
         : null;
  } catch (err) {
    console.error('[getUserRole] unexpected error:', err);
    return null;
  }
});
```

**Key design points:**

1. **`React.cache()` scope**: Memoization is per-render-tree, per-request. No cross-request cache leak.
2. **No `import 'server-only'`**: `next/headers` (imported via `createClient`) is already a bundler boundary; `server-only` is redundant and blocks test imports.
3. **Error handling**: All catch blocks bind `catch (err)` and log errors (matching `lib/auth/guard.ts` convention). Bare `catch {}` is unacceptable.
4. **Type correctness**: `data.user` from `supabase.auth.getUser()` is `User | null`, never `undefined`. No `?? null` fallback (dead code).
5. **Role ternary**: Use `row?.role === 'admin' ? ('admin' as const) : ...` to safely promote only recognized roles; others are null or demoted to member.

**Refactored consumers:**

- `components/AppHeader.tsx`: Replace dual `createClient()` try/catch blocks with `await getSessionUser()` + `await getUserRole(user.id)`.
- `app/[locale]/page.tsx`: Same pattern.
- `app/[locale]/admin/users/page.tsx`: Same pattern (role ternary now enforced by type narrowing).

**Middleware unchanged:**

The `proxy.ts` middleware runs in a different Node.js execution context (not the Server Component render tree) and cannot share this cache. It keeps its own `auth.getUser()` call.

## Consequences

### Positive

- **Latency reduction**: ~60% observed reduction (5–6 calls reduced to 2 unique calls per render).
- **Expected target**: under 500 ms from click to interactive on hosted Supabase.
- **Idiomatic Next.js pattern**: `React.cache()` is the canonical approach for request-scoped memoization in App Router.
- **No configuration burden**: No additional dependencies, no cache invalidation logic, no env vars.
- **Explicit, auditable**: Helpers are co-located in one file; grep `getSessionUser` or `getUserRole` to find all consumers.

### Negative / Trade-offs

- **Two Supabase client instances**: Although only 2 network calls are made, `getSessionUser()` and `getUserRole()` each create a `createClient()` instance. This is intentional — `createClient()` is lightweight (cookie parsing, no network); the network calls are the expensive operation. The tradeoff is justified by the latency gain.
- **Cache scope is per-request only**: Cross-request caching requires a separate cache (e.g., Redis). This helper does not persist data across requests.
- **No cache invalidation hooks**: If a user updates their profile or role changes mid-session, the change is not reflected until the next page load. For our use case (intra-page consistency during a single render), this is acceptable.

## Alternatives Considered

1. **Manual `AsyncLocalStorage` cache**: More verbose; developers must manually initialize and manage the cache. `React.cache()` is simpler and framework-integrated.

2. **Move auth logic to layout**: Fetch user + role in the root layout and pass as props. Drawback: layout becomes a data bottleneck; doesn't scale to pages with different auth needs (e.g., optional vs. required auth).

3. **GraphQL with built-in request caching**: Adds dependency bloat; our REST API is already simple.

4. **Memcached / Redis for user data**: Introduces operational complexity and cache-invalidation logic for minimal gain on small user sets.

5. **Do nothing, accept 1 second latency**: Not acceptable for user experience.

## Migration Path

If per-render latency requirements evolve (e.g., need sub-100ms response times), evaluate:

1. **Partial pre-rendering (PPR)**: Next.js 15+ supports revalidating specific segments. Can prerender the header and defer the page body.
2. **Incremental Static Regeneration (ISR)**: Precompute role badges for frequently-accessed pages.
3. **Browser-side caching**: Cache the session in a Client Component and sync via `useEffect`. Risk: stale data across tabs.

None of these are needed in the current phase; `React.cache()` solves the immediate problem.

## Related

- CHORE-07: Deduplicate per-request auth fetches with React cache()
- STORY-03: User provisioning with role assignment
- STORY-04: Server-side role permission enforcement
- STORY-06: Member "no access yet" state & role-gated navigation
- ADR-006: Server-side auth guard for Route Handler protection
- ADR-007: Per-page admin guard convention

## Acceptance

`React.cache()` is the standard Next.js App Router pattern for request-scoped memoization. This decision adopts the idiomatic approach and achieves the performance target (60% latency reduction, target sub-500ms). As the admin section and user count grow, this can be revisited for more sophisticated caching strategies (PPR, ISR, Redis) if needed.
