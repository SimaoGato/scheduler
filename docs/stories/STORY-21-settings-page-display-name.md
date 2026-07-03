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
