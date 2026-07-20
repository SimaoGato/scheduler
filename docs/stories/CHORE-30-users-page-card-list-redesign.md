# CHORE-30: Redesign Users page as avatar card-list rows with badges
Epic: maintenance
Priority: standard — part of the pre-EPIC-04 UI push
Status: draft
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: CHORE-21 (Team page redesign — same row idiom), CHORE-29 (Roles
page redesign — same row idiom), updated mockup in
`App design refinement/Escala Dashboard.dc.html` (`isUsers` block,
`userRows`), STORY-05 (user management), STORY-08 (self-demotion guard)

## Task
As an Admin on the Utilizadores page (`/admin/users`), I want each account
shown as a card-style row with an initials avatar, name, email, and a role
badge, so the page matches the new design language and reads cleanly on a
phone.

## Context
The updated mockup renders each user as a bordered card row: a circular
initials avatar (mono font), name (display font, bold) with the email in
mono underneath, and pill badges on the right — in the mockup: a teams
badge, an ADMIN/Member role badge (admin = solid navy fill, member =
outline), and an Active/Invited status badge.

Two mockup elements do **not** map to this app's model and are excluded:
- **Teams badge** — multi-team is out of MVP scope (PRD §8).
- **"Invited" status / "Invite user" button** — there is no invite flow;
  accounts self-provision on first Google login (STORY-03) and link via
  the claim flow (STORY-11). Every listed account is definitionally
  active. Do not invent a status column.

What remains: avatar + name/email + role badge, plus the existing
promote/demote action restyled as a pill control.

## Acceptance criteria
1. Given the Utilizadores page, when rendered, then each user appears as a
   card-style row with: circular initials avatar (initials derived from
   display name, mono font), display name (display font), email (mono
   font), and a role badge — admin rendered as a solid filled pill,
   member as an outline pill, matching the mockup's visual hierarchy.
2. Given the existing promote/demote flow (including the STORY-08
   self-demotion block and the last-admin 409 guard), when used in the new
   layout, then behavior, API calls, error messages, and all existing
   `data-testid`s in `UserTable.tsx` are unchanged so STORY-05/08 e2e
   tests pass unmodified.
3. Given a 375px/390px viewport with long names/emails, when rendered,
   then no horizontal page overflow and no visually broken row (name and
   badges stay visually associated — BUGFIX-06's coherence standard, not
   just a scrollWidth pass).
4. Given all interactive controls, when measured, then ≥44px tap targets.
5. Given light and dark theme, when rendered, then all text/background
   pairs — including the solid role badge fill — meet WCAG AA 4.5:1 using
   existing verified tokens; if the navy header token (CHORE-28) is used
   for the admin badge fill per the mockup, verify that pairing
   explicitly.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Invite flow, "Invited" status, or any accounts-model change.
- Teams badge / multi-team anything (PRD §8).
- Roles and Team pages — CHORE-29/CHORE-21.
- Changing who can be promoted/demoted — presentation only.

## Technical notes
- Primary files: `components/UserTable.tsx`,
  `app/[locale]/(app)/admin/users/page.tsx`.
- Initials helper: mockup uses first letters of first two name words,
  uppercased — handle empty display names with the existing user-display
  fallback convention (CLAUDE.md), never render an empty avatar.
