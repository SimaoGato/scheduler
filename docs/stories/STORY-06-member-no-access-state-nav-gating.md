# STORY-06: Member "no access yet" state & role-gated navigation
Epic: EPIC-01
Status: done ✅
PR: 14

## User story
As a brand-new Member, I want a clear, friendly view that matches my permissions,
so that I understand I'm logged in and what I can (and can't) do yet.

## Context
Final slice of EPIC-01. The member-facing UX layer on top of roles (STORY-03)
and enforcement (STORY-04). See PRD §7 and Epic scope: "a 'no access yet' state
for brand-new Members" and a member-appropriate view. Distinct from STORY-04
(server enforcement) — this is the navigation/UX.

## Acceptance criteria
1. Given a logged-in Member with no assignments/availability features yet
   available, when they land in the app, then they see a clear pt-PT
   "welcome / no access yet" view rather than an error or a blank/Admin screen.
2. Given a logged-in Member, when the navigation renders, then Admin-only
   destinations (e.g. user management) are **not shown**.
3. Given a logged-in Admin, when the navigation renders, then Admin
   destinations are shown.
4. Given a Member who manually navigates to an Admin route URL, when the page
   loads, then they are redirected/shown an unauthorized view (UI mirrors the
   STORY-04 server denial) rather than the Admin content.
5. Given any logged-in user, when the shell renders, then their identity (name
   and role) is visible and a sign-out control is available.

## Out of scope
- Server-side permission enforcement itself (STORY-04).
- Member availability features (EPIC-03) — only the placeholder/empty state here.

## Technical notes
- Role-aware navigation component; conditional menu items.
- Client route guard that reflects the server authorization, with graceful
  redirect/unauthorized view.
- Reuse i18n catalog (STORY-01) for all copy.

## Definition of Done
See CLAUDE.md.

## Manual verification

The following ACs require real Supabase credentials and cannot run in CI.
Run these steps locally with `.env.local` configured and Google OAuth set up.

### AC1 — Member "no access yet" view
1. Log in with a Google account whose row has `role = 'member'` in `public.users`.
2. Confirm the home page shows **"Bem-vindo ao Escala!"** and the no-access
   description, and does **not** show the "Ver escala" button.

### AC3 — Admin nav shows admin links
1. Log in with a Google account whose row has `role = 'admin'` in `public.users`.
2. Confirm the nav shows both **"Início"** and **"Utilizadores"**.

### AC4 — Member blocked from admin route
1. While logged in as a Member, navigate directly to `/pt-PT/admin/users`.
2. Confirm redirect to the home page with a visible banner:
   **"Não tens permissão para aceder a essa página."**
3. Confirm the admin user table is **not** rendered.

### AC5 — Identity visible in shell
1. Log in as any user (admin or member).
2. Confirm the header shows the user's name (via "Olá, {name}"), their role
   label (**"Administrador"** or **"Membro"**), and a **"Sair"** button.
3. Click **"Sair"** and confirm redirect to the login page.

## Implementation plan

### Affected areas
- **Frontend (UX/UI)**: `components/AppHeader.tsx`, `components/AppNav.tsx`, `app/[locale]/page.tsx`
- **i18n**: `messages/pt-PT.json`
- **E2E tests**: `e2e/member-gating.spec.ts` (new file)

No DB migrations, no new API routes, no changes to `proxy.ts`, `lib/auth/guard.ts`, or `app/[locale]/admin/users/page.tsx`.

---

### Step-by-step approach

#### 1. Add i18n keys — `messages/pt-PT.json`

Add a new `Member` namespace for the no-access state and two role-display keys to the existing `Auth` namespace:

```json
"Member": {
  "noAccessTitle": "Bem-vindo ao Escala!",
  "noAccessDescription": "A tua conta está activa, mas ainda não tens acesso a nenhuma funcionalidade. Fala com um Administrador para obteres permissões.",
  "role": "Função: {role}"
},
"Auth": {
  // existing keys preserved…
  "roleAdmin": "Administrador",
  "roleMember": "Membro"
}
```

#### 2. Update `components/AppHeader.tsx` — fetch role, display identity, pass role to AppNav

After the existing `user` fetch, add a second try/catch block to read `role` from `public.users` using the same `createClient()` pattern already in the file (Server Component, `next/headers` cookies are correct here). Pass `role` as a prop to `AppNav`.

For AC5 — show role in the header user-info block alongside the existing greeting and sign-out form. Use the new `Auth.roleAdmin` / `Auth.roleMember` keys from step 1.

Resulting shape of the user-info section when authenticated:
```
Olá, {name}  ·  Administrador          [Sair]
```
or
```
Olá, {name}  ·  Membro                 [Sair]
```

When `role` is `null` (Supabase unreachable / placeholder creds), omit the role label — the greeting and sign-out button still render.

#### 3. Update `components/AppNav.tsx` — accept `role` prop, conditional rendering

Add a `Props` interface: `{ role: 'admin' | 'member' | null }`. Make `AppNav` accept this prop. Conditionally render the "Utilizadores" link only when `role === 'admin'`. Remove the existing TODO comment that deferred this to STORY-06.

```tsx
{role === 'admin' && (
  <li>
    <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
      <Link href="/admin/users">{t('userManagement')}</Link>
    </Button>
  </li>
)}
```

