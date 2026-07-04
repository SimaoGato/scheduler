# CHORE-06: Add US English locale and language switcher
Epic: maintenance
Status: done ✅
PR: 27

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
4. Given a user on `/pt-PT/settings`, when they click the language switcher,
   then they are taken to `/en/settings` and all text updates to English
   without a full page reload (next-intl soft navigation).
5. Given a user on `/en/settings`, when they click the language switcher,
   then they are taken to `/pt-PT/settings` (same path, different locale).
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

## Implementation Plan

**Delivery context:** this story lands in the same PR/branch as CHORE-11
(dark-mode toggle) — **CHORE-06 is implemented FIRST, CHORE-11 second**
(orchestrator decision). Both converge on
`app/[locale]/(app)/settings/page.tsx` (STORY-21, already merged). This plan
treats the settings page as **shared real estate**: because it lands first,
this story is responsible for introducing the shared `flex flex-col gap-8`
wrapper (see step 5) and leaves the rest of the page structure untouched so
CHORE-11 can add its own sibling section inside that same wrapper without
restructuring. This story also creates `messages/en.json` for the first
time; CHORE-11 will add further keys to it afterward (see step 9). Verified
against the current file contents (not the story's original assumptions):
`app/[locale]/(app)/settings/page.tsx`, `i18n/routing.ts`, `i18n/navigation.ts`,
`messages/pt-PT.json` were all read directly before writing this plan.

### Decisions made while refining (not blocking, but flagged for visibility)

1. **AC4 and AC5 are scoped to `/settings` (already reflected in the AC text
   above).** The original draft of these ACs referenced `/` and
   `/admin/users`, written before the story's own **"Placement update"**
   paragraph (in Context, above) superseded the original plan and confined
   the switcher to the `/[locale]/settings` page only. Since neither of
   those original pages is reachable through the switcher (it doesn't
   render on `/` or `/admin/users`), the AC text itself has been corrected
   in place to target `/pt-PT/settings` / `/en/settings` — see the
   Acceptance Criteria section above, which is now the source of truth.
   This is a faithful proxy for both ACs' original intent (path-preserving
   locale switch) because the underlying mechanism (`usePathname()` +
   `Link`'s `locale` prop) is path-agnostic by construction — it is not
   special-cased to `/settings`, it just happens to only be *rendered*
   there. If a human reviewer disagrees and wants the switcher available on
   more pages (e.g. `AppHeader`), that's a scope change to raise before
   implementation, not during it.
2. **`i18n/routing.ts` needs `localeDetection: false`, not just an appended
   locale.** Today `locales: ['pt-PT']` is a single-entry array, so
   next-intl's default Accept-Language/cookie-based locale negotiation
   (`localeDetection: true` by default) is inert — there's only one option to
   negotiate to. Once `'en'` is added, a bare `/` request from a browser/CI
   runner whose `Accept-Language` is `en-US` (the common Playwright/Chromium
   default, and plausible for real users) would auto-redirect to `/en/`
   instead of the required default `pt-PT`. The story's own "Out of scope"
   section already states *"Auto-detecting the user's browser locale (always
   default to pt-PT)"* is explicitly not wanted — `localeDetection: false`
   (a `defineRouting` option, confirmed present in
   `node_modules/next-intl/dist/types/routing/config.d.ts`) is required to
   make that explicit requirement actually hold once a second locale exists.
   This does not touch `proxy.ts` (its own auth-guard redirects already
   hardcode `routing.defaultLocale` independently of next-intl's negotiation,
   so AC6 was never at risk) — it only affects `intlMiddleware`'s handling of
   unprefixed URLs for already-authenticated requests. Add this to
   `i18n/routing.ts` alongside the new locale.
3. **`App.name` ("Escala") is not translated** — it's a brand name, kept
   identical in both locales (same convention as e.g. "Slack", "Figma").
   `App.tagline` and every other key are translated.

### Affected areas
- **i18n / config**: `i18n/routing.ts` (add `'en'` locale + `localeDetection: false`).
- **data (translation content)**: new `messages/en.json`; two new keys added
  to `messages/pt-PT.json` (Settings.language*).
- **frontend**: new `components/LanguageSwitcher.tsx` (client component);
  edit to `app/[locale]/(app)/settings/page.tsx` to render it as a sibling
  section next to `DisplayNameForm`.
- **tests**: new `e2e/language-switcher.spec.ts`.

No backend/API/DB/auth changes.

### Step-by-step approach

1. **Routing config first** (`i18n/routing.ts`):
   ```ts
   export const routing = defineRouting({
     locales: ['pt-PT', 'en'],
     defaultLocale: 'pt-PT',
     localePrefix: 'always',
     localeDetection: false,
   });
   ```
   `i18n/navigation.ts` needs no change (it already derives everything from
   `routing`).

