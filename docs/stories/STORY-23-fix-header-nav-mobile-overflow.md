# STORY-23: Fix header/nav horizontal overflow at 375px viewport
Epic: EPIC-01
Status: draft

## User story
As a user on a phone, I want the app header and navigation to fit my screen
width without horizontal scrolling, so that the app feels correct and
trustworthy on the device most people actually use it on.

## Context
STORY-12 (done ✅) originally shipped the header/nav with explicit ACs 4/5
requiring no horizontal overflow at a 375px viewport (iPhone SE baseline),
verified manually at the time. Since then, **CLAUDE.md's Playwright section
documents a confirmed regression**:

> Known issue: app header/nav horizontal overflow at 375px viewport — the
> app's persistent `<header>` and nav chrome overflow the 375px mobile
> viewport by approximately 16px (`document.documentElement.scrollWidth` ≈
> 391px vs 375px viewport), confirmed on both `/pt-PT/admin/people` and
> `/pt-PT/` home page.

This was most likely introduced by nav growth after STORY-12 shipped —
`AppNav.tsx` gained conditional "Utilizadores" and "Equipa" admin links later,
widening the admin nav beyond what STORY-12 measured. The regression is
currently referenced defensively in STORY-14's test notes (to explain an
unrelated test failure) and in STORY-01's smoke test, but **no story owns
fixing it** — it is documented as a known limitation, not tracked as work.

This is exactly the kind of mobile-quality gap the user flagged: things that
"work" but aren't optimal, and that must not be allowed to accumulate as the
app grows more interaction-heavy (see STORY-18's mobile-tap-target amendment
for the same standard applied elsewhere).

## Acceptance criteria
1. Given an admin user, when the header/nav render at a 375px viewport on
   `/pt-PT/` (home) and `/pt-PT/admin/people`, then
   `document.documentElement.scrollWidth <= 375` (no horizontal overflow).
2. Given a member user, when the header/nav render at a 375px viewport on any
   page they can access, then `document.documentElement.scrollWidth <= 375`.
3. Given the fix, when checked across the admin nav's widest state (all
   current admin links: Utilizadores, Equipa, plus any added since), then it
   still fits without overflow — the fix must not be a one-off measurement
   that breaks again the next time a nav link is added.
4. Given the existing STORY-14 test note referencing this bug (as a caveat
   for an unrelated AC3 assertion) and any other test/doc referencing it, when
   this story ships, then those references are updated or removed since the
   underlying bug no longer applies.
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0 with a real (not `test.skip`) assertion for AC1
   at minimum, gated the same way as other auth-required tests
   (`E2E_WITH_AUTH`).

## Out of scope
- A responsive hamburger menu — STORY-12 explicitly deferred this "unless
  overflow persists"; try layout fixes (wrapping, compacting, hiding
  non-essential text) first and only reach for a hamburger menu if those
  aren't sufficient. If a hamburger menu turns out to be required, that's an
  acceptable technical note outcome for this story, not a new story.
- General responsive/mobile audit of every page (see also this triage round's
  separate mobile-polish note in CHORE-12 for other phone-specific gaps) —
  this story is scoped to the persistent header/nav chrome only.
- Tablet/desktop layout changes.

## Technical notes
- Reproduce first: measure `document.documentElement.scrollWidth` at 375px
  for both an admin session (widest nav: Início-equivalent removed per
  STORY-16, Utilizadores, Equipa) and a member session, on `AppHeader.tsx` +
  `AppNav.tsx` + `UserWidget.tsx` combined.
- Likely culprits to check: `UserWidget.tsx`'s `hidden sm:block` name span
  (should already hide on mobile — confirm it still does after nav link
  additions), fixed gaps/padding (`gap-4`, `px-*`) not shrinking, and whether
  `AppNav.tsx`'s admin links wrap or truncate at narrow widths.
- If this story lands after STORY-16 (logo-as-home-link, removes "Início"),
  re-measure — removing a nav link may partially or fully fix this on its
  own; don't assume STORY-16 alone resolves it without verifying, since the
  documented 16px overflow may come from link/label width, not link count.
- Update the CLAUDE.md "Known issue" note once fixed (remove it or mark
  resolved with the story reference) so future contributors don't treat it as
  still-open.
- Complexity: **standard** — CSS/layout fix, no data or auth changes, but
  requires a real authenticated Playwright run to verify (per
  `E2E_WITH_AUTH` convention) since the header only renders for logged-in
  users.

## Definition of Done
See CLAUDE.md.