#### 4. Update `app/[locale]/page.tsx` — role-aware home page content

`page.tsx` is already a Server Component. Add a fetch of `user` + `role` using the same `createClient()` / try/catch pattern used in `AppHeader.tsx` and `admin/users/page.tsx`.

Render logic:
- `role === 'member'` (or `null` but `user` is set): show the `Member.*` i18n content — a clear "no access yet" message. Drop the disabled "Ver escala" button (it communicates nothing useful to a member without assignments). Do NOT redirect — proxy.ts already handles the unauthenticated redirect; this path only fires for authenticated members.
- `role === 'admin'`: keep the current home content (`Home.*` keys with the disabled "Ver escala" button — it remains a placeholder until EPIC-03/EPIC-04 content arrives).
- `user === null` (shouldn't reach here due to proxy.ts guard, but render the same home content defensively).

This satisfies AC1 directly and also provides the destination for the AC4 redirect (member → admin URL → admin/users page redirects to home → home shows "no access yet").

AC4 note: `app/[locale]/admin/users/page.tsx` already redirects non-admin users to `/${routing.defaultLocale}/`. No changes needed there. The redirect target (home page) now shows the "no access yet" view for members, which satisfies "redirected/shown an unauthorized view."

#### 5. Write `e2e/member-gating.spec.ts`

**Automated (CI-safe, no real Supabase):**

```
AC2-unauth-nav: navigate to /pt-PT/login (the unauthenticated landing target from proxy.ts)
  → nav contains "Início"
  → nav does NOT contain "Utilizadores"
  (validates that role=null → admin link hidden, which is the unauthenticated equivalent of the member state)
```

This is the only automated assertion that can be CI-safe without real credentials. Because proxy.ts always redirects unauthenticated users to login, we can't reach the home page in CI to test the member-specific content.

**Manual verification steps documented in the test file:**

AC1 — Member no-access view:
1. Log in with a Google account that has `role = 'member'` in `public.users`.
2. Confirm the home page shows the new "no access yet" title and description (from `Member.*` i18n keys) and does NOT show the "Ver escala" button.

AC2 — Member nav:
1. While logged in as Member, confirm the nav shows "Início" only — "Utilizadores" link is absent.

AC3 — Admin nav:
1. Log in with a Google account that has `role = 'admin'` in `public.users`.
2. Confirm the nav shows both "Início" and "Utilizadores".

AC4 — Member blocked from admin route:
1. While logged in as Member, navigate directly to `/pt-PT/admin/users`.
2. Confirm redirect to home page showing the "no access yet" view (not the admin user table).

AC5 — Identity in shell:
1. Log in as any user (admin or member).
2. Confirm the header shows the user's name (via `Auth.userGreeting`), their role label (`Administrador` or `Membro`), and a "Sair" button.
3. Confirm the "Sair" button signs out and redirects to login.

---

### Test plan mapped to acceptance criteria

| AC | Test type | Covered by |
|----|-----------|------------|
| AC1 | Manual | Step in `member-gating.spec.ts` comments |
| AC2 | Automated (partial: unauth) + Manual (member) | `member-gating.spec.ts` automated + manual steps |
| AC3 | Manual | Step in `member-gating.spec.ts` comments |
| AC4 | Manual | Step in `member-gating.spec.ts` comments; server redirect in `admin/users/page.tsx` already exists |
| AC5 | Manual | Step in `member-gating.spec.ts` comments |

---

### Risks and rollback notes

**Risk 1 — AppHeader role fetch adds a second DB round-trip per page load.**
The role is fetched separately from the user session (one call to `supabase.auth.getUser()`, one `SELECT role FROM public.users`). Both are already in `admin/users/page.tsx` as the established pattern. Acceptable until caching (React `cache()`) is warranted.

**Risk 2 — `createClient()` in `page.tsx` with placeholder Supabase creds.**
In CI, `createClient()` throws; `user` falls through as `null`. proxy.ts redirects unauthenticated users before `page.tsx` renders, so this path is unreachable in practice. The try/catch defensive pattern is maintained for correctness.

**Risk 3 — Smoke tests rely on nav rendering.**
`smoke.spec.ts` has `await expect(page.locator('nav')).toContainText('Início')`. After this change, AppNav always renders "Início" regardless of role. The smoke test continues to pass. The "Utilizadores" link is no longer in the nav by default (requires `role === 'admin'`), so any test that previously navigated via that link needs updating — none currently does.

**Risk 4 — AppNav becomes a prop-driven component.**
`AppNav` loses its zero-prop signature. Any future usage outside `AppHeader` must supply `role`. Since `AppNav` is only used in `AppHeader`, this is a contained change. Search confirms: `grep -r "AppNav" components/ app/` shows it is imported only from `AppHeader.tsx`.

**Rollback:** All changes are additive or within existing files. Reverting consists of restoring `AppHeader.tsx`, `AppNav.tsx`, `page.tsx`, and `messages/pt-PT.json` to their pre-story state. No migrations or schema changes involved.

---

### Complexity tag

**standard** — Three components need changes in concert (AppHeader, AppNav, home page), role data must be threaded from a Server Component DB fetch into a `'use client'` component prop, and i18n + E2E tests span the full stack. No auth system, DB schema, or API route changes, which keeps it off `complex`.