2. **Add the two new i18n keys to `messages/pt-PT.json`** under `Settings`:
   ```json
   "languageLabel": "Idioma",
   "switchToPortuguese": "Mudar para português",
   "switchToEnglish": "Mudar para inglês"
   ```

3. **Create `messages/en.json`** as a complete, key-for-key mirror of
   `messages/pt-PT.json` (including the two new keys above). Use these exact
   translations (AO90/US-English conventions, verified against every key
   currently in `messages/pt-PT.json`):

   ```json
   {
     "App": { "name": "Escala", "tagline": "Schedule management for service teams" },
     "Nav": { "ariaLabel": "Main navigation", "userManagement": "Users", "people": "Team" },
     "UserManagement": {
       "title": "User management",
       "columnName": "Name",
       "columnEmail": "Email",
       "columnRole": "Role",
       "roleAdmin": "Administrator",
       "roleMember": "Member",
       "promoteButton": "Promote to Administrator",
       "demoteButton": "Demote to Member",
       "errorLastAdmin": "Cannot remove the only Administrator.",
       "errorGeneric": "Something went wrong. Please try again.",
       "actionLoading": "Processing..."
     },
     "Member": {
       "noAccessTitle": "Welcome to Escala!",
       "noAccessDescription": "Your account is active, but you don't have access to any features yet. Talk to an administrator to get permissions.",
       "noRoleError": "Error loading your profile. Please contact the administrator.",
       "accessDenied": "You don't have permission to access this page."
     },
     "Home": {
       "welcome": "Welcome to Escala.",
       "description": "Schedule management for service teams.",
       "cta": "View schedule"
     },
     "PeopleManagement": {
       "title": "Team",
       "columnName": "Name",
       "addPersonLabel": "Add person",
       "namePlaceholder": "Name",
       "saveButton": "Save",
       "cancelButton": "Cancel",
       "editButton": "Edit",
       "removeButton": "Remove",
       "emptyList": "No people on the team.",
       "errorNameRequired": "Name is required.",
       "errorGeneric": "Something went wrong. Please try again.",
       "actionLoading": "Processing..."
     },
     "Auth": {
       "signInTitle": "Sign in to Escala",
       "continueWithGoogle": "Continue with Google",
       "signOut": "Sign out",
       "errorAccessDenied": "Sign-in cancelled.",
       "errorExchangeFailed": "Could not complete sign-in. Please try again.",
       "errorDefault": "Something went wrong during sign-in. Please try again.",
       "userMenuAriaLabel": "User menu",
       "userFallback": "user",
       "settingsLink": "Settings"
     },
     "Settings": {
       "title": "Settings",
       "nameLabel": "Display name",
       "saveButton": "Save",
       "savingLabel": "Saving...",
       "successMessage": "Saved",
       "errorEmpty": "Name cannot be empty.",
       "errorGeneric": "Something went wrong. Please try again.",
       "languageLabel": "Language",
       "switchToPortuguese": "Switch to Portuguese",
       "switchToEnglish": "Switch to English"
     }
   }
   ```
   Verify key-set parity mechanically, e.g.:
   `node -e "const a=require('./messages/pt-PT.json'), b=require('./messages/en.json'); const flat=o=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?Object.keys(v).map(k2=>k+'.'+k2):[k]); const [ka,kb]=[flat(a),flat(b)]; console.log(JSON.stringify(ka)===JSON.stringify(kb) ? 'OK' : {onlyInPt: ka.filter(k=>!kb.includes(k)), onlyInEn: kb.filter(k=>!ka.includes(k))})"`

