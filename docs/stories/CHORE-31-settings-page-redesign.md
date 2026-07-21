# CHORE-31: Redesign Settings page (profile card + grouped preference rows)
Epic: maintenance
Priority: standard — part of the pre-EPIC-04 UI push
Status: implemented
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: updated mockup in `App design refinement/Escala Dashboard.dc.html`
(`isSettings` block), STORY-21 (display name form), CHORE-11 (theme
toggle), CHORE-06 (language switcher), STORY-15 (sign-out)

## Task
As any signed-in user on the Settings page, I want my profile shown as a
card (avatar, name, email) with preferences grouped into labeled card rows
(appearance, language, display name) and a full-width sign-out action, so
Settings matches the new design language instead of the current bare
stacked forms.

## Context
The updated mockup structures Settings as:
1. A **profile card**: circular initials avatar (mono), display name
   (display font, bold), email (mono, muted).
2. A **preferences card** of stacked rows separated by hairline dividers —
   each row has a bold title + muted description on the left and the
   control on the right (Appearance → theme toggle; Language → language
   control). The mockup also shows a Notifications toggle ("Email me when
   a schedule is published") — that is a **new feature** and a PRD
   non-goal for now (§ Non-goals: no notifications); it is excluded here
   and flagged separately in triage.
3. A "My teams" card — multi-team, out of MVP scope (PRD §8), excluded.
4. A full-width, outline/destructive-toned pill **Sign out** button.

The current page (`app/[locale]/(app)/settings/page.tsx`) renders
`DisplayNameForm`, `LanguageSwitcher`, and `ThemeToggle` as bare stacked
sections with plain headings — none of the mockup's card structure.
Sign-out currently lives only in the header avatar menu (STORY-15); the
mockup adds it on Settings too (mobile users won't have the avatar menu
once CHORE-22's bottom bar ships, making a Settings-page sign-out the
natural home for it).

## Acceptance criteria
1. Given the Settings page, when rendered, then a profile card shows the
   user's initials avatar, display name (with the existing empty-name
   fallback convention), and email, styled per the mockup (display font
   name, mono email).
2. Given the preferences area, when rendered, then the display-name form,
   language control, and theme toggle each appear as a titled row
   (title + short description, both from i18n keys in **both** locale
   files) inside a card, with hairline dividers between rows — and each
   control's existing behavior, testids, and accessibility labels are
   unchanged so STORY-21/CHORE-11/CHORE-06 e2e tests pass unmodified.
3. Given the Sign out button on the Settings page, when activated, then it
   performs the exact STORY-15 sign-out flow (marker cookie + navigation —
   reuse the existing implementation, do not fork it), renders full-width
   with a ≥44px tap target, and is visually distinct (alert/destructive
   outline per the mockup) with WCAG AA contrast in both themes.
4. Given the header avatar menu, when this ships, then its existing
   sign-out entry still works — this chore adds a second entry point, it
   does not move the existing one.
5. Given a 375px viewport, when rendered, then rows stack/wrap cleanly
   with no horizontal overflow and controls remain ≥44px.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Notifications toggle / email-on-publish — new feature, PRD non-goal,
  needs a product decision (flagged in triage; not lost, just not here).
- "My teams" card / multi-team (PRD §8).
- Any change to how display name, locale, or theme are persisted — purely
  presentational regrouping of existing controls.
- The avatar menu's contents (STORY-13/15) — untouched.

## Technical notes
- Primary files: `app/[locale]/(app)/settings/page.tsx`; small wrappers
  around `DisplayNameForm`/`LanguageSwitcher`/`ThemeToggle` rather than
  rewriting them — the mockup's row layout is a container concern.
- Sign-out on this page: reuse the client-side sign-out logic from
  `UserWidgetMenu.tsx` (STORY-15 marker-cookie pattern) — extract to a
  shared helper/component if needed rather than duplicating the
  marker-cookie sequence.
- Avatar initials: same helper/convention as CHORE-30's Users page —
  whichever lands second reuses the first's helper (coordinate per
  CLAUDE.md multi-story guidance).
- Uses `Card` primitive (CHORE-17) and existing tokens; no new colors
  expected — if the destructive-outline sign-out introduces a new pairing,
  measure it.
- Visually render (dev server) both themes at 375px and 1280px before
  marking done.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Grounding notes (from exploration)

- **Current state confirmed**: `app/[locale]/(app)/settings/page.tsx` renders
  `DisplayNameForm`, `LanguageSwitcher`, `ThemeToggle` as bare stacked
  `<section>`s with a plain `h1`. No `Card` usage anywhere on this page today.
