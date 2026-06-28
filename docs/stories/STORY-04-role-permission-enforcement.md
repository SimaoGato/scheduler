# STORY-04: Server-side role permission enforcement
Epic: EPIC-01
Status: in-progress

## User story
As the coordinator, I want Admin-only actions to be blocked for Members on the
server, so that permissions are actually secure and not just hidden in the UI.

## Context
Fourth slice of EPIC-01. Turns the role field (STORY-03) into enforced
authorization. See PRD §6 (FR19) and Epic acceptance signal: "permission checks
block Members from Admin-only actions (server-enforced, not just UI)".

## Acceptance criteria
1. Given a Member's authenticated session, when they call an Admin-only endpoint
   /action, then the server rejects it with an authorization error (e.g. 403)
   and performs no change.
2. Given an Admin's authenticated session, when they call the same Admin-only
   endpoint, then the action is permitted.
3. Given an unauthenticated request, when it hits any protected endpoint, then
   it is rejected with an authentication error (e.g. 401) before any role check.
4. Given the data layer, when a Member attempts to read or write data they are
   not authorized for, then it is denied at the database/row-security level
   (defense in depth), not only in application code.
5. Given a reusable authorization guard, when applied to an endpoint, then it
   centralizes the Admin/Member check so future endpoints can adopt it
   consistently.

## Out of scope
- The specific Admin screens/actions (STORY-05 and later epics).
- UI gating / "no access" experience (STORY-06).

## Technical notes
- Reusable server-side guard/middleware reading the user's role.
- Supabase Row Level Security policies for defense-in-depth at the DB layer.
- Provide at least one representative Admin-only endpoint to test against
  (can be a stub if no real Admin action exists yet).

## Definition of Done
See CLAUDE.md.

## Implementation plan

### Complexity tag

**complex** — touches the auth/security layer (session verification), data integrity
(Supabase RLS with a SECURITY DEFINER function), and three interacting modules
(lib/auth guard, Route Handler, supabase/migrations).

---

### Affected areas

- **backend** — new Route Handler (`app/api/admin/ping/route.ts`), new guard
  module (`lib/auth/guard.ts`)
- **data** — new Supabase migration adding a SECURITY DEFINER helper function and
  two RLS policies on `public.users`
- **infra** — no CI changes required (migration picked up automatically by the
  existing `migrate` job)

---

### Key design decisions

**Why `proxy.ts` does not cover this story**  
The proxy.ts matcher already excludes `/api` (see `matcher:
['/((?!api|auth|_next|_vercel|.*\\..*).*)',]`). Page routes are protected by
proxy.ts; API routes must self-protect. This story introduces the guard that
API routes will call.

**Guard API — discriminated union via `instanceof NextResponse`**  
Each guard function returns either a plain object (`AuthUser`) or a `NextResponse`
(error). Callers check `if (result instanceof NextResponse) return result`. This
avoids wrapping every response in an `{ ok: boolean }` envelope and keeps TypeScript
inference clean.

**Role lookup uses the anon/cookie client, not the service-role client**  
The guard calls `createClient()` (from `lib/supabase/server.ts`), which uses
the session cookie. The existing `users_select_own` RLS policy already allows
an authenticated user to read their own row, so `SELECT role FROM public.users
WHERE id = auth.uid()` succeeds without service-role elevation.

**RLS `get_my_role()` — SECURITY DEFINER prevents infinite recursion**  
The `users_admin_select_all` policy needs to read `public.users` to learn the
current user's role. Reading `public.users` from inside an RLS policy on
`public.users` would recurse infinitely under the invoker's security context
(RLS evaluates again). The `SECURITY DEFINER` attribute makes the function run
as `postgres` (bypassing RLS), so the internal look-up succeeds without
recursion. `SET search_path = ''` is added to prevent search-path injection.

**Migration timestamp**  
Existing migration: `20260628000001_create_users_table.sql`.
New migration: `20260628000002_rls_admin_policies.sql`.

**No i18n strings needed**  
The stub endpoint returns JSON (`{ "error": "Unauthorized" }` / `{ "error":
"Forbidden" }` / `{ "ok": true }`). These are machine-readable API responses,
not UI text. i18n error pages are STORY-06 scope.

---

### Files to create