- Note the known pre-existing bug in `admin/users/page.tsx` (destructures
  `{ data }` without `error` — CLAUDE.md flags "fix it in the next story
  that touches that file"): if this chore touches that query, fix the
  destructuring per the documented pattern.
- Role badge needs no new tokens if it reuses verified pairs; measure any
  new combination.
- Visually render (dev server) both themes at 375px and 1280px before
  marking done.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Grounding notes (from exploration)

- **CHORE-29 (Roles) is Done** (`docs/stories/done/CHORE-29-...md`, PR #64) and
  is the direct precedent for this story's row idiom — its `<ul
  className="flex flex-col gap-2.5">` of `<li className="rounded-lg border
  bg-card px-4 py-3.5">` rows, its nested badge/actions `flex flex-wrap`
  grouping (BUGFIX-06 coherence pattern), and its hard-won correction that the
  grouping wrapper must **not** be `flex-shrink-0` (CHORE-29 PR #64 cycle-2
  fix) are all reused directly below. **CHORE-21 (Team page) has NOT
  landed** (`Status: draft`, no commits) — there is no additional precedent
  from that story to reconcile; CHORE-29 is the only landed reference.
- `components/UserTable.tsx` is a small `'use client'` component: state is
  just `rows`, `loadingId`, `errorMessage`; the only handler is
  `handleRoleChange` (PATCH `/api/admin/users/:id`). None of this changes —
  only the JSX/markup around it, exactly like CHORE-29's own constraint on
  `RoleTable.tsx`.
- **Pre-existing bug already fixed, no action needed**: CLAUDE.md flags
  `app/[locale]/(app)/admin/users/page.tsx` line 47 as destructuring `{ data
  }` without `error`. Reading the current file shows this is **already
  fixed** (`const { data, error } = ...` at line 47, with `if (error) {
  console.error(...) }` at lines 52-54) — confirmed via `git log -p` that a
  prior change ("W2 ... Destructure `{ data, error }`") landed this fix.
  CLAUDE.md's note is stale; no fix is required in this story. (Verify this
  again at implementation time in case of intervening changes, but no code
  change is expected here.)
- The mockup's `isUsers`/`userRows` block (`App design refinement/Escala
  Dashboard.dc.html` lines 368-397, `userRows` construction lines 652-662,
  shared `badge`/`listRow`/`avatar` style helpers lines 555-568) renders
  `<ul><li>` rows with: a 40px circular avatar (mono font, bold initials),
  name (display font, bold) + email (mono, muted, smaller) stacked on the
  left, and on the right: a teams badge (**excluded**, out of scope per
  Context), a role badge (`u.role === 'admin' ? badge(t.header, t.headerText)
  : { ...badge('transparent', t.muted), border: '1px solid ' + t.cardBorder
  }`), and a status badge (**excluded**, out of scope per Context — no
  invite flow, every account is definitionally active).
- **Admin badge token already exists and is already contrast-verified,
  confirming the mockup's own design 1:1**: CHORE-28 added
  `--header`/`--header-foreground` to `app/globals.css` specifically as
  "forward infrastructure for a future named consumer" (its own code comment
  names this exact use case: "CHORE-22's mobile bottom nav or CHORE-27's
  login page" as *candidate* future consumers, but this story's admin badge
  is an equally valid, in-fact-closer match — the mockup literally uses
  `t.header`/`t.headerText` for the admin role badge). Verified ratios (from
  `app/globals.css`'s own comment, CHORE-28): **16.38:1 (light) / 16.12:1
  (dark)** for `--header-foreground` on `--header` — comfortably clears
  WCAG AA 4.5:1 in both themes. This satisfies AC5's explicit ask ("if the
  navy header token is used for the admin badge fill … verify that pairing
  explicitly") by citation, not by re-measurement — the ratio is already
  computed and documented; this story just becomes its first live DOM
  consumer.
- **Member badge and avatar reuse other already-verified pairs, no new
  colors anywhere in this story**:
  - Avatar solid fill: `bg-primary text-primary-foreground` — already in
    `e2e/design-language-foundation.spec.ts`'s `EXISTING_SEMANTIC_PAIRS`
    gate (`['primary', 'primary-foreground']`), and already the exact
    pattern used by the header's own single-initial avatar
    (`components/UserWidgetMenu.tsx` line 120:
    `bg-primary text-primary-foreground`).
  - Member badge (outline pill, transparent bg + muted text): `border
    text-muted-foreground` sitting on the row's `bg-card` surface —
    `muted-foreground`/`card` is already contrast-verified per CLAUDE.md's
    CHORE-17 note (light ≈4.83:1, gated by
    `e2e/card-ui-primitive.spec.ts` AC2) — not in
    `EXISTING_SEMANTIC_PAIRS` (a different, already-existing gate), but
    already covered.
  - Row surface: `bg-card`/`card-foreground` — already in
    `EXISTING_SEMANTIC_PAIRS`.
  - **New step**: add `['header', 'header-foreground']` to
    `EXISTING_SEMANTIC_PAIRS` in `e2e/design-language-foundation.spec.ts`.
    This is a one-line addition to an existing generic loop (not new test
    code), and converts CHORE-28's "verified but zero live consumers" token
    pair into an actively regression-gated one now that this story gives it
    a real consumer — directly serves AC5.
- **No new i18n keys needed.** Role badge text reuses the existing
  `UserManagement.roleAdmin`/`roleMember` keys unchanged. No teams/status
  badge (out of scope) means no new keys for those either.
- **Existing e2e tests that DOM-depend on the `<table>`/`<tr>` structure
  (must be mechanically updated, CHORE-29 precedent)**:
  - `e2e/user-table-alignment.spec.ts` (STORY-14, `E2E_WITH_AUTH`-gated,
    line 42: `page.locator('tbody tr').first()`; line 45: `row.locator('td').last()`)
    — checks the promote/demote button sits flush against the *table
    actions cell's* right edge at desktop width. With no more `<table>`,
    there is no "actions cell" concept to translate 1:1; the closest
    faithful equivalent is: the button sits flush against the **row's own**
    right inner edge (accounting for the row's `px-4` padding), which is
    what "flush right" visually means in a card-row layout too, since the
    badge+button group is grouped with `justify-between` against the row's
    other side. This test's own docstring ("actions column alignment")
    needs an update to describe the card-row model, not just a selector
    swap — flagged as a slightly-more-than-mechanical change (see Step 6
    below for the literal proposed replacement).
  - `e2e/user-management.spec.ts` (STORY-08, line 140:
    `page.locator('tbody tr', { hasText: self.email })`) — one-line tag
    swap (`tr` → new row selector), zero assertion change.
  - **Confirmed unaffected**: `e2e-integration/admin-crud.spec.ts` and
    `e2e-integration/self-demotion.spec.ts` are pure API-level tests
    (`request.get/patch`), no DOM dependency — zero changes needed.
- **`AppNav.tsx` also renders `<li>` elements** (in the header's nav list,
  lines 72-129) — a bare `page.locator('li')` on the page would ambiguously
  match nav items too. To avoid relying on DOM nesting assumptions (`main
  li`) for test scoping, add one new **container** `data-testid="um-list"`
  to the `<ul>` wrapping the user rows. This is purely additive (AC2 says
  existing testids are unchanged — it does not forbid adding one new
  scoping hook) and gives tests an unambiguous anchor, matching the existing
  `data-testid="user-widget"`/`"user-widget-menu"` container-hook
  convention elsewhere in this codebase.
- **`public.users.id` is a FK to `auth.users(id) ON DELETE CASCADE`**
  (`supabase/migrations/20260628000001_create_users_table.sql` line 13) —
  a new e2e-integration fixture user (needed for AC3's long-name/long-email
  test) cannot be created with a bare `public.users` insert; it needs a real
  `serviceClient().auth.admin.createUser(...)` call (exactly
  `supabase/seed-test-users.mjs`'s own pattern) followed by an
  `upsert` into `public.users`, and cleanup via
  `serviceClient().auth.admin.deleteUser(id)` (cascades the `public.users`
  row automatically — no separate delete needed).

### Design decisions

1. **Row markup** — same idiom as CHORE-29, with an avatar added on the
   left:
   ```
   <ul data-testid="um-list" className="flex flex-col gap-2.5">
     <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3.5 text-card-foreground transition-colors hover:bg-muted/25">
       <div className="flex min-w-0 items-center gap-3">
         <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
           {initials}
         </span>
         <div className="min-w-0">
           <p className="truncate font-semibold">{nameText}</p>
           <p className="truncate font-mono text-xs text-muted-foreground">{user.email}</p>
         </div>
       </div>
       <div className="flex flex-wrap items-center gap-2">
         <span className={roleBadgeClass}>{user.role === 'admin' ? t('roleAdmin') : t('roleMember')}</span>
         {/* promote/demote button, or nothing for currentUserId, unchanged testids/logic */}
       </div>
     </li>
   </ul>
   ```
   - The right-hand group (`flex flex-wrap items-center gap-2`) is
     **intentionally nested but NOT `flex-shrink-0`** — this is CHORE-29's
     exact landmine and its exact fix (see CLAUDE.md's "CHORE-29
     flex-shrink-0 landmine" note). Since this row only ever has at most
     two right-hand items (one badge + one button — there is no
     confirm-remove multi-state like RoleTable), the overflow risk here is
     inherently smaller than CHORE-29's, but the pattern is applied
     identically and proactively so this story doesn't need its own
     hard-won correction cycle.
   - `truncate` (not RoleTable's "let it wrap" approach) is used for name
     and email, **a deliberate divergence from CHORE-29**: role names are
     admin-authored and short; emails are unbounded (real Google account
     emails, e.g. `first.middle.last.name+something@some-long-domain.example.com`)
     and wrapping a long email across 2-3 lines reads worse than a clean
     ellipsis truncation. `truncate` requires a bounded width to engage,
     provided by the parent's `min-w-0` (flex-item shrink) + the grandparent
     `min-w-0` on the left block. AC3's 375px/390px test must seed a
     deliberately long email/name to prove `truncate` actually engages
     (not just that short seeded strings happen to fit).
   - `rounded-lg border bg-card px-4 py-3.5`, `gap-2.5` on the `<ul>` — byte
     -identical to CHORE-29's already-approved values, no re-derivation
     needed.
   - Promote/demote button keeps `min-h-[44px]` and its exact existing
     `data-testid`s (`um-promote-${user.id}` / `um-demote-${user.id}`) and
     `onClick`/`disabled` wiring; only its className changes to
     `rounded-full` (pill, matching CHORE-24/CHORE-29's pill-actions
     convention) instead of `rounded-md`.
   - `roleBadgeClass`:
     - admin: `"rounded-full bg-header px-2 py-0.5 text-xs font-mono font-semibold text-header-foreground"`
     - member: `"rounded-full border px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground"`

2. **Initials + avatar-only fallback helper** (new, co-located in
   `UserTable.tsx`, same "small pure helper lives next to its one consumer"
   convention as `RoleTable.tsx`'s `isValidSlotsInput`):
   ```ts
   function getInitials(name: string): string {
     const words = name.trim().split(/\s+/).filter(Boolean)
     return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('')
   }
   ```
   Fallback resolution used **only** for avatar-initials derivation (using
   the existing `Auth.userFallback` i18n key — CLAUDE.md's documented "user
   display fallback" convention — rather than inventing a new key). The
   visible name text keeps today's exact behavior (`user.display_name ??
   '—'`), unchanged:
   ```ts
   const tAuth = useTranslations('Auth')
   // ...
   const nameText = user.display_name ?? '—'
   const initialsSource = (user.display_name ?? '').trim() !== '' ? user.display_name! : tAuth('userFallback')
   const initials = getInitials(initialsSource)
   ```
   **Revised after Challenge cycle 1**: the prior draft of this decision
   proposed also replacing the name cell's em-dash with the same fallback
   string, reasoning that an avatar showing "U" next to a name cell showing
   "—" looks internally inconsistent. Challenge correctly flagged this as
   scope creep — the Technical notes only mandate the *avatar* never be
   empty ("never render an empty avatar"); AC1 says nothing about changing
   visible name text, and the story's own "Out of scope" section is a
   presentation-only, minimal-footprint chore. **Reverted to option (a)**:
   the name cell keeps rendering `user.display_name ?? '—'` exactly as
   today; only the avatar's initials computation falls back to
   `Auth.userFallback` when `display_name` is null/blank. This does mean
   the row can show "U" in the avatar next to "—" in the name text in the
   (currently unobserved-in-practice) case of a null `display_name` — an
   accepted, narrow, presentation-only inconsistency preserved from before
   this story, not introduced by it, and out of this chore's declared
   scope to fix.

3. **`e2e/user-table-alignment.spec.ts` (STORY-14) update** — replace the
   `<td>`-based geometry check with a row-relative one:
   ```ts
   const row = page.locator('[data-testid="um-list"] > li').first();
   await expect(row).toBeVisible();
   const roleButton = row.locator('[data-testid^="um-promote-"], [data-testid^="um-demote-"]');
   await expect(roleButton).toBeVisible();

   const rowBox = await row.boundingBox();
   const btnBox = await roleButton.boundingBox();
   const gap = rowBox!.x + rowBox!.width - RIGHT_PADDING_PX - (btnBox!.x + btnBox!.width);
   expect(Math.abs(gap)).toBeLessThanOrEqual(RIGHT_EDGE_TOLERANCE_PX);
   expect(btnBox!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
   ```
   `RIGHT_PADDING_PX` stays `16` (the row's own `px-4`, same numeric value as
   the old table's `<td>` padding, coincidentally identical). Update the
   file's header docstring to describe "card row" instead of "table actions
   column." **Pre-existing risk, not introduced by this story**: `.first()`
   assumes the first rendered row is not the logged-in admin's own row
   (whose action button is hidden per STORY-08 AC1) — this assumption
   already existed in the current test and is not newly introduced; not
   fixed here (out of scope — a test-locator robustness issue, not a
   redesign concern, same category CHORE-29 flagged and deferred for
   `role-management.spec.ts`'s own pre-existing locator gap).

4. **`e2e/user-management.spec.ts` (STORY-08) update** — one-line selector
   swap only: `page.locator('tbody tr', { hasText: self.email })` →
   `page.locator('[data-testid="um-list"] li', { hasText: self.email })`.
   Zero change to any assertion or testid.

5. **New CI-enforced integration test**:
   `e2e-integration/users-card-list.spec.ts`, modeled directly on
   `e2e-integration/roles-card-list.spec.ts` (same `adminPage` fixture, same
   "no `E2E_WITH_AUTH` opt-in" BUGFIX-06 pattern). Fixture strategy: reuse
   the already-seeded `ADMIN_ID`/`MEMBER_ID` (`supabase/test-users.mjs`) for
   role-badge/testid assertions (no mutation of their `role`, to avoid
   colliding with `self-demotion.spec.ts`/`admin-crud.spec.ts`'s
   assumptions about seeded admin count), plus **one new throwaway fixture
   user** created via `serviceClient().auth.admin.createUser(...)` +
   `public.users` upsert (mirroring `supabase/seed-test-users.mjs`'s own
   two calls) with a deliberately long display name and long email, cleaned
   up via `serviceClient().auth.admin.deleteUser(id)` in `test.afterEach`
   (worker-isolated unique email per `testInfo.workerIndex`, STORY-14
   fixture-hygiene pattern).

### Affected areas

- **Frontend / UI** (primary): `components/UserTable.tsx` (markup
  restructure + new `getInitials` helper + fallback-name resolution; state
  machine and `handleRoleChange` untouched).
- **Test infra**: `e2e/user-table-alignment.spec.ts` and
  `e2e/user-management.spec.ts` (mechanical selector updates, both
  `E2E_WITH_AUTH`-gated, not CI-enforced), new
  `e2e-integration/users-card-list.spec.ts` (CI-enforced), one-line addition
  to `e2e/design-language-foundation.spec.ts`'s `EXISTING_SEMANTIC_PAIRS`.
- No backend/data/auth/migration changes. `app/[locale]/(app)/admin/users/page.tsx`
  needs no code change (its `{ data, error }` destructuring is already
  correct — verified above); confirm this again at implementation start in
  case of drift, but no diff is expected there.
- No new i18n keys in either locale file.

### Step-by-step approach (test-first where possible)

1. Re-confirm `admin/users/page.tsx`'s `{ data, error }` destructuring is
   still correct (grounding note above) — if somehow regressed, fix per the
   documented pattern before touching the component.
2. Write `e2e-integration/users-card-list.spec.ts` first (failing):
   - AC1: assert card row structure for the seeded `ADMIN_ID`/`MEMBER_ID`
     rows — avatar initials text, name, email (mono class), role badge text
     and class (`bg-header`/`text-header-foreground` for admin, `border`/
     `text-muted-foreground` for member).
   - AC2: click `um-promote-{tempUserId}` on the new throwaway member
     fixture, confirm optimistic role change to admin and that
     `um-demote-{tempUserId}` now renders in its place — proves the
     existing testids/handler still work end-to-end in the new markup, not
     just that they're present.
   - AC3: seed the long-name/long-email throwaway user, assert
     `document.documentElement.scrollWidth <= viewport width` at 375px and
     390px, and that the email/name actually render truncated (not merely
     "didn't overflow because it happened to fit"). **Added after Challenge
     cycle 1**: a `scrollWidth` assertion alone does not meet AC3's literal
     "no visually broken row … BUGFIX-06's coherence standard, not just a
     scrollWidth pass" bar. Mirror
     `e2e-integration/roles-card-list.spec.ts`'s own AC1 pattern (lines
     140-171): at each of 375px and 390px, capture
     `await page.screenshot({ path: 'test-results-integration/chore-30-users-card-list-375.png', fullPage: true })`
     (and the 390px equivalent) as committed-evidence artifacts. These
     screenshots are not self-verifying — they must be referenced by path
     in the PR description with an explicit ask for human visual
     confirmation that the row reads as intentional (avatar + truncated
     name/email on the left, badge/button flush right, no incoherent
     wrapping), per the BUGFIX-06 convention CLAUDE.md documents for this
     exact situation.
   - AC4: `boundingBox()` height ≥44px on the promote/demote button (after
     `toBeVisible()`).
3. Add `getInitials` + avatar-only fallback resolution to `UserTable.tsx`
   (name text keeps today's `user.display_name ?? '—'` unchanged, per
   Design decision 2's cycle-1 revision).
4. Restructure `UserTable.tsx`'s JSX per Design decision 1 — remove
   `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<td>` entirely, replace with the
   `<ul data-testid="um-list">`/`<li>` structure. Do not touch
   `handleRoleChange`, `rows`/`loadingId`/`errorMessage` state, or the
   `um-error` banner.
5. Update `e2e/user-table-alignment.spec.ts` (Design decision 3) and
   `e2e/user-management.spec.ts` (Design decision 4).
6. Add `['header', 'header-foreground']` to `EXISTING_SEMANTIC_PAIRS` in
   `e2e/design-language-foundation.spec.ts`.
7. Run the new `e2e-integration/users-card-list.spec.ts`, confirm it passes
   (CI-enforced going forward, BUGFIX-06 pattern).
8. Run the `E2E_WITH_AUTH=1` local-Supabase pass of
   `e2e/user-table-alignment.spec.ts` and `e2e/user-management.spec.ts`
   (manual/local verification step, same as CHORE-29's AC3 precedent —
   these specs are not re-verified automatically by AC6's CI run). Record
   the pass in this story's manual-verification notes before marking done.
9. Visually render (dev server) both themes at 375px and 1280px per the
   story's own Technical notes — confirm the row matches the mockup's card
   look (avatar, name/email, role badge) and that the admin badge's navy
   fill is legible in both themes.
10. `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e`.

### Test plan (mapped to acceptance criteria)

| AC | Test |
|---|---|
| AC1 (card row: avatar initials, name, email, role badge admin=solid/member=outline) | New `e2e-integration/users-card-list.spec.ts`: assert avatar text, name/email text and font classes, role badge text + class per role, for both seeded users. |
| AC2 (existing promote/demote flow + testids unchanged) | New spec's throwaway-user promote/demote DOM click test (proves testids are still wired to real behavior); plus the mechanically-updated `e2e/user-management.spec.ts` (STORY-08, `E2E_WITH_AUTH`, manual/local verification) and existing CI-enforced `e2e-integration/admin-crud.spec.ts`/`self-demotion.spec.ts` (API-level, unaffected by markup, still green). **Explicit gap, not new to this story**: AC2's error-message *rendering* for the last-admin 409 / self-demotion 400 paths (i.e., that `um-error`'s banner text is legible and correctly positioned inside the new `<li>` markup) has no CI-enforced coverage — only the `um-error` testid's *presence* and the API-level status/error-code assertions are CI-enforced (`e2e-integration/self-demotion.spec.ts`, `e2e/user-management.spec.ts`'s AC5-api tests). The full "error banner renders correctly with real text in the new card-row layout" path stays gated behind the pre-existing `E2E_WITH_AUTH` manual/local verification (`e2e/user-management.spec.ts`'s STORY-08 AC1-AC3), same as before this story — the redesign does not add this gap, it just doesn't close it either. |
| AC3 (375px/390px, no overflow, no visually broken row with long names/emails) | New spec: seed a long-name/long-email throwaway user, `scrollWidth` assertion at both widths, assert truncation actually engages, plus committed `page.screenshot()` evidence at both widths (BUGFIX-06 convention) referenced in the PR description for human visual confirmation — not a scrollWidth-only pass. |
| AC4 (≥44px tap targets) | New spec's `boundingBox()` check on the promote/demote button (`toBeVisible()` first); mechanically-preserved check in `e2e/user-table-alignment.spec.ts`. |
| AC5 (WCAG AA, incl. solid admin badge fill) | `['header', 'header-foreground']` added to `EXISTING_SEMANTIC_PAIRS` (16.38:1 light / 16.12:1 dark, already computed by CHORE-28, now actively gated); `primary`/`primary-foreground` and `card`/`card-foreground` already gated; `muted-foreground`/`card` already gated by `e2e/card-ui-primitive.spec.ts` AC2 — all cited, no new measurement needed. |
| AC6 (lint/tsc/build/test:e2e all exit 0) | CI + local run before marking done. |

### Risks and rollback

- **Risk**: the nested badge/button `flex-wrap` group could, in principle,
  hit the same CHORE-29 landmine if `flex-shrink-0` is mistakenly reapplied
  out of habit (it's a natural-looking class to add "to keep the button
  from getting squished"). Mitigated by Design decision 1's explicit note
  and by this story having a much smaller right-hand content set (badge +
  one button, never three+ items) than CHORE-29's confirm-remove state, so
  the failure mode is less likely to be triggered even if the mistake is
  made — but the plan calls it out up front rather than discovering it in
  a review cycle.
- **Risk**: resolved (Challenge cycle 1) — Design decision 2's fallback is
  now scoped to the avatar only, matching the Technical notes' literal
  wording exactly; the name cell is an unchanged ternary (`user.display_name
  ?? '—'`), so there is no remaining scope-creep risk here.
- **Risk**: `e2e/user-table-alignment.spec.ts`'s translation from "flush
  against the table cell" to "flush against the row" is a slightly
  judgment-based adaptation, not a pure mechanical tag swap (unlike
  CHORE-29's `tr`→`li` swaps). Mitigated by keeping the same numeric
  tolerance/padding constants and by this being an `E2E_WITH_AUTH`-gated,
  non-CI-blocking test — a wrong adaptation is caught in local verification
  (Step 8), not silently shipped.
- **Risk**: the new throwaway-user fixture (Design decision 5) uses real
  Supabase Admin API calls (`auth.admin.createUser`/`deleteUser`) — the
  heaviest fixture machinery in this story. Mitigated by mirroring
  `supabase/seed-test-users.mjs`'s exact, already-proven pattern, and by
  strict `test.afterEach` cleanup (STORY-14 fixture-hygiene convention) so
  a failed test doesn't leak a stray auth user into the local Supabase
  instance.
- **Rollback**: no migrations, no API routes, no shared-type changes
  (`UserRow` unchanged) — a revert is a clean single-PR revert with no data
  cleanup required.

### Complexity tag

**Standard.** Multi-file (Client Component markup rewrite + two
`E2E_WITH_AUTH`-gated spec updates + one new CI-enforced integration spec
with Admin-API fixture creation + a shared contrast-gate addition),
requires understanding the existing STORY-05/STORY-08 promote/demote/
self-demotion behavior well enough to preserve it exactly through a
structural markup change, and requires correctly re-applying the CHORE-29
flex-wrap/no-`flex-shrink-0` lesson rather than re-deriving it from
scratch. No auth, money, concurrency, or security surface — matches
CHORE-29's own classification and rationale exactly.

## Clarifying questions

None blocking — CHORE-29 (the direct precedent for this exact row idiom)
already resolved the open design questions (row markup, badge styling,
flex-wrap/overflow handling, WCAG verification approach) that would
otherwise need re-litigating here. The one genuine judgment call (Design
decision 2's name-cell fallback-text change) is flagged explicitly above
for Challenge to confirm rather than treated as a blocking question, since
a reasonable default (apply it) is stated and easily reversible.