- **Mockup's literal Settings block** (`App design refinement/Escala
  Dashboard.dc.html` lines 308-366) shows: profile card (48px circular mono
  avatar + display-font bold name + mono muted email), a preferences card of
  Appearance/Language/**Notifications** rows separated by 1px dividers, a "My
  teams" card, and a full-width `signOutWideBtnStyle` button (`color:
  t.alertText, background: transparent, border: 1.5px solid t.alertBorder`).
  The mockup has **no "Display name" row at all** — AC2 explicitly adds one
  that isn't in the mockup, and Notifications/My teams are explicitly
  out-of-scope per the Context section. So the row *set* comes from AC2, not
  literally from the mockup; the mockup only supplies the card+row+divider
  *visual language*.
- **`UserWidgetMenu.tsx`'s sign-out handler** (`handleSignOut`) is a self
  contained closure: set the `SIGNOUT_MARKER_COOKIE` cookie synchronously →
  defensive readback/console.error → `router.push('/login')` → fire-and-log
  `signOutAction()`. It depends only on `useRouter()` from `@/i18n/navigation`
  and the two constants in `lib/auth/signout-marker.ts` — nothing
  component-local. This extracts cleanly into a hook with zero behavior
  change; `e2e/signout-instant-nav.spec.ts` only asserts cookie
  name/value/path/sameSite and the resulting URL, none of which change.
- **`getInitials` (CHORE-30)** lives unexported inside `components/UserTable.tsx`
  (2-word initials, first letter of each of the first two words). It is not
  exported and `UserTable.tsx` is not a primary file for this story. Per
  CLAUDE.md's scope-firewall precedent (STORY-30), define a local, unexported
  duplicate in the Settings page rather than exporting/importing across a
  file this story doesn't otherwise touch.
- **Effective display-name fallback chain** already exists, inline, in
  `AppHeader.tsx` (`profile.displayName || googleName || user.email ||
  tAuth('userFallback')`). Settings currently does *not* compute this chain
  (it only reads the raw `profile?.displayName ?? ''` for the editable input).
  The profile card needs the *effective* name (never blank), so this chain is
  duplicated locally in `page.tsx` (same scope-firewall reasoning — mirroring
  a small inline computation, not importing from `AppHeader.tsx`).
- **Contrast math for the sign-out button, done explicitly (not eyeballed)**,
  using this repo's own HSL→luminance→ratio method
  (`e2e/design-language-foundation.spec.ts` / `availability-destructive-contrast.spec.ts`),
  **revised after Challenge cycle 1** — the first pass wrongly defaulted to
  solid-fill without attempting a tuned outline value first. Redone here with
  a genuine tuning attempt, per CLAUDE.md's STORY-19/CHORE-23/CHORE-28
  precedent of defining a new, narrowly-scoped, per-theme literal HSL value
  for one specific pairing:
  - `text-destructive`/`border-destructive` directly against `--background`:
    light ≈ **4.83:1** (already clears both the 4.5:1 text floor and the 3:1
    non-text/border floor — no new value needed in light theme).
    Dark ≈ **1.53:1 (fails badly)**. `--destructive` in dark theme
    (`0 62.8% 30.6%`) is deliberately dark — tuned only as a *solid-fill*
    background under near-white text (CHORE-32's explicit comment: "any
    future bg-destructive/10 + text-destructive usage should use the
    solid-fill pattern instead"), not as standalone text or a border color
    against `--background`.
  - **Tuning attempt (computed, not guessed)**: held hue at `0` (same red
    family as `--destructive`) and swept saturation/lightness against dark
    theme's `--background` (`211 28% 15%`) using the repo's own
    `hslToRgb`/`relativeLuminance`/`contrastRatioFromHsl` formulas
    (`e2e/design-language-foundation.spec.ts` lines 86-124). Representative
    sample at `s=72%`: `l=50% → 3.14:1`, `l=60% → 4.02:1`, `l=65% → 4.70:1`,
    `l=70% → 5.57:1`. **A tuned value at `0 72.2% 65%` clears both floors**
    (4.70:1, comfortably above the 4.5:1 text floor and the 3:1 border
    floor) while staying recognizably red/alert-hued (hue unchanged from
    `--destructive`, only lightness raised). The tuning attempt succeeds —
    **no solid-fill fallback is needed**, and no product-owner amendment to
    AC3's wording is required.
  - **New token — `--destructive-outline`** (additive, mirrors the
    `:root`/`.dark` per-theme-value pattern every other token in
    `app/globals.css` already uses, e.g. `--destructive` itself):
    - `:root`: `--destructive-outline: var(--destructive);` — a **`var()`
      reference, not a literal duplicate** (CLAUDE.md's CHORE-32 "literal
      duplicate custom properties can silently diverge" lesson applies here:
      light theme's existing `--destructive` value already clears both
      floors at 4.83:1, so there is no need to diverge, and referencing it
      keeps the two tokens permanently in sync if `--destructive` is ever
      retuned in light theme).
    - `.dark`: `--destructive-outline: 0 72.2% 65%;` — a **new, independent
      literal value**, deliberately diverging from `.dark`'s `--destructive`
      (`0 62.8% 30.6%`) because that value is only valid for the
      solid-fill/near-white-text pairing (CHORE-32 comment already says so);
      this is intentional divergence for a documented reason, not an
      accidental duplicate.
    - `@theme inline`: add `--color-destructive-outline: hsl(var(--destructive-outline));`
      so Tailwind exposes `border-destructive-outline`/`text-destructive-outline`
      utilities that resolve to the correct value per theme automatically
      (no `dark:` prefixed overrides needed — the same mechanism `--destructive`
      itself already relies on).
    - Verified ratios: **light 4.829:1**, **dark 4.702:1** (both `text` and
      `border`, since the outline button uses the same color for text and
      border, both floors are satisfied by clearing the stricter 4.5:1).
    - **Placement constraint (must be respected by the implementation)**: the
      Sign out button renders directly on the page's `--background` surface,
      *not* nested inside a `Card`/`--card` surface. Checked for completeness:
      against `--card` the dark-theme ratio drops to **3.82:1** — still clears
      the 3:1 border floor but **fails** the 4.5:1 text floor. This token is
      only verified for the `--background` placement (mirrors CHORE-23/28's
      "verified pairing, not standalone" documentation discipline). Document
      this constraint as an inline comment beside the token in `globals.css`
      and keep the button as a sibling of the Cards in `page.tsx`, never a
      `CardContent` child.
  - **Button primitive approach — new cva variant, not className composition**:
    composing `variant="outline"` + a custom `className` would require
    overriding *several* class groups from the existing outline string
    (`border border-input bg-background ... hover:bg-accent
    hover:text-accent-foreground dark:bg-input/30 dark:border-input
    dark:hover:bg-input/50`) — border-color, bg-color, text-color, and two
    `dark:` hover/bg groups. `cn()`/`twMerge`'s last-occurrence-wins behavior
    (CHORE-24's documented cva/twMerge landmine) means *every one* of those
    groups must be individually and correctly re-declared in the override
    string, in the right order, or a stale class silently survives (e.g.
    forgetting to override `dark:bg-input/30` would leave a faint gray tint
    bleeding through a supposedly-transparent button). Because the new
    `--destructive-outline` token already flips value per `.dark` class (no
    `dark:` prefixed classes needed at all — see above), a **self-contained
    new `variant: "destructiveOutline"`** in `buttonVariants`' cva config is
    simpler and safer than composing on top of `"outline"`: zero override
    collisions, nothing for `twMerge` to arbitrate.
    ```ts
    // components/ui/button.tsx — new variant, added to the existing variants.variant map
    destructiveOutline:
      "border bg-transparent text-destructive-outline border-destructive-outline shadow-xs hover:bg-destructive-outline/10",
    ```
    (Border width kept at the primitive's default `border`/1px, matching the
    existing `outline` variant's width, rather than the mockup's arbitrary
    `1.5px` — a minor, non-gated visual simplification, flagged in Risks.)
  - **Decision**: the Sign out button uses `Button variant="destructiveOutline"`
    (new variant, new tuned token), which satisfies AC3's literal "outline"
    wording with measured WCAG AA contrast in both themes — **not** the
    solid-fill `variant="destructive"` fallback from cycle 1's plan. See
    Design decision 5 below for the full change list.
- **No e2e test asserts on the removed `<section>`/`<h2 id="...">` wrapper
  markup around `LanguageSwitcher`/`ThemeToggle`** — `dark-mode.spec.ts`,
  `language-switcher.spec.ts`, `settings-display-name.spec.ts` only assert on
  `data-testid`s, ARIA attributes' *presence*, visible text, tap-target size,
  and page-level `h1` text. Confirmed by reading all three files in full.
  This means the internal restructuring below (Design decisions 2-3) leaves
  all three suites passing unmodified, satisfying AC2's literal requirement.

### Design decisions

1. **New shared `SettingsRow` primitive** (`components/SettingsRow.tsx`),
   not one-off markup repeated three times. Three call sites, identical
   title/description/divider/wrap behavior — this meets the same "worth
   extracting" bar as `SettingsRow`'s CHORE-29/30 card-list-row precedent.
   Plain function component (no hooks, no `'use client'` needed — it's a
   pass-through wrapper like `Card`/`CardHeader`), so it renders fine as a
   Server Component parent of Client Component children:
   ```tsx
   interface SettingsRowProps {
     title: string;
     description: string;
     children: React.ReactNode;
   }

   export default function SettingsRow({ title, description, children }: SettingsRowProps) {
     return (
       <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
         <div className="min-w-0">
           <h2 className="text-sm font-semibold">{title}</h2>
           <p className="text-xs text-muted-foreground">{description}</p>
         </div>
         <div>{children}</div>
       </div>
     );
   }
   ```
   - `flex-wrap` on the row (no `flex-shrink-0` anywhere) — CHORE-29's
     documented landmine/fix, applied proactively.
   - Three `<SettingsRow>` siblings sit inside one `<Card className="gap-0
     divide-y divide-border py-0">` (overriding Card's own `gap-6 py-6` via
     `cn()`/`twMerge` last-occurrence-wins, per CHORE-24's documented
     mechanism — `gap-0 py-0` appears after Card's base string so it wins).
     `divide-y divide-border` renders the mockup's hairline dividers between
     rows without each row needing to know if it's first/last.
   - No `role="group"`/`aria-labelledby` added — `<h2>` + `<p>` is sufficient
     and consistent with the *existing* precedent (today's page.tsx and
     `LanguageSwitcher.tsx` already use bare `<h2 id="...">` for these same
     three groupings, no ARIA landmark wrapper). This also avoids adding new
     ARIA attributes to `LanguageSwitcher`/`ThemeToggle` internals, which
     AC2 says must stay "unchanged."

