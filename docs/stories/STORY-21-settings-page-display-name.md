# STORY-21: Account settings page (display name override), reachable from the user menu
Epic: EPIC-01
Status: draft

## User story
As a logged-in user, I want to open "Definições" from my account menu and set
a display name of my own choosing, so that I'm not stuck with whatever name
Google put on my account.

## Context
Putting account-level controls (name, language, and later theme) behind the
avatar/account menu — rather than scattering individual toggles across the
header — is a standard, well-established pattern (Google, GitHub, Slack all do
this), not bad practice. It also keeps `AppNav`/`AppHeader` uncluttered, which
STORY-16 is already trying to achieve by removing the redundant "Início" link.
A single "Definições" entry in `UserWidgetMenu` (`components/UserWidgetMenu.tsx`)
that opens a dedicated settings page is the right shape: one discoverable
place, room to grow (this story: name; CHORE-06: language; CHORE-11: theme).

**Key finding while investigating:** the data model for this already exists.
`public.users.display_name` (migration `20260628000001`) has held a name since
STORY-03 shipped — but two things are wrong today:
1. `components/AppHeader.tsx` never reads it; it computes the greeting
   directly from `user.user_metadata.full_name` (the raw Google name),
   bypassing the DB column entirely.
2. `provisionUser()` (`app/auth/callback/route.ts`, "existing user" branch)
   **unconditionally overwrites** `display_name` from the Google name on
   **every login** — so even after this story ships an edit UI, a user's
   custom name would be silently wiped the next time they sign in. This must
   be fixed as part of this story, not left as a landmine.

## Acceptance criteria
1. Given a logged-in user, when they open the account menu (`UserWidgetMenu`),
   then a new "Definições" item is visible below the identity block and above
   "Sair", navigating to `/[locale]/settings`.
2. Given the settings page, when it renders, then it shows an editable name
   field pre-filled with the user's current `public.users.display_name` (or,
   if empty, the Google name as a placeholder-only default, never silently
   auto-saved).
3. Given a user submits a new, non-empty name, when the save succeeds, then
   `public.users.display_name` is updated and the header/account-menu
   immediately reflect the new name (no stale cache).
4. Given a user submits a blank name, then the request is rejected with a
   clear validation message (400, not written) — a user must always have a
   non-empty display name.
5. Given `provisionUser()` runs on a **returning** login, when the user
   already has a non-empty `display_name`, then it is **preserved**, not
   overwritten by the Google name (fixes the landmine above). Only a
   brand-new row (first login) or a currently-empty `display_name` is
   populated from Google's name.
6. Given `components/AppHeader.tsx`/`UserWidget.tsx`, when computing the
   displayed name, then the source of truth is `public.users.display_name`
   (falling back to Google name / email / `Auth.userFallback` only when the
   DB value is empty), not raw `user_metadata` directly.
7. Given an unauthenticated user, when they request `/settings` directly, then
   they are redirected to login (same guard convention as other pages).
8. Given all settings UI text, when it renders, then strings come from
   `messages/pt-PT.json` (AO90), tap targets meet the 44px floor, and the page
   has no horizontal overflow at 375px (same Playwright pattern as other
   screens).

## Out of scope
- The language switcher itself (CHORE-06 — will live on this same settings
  page; this story only needs to leave room/a section for it).
- The dark-mode toggle itself (CHORE-11 — same treatment).
- Email changes (email is Google-sourced and not user-editable here).
- Avatar/photo upload.
- Admin editing another user's display name (that would be a separate
  admin-management story if ever needed).

## Technical notes
- No new migration — `public.users.display_name` and its `NOT NULL DEFAULT
  ''` constraint already exist.
