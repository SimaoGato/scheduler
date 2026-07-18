# CHORE-27: Roll out design language on the login page
Epic: maintenance
Priority: standard — visual-only, part of the pre-EPIC-04 UI push
Status: draft
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: updated mockup in `App design refinement/Escala Dashboard.dc.html`
(login screen, `loginWrapStyle`/`loginCardStyle` block), STORY-10 (login
page minimal shell)

## Task
As any user landing on the login page, I want it to reflect the approved
"Escala" design language (dark navy backdrop, wordmark card with the brand
offset-shadow, mono tagline), so the first screen anyone sees matches the
redesigned app instead of the old neutral shell.

## Context
The updated mockup's login screen shows: a full-viewport dark navy backdrop
(the mockup's `t.header` color), a centered white/dark card with a flat
brand offset shadow (`box-shadow: 0 6px 0 0 <brand>` — same treatment
CHORE-25 used for the Dashboard hero card), the "ESCALA" wordmark in the
display font, a monospace tagline, and a pill-shaped brand CTA.

The mockup renders email/password fields, but that is mockup artifice — this
app authenticates exclusively via Google OAuth (PRD #18, STORY-02). The
real page keeps only the existing `GoogleSignInButton` as its CTA. Do not
add email/password inputs.

The current page (`app/[locale]/login/page.tsx`) is a plain `bg-card`
rounded box on the default page background, with no brand color anywhere.

## Acceptance criteria
1. Given the login route, when rendered, then the page backdrop uses the
   dark header/navy surface (in both light and dark theme, per the mockup's
   navy-backdrop-in-both-themes choice) and the centered card carries the
   brand offset-shadow treatment consistent with CHORE-25's hero card.
2. Given the card, when rendered, then the app name renders as a wordmark
   in the display font and the tagline renders in the mono font, both
   sourced from existing i18n keys (`App.name`, `App.tagline`) — no new
   hardcoded strings.
3. Given the Google sign-in CTA, when rendered, then it keeps its existing
   `data-testid="google-signin-button"`, pill shape (CHORE-24), ≥44px tap
   target, and all existing behavior — no changes to the OAuth flow or
   error-message handling (`auth-error` testid preserved).
4. Given light and dark theme, when the page renders, then all
   text/background pairs (including the error banner on the new backdrop)
   meet WCAG AA 4.5:1, measured with the established HSL→luminance→ratio
   method — no eyeballed colors; reuse existing verified tokens where
   possible.
5. Given a 375px viewport, when rendered, then no horizontal overflow
   (`document.documentElement.scrollWidth` ≤ viewport) — the existing
   smoke-spec check for `/pt-PT/login` must keep passing.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0. Existing login-page e2e assertions
   (`design-system.spec.ts`, `button-pill-shape.spec.ts`,
   `smoke.spec.ts`) pass, updated only where they assert the old visual
   treatment (call any such update out in the PR).

## Out of scope
- Email/password authentication or any auth-flow change — Google OAuth only.
- The `/claim` page — separate surface; file a follow-up if it should get
  the same backdrop treatment.
- Header/nav chrome — CHORE-28/CHORE-22.

## Technical notes
- Primary files: `app/[locale]/login/page.tsx`, possibly
  `app/[locale]/login/layout.tsx` (or wherever the login route group's
  backdrop is set — login sits outside `(app)/` per ADR-009).
- The navy backdrop color should come from a token. The mockup uses its
  header color (`oklch(0.22 0.035 250)` light / `oklch(0.20 0.03 250)`
  dark). If CHORE-28 (header recolor) lands first, reuse its token; if this
  lands first, introduce the token here with contrast verification and let
  CHORE-28 consume it — whichever lands second must not duplicate the
  value. Coordinate per CLAUDE.md's multi-story shared-file guidance.
- The brand offset-shadow treatment already exists from CHORE-25's hero
  card — check for a reusable class/pattern before re-implementing.
- Visually render (dev server) both themes at 375px and 1280px before
  marking done.

## Definition of Done
See CLAUDE.md.