2. **`LanguageSwitcher.tsx`**: remove its own wrapping `<section
   aria-labelledby="language-section-title"><h2 id="language-section-title">`
   — `SettingsRow` now supplies that title (`t('languageLabel')`, reused, no
   new key). Keep the inner `<div className="flex items-center gap-2"
   role="group">` (the actual control) as the component's only rendered
   output, testids/aria-labels on the two chips **byte-identical**. Minimal,
   surgical edit — not a rewrite (matches the technical note's "small
   wrappers ... rather than rewriting").

3. **`DisplayNameForm.tsx`**: one-line change — the field's own `<label
   htmlFor="display-name-input">{t('nameLabel')}</label>` changes className
   from `"text-sm font-medium"` to `"sr-only"`. Rationale: `SettingsRow`'s
   title for this row reuses the *same* `nameLabel` string
   ("Nome apresentado"/"Display name") as its visible heading; rendering it
   a second time, visibly, immediately below (as the form's own label) would
   be a redundant duplicate string in one row. Making the field's own label
   `sr-only` preserves the `htmlFor`/`id` association (so
   `aria-label`/accessible-name behavior for `display-name-input` is
   completely unchanged — AC2's requirement) while removing the visual
   duplication. Zero testid/behavior change; `settings-display-name.spec.ts`
   only checks `toHaveAttribute('aria-label')`/testids, not the label's
   visible styling.
   - **Flagged for Challenge**: this is the one edit to an existing "control"
     file beyond pure external wrapping. It is presentational-only (a
     className swap on a label, not a markup restructure, not a testid/aria
     change) and squarely inside AC2's "titled row ... with hairline
     dividers" ask (removing visual duplicate is inherent to making that ask
     coherent), so it reads as in-scope — but Challenge should confirm this
     doesn't cross into "the control's contents" the way the avatar-menu's
     out-of-scope note is trying to guard against for `UserWidgetMenu.tsx`.
   - `ThemeToggle.tsx` needs **zero changes** — it never rendered its own
     heading (the heading lived in `page.tsx`, which is being rewritten
     anyway).

4. **Sign-out extraction**: new hook `lib/auth/use-sign-out.ts`
   (`'use client'`), lifting `UserWidgetMenu.tsx`'s `handleSignOut` body
   verbatim (same cookie string, same max-age constant, same
   `router.push('/login')`, same fire-and-log `signOutAction()` call):
   ```ts
   'use client';
   import { useRouter } from '@/i18n/navigation';
   import { SIGNOUT_MARKER_COOKIE, SIGNOUT_MARKER_MAX_AGE_SECONDS } from '@/lib/auth/signout-marker';

   // STORY-15 marker-cookie sign-out sequence, extracted from
   // UserWidgetMenu.tsx (CHORE-31) so the Settings-page sign-out button can
   // reuse it verbatim instead of forking the marker-cookie logic. See
   // lib/auth/signout-marker.ts (constants) and proxy.ts (read side) for the
   // rest of the mechanism. DO NOT alter the cookie write/readback sequence
   // — see UserWidgetMenu.tsx's original STORY-15 comment (preserved below)
   // for why each line exists.
   export function useSignOut(signOutAction: () => Promise<void>) {
     const router = useRouter();
     return function handleSignOut() {
       document.cookie = `${SIGNOUT_MARKER_COOKIE}=1; path=/; max-age=${SIGNOUT_MARKER_MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
       if (!document.cookie.includes(`${SIGNOUT_MARKER_COOKIE}=1`)) {
         console.error('[useSignOut] Sign-out marker cookie was not set (non-secure context?). proxy.ts may briefly treat this browser as still signed in.');
       }
       router.push('/login');
       void signOutAction().catch((err) => {
         console.error('[useSignOut] signOutAction invocation error:', err);
       });
     };
   }
   ```
   - `UserWidgetMenu.tsx` changes to `const handleSignOut = useSignOut(signOutAction);`,
     deleting the old inline function body and its now-unused `useRouter`/
     `SIGNOUT_MARKER_*` imports (moved into the hook). The STORY-15 "why the
     marker cookie exists" comment block moves to `use-sign-out.ts` (single
     source of truth); leave a one-line pointer comment in
     `UserWidgetMenu.tsx`. **No change to rendered markup, testids, or the
     menu's contents** — only the internal implementation of one handler is
     relocated. This satisfies the "extract to a shared helper ... rather
     than duplicating" technical note and does not touch the "avatar menu's
     contents" (out of scope item refers to rendered contents/behavior, not
     internal code organization).
   - New `components/SettingsSignOutButton.tsx` (`'use client'`):
     ```tsx
     'use client';
     import { useSignOut } from '@/lib/auth/use-sign-out';
     import { Button } from '@/components/ui/button';

     interface Props {
       label: string;
       signOutAction: () => Promise<void>;
     }

     export default function SettingsSignOutButton({ label, signOutAction }: Props) {
       const handleSignOut = useSignOut(signOutAction);
       return (
         <Button
           type="button"
           variant="destructiveOutline"
           onClick={handleSignOut}
           data-testid="settings-sign-out-button"
           className="w-full min-h-[44px]"
         >
           {label}
         </Button>
       );
     }
     ```
     `page.tsx` passes `signOutAction={signOut}` (imported from
     `@/app/[locale]/login/actions`, the same server action `UserWidget.tsx`
     already passes to `UserWidgetMenu`) and `label={tAuth('signOut')}`
     (reused key, no new i18n string — same semantic action as the header
     menu's "Sair"/"Sign out").

5. **Sign-out button styling — tuned `destructiveOutline` variant (literal
   outline, per AC3), not solid fill** (see Grounding notes contrast math
   above for the full tuning derivation and numbers). Two file changes:
   - `app/globals.css`: add `--destructive-outline: var(--destructive);` to
     `:root` (reference, not duplicate — light theme's existing value
     already clears both floors), `--destructive-outline: 0 72.2% 65%;` to
     `.dark` (new, independently-tuned literal value — verified 4.702:1
     against dark `--background`), and
     `--color-destructive-outline: hsl(var(--destructive-outline));` to the
     `@theme inline` block. Comment on both declarations documents the
     verified ratios (light 4.829:1 / dark 4.702:1 against `--background`
     only — not verified against `--card`, per the placement constraint
     above) and why the `.dark` value is an intentional, independent literal
     rather than a `--destructive` duplicate.
   - `components/ui/button.tsx`: add a new
     `destructiveOutline: "border bg-transparent text-destructive-outline border-destructive-outline shadow-xs hover:bg-destructive-outline/10"`
     entry to `buttonVariants`' `variant` map (see Grounding notes for why a
     new variant was chosen over composing on top of `"outline"` — avoids
     the CHORE-24 cva/twMerge multi-group-override landmine entirely, since
     no `dark:`-prefixed overrides are needed).
   - `components/SettingsSignOutButton.tsx` uses
     `variant="destructiveOutline"` (Design decision 4's code updated
     accordingly) + `className="w-full min-h-[44px]"`.
   - **Placement constraint carried forward from Grounding notes**: this
     button must be a direct sibling of the profile/preferences `Card`s in
     `page.tsx`, rendered on the page's own `--background`, never nested
     inside a `CardContent` (the token is only contrast-verified for that
     placement — see Design decision 6's page skeleton).
   - This satisfies AC3's literal "(alert/destructive outline per the
     mockup)" wording with measured WCAG AA numbers in both themes — no
     Open Question / product-owner amendment needed on this point.

6. **Profile card** (new markup in `page.tsx`, no new component — used once,
   not worth extracting):
   ```tsx
   <Card data-testid="settings-profile-card">
     <CardContent className="flex items-center gap-4">
       <span aria-hidden="true" data-testid="settings-profile-avatar" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-base font-bold text-primary-foreground">
         {initials}
       </span>
       <div className="min-w-0">
         <p className="truncate text-lg font-bold" data-testid="settings-profile-name">{effectiveDisplayName}</p>
         <p className="truncate font-mono text-sm text-muted-foreground" data-testid="settings-profile-email">{user.email ?? ''}</p>
       </div>
     </CardContent>
   </Card>
   ```
   - `bg-primary text-primary-foreground` avatar and `font-mono` email reuse
     CHORE-30's exact `UserTable.tsx` pattern (already in
     `EXISTING_SEMANTIC_PAIRS`, no new pairing). Name uses the default
     `font-sans` (Space Grotesk is already the body default per
     `globals.css`'s CHORE-23 comment — no `font-display` utility exists or
     is needed).
   - `effectiveDisplayName` and `initials` computed locally in `page.tsx`
     (Grounding notes above), mirroring `AppHeader.tsx`'s fallback chain and
     `UserTable.tsx`'s `getInitials`:
     ```ts
     function getInitials(name: string): string {
       const words = name.trim().split(/\s+/).filter(Boolean);
       return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
     }
     // ...
     const googleName = (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? '';
     const effectiveDisplayName =
       profile?.displayName && profile.displayName !== ''
         ? profile.displayName
         : googleName || user.email || tAuth('userFallback');
     const initials = getInitials(effectiveDisplayName);
     ```