- Fix `provisionUser()` in `app/auth/callback/route.ts`: in the "existing
  user" branch, change the update to conditionally skip `display_name` when
  the current DB value is non-empty (e.g. fetch the existing `display_name`
  in the same `.select('id')` call by also selecting `display_name`, then
  only include it in the `.update()` payload if it's currently `''`).
- New Route Handler (e.g. `app/api/settings/display-name/route.ts`, PATCH):
  `requireAuth` (any logged-in user, not admin-only — this is self-service),
  validate non-empty trimmed string, update the caller's own row only
  (`WHERE id = user.id`, never another user's).
- New page `app/[locale]/settings/page.tsx` (Server Component, same
  `getSessionUser` guard pattern as other pages) + a small client form
  component for the name field.
- Update `components/AppHeader.tsx` to fetch `display_name` from
  `public.users` (likely extend `getUserRole`-style helper in
  `lib/auth/session.ts`, e.g. `getUserProfile(userId)` returning `{ role,
  display_name }` in one query) instead of reading `user_metadata` directly.
- `components/UserWidgetMenu.tsx`: add the "Definições" link between the
  identity block and the sign-out form (`<Link href="/settings">`).
- New i18n namespace `Settings` in `messages/pt-PT.json`.
- Complexity: **standard** — small UI surface, but touches the provisioning
  landmine (auth callback) and the shared display-name read path used by
  the header everywhere.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Complexity: `standard` (confirmed)
Justification: the UI surface itself (one form, one menu link) would be
`trivial`-adjacent, but the story requires correctly modifying
`provisionUser()` — a data-integrity fix in the auth callback path that
protects a user's own data from being silently overwritten on every login —
plus a new self-service Route Handler that writes to `public.users`, and a
change to the shared session-read helper (`lib/auth/session.ts`) consumed by
`AppHeader` on every authenticated page render. That's three interacting
modules (auth callback, auth session cache, header/menu chrome) plus a new
API surface, which is exactly the "multiple interacting systems" trigger for
`standard` per CLAUDE.md. Not `complex`: no concurrency, no admin/security
boundary beyond the existing `requireAuth` pattern, no multi-table writes.

### Affected areas
- **backend** (Route Handler, auth callback fix, session helper query)
- **frontend** (settings page, form component, header/menu wiring)
- **ux** (new page layout, i18n strings, 44px tap targets, 375px overflow)
- Not affected: data/infra (no new migration), ai-ml.

### Files to create/modify

1. **`app/auth/callback/route.ts`** (modify) — fix the `provisionUser()`
   overwrite landmine. See exact diff below (AC5).
2. **`lib/auth/session.ts`** (modify) — add a new cached helper
   `getUserProfile(userId)` returning `{ role, displayName }` in one query
   against `public.users`. Do **not** change the existing `getUserRole`
   signature/behavior — it's still used as-is by
   `app/[locale]/(app)/admin/users/page.tsx`,
   `app/[locale]/(app)/admin/people/page.tsx`, and
   `app/[locale]/(app)/page.tsx`; leave those call sites untouched.
3. **`components/AppHeader.tsx`** (modify) — replace the
   `getUserRole(user.id)` call and the `user.user_metadata?.full_name ??
   user?.email ?? tAuth('userFallback')` computation with a single
   `getUserProfile(user.id)` call. This is the "AC6" fix.
4. **`app/api/settings/display-name/route.ts`** (create) — `PATCH` handler,
   `requireAuth` (not `requireAdmin` — self-service), validates and updates
   the caller's own row.
5. **`app/[locale]/(app)/settings/page.tsx`** (create) — Server Component,
   guard + fetch profile + render form. Lives inside the `(app)/` route
   group so it inherits `AppHeader` chrome per the locale-layout convention.
6. **`components/DisplayNameForm.tsx`** (create) — `'use client'` form
   component: controlled input, submit handler, inline validation/error
   display, `router.refresh()` on success.
7. **`components/UserWidgetMenu.tsx`** (modify) — add a "Definições"
   `Link` between the identity block and the sign-out form/button, and
   explicitly close the `<details>` on click (see landmine note below).
8. **`components/UserWidget.tsx`** (modify) — thread a new
   `settingsLabel` prop (`t('settingsLink')` from the `Auth` namespace)
   down to `UserWidgetMenu`.
9. **`messages/pt-PT.json`** (modify) — add `Auth.settingsLink` and a new
   `Settings` namespace (keys enumerated below — add only what's actually
   consumed, per CLAUDE.md's i18n key-hygiene rule).
10. **`e2e/settings-display-name.spec.ts`** (create) — new spec file, CI-safe
    tests + documented manual/`E2E_WITH_AUTH` steps (see Test Plan).

No new migration. No changes to `types/user-management.ts`,
`lib/auth/guard.ts`, or `proxy.ts` — all already sufficient for this story.

### Exact fix for the `provisionUser()` overwrite landmine (AC5)

In `app/auth/callback/route.ts`, change the existence-check `.select()` to
also fetch `display_name`, then make the update payload conditional:

```ts
// 1. Check if a row already exists for this user.
const { data: existing, error: selectError } = await serviceClient
  .from('users')
  .select('id, display_name')
  .eq('id', user.id)
  .maybeSingle();

if (selectError) {
  throw selectError;
}

if (existing !== null) {
  // 2. Existing user — update email always; only populate display_name
  //    from Google when the DB value is currently empty (AC5: never
  //    overwrite a user-set name on a returning login).
  const existingDisplayName = (existing.display_name as string | null) ?? '';
  const updatePayload: { email: string; display_name?: string } = {
    email: user.email,
  };
  if (existingDisplayName === '') {
    updatePayload.display_name = displayName;
  }

  const { error: updateError } = await serviceClient
    .from('users')
    .update(updatePayload)
    .eq('id', user.id);

  if (updateError) {
    throw updateError;
  }
  return;
}
```

Update the function's doc comment (currently says "UPDATE email +
display_name, leaving role unchanged (AC2)") to describe the new
conditional behavior, referencing STORY-21/AC5.

### Shared `display_name` read path (AC6)

New helper in `lib/auth/session.ts`, following the existing `getUserRole`
pattern (React `cache()`, anon-key client, `users_select_own` /
`users_admin_select_all` RLS already permit this read):

```ts
export const getUserProfile = cache(async (userId: string) => {
  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('users')
      .select('role, display_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[getUserProfile] DB error:', error);
      return null;
    }

    return {
      role: row.role === 'admin' ? ('admin' as const) : ('member' as const),
      displayName: (row.display_name as string | null) ?? '',
    };
  } catch (err) {
    console.error('[getUserProfile] unexpected error:', err);
    return null;
  }
});
```

Both `components/AppHeader.tsx` and `app/[locale]/(app)/settings/page.tsx`
call `getUserProfile(user.id)` and derive the displayed/pre-filled name the
same way:

```ts
const googleName =
  (user.user_metadata?.full_name as string | undefined) ??
  (user.user_metadata?.name as string | undefined) ??
  '';
const displayName =
  profile?.displayName && profile.displayName !== ''
    ? profile.displayName
    : googleName || user.email || tAuth('userFallback'); // AppHeader
```

For the settings page, the raw `profile?.displayName ?? ''` is passed as the
input's `value` (empty when unset — never pre-filled with the Google name),
and `googleName` is passed separately as the `placeholder` (AC2's
"placeholder-only default, never silently auto-saved").

Because both `AppHeader` (in the shared `(app)/` layout) and the new
`/settings` page read from the same DB column via the same cached helper,
and neither the layout nor the page use Next.js data caching /
`revalidate`, there is no stale-cache risk across *full* navigations. The
one real staleness risk is client-side: after `DisplayNameForm` PATCHes
successfully, the already-mounted `AppHeader`/`UserWidgetMenu` (part of the
persistent `(app)/` layout, which does not remount on same-route-group
navigation) will not automatically refetch. `DisplayNameForm` must call
`router.refresh()` (from `@/i18n/navigation`'s `useRouter`, which is Next.js
App Router's `refresh()` re-invoking Server Components without a full
reload) immediately after a successful PATCH response, in addition to
updating its own local input state from the response body. This directly
satisfies AC3's "no stale cache."

### `UserWidgetMenu` landmine: closing the menu on "Definições" click

`/settings` is inside the `(app)/` route group, same as `/`. Client-side
navigation between routes in the same route group does **not** remount the
shared layout (`AppHeader`/`UserWidgetMenu`), unlike the sign-out flow
(which navigates to `/login`, outside the group, so the whole layout
unmounts). Without an explicit close, the dropdown `<details>` would still
be `open` after landing on `/settings`. Add an `onClick` on the new
"Definições" `Link` that sets `detailsRef.current.open = false` before
navigation (same ref already used for outside-click/Escape dismissal —
mirror the existing Escape handler's `details.open = false` line, no new
ref needed).

### Step-by-step approach (test-first where possible)

1. Write `e2e/settings-display-name.spec.ts` first with the CI-safe
   unauthenticated-401 regression test for the new Route Handler (mirrors
   `role-enforcement.spec.ts`'s `AC3` pattern), plus documented
   manual/`E2E_WITH_AUTH` steps for every other AC. This pins down expected
   behavior before implementation.
2. Fix `provisionUser()` in `app/auth/callback/route.ts` (AC5). Existing
   `e2e/provision.spec.ts` CI-safe tests must keep passing unmodified
   (they don't reach the provisioning branch with placeholder creds, so no
   update expected there — confirm after the change).
3. Add `getUserProfile` to `lib/auth/session.ts`.
4. Update `components/AppHeader.tsx` to use `getUserProfile` (AC6).
   Re-run `e2e/header-identity-widget.spec.ts` (CI-safe subset — most are
   `E2E_WITH_AUTH`-gated, but confirm nothing regresses at build/lint time).
5. Add the `Settings` namespace + `Auth.settingsLink` to
   `messages/pt-PT.json`.
6. Build `app/api/settings/display-name/route.ts` (PATCH): `requireAuth`,
   parse+validate JSON body defensively (invalid JSON → 400, per the
   project's Route Handler input-validation convention), trim, reject empty
   with 400, update via `createServiceClient()` scoped to
   `.eq('id', result.user.id)`.
7. Build `components/DisplayNameForm.tsx` (client form, fetch, inline
   error via `aria-live="polite"` + `data-testid`, 44px tap targets,
   `router.refresh()` on success, label/`htmlFor` association per WCAG
   SC 1.3.1).
8. Build `app/[locale]/(app)/settings/page.tsx` (guard redirect to login if
   `!user` — belt-and-suspenders alongside `proxy.ts`'s existing guard,
   AC7; fetch profile; render `<h1>` + `DisplayNameForm`).
9. Wire `components/UserWidget.tsx` → `components/UserWidgetMenu.tsx`
   ("Definições" link + explicit menu-close on click, AC1).
10. Manually verify in dev server per CLAUDE.md/memory ("QA must visually
    render UI stories") — open the settings page and menu at 375px and at
    desktop width, confirm no overflow, confirm tap targets, confirm the
    header updates after a save without a full reload.
11. Run full local gate: `npm run lint`, `npx tsc --noEmit`, `npm run
    build`, `npm run test:e2e`.

### Test plan mapped to acceptance criteria

- **AC1** ("Definições" visible, navigates to `/[locale]/settings`):
  `E2E_WITH_AUTH`-gated Playwright test — open widget, assert
  `data-testid="settings-link"` visible between identity block and sign-out
  button (DOM order assertion), click it, assert `toHaveURL(/\/pt-PT\/settings\/?$/)`
  (right-anchored, per the STORY-16 URL-matching lesson).
- **AC2** (pre-filled from DB, placeholder-only fallback to Google name):
  `E2E_WITH_AUTH`-gated test asserting the input's `value` equals the
  seeded `display_name` when non-empty; a second manual step for the
  empty-`display_name` case (input empty, `placeholder` attribute equals
  the Google name, and no network call fires on page load — assert via
  no request to the PATCH endpoint before any user interaction).
- **AC3** (save updates DB + header/menu reflect immediately):
  `E2E_WITH_AUTH`-gated test — submit a new name, assert 200 response,
  assert the header's `data-testid="user-identity"` (or the header's name
  span) shows the new value without a full page reload (i.e. do not call
  `page.reload()` in the test — navigate via the `Link`/router only, to
  actually exercise `router.refresh()`).
- **AC4** (blank name → 400, not written): two tests — (a) CI-safe:
  unauthenticated `request.patch('/api/settings/display-name', { data: {
  displayName: 'x' } })` → 401 (regression guard, mirrors
  `role-enforcement.spec.ts`); (b) `E2E_WITH_AUTH`-gated: authenticated PATCH
  with `displayName: '   '` (whitespace-only) → 400, and a follow-up GET/DB
  check confirms `display_name` was not changed.
- **AC5** (`provisionUser` preserves non-empty `display_name` on returning
  login): this is the hardest AC to cover with CI-safe automation (same
  limitation `provision.spec.ts` already documents — Supabase rejects any
  `code` with placeholder creds, so the provisioning branch itself is never
  reached in CI). Document as **manual verification** in the spec file,
  mirroring `provision.spec.ts`'s AC2 steps: (1) log in, (2) in Table
  Editor set `display_name` to a custom value, (3) log out, (4) log in
  again with the same Google account, (5) confirm `display_name` is
  unchanged. Additionally add a **unit-level TypeScript compile check**
  comment (like AC5 in `provision.spec.ts`) is not sufficient here since
  this is a runtime data behavior, not a type-narrowing guarantee — flag
  this as the one AC most worth a real Supabase local/staging check before
  merge (see CHORE-05, local Supabase integration tests, for the eventual
  automatable version of this).
- **AC6** (header/menu source of truth is `public.users.display_name`):
  covered indirectly by AC2/AC3's `E2E_WITH_AUTH` tests (same read path).
  Add one CI-safe regression assertion: `npx tsc --noEmit` catches any
  accidental reintroduction of a direct `user.user_metadata` read in
  `AppHeader.tsx` only if we also grep-guard it — add a one-line comment
  in `AppHeader.tsx` at the `getUserProfile` call site referencing AC6 so
  a future edit doesn't silently regress it (soft guard, not automatable
  cheaply).
- **AC7** (unauthenticated `/settings` → redirect to login): CI-safe test,
  same pattern as other protected routes —
  `await page.goto('/pt-PT/settings'); await expect(page).toHaveURL(/\/pt-PT\/login\/?$/)`.
  This exercises `proxy.ts`'s existing guard (no new proxy code needed);
  the page-level guard in step 8 is belt-and-suspenders and not
  independently observable via Playwright (same as the admin pages'
  convention).
- **AC8** (i18n strings, 44px tap targets, no 375px overflow): CI-safe
  overflow test at `/pt-PT/settings` mirroring
  `header-identity-widget.spec.ts`'s AC4/AC5 pattern (will redirect to
  login in CI without auth, so this really only asserts the *login* page's
  overflow unless gated — mark as `E2E_WITH_AUTH`-gated like the rest, plus
  a manual 375px DevTools check per the QA-visual-rendering memory note).
  Tap-target check: assert computed height of the input and save button
  `>= 44` via `boundingBox()` (after `toBeVisible()` guard, per the
  Playwright boundingBox() convention). String-hardcoding check: `npm run
  lint` plus a manual grep for raw Portuguese literals in the new files
  before commit.

### Risks and rollback notes

- **Risk**: the `provisionUser()` fix is the highest-value, highest-risk
  change — a mistake here could either (a) still overwrite custom names
  (regression of the very bug this story fixes) or (b) never update
  `display_name` from Google even for legitimately-empty rows (breaking
  first-login-after-story-03-but-before-this-story-existing-empty-name
  users). Mitigated by the conditional-payload approach (only omit the key
  when explicitly non-empty), which is a narrow, easily-reviewable diff.
- **Risk**: `router.refresh()` re-runs `getSessionUser`/`getUserProfile`
  for the whole layout on every save — cheap (single-row query, already
  cached per-request), no pagination/list concerns.
- **Risk**: forgetting to close the `<details>` menu on "Definições" click
  (see landmine note above) — low severity (cosmetic), but explicitly
  planned for to avoid a follow-up bug report.
- **Rollback**: all changes are additive except the two modified read/write
  paths (`provisionUser()`, `AppHeader.tsx`). Both are small, self-contained
  diffs; reverting the single commit/PR fully restores prior behavior. No
  migration to roll back.

### Open questions (non-blocking — reasonable defaults chosen above, flag for confirmation)

1. **i18n key set for `Settings` namespace** — the plan above proposes
   `title`, `nameLabel`, `saveButton`, `savingLabel`, `errorEmpty`,
   `errorGeneric` only (no success-toast copy), to follow the i18n
   key-hygiene rule (don't add unused keys). If a success confirmation
   message is desired UX, add `successMessage` and wire it in
   `DisplayNameForm`. Recommend proceeding without it (the header updating
   is itself the confirmation) unless product wants explicit toast/copy.
2. **`Auth.settingsLink` vs. a `Settings.navLabel` key** — the plan places
   the menu-item label in the existing `Auth` namespace (co-located with
   `signOut`, since both live in the same `UserWidgetMenu` component).
   Alternative: put it in the new `Settings` namespace. Either is fine;
   `Auth` was chosen for component-locality consistency with `signOut`.
3. **AC5 automated coverage gap** — flagged above; this story will ship
   with only manual verification for AC5, consistent with the existing
   `provision.spec.ts` precedent for the same CI limitation (no live
   Supabase project in CI). If the team wants stronger guarantees before
   merge, run the manual steps against a real dev Supabase project prior
   to sign-off, or fast-track CHORE-05 (local Supabase integration tests)
   first.

None of these block writing code — they are documented defaults, not
blocking ambiguities.

## Implementation notes (post-implementation)

- **Challenger WARNING fixes incorporated**: (1) the PATCH response body
  returns `{ displayName: trimmedName }`, not `{ ok: true }`
  (`app/api/settings/display-name/route.ts`), so `DisplayNameForm` syncs its
  input to the actual persisted value. (2) `DisplayNameForm` shows a
  transient inline "Guardado" confirmation (`data-testid="display-name-success"`,
  `aria-live="polite"`, auto-clears after 3s or on next edit) directly on the
  settings page, independent of reopening the account menu or viewport width.
- **Service-role UPDATE verified against the real dev Supabase project**:
  confirmed via a direct `PATCH` to the Supabase REST API
  (`/rest/v1/users?id=eq.<uuid>`) using `SUPABASE_SERVICE_ROLE_KEY` from
  `.env.local` — returned `200` with the updated row. This is the same
  grant/RLS path `createServiceClient()` uses in the Route Handler, so the
  "missing `service_role` GRANT" class of bug (see CLAUDE.md) does **not**
  affect this story's write path. No migration change was needed.
- **AC5 remains manual-verification only**, as scoped in the plan above —
  Supabase rejects any `code` param with placeholder CI credentials, so
  `provisionUser()`'s "existing user" branch is never reached in CI (same
  limitation documented in `e2e/provision.spec.ts`). Manual steps are
  documented in `e2e/settings-display-name.spec.ts`'s file header.
- **Sandbox environment note**: in this implementation sandbox (WSL2,
  no root), all Playwright browser-based tests fail to launch Chromium
  (`libnspr4.so` missing — the pre-existing "WSL2 gotcha" documented in
  CLAUDE.md). This affects every browser-based test in the suite, including
  pre-existing ones (`smoke.spec.ts`, `provision.spec.ts`, etc.), not just
  this story's new tests — confirmed by running the full suite before and
  after this change. `request`-fixture-only tests (no browser) run and pass
  normally, including this story's `AC4: unauthenticated PATCH` test and
  AC7's redirect behavior (independently verified via `curl`, since the
  Playwright `page`-based AC7 test cannot launch a browser here). CI (with
  `--with-deps`) is expected to run all tests, including the browser-based
  ones, without this limitation.
