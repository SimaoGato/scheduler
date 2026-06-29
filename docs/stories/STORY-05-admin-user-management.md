# STORY-05: Admin user management — list & promote/demote
Epic: EPIC-01
Status: draft

## User story
As an Admin, I want to see all users and promote or demote them between Admin
and Member, so that I can control who can manage the schedule.

## Context
Fifth slice of EPIC-01. The Admin-facing UI on top of the role model (STORY-03)
and enforcement (STORY-04). See PRD §6 (FR19: "Can promote other users to
Admin"; multiple admins allowed) and Epic acceptance signal about the user list
+ last-admin safeguard.

## Acceptance criteria
1. Given an Admin, when they open the user-management screen, then they see a
   list of all users with name, email, and current role.
2. Given a Member in the list, when the Admin promotes them, then their role
   becomes Admin and the change persists across reloads.
3. Given an Admin in the list, when another Admin demotes them, then their role
   becomes Member and the change persists.
4. Given there is exactly **one** remaining Admin, when an Admin tries to demote
   that last Admin, then the action is blocked with a clear pt-PT message and the
   system retains at least one Admin.
5. Given a Member, when they navigate to the user-management screen or call its
   endpoints, then access is denied (reusing STORY-04 enforcement).

## Out of scope
- Inviting/creating users manually (users appear after first Google login).
- Deleting users.
- Linking users to team "people" records (EPIC-02).

## Technical notes
- Admin-gated route + list UI (pt-PT) reading the users table.
- Promote/demote endpoints behind the STORY-04 authorization guard.
- Last-admin safeguard enforced server-side (count of admins > 1 before demote).

## Definition of Done
See CLAUDE.md.

---

## Implementation plan

**Complexity: complex**
Justification: Touches auth (requireAdmin in Route Handlers + role check in a Server Component), data integrity (last-admin safeguard that prevents lockout), and three or more interacting systems (proxy.ts, Server Component SSR with Supabase anon client, API Route Handlers, service-role client for DB mutations, client-side React state).

---

### Affected areas

| Area     | Description |
|----------|-------------|
| frontend | Server Component page (`app/[locale]/admin/users/page.tsx`), Client Component table (`components/UserTable.tsx`), nav link (`components/AppNav.tsx`) |
| backend  | Two API Route Handlers (`app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`) using existing `requireAdmin` guard and service-role client |
| data     | No new migration — `public.users` table and all RLS policies are already in place; role UPDATE goes through service-role client (bypasses RLS) |
| ux       | New i18n keys in `messages/pt-PT.json` under `UserManagement` namespace and one key added to `Nav` |

---

### No DB migration needed

The `public.users` table (created in migration `20260628000001`) already has `id`, `email`, `display_name`, `role`. The RLS policies in `20260628000002` already allow admins to SELECT all rows. Role mutations use `createServiceClient()` which bypasses RLS — no UPDATE policy is required.

---

### Step-by-step implementation

#### Step 1 — i18n keys (prerequisite for all UI work)

Add the following to `messages/pt-PT.json`:

- `Nav.userManagement`: `"Utilizadores"` — nav link label (role-based visibility is STORY-06; the page itself enforces access).
- New `UserManagement` namespace:
  - `title`: `"Gestão de utilizadores"`
  - `columnName`: `"Nome"`
  - `columnEmail`: `"E-mail"`
  - `columnRole`: `"Função"`
  - `roleAdmin`: `"Administrador"`
  - `roleMember`: `"Membro"`
  - `promoteButton`: `"Promover a Administrador"`
  - `demoteButton`: `"Rebaixar a Membro"`
  - `errorLastAdmin`: `"Não é possível remover o único Administrador."`
  - `errorGeneric`: `"Ocorreu um erro. Tente novamente."`
  - `actionLoading`: `"A processar..."`

#### Step 2 — Shared type: UserRow

File: `types/user-management.ts`

Create this file first (no server dependencies — safe for both Server Components and Client Components):

```ts
export interface UserRow {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'member'
}
```

Both `app/[locale]/admin/users/page.tsx` and `components/UserTable.tsx` import from here with `import type { UserRow } from '@/types/user-management'`. The GET route also uses `UserRow` for typing the DB result.

#### Step 3 — API Route: GET /api/admin/users

File: `app/api/admin/users/route.ts`

Pattern: identical to `app/api/admin/ping/route.ts`.

```
1. Call requireAdmin(request); if NextResponse, return it (401/403).
2. const serviceClient = createServiceClient()
3. SELECT id, email, display_name, role FROM public.users ORDER BY display_name ASC
4. Return 200 JSON array typed as UserRow[].
5. On DB error: console.error and return 500.
```

#### Step 4 — API Route: PATCH /api/admin/users/[id]

File: `app/api/admin/users/[id]/route.ts`

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params
  // 1. requireAdmin(request); propagate 401/403.
  // 2. Parse { role } from request.json(); validate it is 'admin' | 'member' (return 400 otherwise).
  // 3. If role === 'member' (demotion):
  //      a. serviceClient.from('users').select('*', { count: 'exact', head: true })
  //             .eq('role', 'admin')
  //      b. If count === null: throw (treat as unknown, return 500).
  //      c. If count === 1: return 409 JSON { error: 'last_admin' }.
  // 4. const { data, error } = await serviceClient
  //       .from('users').update({ role }).eq('id', userId).select()
  //    If error: return 500.
  //    If data.length === 0: return 404 (user not found or not yet provisioned).
  // 5. Return 200 { ok: true }.
}
```

Use runtime role validation: `body.role === 'admin' ? ('admin' as const) : ('member' as const)` after validation.
Wrap in try/catch; log `console.error('[PATCH /api/admin/users/[id]]', err)`.

#### Step 5 — Client Component: UserTable

File: `components/UserTable.tsx`

```tsx
'use client'
// Props: initialUsers: UserRow[]
// State: users (from initialUsers), loadingId (string | null), errorMessage (string | null)

