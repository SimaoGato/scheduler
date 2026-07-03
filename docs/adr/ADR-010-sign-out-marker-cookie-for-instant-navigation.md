# ADR-010: Sign-out Marker Cookie for Instant Navigation

**Status:** Accepted (STORY-15, PR #24)  
**Date:** 2026-07-03  
**Author:** Simão, Agent  
**Related issue:** STORY-15, EPIC-01

## Context

After successful OAuth login, users expect clicking "Sign out" to navigate to the login page immediately. The current implementation awaits `supabase.auth.signOut()` (a network call to Supabase Auth) before the browser navigates, creating a noticeable delay.

### The Race Condition

The core problem is a structural race between client-side navigation timing and server-side session state:

1. **Client side**: User clicks "Sign out" → browser fetches a Server Action → Server Action calls `supabase.auth.signOut()` (network) → eventually returns → browser navigates.
2. **Server side (proxy.ts middleware)**: Every request checks `user` via `supabase.auth.getUser()`, which reads the session cookie. The cookie is only cleared *after* the revoke call completes.
3. **The race**: While the revoke call is in flight, the session cookie is still valid. If the browser navigates to `/login` before the revoke completes, proxy.ts's reverse-guard (`if (user && isLoginPath) redirect('/') `) bounces the login page back to home.

### Why Timeouts Don't Work

A first approach attempted `Promise.race([supabase.auth.signOut(), timeout(300)])`: cancel waiting on the network and navigate after 300 ms. However:

- `GoTrueClient._signOut()` never clears the session cookie until *after* the network call resolves. No synchronous local clear exists.
- The in-memory session state (`__loadSession()`) always re-reads from the browser's storage adapter; shortcuts do not exist.
- When network latency exceeds the timeout (common under throttled/real-world conditions), the cookie is still valid when proxy.ts reads it, and the bounce-back happens.
- This is not a "rarely happens under perfect network" edge case — it's deterministic whenever the threshold is exceeded, which the story's acceptance criteria specifically tested for (3-second artificial delay to simulate slow networks).

## Decision

**Use a client-set marker cookie to inform proxy.ts's auth guards, rather than racing the real Supabase revoke call.**

### Design

1. **Client side (components/UserWidgetMenu.tsx)**:
   - On sign-out click, synchronously set a short-lived first-party marker cookie: `app-signout-pending=1; path=/; max-age=15; SameSite=Lax; Secure`.
   - This write is pure JavaScript, zero network, zero wait.
   - Immediately navigate via `router.push('/login')`.
   - Fire the real `signOut()` Server Action without awaiting (background cleanup).

2. **Middleware (proxy.ts)**:
   - Read the marker cookie on every request.
   - If present, skip the Supabase `getUser()` call entirely and treat `user` as `null` for that request.
   - Proceed to the existing guard logic with `user = null`.
   - The reverse-guard (`if (user && isLoginPath)`) will not fire, allowing login to render.
   - The forward-guard (`if (!user && !isLoginPath)`) will continue to work for protected routes.

3. **OAuth callback (app/auth/callback/route.ts)**:
   - Clear the marker on every response (all exit points: error paths, success path, fallback).
   - Use a helper function `clearSignoutMarker(response)` and apply it to all redirect statements.
   - This prevents a sign-out-then-immediate-re-login from being shadowed by a stale marker from the previous sign-out.

4. **Shared constants (lib/auth/signout-marker.ts)**:
   - Export `SIGNOUT_MARKER_COOKIE` and `SIGNOUT_MARKER_MAX_AGE_SECONDS` for import by all three sites.
   - Ensures single source of truth for the marker name and lifetime.

### Why This Approach Is Secure

The marker only ever moves the auth guards in the stricter (logged-out) direction. At worst, a forged or stale marker causes a valid session to be treated as logged-out for a bounded time, which is a UX annoyance (user sees login, has to reload), never a privilege escalation. The marker cannot be used to gain access to anything.

### Why 15 Seconds

The 15-second max-age bounds the window in which a genuinely hung/failed real `signOut()` (e.g., total network outage) could leave the session cookie valid after the marker expires. This is a documented, bounded residual risk tied to actual signOut failure (a scenario the story's acceptance criteria already flags as "swallow and log"), not to ordinary network slowness. The story's design closes the gap for any network delay; the 15-second bound is only for the edge case of total failure beyond that.

### Why Not Just Clear the Real Cookie Synchronously

The Supabase auth JS client does not expose a synchronous local-only clear method; `_removeSession()` only runs after the network call. Even if it did, the Guard-vs-Network race would remain unless middleware had a way to know about local-only clears, which it doesn't (middleware sees the real cookie as-is every request, not a local JS variable).

## Consequences

### Positive

- **Instant navigation**: Sign-out navigates to login immediately, before the server-side revoke is complete. UX is snappy and responsive.
- **Deterministic correctness**: Both auth guards (forward and reverse) are driven by the same `user` variable. Setting the marker synchronously ensures both guards behave correctly, not just "most of the time."
- **No new privilege-escalation surface**: The marker can only enforce stricter auth, never grant access.
- **Clean decoupling**: The real `signOut()` cleanup still happens; it's now purely background. No change to the revocation/invalidation semantics.
- **Cross-cutting coordination**: The pattern (client sets, middleware reads, callback clears) is simple to audit and understand.

### Negative / Trade-offs

- **Middleware now depends on a client-set signal**: The `proxy.ts` reverse-guard behavior is now dependent on the client's ability to set a cookie before navigating. If the marker write fails (e.g., non-secure context when `Secure` flag is used), the bounce-back can still happen. Mitigated by a defensive readback and `console.error` in the client code.
- **Marker must be cleared on every login path**: Forgetting to clear the marker in `app/auth/callback/route.ts` on one response path would cause that path to leave the marker set, shadowing a subsequent login. Mitigated by wrapping all redirect statements through a helper function.
- **Bounded residual risk on total failure**: If `signOut()` hangs/fails for >15 seconds, a subsequent request to a protected route after the marker expires could incorrectly succeed if the real session cookie is still somehow valid. This is an edge case and is documented in CLAUDE.md.

## Alternatives Considered

1. **Middleware-level signout status tracking**: Have middleware maintain a per-session signout flag in a store. Cons: introduces state management and cache invalidation complexity; unclear how to trigger the flag from the client; tied to session duration (hard to reason about).

2. **Just wait for the signOut network call with a longer timeout**: `Promise.race([signOut(), timeout(5000)])`. Cons: still races the network and fails under realistic conditions (the story's own test proved this with a 3-second artificial delay); window just gets pushed to a different threshold; users experience latency up to the timeout.

3. **Service-side signout-pending flag (e.g., Redis entry)**: Have the Server Action set a short-lived flag on the server after calling signOut, then have middleware check this flag. Cons: requires additional server state (Redis or equivalent); adds latency to the Server Action response; doesn't actually solve the problem (the flag still needs to be checked and cleared with the same race timing).

4. **Remove the reverse-guard entirely**: Just let authenticated users see the login page. Cons: breaks a sensible UX guard (prevents users from accidentally landing on login when they're already signed in); doesn't address the underlying race for protected routes (AC2 still requires forward-guard behavior).

5. **Use a separate sign-out confirmation page**: Navigate to a confirmation page first, which can wait for signOut() before proceeding to login. Cons: adds an extra step, defeating the "instant" UX goal; doesn't solve the underlying design problem.

## Related

- STORY-15: Make sign-out feel instant
- STORY-09: Redirect authenticated users away from login (established the reverse-guard pattern)
- ADR-006: Server-side auth guards for Route Handler protection (establishes guard patterns in this codebase)
- ADR-004: Service-role client and callback-based user provisioning (establishes callback-route provisioning pattern)

## Acceptance

This decision enables sign-out to feel instant without changing the security semantics of session invalidation. The marker-cookie coordination pattern is deterministic and auditable. The pattern is simple enough to replicate if other sign-out flows (e.g., auto-logout on token expiry) are added in future stories.
