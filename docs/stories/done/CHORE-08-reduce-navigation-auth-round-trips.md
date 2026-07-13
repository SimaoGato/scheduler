# CHORE-08: Reduce sequential Supabase round trips per navigation
Epic: maintenance
Status: won't-do ❌ — superseded by region fix

## Resolution note (2026-07-02)
This chore's own "Technical notes" section flagged a human decision needed
before implementation: confirm Vercel and Supabase project regions are
colocated. On checking, they were **not** — Vercel was deployed in NA while
the Supabase project was in EU. Simão moved the Vercel deployment to EU to
colocate with Supabase.

This almost certainly was the dominant cause of the reported "changing pages
is still very slow" regression, not the sequential-round-trip count this
chore targeted — cross-continent round trips typically add 80-150ms *each*,
compounding across the 3-4 sequential Supabase calls per navigation
identified in this story's Context section.

Decision: close this chore rather than implement the middleware/JWT-check
optimization. The round-trip count is still technically higher than
strictly necessary (3 sequential hops for `/`, 4 for admin pages), but with
regions colocated the absolute latency cost is now small enough that this is
no longer worth the security-sensitive refactor to `proxy.ts` (weakening or
complicating the auth guard for a marginal gain). Revisit only if navigation
still feels slow after the region fix, or if profiling later shows the
round-trip count itself (not latency) is the bottleneck.

## Task
Investigate and reduce the number of *sequential* network round trips to
Supabase incurred on every page navigation. As of 2026-07-02 this is 3 round
trips for a normal page (4 for admin pages) despite CHORE-07's auth-fetch
deduplication — because CHORE-07 only deduplicated calls *within* a single
Server Component render, not across the middleware/page boundary.

## Context
CHORE-07 wrapped `getSessionUser()`/`getUserRole()` in React `cache()`,
cutting the page-render leg of a navigation from ~4-5 Supabase calls to 2
(shared between `AppHeader` and the page component). It explicitly scoped
out the middleware fetch as future work: "Removing the `proxy.ts` middleware
session fetch (it runs in a different Node.js request context and cannot
share the React cache with page renders)."

Verified against the current code (2026-07-02):
- `proxy.ts` runs its own `supabase.auth.getUser()` on every navigation (1
  network round trip to the Supabase Auth server to revalidate the JWT)
  *before* any page code runs.
- The page render (`AppHeader` + `page.tsx`, deduped via `cache()`) then does
  its own separate `getSessionUser()` (1 round trip) + `getUserRole()` (1
  round trip) — unavoidable today because middleware and the Server
  Component render are different Node.js execution contexts and cannot share
  React's per-request cache.
- Admin pages (`admin/people`, `admin/users`) add one more sequential round
  trip for the actual data fetch, which must wait for the role check to
  resolve first (correctly, for security).

So every navigation still costs 3 sequential Supabase network hops (4 for
admin pages). This is the most likely explanation for the user's report that
"changing pages is still very slow" despite CHORE-07 — that chore reduced
the *page-render* leg but didn't touch the *middleware* leg it flagged as
out of scope.

## Acceptance criteria
1. Given the current architecture, when this chore is refined, then the
   implementer documents — via logging/instrumentation, not estimation — the
   exact number of sequential Supabase round trips a navigation to `/` and
   to `/admin/people` currently costs.
2. Given a chosen approach, when implemented, then navigating to `/` costs
   at most 2 sequential Supabase round trips (down from 3), without weakening
   the auth guarantee described in AC3.
3. Given the change, when tested, then an unauthenticated or unauthorized
   user is still blocked at the same point in the request lifecycle as
   today — no regression on the security boundary. This must be explicitly
   verified, not assumed, since the likely approaches touch the auth guard.
4. Given the change, when `npm run lint && npx tsc --noEmit && npm run build
   && npm run test:e2e` run, then all exit 0.
5. Given the change, when navigating between pages against a real, hosted
   Supabase project (not CI placeholders), then the subjective load time is
   measurably improved versus the CHORE-07 baseline — document the
   before/after in the story.

## Out of scope
- Removing the middleware auth check outright — the security boundary must
  remain intact.
- A client-side/SPA navigation architecture change.
- Optimizing the admin data-fetch round trip itself (separate, lower-value
  concern already noted as out of scope in CHORE-07).
- Changing Supabase project region / Vercel deployment region — that's an
  infra decision, not a code chore (see note below).

## Technical notes
- Candidate approaches to evaluate during Refine (this chore does not
  prescribe the solution — it requires a security-aware design decision):
  - A lighter, local JWT-expiry check in `proxy.ts` (no network call) as the
    first gate, relying on the page-level `getSessionUser()`/`getUserRole()`
    (which already does a fully revalidated check) as the source of truth.
    Supabase's own guidance cautions against skipping `getUser()`'s
    server-side revalidation for security-sensitive gating — weigh this
    carefully rather than optimizing blindly.
  - Check whether the installed `@supabase/ssr`/`@supabase/supabase-js`
    version exposes a `getClaims()`-style local JWT verification path that
    could safely replace `auth.getUser()` specifically in the middleware.
- Required reading: `docs/stories/CHORE-07-deduplicate-auth-fetches-with-react-cache.md`
  — this chore is exactly the "future work" it flagged.
- **Human decision needed before implementation**: confirm the Vercel
  deployment region and the Supabase project region are colocated (same
  AWS/GCP region). Cross-region latency compounds on every round trip and no
  code change fixes that — if the two are geographically far apart, that
  alone could explain a large share of the perceived slowness independent of
  round-trip count. Simão should check both dashboards before this chore is
  implemented, so the fix targets the real bottleneck.
- Priority: normal-high — directly reported by the user as an unresolved
  regression despite a prior fix attempt (CHORE-07).

## Definition of Done
See CLAUDE.md.