| Path | Purpose |
|------|---------|
| `lib/auth/guard.ts` | Reusable server-only guard (AC5) |
| `app/api/admin/ping/route.ts` | Stub Admin-only Route Handler (AC1, AC2, AC3) |
| `supabase/migrations/20260628000002_rls_admin_policies.sql` | DB-level enforcement (AC4) |
| `e2e/role-enforcement.spec.ts` | Playwright tests for this story |

### Files to modify

None — no existing files need changes.

---

### Step-by-step implementation (test-first)

#### Step 1 — Write the Playwright test file (test-first)

Create `e2e/role-enforcement.spec.ts`. Write all automated tests first; they
will fail until Steps 2–3 are done.

Automated test (works with placeholder Supabase credentials, no real session):

```ts
// AC3: unauthenticated request → 401 (not 302/redirect; API routes return JSON)
test('AC3: unauthenticated GET /api/admin/ping returns 401', async ({ request }) => {
  const response = await request.get('/api/admin/ping')
  expect(response.status()).toBe(401)
  const body = await response.json()
  expect(body).toHaveProperty('error')
})
```

Manual verification steps for AC1, AC2, AC4 are documented in the same file as
spec comments (same pattern used in `e2e/provision.spec.ts` and `e2e/auth.spec.ts`).

#### Step 2 — Create `lib/auth/guard.ts`

```ts
import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export interface AuthUser {
  user: User
  role: 'admin' | 'member'
}

/**
 * requireAuth — Resolves the authenticated user and their role from public.users.
 * Returns AuthUser on success.
 * Returns a 401 NextResponse if no session or role row is missing.
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (roleError || !row) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { user, role: row.role as 'admin' | 'member' }
}

/**
 * requireAdmin — Like requireAuth but additionally enforces role === 'admin'.
 * Returns a 401 NextResponse if no session.
 * Returns a 403 NextResponse if authenticated but role !== 'admin'.
 */
export async function requireAdmin(): Promise<(AuthUser & { role: 'admin' }) | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result   // 401

  if (result.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return result as AuthUser & { role: 'admin' }
}
```

Key invariants:
- `import 'server-only'` prevents accidental import in Client Components.
- Both functions are async; no module-level state.
- Callers distinguish error from success with `instanceof NextResponse`.

#### Step 3 — Create `app/api/admin/ping/route.ts`

```ts
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'

export async function GET() {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  return NextResponse.json({ ok: true, role: result.role })
}
```

After this step, run:
- `npx tsc --noEmit` → must exit 0
- `npm run lint` → must exit 0
- `npm run test:e2e` → AC3 automated test must now pass

#### Step 4 — Create the Supabase migration

Create `supabase/migrations/20260628000002_rls_admin_policies.sql`:

```sql
-- STORY-04: RLS helper function and admin-read policy for public.users
--
-- HOW TO APPLY:
--   Applied automatically by the `migrate` CI job on merge to main.
--   Idempotent: uses CREATE OR REPLACE (function) and
--   DROP POLICY IF EXISTS + CREATE POLICY (policies).

-- -----------------------------------------------------------------------
-- Helper function: read the current user's role bypassing RLS.
-- SECURITY DEFINER runs as the function owner (postgres), preventing
-- infinite recursion when this function is called from an RLS policy on
-- the same table.
-- SET search_path = '' prevents search-path injection.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

-- -----------------------------------------------------------------------
-- Admins can SELECT all rows in public.users.
-- Members are limited to their own row by the existing users_select_own
-- policy (applied in migration 20260628000001).
-- No UPDATE/DELETE policy is added: mutations go only through the
-- service-role client (callback route), which bypasses RLS. This is the
-- defense-in-depth guarantee — anon-key clients cannot mutate user rows.
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "users_admin_select_all" ON public.users;
CREATE POLICY "users_admin_select_all" ON public.users
  FOR SELECT
  USING (public.get_my_role() = 'admin');
```

This migration is idempotent and PG17-compatible.

#### Step 5 — Run all quality gates

```
npm run lint          # must exit 0
npx tsc --noEmit      # must exit 0
npm run build         # must exit 0
npm run test:e2e      # must exit 0; AC3 automated test passes
```

---

### Test plan mapped to each AC