4. **Create `components/LanguageSwitcher.tsx`** (`'use client'`, following the
   `DisplayNameForm.tsx` pattern for structure/testids):
   ```tsx
   'use client';

   import { useLocale, useTranslations } from 'next-intl';
   import { Link, usePathname } from '@/i18n/navigation';
   import { routing } from '@/i18n/routing';

   const LOCALE_LABELS: Record<string, string> = { 'pt-PT': 'PT', en: 'EN' };

   export default function LanguageSwitcher() {
     const locale = useLocale();
     const pathname = usePathname(); // locale-agnostic, e.g. "/settings"
     const t = useTranslations('Settings');
     const otherLocale =
       routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;
     const switchLabel =
       otherLocale === 'en' ? t('switchToEnglish') : t('switchToPortuguese');
     const otherLocaleLabel = LOCALE_LABELS[otherLocale] ?? otherLocale;

     return (
       <section className="flex flex-col gap-3 max-w-sm">
         <h2 className="text-sm font-medium">{t('languageLabel')}</h2>
         <div
           className="flex items-center gap-2"
           role="group"
           aria-label={t('languageLabel')}
         >
           <span
             data-testid="language-switcher-current"
             aria-current="true"
             className="min-h-[44px] inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium bg-accent"
           >
             {LOCALE_LABELS[locale] ?? locale}
           </span>
           <Link
             href={pathname}
             locale={otherLocale}
             data-testid="language-switcher-link"
             aria-label={`${otherLocaleLabel} — ${switchLabel}`}
             className="min-h-[44px] inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
           >
             {otherLocaleLabel}
           </Link>
         </div>
       </section>
     );
   }
   ```
   Notes: `usePathname`/`Link` from `@/i18n/navigation` work identically in
   Server and Client components (see CLAUDE.md), but `useLocale` requires
   client context here since it's a hook — hence `'use client'`. `data-testid`
   values are locale-agnostic (`-current`/`-link`, not suffixed with the
   locale code) so tests don't need to branch on which locale is active.
   **Accessible name (WCAG 2.5.3 Label in Name)**: the link's visible text is
   just the locale code (e.g. "EN"), so its `aria-label` is composed as
   `${otherLocaleLabel} — ${switchLabel}` (e.g. "EN — Mudar para inglês"),
   following the same pattern CLAUDE.md documents for `UserWidgetMenu`'s
   `aria-label` composition. This guarantees the visible label text is a
   substring of the accessible name — a bare `aria-label={switchLabel}`
   (e.g. just "Mudar para inglês") would not textually contain "EN" and
   risks failing WCAG 2.5.3 for speech-input users who target elements by
   their visible label.

5. **Wire into the settings page, and own creation of the shared wrapper**
   (combined-PR coordination — CHORE-06 lands first in the shared branch/PR,
   before CHORE-11). Currently `settings/page.tsx` renders only
   `<DisplayNameForm />` as the sole child of `<main>`, with no wrapper `<div>`
   around it. **This story is explicitly responsible for introducing the
   `<div className="flex flex-col gap-8">` wrapper** around the page's
   children, adding `LanguageSwitcher` as a sibling inside it. This is a
   prerequisite for CHORE-11, which lands *second* and will add `ThemeToggle`
   as a third sibling inside this same wrapper without needing to restructure
   the page:
   ```tsx
   <main className="flex-1 container mx-auto px-4 py-8">
     <h1 className="text-xl font-semibold mb-6">{t('title')}</h1>
     <div className="flex flex-col gap-8">
       <DisplayNameForm ... />
       <LanguageSwitcher />
       {/* CHORE-11 adds <ThemeToggle /> here as a third sibling */}
     </div>
   </main>
   ```
   Do not add any language-switching logic to `AppHeader`, `AppNav`, or
   `UserWidgetMenu` — out of scope per the Context section's placement
   update.

6. **Tests** (`e2e/language-switcher.spec.ts`, new file) — write before/alongside
   the component per repo convention (see step-by-step test-first framing
   below in the Test Plan). CI-safe tests do not require `E2E_WITH_AUTH`;
   settings-page tests do (mirrors `e2e/settings-display-name.spec.ts`).
   **AC4/AC5 URL assertions must use `toHaveURL` with a right-anchored regex**
   per the CLAUDE.md convention (`toHaveURL(RegExp)` matches the full href
   including origin, e.g. `http://localhost:3000/en/settings`, not just the
   pathname — a left-anchored pattern like `/^\/en\/settings/` will silently
   never match). Use e.g. `await expect(page).toHaveURL(/\/en\/settings\/?$/)`
   for AC4 and `await expect(page).toHaveURL(/\/pt-PT\/settings\/?$/)` for
   AC5 — right-anchored, no leading `^`.

7. **Regression pass**: run the full existing e2e suite locally
   (`npm run test:e2e`) to confirm no existing pt-PT-hardcoded assertions
   break now that a second locale exists (expected: none should, since
   `defaultLocale` is unchanged and `localePrefix` stays `'always'`).

8. Run `npm run lint`, `npx tsc --noEmit`, `npm run build` per Definition of
   Done (AC7).

9. **Combined-PR coordination note (key-parity re-check ownership)**: this
   story creates `messages/en.json` for the first time (step 3) and verifies
   key-set parity against `messages/pt-PT.json` at that point. CHORE-11
   (landing second in the same PR) will subsequently add new
   `Settings.theme*` keys (e.g. `themeLabel`, `themeLight`, `themeDark`) to
   **both** `messages/pt-PT.json` and this story's newly-created
   `messages/en.json`. Because CHORE-06 lands first, its own key-parity
   check (step 3) will pass but only reflects the key set as of this story —
   it does **not** cover keys CHORE-11 adds afterward. Whoever implements
   CHORE-11 (landing last) is responsible for re-running the same key-parity
   check command (from step 3) after both stories' message-file edits have
   landed, to confirm the two files are still key-for-key identical. This
   story does not need to implement that re-check itself — it only needs to
   leave this expectation documented so it is not lost between the two
   implementer passes.

