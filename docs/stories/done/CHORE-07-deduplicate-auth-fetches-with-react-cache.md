# CHORE-07: Deduplicate per-request auth fetches with React cache()
Epic: maintenance
Status: done ✅
PR: 16

## Task
Eliminate redundant Supabase network calls on every page render by wrapping
the session and role fetches in React `cache()`-decorated helpers. Every
navigation currently fires 5–6 sequential round-trips to Supabase; this chore
reduces that to 2 (one `auth.getUser()` + one role lookup), shared across
the entire Server Component render tree for a given request.

## Context
`AppHeader.tsx` and each page component (`page.tsx`, `admin/users/page.tsx`)
independently call `createClient()` → `auth.getUser()` and
`createClient()` → `from('users').select('role')`. Because there is no
request-scoped cache, these are separate network calls even though they run
in the same render tree with the same cookies.

Current call count per navigation:
- middleware (`proxy.ts`): 1× `auth.getUser()`
- `AppHeader`: 1× `auth.getUser()` + 1× role lookup (both duplicates)
- `page.tsx` or `admin/users/page.tsx`: 1× `auth.getUser()` + 1× role lookup
  (all duplicates) + 1× all-users fetch (admin page only)

Total: 5 sequential calls on home page, 6 on admin page → ~1 s observed
latency. React `cache()` deduplicates to 2 unique calls shared across
`AppHeader` + the page, cutting render time by ~60 %.

The CLAUDE.md already notes: "independent role fetches should be consolidated
with React cache() in a future story."

## Acceptance criteria
1. Given a logged-in admin navigating to the home page, when the page renders,
   then only **one** `auth.getUser()` call and **one** `users.select('role')`
   call are made to Supabase (verifiable via Supabase dashboard logs or
   `console.log` instrumentation during development).
2. Given a logged-in admin navigating to `/admin/users`, when the page renders,
   then the same deduplication holds — two unique auth calls total for the
   render, not four.
3. Given any navigation, when the page loads, then the subjective response time
   is noticeably faster than the pre-chore ~1 s baseline (target: under 500 ms
   from click to interactive on a hosted Supabase project in the same region).
4. Given any navigation, when the page renders, then the displayed user name,
   role label, and nav links are correct and unchanged (no regression).
5. Given all quality gates, when `npm run lint && npx tsc --noEmit &&
   npm run build && npm run test:e2e` run, then all exit 0.

## Out of scope
- Removing the `proxy.ts` middleware session fetch (it runs in a different
  Node.js request context and cannot share the React cache with page renders).
- Caching the all-users list on the admin page (separate concern, lower value).
- Client-side navigation / partial pre-rendering (larger architectural change).
- Reducing the sign-out round-trip (already minimal: one `signOut` call +
  redirect; negligible compared to page render latency).

## Technical notes
- Create `lib/auth/session.ts`:
  ```ts
  import { cache } from 'react';
  import { createClient } from '@/lib/supabase/server';

  export const getSessionUser = cache(async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    } catch {
      return null;
    }
  });

  export const getUserRole = cache(async (userId: string) => {
    try {
      const supabase = await createClient();
      const { data: row } = await supabase
        .from('users').select('role').eq('id', userId).single();
      return row?.role === 'admin' ? ('admin' as const)
           : row?.role === 'member' ? ('member' as const)
           : null;
    } catch {
      return null;
    }
  });
  ```
- `AppHeader.tsx`, `page.tsx`, and `admin/users/page.tsx` replace their
  inline `createClient()` + try/catch auth blocks with calls to
  `getSessionUser()` and `getUserRole(user.id)`.
- `React.cache()` scopes the memoisation to a single server request — there
  is no cross-request cache leak risk.
- `lib/auth/session.ts` must NOT have `import 'server-only'` — it uses
  `next/headers` transitively via `createClient`, which is already
  server-only. Adding `server-only` would block it from being imported in
  test files.
- The middleware (`proxy.ts`) cannot use this cache (different execution
  context) and keeps its own `auth.getUser()` call.
- Verify: temporarily add `console.log('[session] getUser called')` inside
  `getSessionUser` during development; with `cache()` it should log exactly
  once per page render even though two components call it.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Verification findings

The following was confirmed against the live codebase before writing this plan:

- **`lib/auth/`** exists and contains only `guard.ts`. `session.ts` does not
  exist yet and must be created.
- **`AppHeader.tsx`** (`components/AppHeader.tsx`): calls `createClient()` +
  `auth.getUser()` in one try/catch, then a separate `createClient()` +
  `from('users').select('role').eq('id', user.id).single()` in a second
  try/catch. Returns `role` as `'admin' | 'member' | null`.
- **`page.tsx`** (`app/[locale]/page.tsx`): identical dual-call pattern.
  Returns `role` as `'admin' | 'member' | null`.
- **`admin/users/page.tsx`** (`app/[locale]/admin/users/page.tsx`): same
  dual-call pattern, but stores role as `string | null` (not the narrow union
  type). Has an explicit `if (!user) redirect(...)` null guard between the two
  fetches. The guard must be preserved — `getSessionUser()` returning null will
  still trigger it correctly.
- **E2e tests**: all eight spec files run against placeholder Supabase
  credentials (unauthenticated flow only) and are CI-safe. Regression coverage
  for the authenticated UI behaviour (user name, role label, nav links) is
  manual only. ACs 1–3 of this story are not automatable in CI.

### Affected areas

- **backend** (server-side helper): `lib/auth/session.ts` (new file)
- **frontend / server components**: `components/AppHeader.tsx`,
  `app/[locale]/page.tsx`, `app/[locale]/admin/users/page.tsx`

### Step-by-step approach

