# STORY-12: App header — user identity widget
Epic: EPIC-01
Status: draft

## User story
As a logged-in user, I want a clear, interactive user identity element in the
header, so that I know who I am logged in as and can sign out without
confusion.

## Context
The current header renders "Olá, <name> · <role>" as a plain non-interactive
`<span>` alongside separate nav buttons and a "Sair" `<button>`. This creates
two problems:

1. **Non-interactive text between buttons is confusing.** Users instinctively
   try to click the identity text because it sits between other interactive
   elements. There is no recognised UI pattern where plain identity text sits
   inline between buttons in a toolbar.
2. **"Sair" has no pointer cursor.** It uses a bare `<button>` without
   `cursor-pointer`, unlike the shadcn nav buttons, so the hover state gives
   no visual affordance.

The correct pattern (as seen in Gmail, GitHub, etc.) is a single **interactive
identity widget** — a clickable element (avatar initial or name) that groups
identity info and sign-out together, removing the ambiguity entirely.

See PRD §7 (usability, accessibility) and EPIC-01 (app shell/navigation).

## Acceptance criteria
1. Given a logged-in user on any page with the app header visible, when they
   look at the header, then the identity/sign-out area is a single clearly
   interactive element (cursor changes to pointer on hover).
2. Given a logged-in user, when they activate (click/tap) the identity widget,
   then a sign-out action is accessible from that interaction (either the
   widget itself triggers sign-out, or a small dropdown appears with a
   "Sair" option).
3. Given a logged-in user, when they view the identity widget, then their
   display name and role are visible (either always or when the widget is
   open).
4. Given an admin on any page, when the header renders, then the nav links
   and identity widget are visible without horizontal overflow on a viewport
   ≥ 375 px wide (iPhone SE baseline).
5. Given a member on any page, when the header renders, then the nav links
   and identity widget are visible without horizontal overflow on a viewport
   ≥ 375 px.

## Out of scope
- A full user settings or profile page (future story).
- Changing navigation destinations or adding new nav links.
- Changing the sign-out server action itself (`actions.ts`).
- Responsive hamburger menu — resolve header crowding with layout and the
  widget consolidation first; add hamburger only if overflow persists.
- Avatar image fetched from Google (initials-based avatar is sufficient).