// Renders: <table> with columns Name, Email, Role, Actions
// For each row:
//   - Role label from t('roleAdmin') or t('roleMember')
//   - If role === 'member': button t('promoteButton') → PATCH with { role: 'admin' }
//   - If role === 'admin': button t('demoteButton') → PATCH with { role: 'member' }
//   - Button disabled when loadingId === user.id; shows t('actionLoading')
//   - Buttons use min-h-[44px] for WCAG tap target

// On PATCH success (200): update that row's role in local users state.
// On PATCH 409 (last_admin): set errorMessage to t('errorLastAdmin').
// On other error: set errorMessage to t('errorGeneric').
// Display errorMessage in a div[data-testid="um-error"] above the table.
```

#### Step 6 — Server Component page

File: `app/[locale]/admin/users/page.tsx`

```tsx
// Server Component (no 'use client')
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'
import type { UserRow } from '@/types/user-management'
import UserTable from '@/components/UserTable'

// 1. createClient() → auth.getUser() — proxy.ts already blocked unauthenticated;
//    this is a belt-and-suspenders guard for role.
// 2. If user is null: redirect(`/${routing.defaultLocale}/login`)
//    (null guard runs before any user.id access — mirrors AppHeader pattern)
// 3. Query public.users for role WHERE id = user.id using anon-key client
//    (users_select_own or users_admin_select_all policy covers this).
// 4. If role !== 'admin': redirect(`/${routing.defaultLocale}/`)
// 5. createServiceClient() → SELECT all users ORDER BY display_name.
// 6. Render <UserTable initialUsers={users} />
// 7. Page title from t('UserManagement.title')
```

The proxy.ts already redirects unauthenticated visitors. Steps 1–4 add the belt-and-suspenders null + role check.

#### Step 7 — Nav link

File: `components/AppNav.tsx`

Add a second `<li>` with `<Link href="/admin/users">{t('userManagement')}</Link>` using the same Button variant="ghost" pattern. Role-based hiding is out of scope (STORY-06); the page enforces access.

#### Step 8 — Playwright tests

File: `e2e/user-management.spec.ts`

---

### Test plan (mapped 1:1 to ACs)

**AC1 — Admin sees list of all users (name, email, role)**
- Automated CI: not automatable without a real authenticated admin session. Covered by the AC5-api-list unauthenticated path (HTTP-only) and by manual verification below.
- Manual: sign in as admin, navigate to `/pt-PT/admin/users`, confirm table has columns Name, Email, Role and shows all users in the DB.

**AC2 — Promote Member → Admin (persists)**
- Automated CI: not automatable without a real authenticated admin session. The unauthenticated PATCH 401 path is covered by AC5-api-patch.
- Manual: sign in as admin, click "Promover a Administrador" for a member row, confirm role label changes to "Administrador"; reload page, confirm role is still "Administrador".

**AC3 — Demote Admin → Member (persists)**
- Automated CI: not automatable without a real authenticated admin session. The unauthenticated PATCH 401 path is covered by AC5-api-patch.
- Manual: sign in as admin (with ≥2 admins in DB), click "Rebaixar a Membro" for another admin, confirm role changes and persists after reload.

**AC4 — Last-admin safeguard**
- Automated CI: `PATCH /api/admin/users/{singleAdminId}` with valid admin session is not automatable without real auth. The 409 logic path is unit-testable by inspection (server-side count check before UPDATE).
- Manual: with exactly one admin in DB, click "Rebaixar a Membro" for that admin, confirm error message "Não é possível remover o único Administrador." appears and the role remains "Administrador".

**AC5 — Members denied access**
- Automated CI (page): `GET /pt-PT/admin/users` unauthenticated → redirect to `/pt-PT/login` (proxy.ts, already tested by the smoke suite implicitly; add explicit assertion in user-management.spec.ts).
- Automated CI (API): `GET /api/admin/users` unauthenticated → 401; `PATCH /api/admin/users/any-id` unauthenticated → 401. These are pure HTTP tests with no auth required.
- Manual: sign in as member, navigate to `/pt-PT/admin/users`, confirm redirect to `/pt-PT/` (home); confirm `GET /api/admin/users` returns 403.

**Automated tests in `e2e/user-management.spec.ts`:**
```
test('AC5-api-list: GET /api/admin/users unauthenticated → 401')
test('AC5-api-patch: PATCH /api/admin/users/test-id unauthenticated → 401')
test('AC5-page: GET /pt-PT/admin/users unauthenticated → redirected to login')
```

---

### Ordering constraints

1. i18n keys (Step 1) must be added before any component that calls `useTranslations('UserManagement')` — needed for TypeScript compilation.
2. `types/user-management.ts` (Step 2) must exist before Steps 3–6 compile — both the GET route and the Server Component page and UserTable import `UserRow` from there.
3. API routes (Steps 3–4) can be built in parallel with the client component (Step 5) — they are independent.
4. Server Component page (Step 6) depends on Steps 2–5 being complete.
5. Nav link (Step 7) is independent and can be done any time after the i18n key is added.
6. Tests (Step 8) can be written alongside the implementation and verified last.
7. No migration step — `public.users` table is already live.

---

### Risks and rollback

| Risk | Mitigation |
|------|-----------|
| Server Component role check races with proxy.ts | Belt-and-suspenders: proxy.ts redirects unauthenticated; page redirects non-admin. No race — both checks are sequential in the request lifecycle. |
| Last-admin count race (two admins demoted simultaneously) | Acceptable for this scale (single-admin church app). A database-level CHECK constraint or serializable transaction would be needed to fully prevent it; not required by the AC. |
| `createClient()` cookie reads in Server Component vs Route Handler | Server Components use `next/headers` cookies via `createClient()` (lib/supabase/server.ts) — this is correct and distinct from the Route Handler pattern. AppHeader already uses this pattern successfully. |
| Service-role key absent in CI build | `SUPABASE_SERVICE_ROLE_KEY: placeholder` is already in CI env blocks (per CLAUDE.md) — no action needed. |
| Nav link exposed to members before STORY-06 | Page redirects non-admins. Showing the link to members is a UX gap, not a security gap. STORY-06 addresses it. |

**Rollback:** No migrations to revert. Delete or revert the six new/modified files (`types/user-management.ts`, two API route files, `components/UserTable.tsx`, the page, `components/AppNav.tsx`). The existing `public.users` table and RLS policies are unaffected.