### Test plan (mapped to ACs)

| AC | Test | Type |
|----|------|------|
| AC1 (pt-PT unaffected) | New: `page.goto('/pt-PT/login')` → assert `t('Auth.continueWithGoogle')` text ("Continuar com Google") visible. Plus: full existing suite still green (regression). | CI-safe |
| AC2 (en works) | New: `page.goto('/en/login')` → assert English string ("Continue with Google") visible; assert app name still "Escala" (untranslated brand name). | CI-safe |
| AC3 (switcher visible on settings, shows current locale) | New, auth-gated: `page.goto('/pt-PT/settings')` → assert `language-switcher-current` shows "PT" and `language-switcher-link` shows "EN" and is visible/clickable. | `E2E_WITH_AUTH` |
| AC4 (settings-scoped, see Decision 1) | New, auth-gated: on `/pt-PT/settings`, click `language-switcher-link`; assert `await expect(page).toHaveURL(/\/en\/settings\/?$/)` (right-anchored regex per CLAUDE.md's `toHaveURL(RegExp)` convention — matches full href including origin, no leading `^`); assert `t('Settings.title')` English text visible. To assert "no full reload," set a `window.__marker` value before click and assert it survives after (a full navigation would reset it) — same reasoning class as STORY-21's router.refresh() test. | `E2E_WITH_AUTH` |
| AC5 (settings-scoped, see Decision 1) | New, auth-gated: on `/en/settings`, click `language-switcher-link`; assert `await expect(page).toHaveURL(/\/pt-PT\/settings\/?$/)` (same right-anchored convention; path segment preserved, locale swapped). | `E2E_WITH_AUTH` |
| AC6 (unauth → /pt-PT/login) | Existing `e2e/login-redirect.spec.ts` regression. Add one new CI-safe test: unauthenticated `page.goto('/')` with Playwright context `locale: 'en-US'` still redirects to `/pt-PT/login` (defends the `localeDetection: false` fix on the unauthenticated path, which is already guaranteed structurally by `proxy.ts`'s hardcoded redirect, but worth locking in explicitly now that two locales exist). Add one auth-gated test: authenticated `page.goto('/')` with `locale: 'en-US'` context still lands on `/pt-PT/` (this one actually exercises `intlMiddleware`'s negotiation path, which the CI-safe test above does not, since `proxy.ts`'s guard intercepts unauthenticated requests before `intlMiddleware` runs). | CI-safe + `E2E_WITH_AUTH` |
| AC7 (lint/tsc/build) | No dedicated test; verified as part of Definition of Done during implementation and by CI. | Manual/CI |

### Risks and rollback

- **Risk**: incomplete/mismatched `en.json` keys → next-intl runtime
  warnings, missing text falls back to raw key. Mitigated by the key-parity
  check command in step 3 and the exhaustive translation table above.
- **Risk**: `localeDetection: false` is easy to omit since it's not in the
  original story's Technical Notes — flagged explicitly above (Decision 2)
  because it's the one non-obvious, easy-to-miss piece of this otherwise
  mechanical story.
- **Risk (shared file)**: `app/[locale]/(app)/settings/page.tsx` is edited by
  both this story and CHORE-11 in the same PR. Mitigated by keeping each
  addition to a single self-contained sibling element inside the shared
  `flex flex-col gap-8` wrapper (step 5) — neither story should restructure
  `<h1>`/`<main>` or the other's section.
- **Rollback**: fully reversible, no migrations. Revert `i18n/routing.ts`'s
  `locales`/`localeDetection` lines, delete `messages/en.json`, remove the
  two new keys from `messages/pt-PT.json`, delete
  `components/LanguageSwitcher.tsx`, and remove its usage from
  `settings/page.tsx`.

### Complexity tag: **standard**

Justification: multi-file (routing config, new translation file, new
component, page edit, new test file), requires understanding next-intl's
locale-negotiation semantics well enough to catch the non-obvious
`localeDetection` gap (a real correctness risk, not just mechanical
copy-paste), and requires coordinating a shared file (`settings/page.tsx`)
with a parallel story in the same PR. Not `complex`: no auth/data-integrity/
concurrency/money/security surface, and it's contained to i18n + one new UI
component (not 3+ interacting systems).
