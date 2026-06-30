# CHORE-07: Deduplicate per-request auth fetches with React cache()
Epic: maintenance
Status: draft

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
