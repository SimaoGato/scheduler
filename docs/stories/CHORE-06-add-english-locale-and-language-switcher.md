# CHORE-06: Add US English locale and language switcher
Epic: maintenance
Status: draft

## Task
Add US English (`en`) as a second locale alongside pt-PT, and expose a
language switcher so users can toggle between the two. Default locale remains
pt-PT.

## Context
The app currently has `localePrefix: 'always'` and a single `pt-PT` locale.
Adding `en` requires registering it in `i18n/routing.ts`, creating a full
`messages/en.json` translation file, and surfacing a switcher in the UI.
No DB, API, or auth changes are needed — next-intl handles the rest via the
existing dynamic `[locale]` route segment.

**Placement update (superseding the original plan):** the switcher does
**not** live as a bare control in `AppHeader`/`AppNav`. STORY-21 introduces a
`/[locale]/settings` page reachable from the account menu, consolidating
account-level preferences (display name, and later CHORE-11's theme toggle)
in one place instead of scattering controls across the header — this keeps
the nav decluttered (see STORY-16, which is actively removing a redundant nav
item for the same reason). This chore depends on STORY-21 shipping first (or
lands in the same PR if it's simpler to build the settings page shell once).

## Acceptance criteria
1. Given any user, when they visit `/pt-PT/*`, then all UI text is in
   European Portuguese (existing behaviour, no regression).
2. Given any user, when they visit `/en/*`, then all UI text is in US English.
3. Given any user, when they open `/[locale]/settings` (STORY-21), then a
   language switcher is visible there showing the current locale and
   allowing a one-click switch to the other locale.
4. Given a user on `/pt-PT/`, when they click the language switcher, then
   they are taken to `/en/` and all text updates to English without a full
   page reload (next-intl soft navigation).
5. Given a user on `/en/admin/users`, when they click the language switcher,
   then they are taken to `/pt-PT/admin/users` (same path, different locale).
6. Given an unauthenticated user, when they are redirected to login, then
   they land on `/pt-PT/login` (default locale preserved as pt-PT).
7. Given any state, when `npm run lint && npx tsc --noEmit && npm run build`
   run, then all exit 0 with no new errors.

## Out of scope
- Adding any locale other than `en` and `pt-PT`.
- Auto-detecting the user's browser locale (always default to `pt-PT`).
- Persisting the user's locale preference to the DB or a cookie.
- Translating content that lives outside `messages/` (e.g. Supabase error
  messages, email templates).

## Technical notes
- `i18n/routing.ts`: add `'en'` to `locales` array. `defaultLocale` stays
  `'pt-PT'`. `localePrefix` stays `'always'`.
- `messages/en.json`: create as a full translation of `messages/pt-PT.json`.
  Every key must exist; missing keys cause next-intl runtime warnings.
  Use US English conventions (e.g. "Sign in", "Administrator", "Member").
- Language switcher: a small component rendered on the `/[locale]/settings`
  page (STORY-21), not in `AppHeader`/`AppNav`. Use next-intl's `Link` with a
  `locale` prop pointing to the other locale and `href={pathname}` (current
  path) — this produces a locale-switched link with no extra JS.
  Alternatively use `useRouter` + `usePathname` from `@/i18n/navigation` for
  a button. Both approaches are valid; prefer the `Link` approach (zero
  client JS).
- The switcher label can be the locale code itself ("PT" / "EN") or a flag
  emoji — keep it simple.
- `proxy.ts` and `app/[locale]/layout.tsx` require no changes.

## Definition of Done
See CLAUDE.md.
