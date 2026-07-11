# STORY-08: Block admin self-demotion on user-management screen
Epic: EPIC-01
Status: done ✅

## User story
As an Admin, I want the "Rebaixar" button on my own row to be absent (or
disabled), so that I cannot accidentally revoke my own admin access from the
user-management screen.

## Context
Discovered during manual QA of STORY-05. The PATCH endpoint already enforces
the last-admin safeguard (409 when only one admin remains), so the truly
dangerous case is protected. However, when two or more admins exist, the current
implementation lets an admin demote themselves — the request succeeds, local
state updates, but on the next navigation the user is redirected away from
`/admin/users` as a Member. This is confusing UX. The PRD (FR19) and AC3 of
STORY-05 both frame role changes as an admin acting on *another* user
("Can promote **other** users"; "when **another** Admin demotes them"), implying
self-demotion is never the intended workflow.

## Acceptance criteria
1. Given a logged-in Admin viewing the user-management screen, when their own
   row is rendered, then the "Rebaixar"/"Promover" action button is **not
   shown** (or is hidden) for that row.
2. Given an Admin who sends a PATCH request to `/api/admin/users/:id` with
   their own `id` and `role: 'member'`, then the server returns 400 with a
   clear error (`self_demotion`), regardless of how many admins exist.
3. Given an Admin who sends a PATCH request to `/api/admin/users/:id` with
   their own `id` and `role: 'admin'` (no-op promote), then the request
   succeeds normally (200) — only demotion is blocked.

## Out of scope
- Blocking an admin from promoting another user to admin.
- Blocking any other self-modification (e.g. name/email changes).
- UI changes beyond hiding/disabling the action button on the logged-in user's
  own row.

## Technical notes
- `app/api/admin/users/[id]/route.ts`: after `requireAdmin`, compare `userId`
  (from params) to `result.user.id` (the authenticated user). If equal and
  `role === 'member'`, return 400 `{ error: 'self_demotion' }`.
- `components/UserTable.tsx`: the page already fetches the full user list via
  the service client. The Server Component `app/[locale]/admin/users/page.tsx`
  must pass the current user's `id` down as a prop so `UserTable` can suppress
  the action button on the matching row.
- Add `UserManagement.errorSelfDemotion` i18n key to `messages/pt-PT.json`
  (e.g. "Não pode remover os seus próprios privilégios de administrador.") for
  any client-side guard or fallback error display.
- The server-side check (AC2) is the authoritative safeguard; the UI change
  (AC1) is UX polish on top.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Branching (important for Implement stage)
This story must be implemented on a **new branch created from `main`**, not
from `story/chore-05-local-supabase-integration-tests` (the current checked
out branch, which has unrelated uncommitted work and an open PR, #41, for
CHORE-05). Verified via `gh pr list`: CHORE-05 is not yet merged, so `main`
does **not** have `e2e-integration/`, `playwright.integration.config.ts`, or
`supabase/test-users.mjs`. This plan therefore does **not** depend on any of
that CHORE-05 infrastructure — all test additions below use only what
already exists on `main` (`e2e/`, `playwright.config.ts`, the existing
`page.request` + `E2E_WITH_AUTH` gated-test pattern). Do not `git checkout
main` destructively over the current branch's uncommitted files; create the
new branch with `git worktree` or after confirming the current WIP is
committed/stashed elsewhere — this is a note for the Implement stage, not
something to action now.

### Affected areas
- **backend** — `app/api/admin/users/[id]/route.ts` (new authorization
  business-rule branch in an existing auth-guarded Route Handler).
- **frontend** — `components/UserTable.tsx` (own-row button suppression),
  `app/[locale]/(app)/admin/users/page.tsx` (thread `currentUserId` prop).
- **ux / i18n** — new error copy in `messages/pt-PT.json` and
  `messages/en.json` (key parity enforced by
  `e2e/i18n-key-parity.spec.ts`).
- **security-adjacent** — this changes authorization business logic on an
  already-authenticated admin-only endpoint and interacts with an existing
  data-integrity safeguard (last-admin check). No changes to `lib/auth/guard.ts`
  itself, no DB schema/RLS changes, no new interacting systems — reuses the
  exact `requireAdmin` → service-role-client pattern STORY-05 already
  established. Flagging explicitly so Challenge/Review apply security
  scrutiny to the new conditional despite the "standard" complexity tag.

### Design decisions (resolved during refinement, not left to implementer)