## Technical notes
- **Simplest approach**: replace the `<span>` + separate `<form>` with a
  shadcn `<DropdownMenu>` (or a minimal `<details>`/`<summary>` if shadcn
  Dropdown hasn't been added yet). Trigger: a button showing the user's
  initial letter in a small avatar circle + name. Dropdown content: name,
  role badge, and the "Sair" form/button.
- **Avatar initial**: `displayName.charAt(0).toUpperCase()` in a
  `rounded-full` div with a background colour (e.g. `bg-primary
  text-primary-foreground`).
- The sign-out form action from `actions.ts` stays unchanged; it just moves
  inside the dropdown.
- `AppHeader.tsx` is a Server Component — the dropdown trigger can be a
  `'use client'` sub-component that receives `displayName` and `roleLabel`
  as props.
- **Overflow on mobile**: the widget consolidation (one element instead of
  text + button) should reduce crowding significantly for both admin and
  member; measure during QA.

## Definition of Done
See CLAUDE.md.

---

## Implementation plan

### Affected areas
- **frontend** — `components/AppHeader.tsx` (server component, modified), new
  `components/UserWidget.tsx` (server component, created)
- **ux** — header layout, avatar initial, pointer cursor, compact trigger,
  mobile overflow at 375 px
- **data** — none; `signOut` action in `app/[locale]/login/actions.ts` is
  unchanged

### Key finding: no shadcn DropdownMenu installed

Only `@radix-ui/react-slot` is present. `@radix-ui/react-dropdown-menu` is not
installed. Per the story's technical notes, the fallback is a native
`<details>`/`<summary>` element. This avoids adding a package and still
satisfies all ACs:
- Native interactive toggle (no JS required, works keyboard-only)
- Browser handles open/close; `<summary>` receives pointer cursor via
  `cursor-pointer`
- `<form action={signOut}>` inside `<details>` works with the server action
  unchanged

Because `<details>` requires no React state, `UserWidget` can be an **async
Server Component** (uses `getTranslations`, not `useTranslations`). No
`'use client'` boundary is needed. The `signOut` server action is imported
directly into the new component.

### Step-by-step approach

#### Step 1 — Add i18n key (test-first)
Add exactly one new key to `/home/justasandbox/scheduler/messages/pt-PT.json`
under `Auth`:
```json
"userMenuAriaLabel": "Menu de utilizador"
```
This key is the `aria-label` on the `<summary>` element.

Do NOT add `Auth.userGreeting` usage — the new widget shows the name directly
(without the "Olá," prefix) inside the dropdown. The existing `userFallback`
and `signOut` keys are reused. No other new keys needed.

#### Step 2 — Create `components/UserWidget.tsx`
New async Server Component. Props interface:
```ts
interface Props {
  displayName: string;
  roleLabel: string | null;
}
```

Structure:
```
<details data-testid="user-widget" className="relative">
  <summary
    aria-label={t('userMenuAriaLabel')}
    data-testid="user-widget-trigger"
    className="list-none cursor-pointer flex items-center gap-2
               min-h-[44px] px-2 rounded-md hover:bg-accent
               hover:text-accent-foreground transition-colors
               [&::-webkit-details-marker]:hidden"
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center
                     rounded-full bg-primary text-primary-foreground
                     text-sm font-medium">
      {initial}   {/* displayName.charAt(0).toUpperCase() */}
    </span>
    <span className="hidden sm:block text-sm">{displayName}</span>
  </summary>

  <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px]
                  rounded-md border bg-background shadow-md"
       data-testid="user-widget-menu">
    <div className="px-3 py-2">
      <p className="text-sm font-medium" data-testid="user-identity">
        {displayName}
      </p>
      {roleLabel && (
        <p className="text-xs text-muted-foreground"
           data-testid="user-role-label">
          {roleLabel}
        </p>
      )}
    </div>
    <div className="border-t" />
    <form action={signOut} className="p-1">
      <button
        type="submit"
        data-testid="sign-out-button"
        className="w-full min-h-[44px] flex items-center px-3 py-2
                   text-sm rounded-md hover:bg-accent
                   hover:text-accent-foreground cursor-pointer
                   transition-colors"
      >
        {t('signOut')}
      </button>
    </form>
  </div>
</details>
```

Imports needed: `getTranslations` from `'next-intl/server'`, `signOut` from
`@/app/[locale]/login/actions`.

The `hidden sm:block` on the display name keeps the trigger compact on narrow
viewports (shows only the avatar circle below the `sm` breakpoint), which
directly addresses AC4/AC5 overflow risk on 375 px.

#### Step 3 — Update `components/AppHeader.tsx`
- Add `import UserWidget from './UserWidget'`.
- Remove the inner `<div className="flex items-center gap-3">` block (the
  `<span data-testid="user-identity">` and `<form>` with the sign-out button).
- Replace with:
  ```tsx
  {user && (
    <UserWidget displayName={displayName} roleLabel={roleLabel} />
  )}
  ```
- Keep `tAuth` import and the `displayName` / `roleLabel` derivation logic
  (still needed: `tAuth('userFallback')` for the fallback, `roleLabel` still
  computed).
- Remove `tAuth('userGreeting', ...)` — the greeting string is no longer
  rendered in the header.
- Adjust the outer flex gap if needed: `gap-4` between `<AppNav>` and
  `<UserWidget>` is fine.

#### Step 4 — Write `e2e/header-identity-widget.spec.ts`
All ACs require an authenticated session (the `AppHeader` lives in the
`(app)/` route group and is never visible to unauthenticated users). Follow
the pattern in `e2e/member-gating.spec.ts` and `e2e/design-system.spec.ts`:
skip automated assertions with `test.skip(true, ...)` and document manual
verification in comments.

```
/**
 * e2e/header-identity-widget.spec.ts — STORY-12
 *
 * AC coverage:
 *
 *  All 5 ACs require an authenticated session. AppHeader lives in the
 *  (app)/ route group — unauthenticated CI runs are always redirected to
 *  /pt-PT/login, which has no header. Each AC is documented as a manual
 *  verification step below.
 *
 *  Manual verification (requires .env.local + real Supabase + Google OAuth):
 *
 *  AC1 — Interactive widget, pointer cursor:
 *    1. Log in. Inspect the header identity area.
 *    2. Hover over the avatar/name. Confirm cursor becomes pointer.
 *    3. Confirm it is a single element, not a span next to a button.
 *
 *  AC2 — Sign-out accessible from widget:
 *    1. Click the identity widget. Confirm a dropdown appears with "Sair".
 *    2. Click "Sair". Confirm redirect to /pt-PT/login.
 *
 *  AC3 — Name and role visible in widget:
 *    1. Open the widget dropdown. Confirm display name and role label are shown.
 *
 *  AC4 — Admin, 375 px, no overflow:
 *    1. Log in as an admin (3 nav links visible).
 *    2. Set browser to 375 px wide (DevTools device mode).
 *    3. Confirm no horizontal scrollbar; scrollWidth == 375.
 *
 *  AC5 — Member, 375 px, no overflow:
 *    1. Log in as a member (1 nav link visible).
 *    2. Set browser to 375 px wide.
 *    3. Confirm no horizontal scrollbar; scrollWidth == 375.
 */
import { test } from '@playwright/test';

test('AC1–5: header identity widget — manual verification required', async () => {
  test.skip(true, 'AppHeader requires authentication; see manual steps in file header.');
});
```

#### Step 5 — Quality gates
After each code change, verify locally:
```
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

### Test plan mapped to ACs

| AC | Type | How verified |
|----|------|--------------|
| AC1 — pointer cursor on widget | Manual | Hover over `data-testid="user-widget-trigger"` in browser; confirm `cursor: pointer` |
| AC2 — sign-out accessible | Manual | Click widget; confirm `data-testid="sign-out-button"` appears; click it; confirm redirect |
| AC3 — name and role visible | Manual | Open widget; confirm `data-testid="user-identity"` text and `data-testid="user-role-label"` text are present |
| AC4 — admin, 375 px, no overflow | Manual | Admin session; DevTools 375 px; confirm `scrollWidth === 375` |
| AC5 — member, 375 px, no overflow | Manual | Member session; DevTools 375 px; confirm `scrollWidth === 375` |

No new automated Playwright assertions can be written for these ACs without
real Supabase credentials. This is consistent with the project's established
pattern for auth-gated UI (see `e2e/member-gating.spec.ts`, `e2e/design-system.spec.ts`).

### Risks and rollback

| Risk | Mitigation |
|------|------------|
| `<details>` open state persists on page navigation (SPA) | Acceptable — each page navigation re-renders the Server Component, resetting `<details>` to closed |
| Safari `<summary>` marker visible despite `list-none` | Add `[&::-webkit-details-marker]:hidden` class on `<summary>` |
| `user-identity` testid moved — breaks existing tests | Grep confirms no e2e test code asserts on `user-identity` (only manual comments reference it). Testid preserved on the new inner element |
| Admin with 3 nav links overflows at 375 px | Avatar-only trigger on `<sm` (`hidden sm:block` on name) reduces width; smoke test still passes |

Rollback: revert `AppHeader.tsx` to the prior `<span>` + `<form>` pattern and delete `UserWidget.tsx`. One-file rollback for the component, one file addition for the spec. No database migrations involved.

### Complexity tag
**standard** — touches two component files, creates one new component, adds one i18n key, adds one test file, and requires reasoning about the client/server component boundary (confirming Server Component is safe here) and mobile layout constraints.