| AC | Test type | Location | What is verified |
|----|-----------|----------|-----------------|
| AC1 (Member → 403) | Manual | `e2e/role-enforcement.spec.ts` comment block | Real session as Member; GET /api/admin/ping returns 403 |
| AC2 (Admin → 200) | Manual | `e2e/role-enforcement.spec.ts` comment block | Real session as Admin; GET /api/admin/ping returns 200 and `{ ok: true }` |
| AC3 (unauth → 401) | Automated (Playwright) | `e2e/role-enforcement.spec.ts` | No session; GET /api/admin/ping returns 401 JSON with CI placeholder creds |
| AC4 (DB RLS) | Manual | `e2e/role-enforcement.spec.ts` comment block | Browser fetch as Member vs Admin proves RLS; no UPDATE policy = deny by default |
| AC5 (reusable guard) | TypeScript + code review | `lib/auth/guard.ts` usage in route | `requireAdmin()` is the single call site; adding to future routes is one import + one `if (result instanceof NextResponse) return result` line |

**Manual verification steps for AC1 (Member → 403):**
1. Ensure a user exists with `role = 'member'` in public.users (any non-first login account).
2. Sign in with that Google account. Session cookie is now active.
3. Open browser DevTools → Network tab.
4. Navigate to any page (session cookie is sent automatically).
5. In the browser console: `fetch('/api/admin/ping').then(r => console.log(r.status, r.json()))`.
6. Confirm status is 403.
7. Confirm no data was mutated (the stub only reads, so nothing to check, but the 403 itself is the proof).

**Manual verification steps for AC2 (Admin → 200):**
1. Sign in with a Google account whose row has `role = 'admin'`.
2. In the browser console: `fetch('/api/admin/ping').then(r => r.json()).then(console.log)`.
3. Confirm status is 200 and body is `{ "ok": true, "role": "admin" }`.

**Manual verification steps for AC4 (RLS):**
Note: Do NOT use the Supabase SQL Editor for this — it runs as the postgres
superuser, which bypasses RLS entirely. Use the browser console with the
authenticated session cookie instead.

1. Sign in as a Member user.
2. Open browser DevTools console on any app page.
3. Run: `fetch('/api/admin/ping').then(r => r.json()).then(b => console.log(b))`.
   Confirm status 403 — proves the application-layer guard works.
   The guard reads `public.users` as the authenticated user via the anon-key
   client, which means the `users_select_own` RLS policy is active. The guard
   returns `role = 'member'` → 403. This is the defense-in-depth guarantee.

4. Sign in as an Admin user.
5. Run the same fetch — confirm 200 `{ ok: true, role: 'admin' }`.
   The `users_admin_select_all` RLS policy (added in migration 20260628000002)
   allows the admin's anon-key client to read all rows.

6. To verify the UPDATE denial: no UPDATE policy exists on `public.users`, so
   all UPDATE attempts via the anon-key client are denied by RLS deny-by-default.
   This is structural (the migration itself is the evidence — no UPDATE policy
   was created). There is no safe way to test UPDATE denial from the browser
   without exposing the anon key directly, which is equivalent to what the
   server-side guard already does.

---

### Risks and rollback notes

**Risk: `get_my_role()` called in RLS causes performance overhead**  
The function does a point-query by primary key (`WHERE id = auth.uid()`), which
hits the PK index. The overhead is one extra index scan per row in queries that
evaluate `users_admin_select_all`. Acceptable for the current scale (church
of tens of members). If it becomes a concern, the role can be promoted to a JWT
custom claim in a later epic.

**Risk: guard reads stale role after a role change**  
The role is read from `public.users` on every request (no caching). A role
downgrade takes effect immediately on the next API call. This is the correct
and safe behaviour.

**Risk: `instanceof NextResponse` check breaks if Next.js changes `NextResponse`**  
This is a stable Next.js API. If it becomes an issue, switch the guard return
type to a tagged discriminated union `{ ok: true; ... } | { ok: false; response:
NextResponse }` without touching callers beyond the check expression.

**Rollback**  
- The migration adds no destructive changes (no DROP TABLE, no column changes).
  Rolling back means dropping the `get_my_role` function and the
  `users_admin_select_all` policy, which restores exactly the STORY-03 state.
- The guard and Route Handler are new files; deleting them is a complete rollback
  with no side effects on existing pages or routes.