1. **Precedence: self-demotion check runs BEFORE the last-admin count query.**
   AC2 says the 400 `self_demotion` response must occur "regardless of how
   many admins exist." Read literally, this includes the single-admin edge
   case (an admin who is also the only admin, attempting to demote
   themselves). If the last-admin count query ran first, that edge case
   would return 409 `last_admin` instead of 400 `self_demotion`, contradicting
   "regardless of how many admins exist" (the response code would then vary
   by count, exactly what AC2 says must NOT happen). Placing the
   self-demotion check first and short-circuiting before the count query
   makes the 400 response unconditional on admin count, satisfies AC2
   exactly as written, and is also a strictly cheaper check (no DB query) —
   no downside to ordering it first. Self-promotion (`role: 'admin'`, AC3) is
   never blocked by this new check because the guard's condition requires
   both `userId === result.user.id` AND `role === 'member'`.

2. **AC1 renders `null` (button not in the DOM), not merely CSS-hidden.**
   AC text says "not shown (or is hidden)" — ambiguous between "absent from
   the DOM" and "present but visually hidden." This project's existing
   convention (STORY-16: "Role-gated layout components return `null` when
   empty") favors omitting the element outright rather than
   `hidden`/`display:none`, so screen readers and `getByRole('button')`
   queries don't encounter a dead interactive element. The action `<td>`
   renders an empty cell (no placeholder text/dash needed — AC1 doesn't
   require one, and adding one is UI scope beyond what's asked).

3. **Client-side error mapping is extended, not just the i18n key added.**
   The story's technical notes say to add the i18n key "for any client-side
   guard or fallback error display" but `UserTable.tsx`'s `handleRoleChange`
   currently branches only on HTTP status code (409 → `errorLastAdmin`, else
   → `errorGeneric`), not on the response body's `error` code. Since
   `self_demotion` is a 400 (a status shared with other potential future 400
   causes), status-code branching alone can't distinguish it. Refactor to
   read `body.error` and map via a small `errorMap` object, following the
   exact pattern documented in CLAUDE.md's "Stable machine-readable error
   codes" section (STORY-17 precedent). This is defensive/UX-polish code —
   with AC1 shipped, a real user should never trigger this path via normal
   UI interaction (the button is gone), but it protects against stale UI
   (e.g. a second browser tab open on `/admin/users` before a page reload,
   or a user manually crafting the request).

### Step-by-step implementation

**1. `app/api/admin/users/[id]/route.ts`** — add the self-demotion guard.
Insert immediately after the `role` value is validated/narrowed, before
`createServiceClient()`:

```ts
// Self-demotion guard (STORY-08, AC2/AC3): an admin can never demote
// themselves, regardless of how many admins currently exist. This check
// intentionally runs BEFORE the last-admin count query below so it takes
// precedence in the single-admin edge case too — self-demoting the only
// admin must return 400 { error: 'self_demotion' }, not 409
// { error: 'last_admin' }. Self-promotion (no-op, role: 'admin') is
// deliberately NOT blocked here (AC3) — the condition requires role === 'member'.
if (userId === result.user.id && role === 'member') {
  return NextResponse.json({ error: 'self_demotion' }, { status: 400 })
}
```

Update the file's top doc comment to mention the new guard alongside the
existing last-admin one.

**2. `components/UserTable.tsx`** — accept and use `currentUserId`.

```tsx
interface Props {
  initialUsers: UserRow[]
  currentUserId: string
}

export default function UserTable({ initialUsers, currentUserId }: Props) {
```

In the action `<td>`, suppress the button for the viewer's own row:

```tsx
<td className="w-[1%] whitespace-nowrap px-4 py-3 text-right">
  {user.id === currentUserId ? null : user.role === 'member' ? (
    /* existing promote button JSX, unchanged */
  ) : (
    /* existing demote button JSX, unchanged */
  )}
</td>
```

Extend `handleRoleChange`'s error branch to map machine-readable codes
(replacing the current `response.status === 409` check):

```tsx
} else {
  let code: string | undefined
  try {
    const errBody = await response.json()
    code = typeof errBody?.error === 'string' ? errBody.error : undefined
  } catch {
    code = undefined
  }
  const errorMap: Record<string, string> = {
    last_admin: t('errorLastAdmin'),
    self_demotion: t('errorSelfDemotion'),
  }
  setErrorMessage(code && errorMap[code] ? errorMap[code] : t('errorGeneric'))
}
```

**3. `app/[locale]/(app)/admin/users/page.tsx`** — thread the prop. `user` is
already fetched via `getSessionUser()` earlier in the function; pass its id:

```tsx
<UserTable initialUsers={users} currentUserId={user.id} />
```

**4. i18n — add to both locale files' `UserManagement` block** (key parity
required by CI):

`messages/pt-PT.json`:
```json
"errorSelfDemotion": "Não pode remover os seus próprios privilégios de administrador."
```

`messages/en.json`:
```json
"errorSelfDemotion": "You cannot remove your own administrator privileges."
```

### Test plan (1:1 with acceptance criteria)

All new tests live in `e2e/user-management.spec.ts` (the existing STORY-05
file for this route/page), extending its existing structure and its
existing `E2E_WITH_AUTH` manual-verification doc-comment block — do not
create a new spec file.

- **AC1 (own row hides the action button)** — `E2E_WITH_AUTH`-gated
  Playwright test:
  ```ts
  test('AC1: own row hides the promote/demote button', async ({ page }) => {
    test.skip(!process.env.E2E_WITH_AUTH, 'Admin pages require authentication; see manual steps in file header.');
    await page.goto('/pt-PT/admin/users');
    const displayName = (await page.locator('[data-testid="user-identity"]').textContent())?.trim();
    expect(displayName).toBeTruthy();
    const ownRow = page.locator('tbody tr', { hasText: displayName! });
    await expect(ownRow).toHaveCount(1);
    await expect(
      ownRow.locator('[data-testid^="um-promote-"], [data-testid^="um-demote-"]')
    ).toHaveCount(0);
  });
  ```
  Note for implementer: `data-testid="user-identity"` (in `UserWidgetMenu.tsx`)
  renders `public.users.display_name` (via `getUserProfile`'s fallback
  chain), which the admin-callback provisioning flow (STORY-21) populates
  from the OAuth name on first login when empty — so it will almost always
  match the table's `display_name` column for a real logged-in test
  account. If it doesn't match in a given dev environment (e.g. display_name
  cleared but the header still shows a Google-name/email fallback), fall
  back to matching by email instead (cross-reference `GET
  /api/admin/users`'s `email` field against the developer's known login
  email) — do not hand-decode the Supabase session cookie/JWT to get the
  user id (this codebase deliberately avoids hand-rolling `@supabase/ssr`'s
  cookie encoding; see CLAUDE.md's fixture-pattern note).
  Also add a manual verification step to the file's header doc comment,
  matching the existing convention, in case a reviewer doesn't run
  `E2E_WITH_AUTH` locally.

- **AC2 (self-demote → 400 `self_demotion`, any admin count)** —
  `E2E_WITH_AUTH`-gated Playwright test using `page.request` (shares the
  authenticated browser context's cookies, per the existing pattern in
  `e2e/role-management.spec.ts`):
  ```ts
  test('AC2: PATCH own id with role member → 400 self_demotion', async ({ page }) => {
    test.skip(!process.env.E2E_WITH_AUTH, 'Requires an authenticated admin session; see manual steps in file header.');
    await page.goto('/pt-PT/admin/users');
    const displayName = (await page.locator('[data-testid="user-identity"]').textContent())?.trim();
    const listResponse = await page.request.get('/api/admin/users');
    const users = (await listResponse.json()) as Array<{ id: string; display_name: string | null }>;
    const self = users.find((u) => u.display_name === displayName);
    expect(self).toBeTruthy();

    const response = await page.request.patch(`/api/admin/users/${self!.id}`, {
      data: { role: 'member' },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('self_demotion');
  });
  ```
  This test performs no mutation (the request is rejected), so it's safe to
  run repeatedly against a real dev Supabase project with no cleanup needed.

- **AC3 (self-promote no-op → 200)** — same file, same self-id lookup,
  reusing the pattern above:
  ```ts
  test('AC3: PATCH own id with role admin (no-op) → 200', async ({ page }) => {
    test.skip(!process.env.E2E_WITH_AUTH, 'Requires an authenticated admin session; see manual steps in file header.');
    // ... same self-id lookup as AC2 ...
    const response = await page.request.patch(`/api/admin/users/${self!.id}`, {
      data: { role: 'admin' },
    });
    expect(response.status()).toBe(200);
  });
  ```
  Idempotent (already admin → admin), safe to re-run, no cleanup needed.

- **Regression check**: the existing CI-safe unauthenticated 401 tests in
  this file are unaffected (the new guard sits behind `requireAdmin`, which
  already short-circuits first) — no changes needed to those tests, but
  re-run them to confirm.

### Definition of Done cross-check
- `npm run lint`, `npx tsc --noEmit`, `npm run build` — must pass; no new
  dependencies introduced.
- `npm run test:e2e` — the 3 new gated tests are skipped in CI (no
  `E2E_WITH_AUTH`), same as all other auth-gated tests in this suite; the
  existing 401 regression tests must still pass.
- i18n key parity: run `e2e/i18n-key-parity.spec.ts` (part of the smoke
  suite) to confirm `errorSelfDemotion` exists identically in both locale
  files.
- Manual verification: developer runs `E2E_WITH_AUTH=1 npm run test:e2e`
  locally with real `.env.local` + a real admin Google account to confirm
  all three new tests pass end-to-end before marking the story ready for
  review (per this repo's established gated-test convention, since CI
  cannot exercise them).

### Risks and rollback
- **Risk**: getting the check-ordering wrong (last-admin count query before
  self-demotion) would silently violate AC2 only in the single-admin edge
  case — low likelihood to hit in normal dev/test usage (most environments
  have 2+ admins) but is exactly the kind of subtle regression AC2's
  "regardless of how many admins exist" phrasing is guarding against. Covered
  by the explicit ordering decision above; Review should specifically check
  the guard's placement relative to the count query.
- **Risk**: `UserTable`'s prop-signature change (`currentUserId` added) is a
  breaking change to any other caller of `UserTable` — grep confirms
  `app/[locale]/(app)/admin/users/page.tsx` is the only consumer, so this is
  low risk.
- **Rollback**: purely additive/conditional — revert the route guard clause,
  the `UserTable`/`page.tsx` prop threading, and the two i18n keys. No DB
  migration, no schema change, nothing to roll back at the data layer.

### Complexity tag: **standard**

Justification: this reuses an already-established auth pattern
(`requireAdmin`, service-role client, Server→Client Component prop
threading) from STORY-05 without modifying `lib/auth/guard.ts` or any
DB/RLS layer — no new interacting systems are introduced. The reasoning risk
is concentrated in one place: the precedence between the new self-demotion
check and the existing last-admin safeguard, which this plan resolves
explicitly rather than leaving to the implementer. Per CLAUDE.md's
reasoning-risk signals, this stays at least `standard` (modifies
authorization business logic sitting behind an auth guard) but does not
cross into `complex` (no new auth primitives, no schema/RLS change, no
concurrency, no 3+ newly-interacting systems — the three files touched are
the same three STORY-05 already wired together). Flagging as
borderline: if Challenge's security persona finds the precedence
interaction or the client-side error-mapping refactor riskier than assessed
here, re-classify to `complex` before Implementation.

## Manual verification

CI cannot exercise ACs 1-3 (all require a real authenticated admin session,
same limitation as STORY-05). Run `E2E_WITH_AUTH=1 npm run test:e2e` locally
with a real `.env.local` + a real admin Google account to run the three
automated (but auth-gated) tests in `e2e/user-management.spec.ts`. If you
prefer to verify by hand instead, follow these steps:

**AC1 — own row hides the promote/demote button**
1. Sign in as an Admin (with at least one other user in `public.users` so the
   table isn't a single row).
2. Navigate to `/pt-PT/admin/users`.
3. Locate the row matching your own email in the table.
4. Confirm the actions column (rightmost) for that row is empty — no
   "Rebaixar a Membro" / "Promover a Administrador" button.
5. Confirm other rows still show their action button as before.

**AC2 — self-demote is blocked with 400, regardless of admin count**
1. While signed in as an Admin, open DevTools console on `/pt-PT/admin/users`.
2. Find your own user id via the Network tab (inspect the response of
   `GET /api/admin/users` and match your row by email).
3. Run:
   ```js
   fetch('/api/admin/users/<your-own-id>', {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ role: 'member' }),
   }).then(r => r.json()).then(console.log)
   ```
4. Confirm the logged body is `{ error: 'self_demotion' }` and the Network
   tab shows HTTP status 400 for the request.
5. Reload the page and confirm your role is still Administrador (the
   request was rejected, no state change).

**AC2 single-admin edge case — now automated, no manual step needed**

The single-remaining-admin variant of AC2 ("regardless of how many admins
exist" — including exactly one) is covered automatically by
`e2e-integration/self-demotion.spec.ts` (runs in the `integration-test` CI
job against a real, freshly-seeded local Supabase instance, which naturally
has exactly one seeded admin — see that file's header comment). This
replaces the previous manual-only step for this edge case, added during
PR #42 review rework since a real single-admin state isn't practical to
produce/restore safely against a shared dev Supabase project.

**AC3 — self-promote (no-op) succeeds**
1. While signed in as an Admin, repeat the same DevTools fetch as AC2 but
   with `body: JSON.stringify({ role: 'admin' })`.
2. Confirm the request resolves with HTTP status 200.
3. Reload the page and confirm your role is still Administrador (no change,
   since you were already an Admin).
