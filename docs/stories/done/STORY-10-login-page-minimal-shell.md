# STORY-10: Login page — minimal shell and centered layout
Epic: EPIC-01
Status: done ✅
PR: 18

## User story
As a visitor arriving at the login page, I want to see a clean, centered
sign-in screen without the application navigation, so that the UI is focused
and not confusing.

## Context
The login page (`/[locale]/login`) renders inside `LocaleLayout`, which
always mounts `AppHeader` (with nav links and a sign-out button). Since
STORY-09 redirects authenticated users away from the login page, the nav is
always irrelevant noise there. Centering the sign-in form is also consistent
with how most login UIs look. See PRD §7 (usability) and EPIC-01 scope
(app shell/navigation).

## Acceptance criteria
1. Given an unauthenticated visitor on `/pt-PT/login`, when the page renders,
   then the `AppHeader` (including nav buttons and sign-out button) is NOT
   visible.
2. Given an unauthenticated visitor on `/pt-PT/login`, when the page renders,
   then the app name/title IS visible (so the user knows what app they're
   signing into).
3. Given an unauthenticated visitor on `/pt-PT/login`, when the page renders,
   then the sign-in form is horizontally and vertically centered in the
   viewport.
4. Given an authenticated user visiting `/pt-PT/login`, when the page renders,
   then they are redirected to home (STORY-09 behaviour is unchanged).

## Out of scope
- Changing the Google sign-in button itself.
- Adding a logo or custom branding beyond the app name.
- Any error-message or OAuth flow changes.

## Technical notes
- Create `app/[locale]/login/layout.tsx` — a nested layout that renders only
  a minimal shell (app name, no AppHeader). Next.js route-group or nested
  layout is the clean seam; `LocaleLayout` stays unchanged.
- The centered layout can use Tailwind flex with `min-h-screen items-center
  justify-center flex-col gap-6`.
- AC2 can be satisfied by rendering the `App.name` translation key in a
  simple `<span>` or `<h1>` above the sign-in card.
- The existing `AppHeader` in `LocaleLayout` is untouched; nesting a layout
  under `login/` takes precedence for that route only.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Affected areas
- **frontend** — Next.js App Router layout restructure (route groups), new login
  layout, login page styling
- **ux** — centered login shell, app name visible without full navigation

### Complexity tag
`standard` — touches four layout/page files plus two Playwright specs; requires
understanding of Next.js App Router layout composition rules (why a naive nested
layout is not sufficient) and the route-group refactor pattern.

---

### Key architectural clarification

The story note "LocaleLayout stays unchanged" is incorrect as written. In Next.js
App Router, nested layouts **compose inside** the parent — they do not replace or
suppress parent-rendered content. Adding `app/[locale]/login/layout.tsx` alone
would still render `AppHeader` from LocaleLayout in the parent slot above the
nested layout's children.

The correct approach is a **route group** (`(app)`) that moves `AppHeader` out of
LocaleLayout and into an inner layout covering only the authenticated app pages.
`LocaleLayout` is modified minimally: only the `<AppHeader />` call and its
surrounding `<div class="flex min-h-screen flex-col">` wrapper are extracted. The
html/body/NextIntlClientProvider shell is untouched.

---

### Step-by-step approach

**Step 1 — Modify `app/[locale]/layout.tsx` (LocaleLayout)**

Remove `<AppHeader />` and the `<div className="flex min-h-screen flex-col">` that
wraps children. After the change, LocaleLayout renders only:

```tsx
<html lang={locale}>
  <body className="min-h-screen bg-background text-foreground antialiased">
    <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
  </body>
</html>
```

Remove the `import AppHeader` line (no longer needed here).

**Step 2 — Create `app/[locale]/(app)/layout.tsx`**

This route-group layout reinstates the flex wrapper and `AppHeader` for all
authenticated app pages. Route groups are invisible to URLs — `/[locale]/`,
`/[locale]/admin/users`, and `/[locale]/admin/people` are unaffected.

```tsx
import AppHeader from '@/components/AppHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
```

**Step 3 — Move three page files into the `(app)` route group**

These files move verbatim (no content changes; all imports use `@/` absolute
paths, so nothing breaks):

| Old path | New path |
|---|---|
| `app/[locale]/page.tsx` | `app/[locale]/(app)/page.tsx` |
| `app/[locale]/admin/users/page.tsx` | `app/[locale]/(app)/admin/users/page.tsx` |
| `app/[locale]/admin/people/page.tsx` | `app/[locale]/(app)/admin/people/page.tsx` |

Delete the originals after creating the new copies.

**Step 4 — Create `app/[locale]/login/layout.tsx`**

This is the minimal shell for the login route. It is a Server Component so it
can call `getTranslations`. It wraps children in a flex-centered full-height
container and places the app name above the sign-in card.

```tsx
import { getTranslations } from 'next-intl/server';

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('App');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <span
        className="text-2xl font-semibold"
        data-testid="login-app-name"
      >
        {t('name')}
      </span>
      {children}
    </div>
  );
}
```