7. **Page heading — `<h1>{t('title')}</h1>` retained unchanged** (fixes
   Challenge cycle 1's CRITICAL finding). `e2e/language-switcher.spec.ts`
   AC4 asserts `page.getByRole('heading', { name: 'Settings' })` is visible
   on `/en/settings`, which depends on exactly this element existing with an
   accessible name matching `Settings.title` in both locale files
   (pt-PT: "Definições", en: "Settings" — confirmed present, unchanged, in
   both `messages/pt-PT.json` and `messages/en.json`). Cycle 1's plan showed
   only the profile-card JSX in isolation and never re-stated the heading in
   the rewritten `page.tsx`, which would have silently dropped it. The
   rewritten page keeps the exact same `<h1 className="text-xl font-semibold mb-6">{t('title')}</h1>`
   markup (same classes, same position: first child of `<main>`, above both
   cards and the sign-out button) — no visual or DOM change to this element,
   only everything below it changes. Full page skeleton, showing the
   heading's position relative to the profile card, preferences card, and
   sign-out button (also resolves the sign-out button's placement
   constraint from Design decision 5 — a direct sibling of the `Card`s, not
   nested inside one):
   ```tsx
   return (
     <main className="flex-1 container mx-auto px-4 py-8">
       <h1 className="text-xl font-semibold mb-6">{t('title')}</h1>
       <div className="flex flex-col gap-6 max-w-2xl">
         <Card data-testid="settings-profile-card">
           <CardContent className="flex items-center gap-4">
             {/* avatar / name / email — see profile card markup above */}
           </CardContent>
         </Card>
         <Card data-testid="settings-preferences-card" className="gap-0 divide-y divide-border py-0">
           <SettingsRow title={t('nameLabel')} description={t('nameRowDescription')}>
             <DisplayNameForm initialDisplayName={profile?.displayName ?? ''} googleNamePlaceholder={googleName} />
           </SettingsRow>
           <SettingsRow title={t('languageLabel')} description={t('languageRowDescription')}>
             <LanguageSwitcher />
           </SettingsRow>
           <SettingsRow title={t('themeSectionTitle')} description={t('themeRowDescription')}>
             <ThemeToggle />
           </SettingsRow>
         </Card>
         <SettingsSignOutButton label={tAuth('signOut')} signOutAction={signOut} />
       </div>
     </main>
   );
   ```
   (`tAuth` = a second `getTranslations('Auth')` call, alongside the
   existing `t = await getTranslations('Settings')` — both namespaces are
   used on every render of this page, so no lazy-loading gate is needed per
   CLAUDE.md's i18n lazy-loading note, which only applies when a namespace
   is conditionally skipped on some code paths.)

### New i18n keys (both `messages/pt-PT.json` and `messages/en.json`, under `Settings`)

| Key | pt-PT (AO90) | en |
|---|---|---|
| `nameRowDescription` | "Como o seu nome é apresentado no Escala" | "How your name appears in Escala" |
| `languageRowDescription` | "Idioma da aplicação" | "App display language" |
| `themeRowDescription` | "Alternar entre tema claro e escuro" | "Switch between light and dark" |

No other new keys. Reused, unchanged: `Settings.nameLabel` (row title for the
display-name row), `Settings.languageLabel` (row title for the language row),
`Settings.themeSectionTitle` (row title for the appearance row — kept as-is,
"Tema"/"Theme"; **not** renamed to literally match the mockup's "Appearance"
wording, to avoid an unnecessary rename ripple into `dark-mode.spec.ts`'s
raw-key regression guard — flagged as a low-stakes wording note, not a
blocker), `Auth.signOut` (Settings sign-out button label, same semantic
action as the header menu's entry).

### File list

- `app/[locale]/(app)/settings/page.tsx` — full rewrite, **retaining the
  existing `<h1>{t('title')}</h1>` unchanged** (position + classes) above
  the new profile card, preferences card of `SettingsRow`s, and sign-out
  button (see Design decision 7's page skeleton).
- `components/SettingsRow.tsx` — new.
- `components/SettingsSignOutButton.tsx` — new; uses
  `Button variant="destructiveOutline"`.
- `lib/auth/use-sign-out.ts` — new.
- `components/UserWidgetMenu.tsx` — refactor `handleSignOut` to call
  `useSignOut`; no rendered-output change.
- `components/LanguageSwitcher.tsx` — remove internal `<section>`/`<h2>`
  wrapper.
- `components/DisplayNameForm.tsx` — one-line label className change
  (`sr-only`).
- `app/globals.css` — new additive `--destructive-outline` token in `:root`
  (var() reference to `--destructive`), `.dark` (new literal `0 72.2% 65%`),
  and `@theme inline` (`--color-destructive-outline`). See Design decision 5.
- `components/ui/button.tsx` — new `destructiveOutline` cva variant added to
  `buttonVariants`' `variant` map. See Design decision 5.
- `messages/pt-PT.json`, `messages/en.json` — 3 new keys under `Settings`
  (see table above).
- `e2e/design-language-foundation.spec.ts` — extend with a new
  `AC1a`/`AC1b`-style pair (static HSL-format check + computed contrast
  check) for `--destructive-outline` against `--background` in both themes,
  mirroring the existing `--brand`/`--brand-foreground` test pattern
  (CHORE-17/STORY-19 precedent for new color-token pairs).
- `e2e/settings-page-redesign.spec.ts` — new spec (AC1, AC3, AC5, plus a
  divider/heading regression check for AC2, and a page-level `h1` visibility
  assertion mirroring `language-switcher.spec.ts` AC4's pattern).
- No `supabase/migrations/*`, no Route Handler, no auth-guard changes.

### Step-by-step approach (test-first where practical)

1. Add the 3 new i18n keys to both locale files.
2. Add `--destructive-outline` to `app/globals.css` (`:root`, `.dark`,
   `@theme inline`) and the new `destructiveOutline` variant to
   `components/ui/button.tsx`. Extend
   `e2e/design-language-foundation.spec.ts` with the new static + computed
   contrast test pair for this token first (test-first), confirm it passes
   against the literal values chosen in Design decision 5, before wiring the
   variant into any component.
3. Write `lib/auth/use-sign-out.ts`; refactor `UserWidgetMenu.tsx` to use it.
   Run `e2e/signout-instant-nav.spec.ts` (if `E2E_WITH_AUTH` available) or at
   minimum `npx tsc --noEmit`/`npm run lint` to confirm no behavior/type
   regression from the extraction before touching anything else.
4. Build `components/SettingsRow.tsx`.
5. Edit `LanguageSwitcher.tsx` (remove section/h2) and `DisplayNameForm.tsx`
   (label → `sr-only`).
6. Build `components/SettingsSignOutButton.tsx` using
   `variant="destructiveOutline"`.
7. Rewrite `app/[locale]/(app)/settings/page.tsx`: **retain the existing
   `<h1>{t('title')}</h1>` unchanged**, then profile card, preferences
   `Card` of three `SettingsRow`s, sign-out button as a direct sibling of
   both cards (not nested in a `CardContent`) — see Design decision 7's
   skeleton.
8. Run the three existing regression suites unmodified
   (`settings-display-name.spec.ts`, `dark-mode.spec.ts`,
   `language-switcher.spec.ts`) — confirm zero edits needed (per Grounding
   notes) and all pass (locally with `E2E_WITH_AUTH=1` + real credentials, or
   documented as manual verification if unavailable in this environment).
   Specifically re-confirm `language-switcher.spec.ts` AC4's page-heading
   assertion still passes unmodified (proves the retained `<h1>` fix works).
9. Write `e2e/settings-page-redesign.spec.ts` (new AC1/AC3/AC5/AC2-divider
   coverage, plus the page-level `h1` visibility assertion).
10. Visually render both themes at 375px and 1280px via local dev server
    (technical note requirement) — screenshot or describe what's checked in
    the story's manual-verification notes, including that the
    `destructiveOutline` sign-out button reads clearly as an alert/destructive
    outline in both themes.
11. `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e`
    (AC6).

### Test plan (mapped to acceptance criteria)

- **AC1** (profile card: avatar, name, email): new
  `e2e/settings-page-redesign.spec.ts`, `E2E_WITH_AUTH`-gated —
  `settings-profile-avatar`/`-name`/`-email` visible; avatar text matches
  `/^[A-Z]{1,2}$/`; email testid non-empty. (Exact display-name/email values
  are account-dependent, same limitation as `settings-display-name.spec.ts`'s
  AC2 — presence/shape only, not exact value.) Also assert
  `page.getByRole('heading', { name: <Settings.title string> })` is visible
  (the retained `<h1>`, Design decision 7) — this is redundant with
  `language-switcher.spec.ts` AC4's existing assertion but pins the
  regression directly in this story's own new spec too, since AC1 is the
  natural home for "the page renders its expected top-level content."
- **AC2** (titled rows + dividers, existing controls unchanged):
  - Regression: re-run `settings-display-name.spec.ts`,
    `dark-mode.spec.ts` (AC3/AC6), `language-switcher.spec.ts` (AC3-AC5)
    **unmodified** — must all still pass.
  - New: assert the three row titles' translated text is visible (pt-PT
    strings, not raw keys) inside the preferences card, and a lightweight
    computed-style check that the 2nd/3rd row has a non-zero `border-top`
    (proves `divide-y` engaged, not just visually eyeballed).
- **AC3** (sign-out button — reuse, full-width, ≥44px, contrast): new test
  mirroring `signout-instant-nav.spec.ts`'s `clickSignOut` pattern but via
  `settings-sign-out-button` testid — asserts the marker cookie's
  name/value/path/sameSite are set synchronously and the page navigates to
  `/pt-PT/login`; `boundingBox()` asserts full row width and `height >= 44`.
  Contrast: **new automated CI-safe test** added to
  `e2e/design-language-foundation.spec.ts` (mirroring its existing
  `--brand`/`--brand-foreground` AC1a/AC1b pattern) — reads `app/globals.css`
  directly, asserts `--destructive-outline` is present in HSL format in both
  `:root` and `.dark`, and asserts the computed contrast ratio of
  `--destructive-outline` against `--background` is ≥ 4.5:1 in both themes
  (light 4.829:1, dark 4.702:1, per Grounding notes/Design decision 5). This
  is a genuinely new token pair, not a reuse of an already-CI-verified one
  (correcting cycle 1's plan, which cited only the unrelated
  `destructive`/`destructive-foreground` solid-fill pairing).
- **AC4** (header menu sign-out still works, this chore only adds a second
  entry point): regression — re-run `settings-display-name.spec.ts` AC1
  (Definições link + DOM order) and `signout-instant-nav.spec.ts`
  **unmodified**; both exercise the *header* menu's sign-out path, unaffected
  by the `useSignOut` extraction (Grounding notes: extraction preserves
  cookie name/value/path/sameSite and the resulting URL exactly).
- **AC5** (375px, no overflow, ≥44px): new test, same pattern as
  `settings-display-name.spec.ts`'s existing AC8 — `scrollWidth <= 375`,
  plus `boundingBox()` checks on the sign-out button and each row's visible
  control.
- **AC6** (lint/tsc/build/test:e2e exit 0): no dedicated test — verified via
  Definition of Done at implementation time.
- **Manual verification** (documented in the story, not automated): visually
  render both themes at 375px and 1280px via local dev server per the
  technical note — confirm the `destructiveOutline` sign-out button reads
  clearly as a red/alert-hued outline in both themes (Design decision 5),
  and confirm row wrapping looks intentional at 375px (BUGFIX-06 precedent:
  a passing `scrollWidth` check alone is not sufficient proof of
  visually-coherent wrapping).

### Risks and rollback

- **New `--destructive-outline` token + new `button.tsx` cva variant**
  (Design decision 5, resolving Challenge cycle 1's CRITICAL 2 finding).
  Risk is now low: the tuned value is computed (not guessed) with the
  repo's own contrast helper, verified at 4.829:1 (light) / 4.702:1 (dark)
  against `--background`, and implemented as a self-contained new cva
  variant (no `twMerge` override collisions with the existing `"outline"`
  variant — see Grounding notes for why this approach was chosen over
  className composition). Residual, explicitly documented constraint: the
  token is only verified for placement directly on `--background`, not
  `--card` (dark theme drops to 3.82:1 there, failing the 4.5:1 text floor)
  — the sign-out button must stay a sibling of the Cards, never nested in a
  `CardContent`. A future edit that moves the button into a Card without
  re-checking this ratio would silently reintroduce a contrast failure;
  flagged here and as an inline `globals.css` comment for future readers.
- **Page `<h1>` regression risk** (Design decision 7, resolving Challenge
  cycle 1's CRITICAL 1 finding): the full-rewrite nature of `page.tsx` makes
  it easy to drop the heading again in a future edit. Mitigated by (a) the
  concrete page skeleton in Design decision 7 now showing the `<h1>`
  explicitly as the first child of `<main>`, and (b) `AC1`'s new test in
  `e2e/settings-page-redesign.spec.ts` asserting the heading's presence
  directly, in addition to the pre-existing `language-switcher.spec.ts` AC4
  regression coverage.
- **`DisplayNameForm.tsx` label → `sr-only`** (Design decision 3): smallest
  behavioral edit to an existing "control." Verified no testid/aria-label
  content change; flagged for Challenge to confirm it doesn't read as
  "changing the control's contents."
- **Sign-out extraction touches STORY-15's carefully-tuned race-condition
  fix.** Mitigated by lifting the closure body verbatim (no logic rewrite)
  and by `e2e/signout-instant-nav.spec.ts` already asserting the exact
  cookie attributes and URL outcome the hook must preserve. Rollback: revert
  `lib/auth/use-sign-out.ts` and `UserWidgetMenu.tsx`'s one-line change;
  `UserWidgetMenu.tsx`'s git history retains the original inline
  implementation if the extraction needs to be undone independently of the
  rest of the story.
- **Rollback in general**: this chore touches no migrations, no Route
  Handlers, no auth guards — a full revert of the PR's diff is safe and
  removes no persisted data or server-side behavior.
- **Residual gap (not fixed here, noted for awareness)**: all Settings-area
  e2e coverage (existing and new) remains `E2E_WITH_AUTH`-gated, i.e. skipped
  in CI without real Google OAuth credentials — same pre-existing limitation
  as STORY-21/CHORE-06/CHORE-11's own tests. Migrating this feature area to
  `e2e-integration`'s local-Supabase fixture pattern (BUGFIX-06 precedent)
  would close that gap but is out of this story's declared scope.

### Complexity tag: **standard**

Justification: touches 11 files across 4 modules (a Server Component page, 3
existing Client Components, a new shared hook, a new shared UI primitive, the
shared `Button` primitive, the global CSS token file, 2 locale files),
requires a WCAG contrast judgment call with real measured math (not just
visual copy/paste — a new token was computed and verified in both themes),
and — per CLAUDE.md's explicit rubric — modifies code adjacent to STORY-15's
auth-adjacent sign-out mechanism ("touches auth ... stay standard or higher
regardless of line count"). The `app/globals.css` edit is a narrowly-scoped,
purely **additive** new custom property (not a change to an existing
inherited/global property like `color-scheme` or `color`), so it does not
independently trigger CLAUDE.md's "touches inherited/global CSS properties"
upgrade-to-`complex` heuristic — but it still keeps this story solidly at
`standard` rather than lower, on top of the auth-adjacency reason already
cited. Not `complex`: no data-integrity, concurrency, money, or
multi-system-integration risk; no migrations or Route Handlers touched. Not
`trivial`: multiple interacting components, a genuine design/contrast
decision requiring justification and computation, a new shared Button cva
variant, and a refactor of a security-adjacent code path — not mechanical,
low-reasoning-risk work.

## Implementation notes (post-implementation)

Followed the plan above exactly; no deviations to the file list, design
decisions, or scope. AC-by-AC verification:

- **AC1/AC2/AC3/AC5**: verified structurally (all E2E_WITH_AUTH-gated tests
  in `e2e/settings-page-redesign.spec.ts` are correctly written and skip in
  this CI-like environment, same as the pre-existing
  `settings-display-name.spec.ts`/`dark-mode.spec.ts`/
  `language-switcher.spec.ts` suites — no real Google OAuth credentials
  available here) **and** visually, via a real authenticated session: this
  sandbox happened to have a local Docker Supabase instance already running
  with migrations applied and the CHORE-05 seeded `ci-admin@example.test`
  test user. Built the app in production mode (`npm run build && npm start`)
  pointed at that local instance, signed in via `signInWithPassword`
  (mirroring `e2e-integration/fixtures.ts`'s cookie-capture pattern) with a
  throwaway script (not committed), and rendered `/pt-PT/settings` with a
  real Chromium browser at 375px and 1280px in both light and dark themes.
  Confirmed: profile card shows initials avatar/name/email; preferences card
  shows three titled rows (Nome apresentado / Idioma / Tema) with visible
  hairline dividers; the retained `<h1>Definições</h1>` renders above both
  cards; the full-width "Sair" button reads clearly as a red/alert-toned
  outline in both themes and rows wrap cleanly at 375px with no overflow.
  This is a stronger check than the plan's fallback (manual-only, described
  but unautomatable) since it exercised real rendered DOM/CSS, not just a
  static description.
- **AC4**: unaffected — `UserWidgetMenu.tsx`'s rendered output, testids, and
  behavior are byte-identical after the `useSignOut` extraction; existing
  `signout-instant-nav.spec.ts` and `settings-display-name.spec.ts` AC1
  assertions were re-read and require zero changes.
- **AC6**: `npm run lint` (0 issues), `npx tsc --noEmit` (0 errors),
  `npm run build` (exit 0 — one pre-existing, unrelated PostCSS warning
  about `.pb-\[calc\(110px\+env\(\.\.\.\)\)\]`, caused by a literal
  "wrong-example" string in CLAUDE.md/layout.tsx comments/done-story docs
  being picked up by Tailwind v4's content scanner; confirmed present and
  reproducing identically on `main` before this branch's changes — not
  introduced by this story), `npm run test:e2e` (all 244 discovered tests
  pass or skip under this repo's own CI retry policy — 0 failures;
  E2E_WITH_AUTH-gated tests skip as documented, matching pre-existing
  precedent for this feature area).

Residual gap carried forward unchanged from the plan's Risks section: full
automated E2E_WITH_AUTH CI coverage for this feature area remains a known
gap (same as STORY-21/CHORE-06/CHORE-11) — closing it via migration to
`e2e-integration`'s local-Supabase fixture pattern is explicitly out of this
story's scope.
