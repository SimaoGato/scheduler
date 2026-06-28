# ADR-004: Service-role Client and Callback-based User Provisioning

**Status:** Accepted (STORY-03, PR #6)  
**Date:** 2026-06-28  
**Author:** Simão, Agent  
**Related issue:** STORY-03, EPIC-01

## Context

After a user logs in via Google OAuth (STORY-02), the system must create an application user record with a default role (Member, or Admin for the first user). This record serves as a bridge between the auth identity (email, display name) and application-level permissions.

Two architectural approaches are available:
1. **Callback-based provisioning**: INSERT/UPDATE the user record in `app/auth/callback/route.ts` after successful OAuth session exchange.
2. **Database trigger**: Deploy a Supabase trigger on `auth.users` INSERT to auto-create application records.

Additionally, provisioning must bypass Row Level Security (RLS) policies to work as a system operation, not as the authenticated user.

### Key Constraints

- A service-role key (full database access, bypasses RLS) is available via Supabase dashboard but must never be exposed to the browser.
- The first user to log in should automatically become an Admin (bootstrap); all others are Members.
- If a user logs in before provisioning code is deployed, the provisioning logic must still catch and create their record.
- Migrations use PostgreSQL 15, not 17+.

## Decision

Use **callback-based provisioning** with a **service-role Supabase client** (`createServiceClient` from `@supabase/supabase-js`, not `@supabase/ssr`).

### Key Design Points

1. **Service-role client (lib/supabase/service.ts)**:
   - Use `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` from `@supabase/supabase-js`.
   - Do NOT use `@supabase/ssr` (that package is for auth-aware clients with cookie management; service-role bypasses auth entirely).
   - Add `import 'server-only'` as the first line to prevent accidental browser imports.
   - Create the client lazily inside the function (not at module level) so missing env vars don't throw at module-load time in CI builds with placeholder credentials.

2. **Callback-based provisioning (app/auth/callback/route.ts)**:
   - After `exchangeCodeForSession` succeeds, call `provisionUser(serviceClient, user)` before redirecting to home.
   - Wrap provisioning in try/catch so DB errors (missing table, network failure, bad key) never block the user from reaching home (degraded-mode behavior).
   - Use an upsert pattern: SELECT to check existence, then UPDATE (existing) or INSERT (new).

3. **Bootstrap-first-admin logic**:
   - On new user creation, count all rows in `public.users` table (using `select('*', { count: 'exact', head: true })`).
   - If count === 0, assign role = 'admin'; otherwise role = 'member'.
   - Treat count === null as a fatal error (query itself failed) to prevent incorrect admin promotion.

4. **PostgreSQL 15 compatibility**:
   - Use `DROP POLICY IF EXISTS "name" ON table; CREATE POLICY ...` for idempotent migrations instead of `CREATE POLICY IF NOT EXISTS` (PG17+ only).
   - This pattern allows migrations to be re-run without error.

5. **Type narrowing for optional fields**:
   - Supabase `User.email` is `string | undefined`. Always guard with `if (!user.email) { throw ... }` before DB writes.
   - TypeScript narrows the type after the guard; no casting needed.

6. **Service-role key in CI**:
   - Add `SUPABASE_SERVICE_ROLE_KEY: placeholder` to both Build and Smoke test env blocks in `.github/workflows/ci.yml`.
   - This prevents future gaps when new service-role operations are added; the placeholder allows builds to succeed without real credentials.

## Consequences

### Positive

- **Catches pre-existing auth accounts**: If a user logged in before provisioning code was deployed (e.g., during STORY-02 testing), their `auth.users` row already exists. Callback-based provisioning still catches and creates their application record on next login (idempotent upsert). DB-trigger approach would miss them silently.
- **Graceful degradation**: Provisioning errors (DB, network, bad key) don't block login; user reaches home with an active session. This is preferable to failing the entire OAuth flow.
- **Simple, testable logic**: Callback provisioning is a single function in a Route Handler; easier to test than distributed Supabase trigger logic.
- **Easy audit trail**: All user creation happens in one place, making debugging and auditing straightforward.
- **Bootstrap safety**: Null count is treated as fatal, preventing accidental admin demotion if the count query fails.

### Negative / Trade-offs

- **Service-role key exposure risk**: `SUPABASE_SERVICE_ROLE_KEY` must remain server-only. Mistakes are possible (e.g., logging it, importing into Client Components). The `import 'server-only'` directive provides a type-level guard but not a runtime one.
- **Provisioning latency**: Callback provisioning adds ~100–200ms to the login flow (DB roundtrips). Async/background provisioning is not implemented; every user waits for INSERT/UPDATE.
- **Bootstrap race condition**: Two simultaneous first-logins could both see count = 0 and both receive admin role. Acceptable for MVP (small church, unlikely); can be hardened later with unique constraints or advisory locks if needed.
- **Manual migration application**: Supabase CLI is not configured in this repository. Migrations must be applied manually via the SQL Editor; deployment order (migration first, code second) must be documented and enforced.

### Implementation Notes

1. **`maybeSingle()` for existence check**: Supabase's `.maybeSingle()` returns `{ data: null, error: null }` for zero rows (not an error), and `{ data: null, error: <real error> }` for DB errors. Use `if (existing !== null)` to distinguish "no row" from "query error".

2. **Provisioning errors are non-fatal**: The try/catch around `provisionUser()` logs but does not throw, so the user is always redirected to home. Monitoring/alerts on server logs are needed to detect silent provisioning failures.

3. **Display name fallback**: User metadata may lack `full_name` and `name` fields. Derive display_name as: `user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''`. Empty string is acceptable; STORY-04 (authorization) handles it without UI truncation.

4. **RLS policies for future stories**: The `public.users` table has RLS enabled with a `users_select_own` policy, allowing authenticated users to read their own row. This is pre-work for STORY-04 (authorization checks); it is not dead code.

## Alternatives Considered

1. **Database trigger on `auth.users` INSERT**: Automatically provisions application records when a new auth account is created. Pros: declarative, no callback latency. Cons: misses pre-existing auth accounts (anyone who logged in before the trigger was deployed), harder to debug, harder to add bootstrap logic.

2. **Async background job**: Provision records in a queue (e.g., Vercel background functions) after login completes. Pros: non-blocking, can retry. Cons: added infrastructure, eventual consistency (user's role is initially null), complex error handling, overkill for MVP.

3. **Client-role Supabase client**: Use the regular client with auth awareness. Pros: simpler for prototyping. Cons: RLS policies would need to grant INSERT to unauthenticated users (security issue) or the first-time-user to create their own record (breaks bootstrap logic, requires side channel for "first user" detection).

4. **Trigger + polled background sync**: Deploy a trigger, but also have the callback handler re-check and fill gaps. Pros: handles both cases. Cons: redundant logic, harder to maintain, defeats the purpose of the trigger.

## Related

- STORY-03: Provision user as Member on first login
- STORY-02: Google sign-in / sign-out with persistent session
- EPIC-01: Authentication and user provisioning
- STORY-04: Authorization enforcement (uses RLS policies on `public.users`)
- CHORE-03: Supabase CLI configuration (future milestone)

## Acceptance

This decision enables the system to create application user records for all new users (including those who logged in during beta), assign the first user as Admin (bootstrap), and handle provisioning failures gracefully without blocking login. The callback-based pattern scales to complex provisioning logic (e.g., team assignments in EPIC-02) and provides a single audit point for all user creation.