The `App.name` key (`"Escala"`) already exists in `messages/pt-PT.json`. No new
i18n keys are needed.

**Step 5 — Update `app/[locale]/login/page.tsx`**

The `<main>` currently has `className="flex-1 container mx-auto px-4 py-8"`.
`flex-1` fights the new centering layout (it would expand main to take all
remaining height, breaking vertical centering). Replace with a constrained width:

```tsx
<main className="w-full max-w-sm px-4">
```

The heading (`text-2xl font-semibold`) and existing error/button elements are
unchanged.

**Step 6 — Update `e2e/smoke.spec.ts`**

The two `'responsive shell'` tests and `'app name rendered from i18n catalog'`
all navigate to `/` which redirects to `/pt-PT/login` in CI (placeholder creds
→ unauthenticated → middleware redirect). After step 2, the login page has no
`<header>` or `<nav>`, so the existing assertions fail.

Update the three affected tests:

- `'responsive shell: header, nav and main content area present at desktop width'`
  — remove the `header` and `nav` locator assertions; check only `main`.
  Rename to reflect it now checks the login shell.
- `'responsive shell: no horizontal overflow at mobile width (375 px)'`
  — same removal of `header`/`nav` assertions; keep the scroll-width check and
  the `main` check.
- `'app name rendered from i18n catalog'` — replace
  `page.locator('header').toContainText('Escala')` with
  `page.getByTestId('login-app-name').toContainText('Escala')`. Remove the `nav`
  assertion (nav only exists for authenticated users).

**Step 7 — Create `e2e/login-page-shell.spec.ts`**

New spec, one test per AC:

```
e2e/login-page-shell.spec.ts
```

---

### Test plan (AC-to-test mapping)

**AC1 — AppHeader NOT visible on `/pt-PT/login`**

```ts
test('AC1: AppHeader is not rendered on the login page', async ({ page }) => {
  await page.goto('/pt-PT/login');
  await expect(page.locator('main')).toBeVisible();
  // No <header> element — login layout does not include AppHeader
  await expect(page.locator('header')).toHaveCount(0);
  // Sign-out button absent (it lives inside AppHeader)
  await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0);
});
```

**AC2 — App name IS visible on `/pt-PT/login`**

```ts
test('AC2: app name is visible on the login page', async ({ page }) => {
  await page.goto('/pt-PT/login');
  const appName = page.getByTestId('login-app-name');
  await expect(appName).toBeVisible();
  await expect(appName).toContainText('Escala');
});
```

**AC3 — Sign-in form is horizontally and vertically centered**

Use `boundingBox()` (CLAUDE.md: always call `toBeVisible` before `boundingBox`):

```ts
test('AC3: sign-in form is horizontally and vertically centered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/pt-PT/login');
  const main = page.locator('main');
  await expect(main).toBeVisible();
  const box = await main.boundingBox();
  const viewportWidth = 1280;
  const viewportHeight = 720;
  // Center of main must be within ±120px of viewport center (horizontal)
  const centerX = box!.x + box!.width / 2;
  expect(Math.abs(centerX - viewportWidth / 2)).toBeLessThan(120);
  // Center of main must be within ±120px of viewport center (vertical)
  const centerY = box!.y + box!.height / 2;
  expect(Math.abs(centerY - viewportHeight / 2)).toBeLessThan(120);
});
```

**AC4 — Authenticated user redirected to home (STORY-09 unchanged)**

Manual only — same constraint as `login-redirect.spec.ts` AC1 (requires live
Supabase with real Google OAuth; CI uses placeholder creds so `user` is always
null). Document in the spec header with a manual verification step. No new
automated assertion; the existing `login-redirect.spec.ts` already covers the
regression guard (AC2 of that spec) and the proxy.ts logic is unchanged.

---

### Risks and rollback notes

1. **Duplicate URL risk** — Moving pages into `(app)/` while originals exist would
   cause a Next.js build error ("Duplicate page"). Delete the originals in the
   same commit. If a build error occurs, reverting the git commit fully restores
   the previous state.

2. **Missing layout wrapper on future pages** — After this change, any new
   `app/[locale]/` page added OUTSIDE of `(app)/` or `login/` will have no flex
   wrapper and no AppHeader. Document this in a comment at the top of
   `app/[locale]/(app)/layout.tsx`.

3. **Smoke test regressions** — The three smoke tests touching `header`/`nav`
   assertions must be updated (step 6) before the layout refactor is merged.
   If omitted, `npm run test:e2e` fails on the smoke suite. Running the tests
   locally with `npm run dev` + `npx playwright test` catches this immediately.

4. **i18n namespace in login layout** — The login layout calls
   `getTranslations('App')`, which is already used by `AppHeader`. The namespace
   is in `messages/pt-PT.json`. No risk of a missing-key error.

5. **Rollback** — `git revert` of the implementing commit fully restores the old
   file layout. No database or environment changes are involved.