**Step 1 — Create `lib/auth/session.ts`**

Create a new file at `/home/justasandbox/scheduler/lib/auth/session.ts`:

```ts
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const getSessionUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
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
    return row?.role === 'admin'
      ? ('admin' as const)
      : row?.role === 'member'
        ? ('member' as const)
        : null;
  } catch {
    return null;
  }
});
```

Notes:
- Do NOT add `import 'server-only'`. The `createClient` import already pulls
  in `next/headers`, making this server-only by transitive dependency.
  Adding `server-only` would unnecessarily block importing from test files.
- `cache()` is per-request scoped in Next.js Server Component rendering — there
  is no cross-request leak risk.
- `getUserRole` is cached on `(userId)` — callers must pass the same `userId`
  string they received from `getSessionUser()`.

**Step 2 — Refactor `components/AppHeader.tsx`**

Replace the two independent try/catch blocks (the `getUser` block and the role
lookup block) with:

```ts
import { getSessionUser, getUserRole } from '@/lib/auth/session';
// remove: import { createClient } from '@/lib/supabase/server';

// Inside the component body:
const user = await getSessionUser();

let role: 'admin' | 'member' | null = null;
let roleLabel: string | null = null;
if (user) {
  role = await getUserRole(user.id);
  const tUM = await getTranslations('UserManagement');
  roleLabel =
    role === 'admin'
      ? tUM('roleAdmin')
      : role === 'member'
        ? tUM('roleMember')
        : null;
}
```

The `displayName` derivation and JSX are unchanged.

**Step 3 — Refactor `app/[locale]/page.tsx`**

Replace the two independent try/catch blocks with:

```ts
import { getSessionUser, getUserRole } from '@/lib/auth/session';
// remove: import { createClient } from '@/lib/supabase/server';

// Inside the component body:
const user = await getSessionUser();
let role: 'admin' | 'member' | null = null;
if (user) {
  role = await getUserRole(user.id);
}
```

All `showDeniedBanner` logic, branch returns, and JSX are unchanged.

**Step 4 — Refactor `app/[locale]/admin/users/page.tsx`**

Replace the two independent try/catch blocks with:

```ts
import { getSessionUser, getUserRole } from '@/lib/auth/session';
// remove: import { createClient } from '@/lib/supabase/server';

// Inside the component body:
const user = await getSessionUser();

if (!user) {
  redirect(`/${routing.defaultLocale}/login`);
}

const role = await getUserRole(user.id);
```

The existing null guard `if (!user) redirect(...)` is preserved and continues
to work because `getSessionUser()` returns `null` on any failure. The `role`
variable is now typed as `'admin' | 'member' | null` (narrower than the prior
`string | null`). The subsequent `if (role !== 'admin') redirect(...)` check
works identically with both types.

**Step 5 — Quality gates**

Run the full quality gate sequence in order:
1. `npm run lint` — no new ESLint errors.
2. `npx tsc --noEmit` — no new type errors.
3. `npm run build` — build succeeds.
4. `npm run test:e2e` — all eight existing spec files still pass.

### Test plan mapped to acceptance criteria

| AC | Criterion | Test approach |
|----|-----------|---------------|
| AC1 | Admin on home page: only one `auth.getUser()` and one role SELECT call | **Manual / development only.** Add `console.log('[session] getUser called')` inside `getSessionUser` temporarily; with `cache()` it logs once per render even when both `AppHeader` and `page.tsx` call it. Verify in terminal output during `npm run dev`. |
| AC2 | Admin on `/admin/users`: same deduplication | Same as AC1 — `getSessionUser` logs once even though `AppHeader` and `admin/users/page.tsx` both call it. |
| AC3 | Subjective response time under 500 ms on hosted Supabase | **Manual / live environment.** Compare load time before and after on the deployed Vercel + Supabase environment. Not automatable in CI. |
| AC4 | Displayed user name, role label, and nav links are correct | Partially covered by the existing e2e suite (unauthenticated path). Full regression requires a live session (manual). The refactor is pure delegation — no logic change — so the risk is low. |
| AC5 | Quality gates all exit 0 | `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e` — all automated and run in CI. |

### Risks and rollback notes

**Risk 1 — React `cache()` API availability.** React `cache()` for Server
Components is stable in React 19 (shipped with Next.js 15+). Confirm by
checking `react` version in `package.json`. If unavailable, a `WeakMap`
or `AsyncLocalStorage`-based workaround is needed, but this should not occur
on the current stack.

**Risk 2 — `createClient` called multiple times inside a single cached
function.** Each call to `getSessionUser()` or `getUserRole()` creates one
`createClient()` call internally. Because `cache()` deduplicates at the
function-call level, only one invocation of each helper runs per request. Two
Supabase client instances are still created (one for `getSessionUser`, one for
`getUserRole`), but only two network calls are made total (down from 4–6).
This is the expected and correct behaviour.

**Risk 3 — Admin page role type narrowing.** The current admin page stores role
as `string | null`; the new helper returns `'admin' | 'member' | null`. TypeScript
will flag any code that treated role as a free string. The only usage is
`if (role !== 'admin')` which works identically. No risk.

**Rollback.** The change is purely additive for `lib/auth/session.ts` and a
local refactor (no external API surface changes) for the three component files.
Rollback is a git revert of the four files — no database migrations, no
environment variable changes, no deployment configuration changes needed.

### Complexity tag

`standard` — Touches four files across two areas (new server-side helper + three
server component consumers), requires understanding of React `cache()` scoping
in Next.js Server Components and how it interacts with the cookie-based Supabase
client. Not trivial because of the multi-module coordination; not complex because
there is no auth security boundary change, no data integrity concern, and no
concurrency issue introduced.
