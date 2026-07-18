# CHORE-31: Redesign Settings page (profile card + grouped preference rows)
Epic: maintenance
Priority: standard — part of the pre-EPIC-04 UI push
Status: draft
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
