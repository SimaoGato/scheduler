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

## Implementation plan

### Affected areas
- **frontend** (primary): `components/AppHeader.tsx`, `components/AppNav.tsx` —
  layout/CSS-only changes, no data/auth/business logic.
- **docs**: `CLAUDE.md` (remove/resolve the "Known issue" paragraph).
- **tests**: `e2e/header-identity-widget.spec.ts` (extend existing
  STORY-12 AC4/AC5 tests rather than adding a new duplicate spec file).

No backend, data, or auth changes. Confirms the story's own complexity tag.

### Root-cause analysis

Reproduced by reading the JSX/CSS chain (no code changes made yet):

`AppHeader.tsx` renders:
```
<div class="container mx-auto flex items-center justify-between">
  <Link (logo "Escala")>
  <div class="flex items-center gap-4">        <!-- group -->
    <AppNav role={role} />                      <!-- <nav><ul class="flex gap-1">…</ul></nav> -->
    <UserWidget />                               <!-- <details><summary>…</summary></details> -->
  </div>
</div>
```

Two compounding CSS facts cause the overflow, both confirmed by reading the
code (not guessed):

1. **`components/ui/button.tsx`'s `buttonVariants` base classes include both
   `whitespace-nowrap` AND `shrink-0`** (`"...whitespace-nowrap rounded-md
   text-sm font-medium ... shrink-0 ..."`). Every `Button` in the app —
   including the two `AppNav` links ("Utilizadores", "Equipa") — is
   *unconditionally* forbidden from shrinking or wrapping its own label. This
   is an app-wide Button design decision; it must **not** be changed globally
   just for the nav (out of scope, would regress every other button in the
   app).
2. **Flexbox default `min-width: auto` on the ancestor chain.** `<nav>` is a
   flex item of the `"flex items-center gap-4"` group div, which is itself a
   flex item of the header's top-level row. By default, a flex item's
   automatic minimum width equals its content's max-content size (i.e., "wide
   enough that nothing inside has to wrap"), unless `min-width: 0` is set.
   Because neither the group div nor `<nav>` has `min-w-0`, and neither
   `AppNav`'s `<ul>` nor the group div has `flex-wrap`, the two fixed-width,
   non-shrinking nav buttons are forced into a single row that is wider than
   the space actually available at 375px, pushing `document.documentElement
   .scrollWidth` past the viewport (confirmed: ≈391px vs 375px, per CLAUDE.md).

This reproduces on **both** `/pt-PT/` and `/pt-PT/admin/people` for an admin
session because the overflowing element is the *persistent header/nav chrome*
itself (present on every authenticated page), not anything page-specific —
consistent with the story's framing.

For a **member** session, `AppNav` returns `null` (`role !== 'admin'`), so the
header only contains the logo and `UserWidget`. `UserWidgetMenu.tsx`'s name
span is already `hidden sm:block` (avatar-only below the `sm` breakpoint), so
the member case is not expected to be broken today — AC2's job is mainly
**regression coverage** to prove it stays fixed as the shared `AppHeader`
markup changes, not a bug to newly fix. No admin-specific display-name-length
scenario is in scope.

**AC3 ("robust to future nav link additions") rules out** a pixel-budget hack
(e.g., shrinking gaps/padding until exactly 2 links fit) — that would
silently break again the moment a 3rd admin link is added. The correct fix is
structural: let the nav **wrap onto additional rows** when it doesn't fit,
which handles any future link count without being re-tuned.

### Concrete fix (layout/CSS only, no hamburger menu needed)

**`components/AppHeader.tsx`** — the group div wrapping `AppNav` + `UserWidget`:
```diff
- <div className="flex items-center gap-4">
+ <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
```
- `min-w-0`: lets this flex item shrink below its unwrapped content width so
  `AppNav`'s own wrap (below) can actually engage instead of being pre-empted
  by the ancestor growing to fit.
- `flex-wrap`: cheap extra safety net in case `AppNav` and `UserWidget`
  themselves ever need to stack (not expected to trigger with today's 2
  links, but harmless if it does — worst case is a taller header, never a
  wider one).
- `gap-2 sm:gap-4`: shrinks the gap by 8px below the `sm` (640px) breakpoint
  only — this only affects mobile, preserving the current gap unchanged at
  tablet/desktop (`sm:` and up), per the "don't touch tablet/desktop" scope
  constraint.

**`components/AppNav.tsx`**:
```diff
- <nav aria-label={t('ariaLabel')}>
-   <ul className="flex gap-1">
+ <nav aria-label={t('ariaLabel')} className="min-w-0">
+   <ul className="flex flex-wrap justify-end gap-1">
```
- `min-w-0` on `<nav>`: same reasoning as above — `<nav>` is itself a flex
  item and needs to be allowed to shrink before its child `<ul>` can be
  assigned a width narrow enough to need to wrap.
- `flex-wrap` on `<ul>`: once the `<nav>` is capped to the actually-available
  width, this lets the two (or N future) `<li>` buttons wrap onto multiple
  rows instead of overflowing horizontally. Each button's own label still
  never wraps mid-word (`whitespace-nowrap` untouched) — only the *collection*
  of buttons wraps as a group.
- `justify-end` on `<ul>`: keeps nav buttons visually right-aligned (matching
  today's position, adjacent to the user widget) instead of left-aligning
  inside whatever box width the wrap algorithm assigns. **Implementer: after
  making this change, visually render the header at 375px in a real browser
  (devtools device mode) per this project's "QA must visually render UI
  stories" convention** — the functional (no-overflow) fix does not depend on
  this class, but confirm it still looks intentional, not visually broken;
  adjust to `justify-start` only if `justify-end` looks wrong in practice.

No changes planned to `UserWidget.tsx`, `UserWidgetMenu.tsx`, or
`app/globals.css`. If, after implementing and visually/E2E-verifying, a
residual few px of overflow remains (e.g. from a longer future translation
string), the fallback is `px-4 sm:px-4` → `px-3 sm:px-4` on `AppHeader.tsx`'s
`<header>` — documented here as a contingency, not expected to be needed.

**No hamburger menu required** — the wrap-based fix is structurally
sufficient for the current and reasonably-future nav link count. Confirms the
story's own "Out of scope" framing; nothing to escalate.

### Step-by-step approach (test-first)

1. Extend `e2e/header-identity-widget.spec.ts`'s existing AC4 test (admin) to
   also assert `scrollWidth <= 375` on `/pt-PT/admin/people` (currently only
   checks `/`), and its AC5 test (member) to also check `/pt-PT/settings`
   (currently only checks `/`). Run locally with `E2E_WITH_AUTH=1` against a
   real logged-in session (whichever role is currently logged in) to confirm
   the extended assertions **fail** against the current code (reproducing the
   bug), before making any component changes.
2. Apply the `AppHeader.tsx` and `AppNav.tsx` class changes above.
3. Re-run the same E2E_WITH_AUTH tests locally; confirm they now pass for
   both the currently-logged-in role's pages. (Full admin+member AC1/AC2
   coverage requires running once logged in as admin and once as member —
   this codebase has no role-selectable auth fixture yet, consistent with
   `e2e/app-nav.spec.ts`'s existing documented limitation; do not attempt to
   build one as part of this story, it's out of scope.)
4. Visually render `/pt-PT/` and `/pt-PT/admin/people` at 375px in a real
   browser (devtools device mode, logged in as admin) and confirm the nav
   wraps cleanly with no horizontal scrollbar and no visually broken/
   overlapping elements.
5. AC3 manual robustness check: temporarily duplicate one `<li>` inside
   `AppNav.tsx`'s `<ul>` (or add a throwaway 3rd link) and reload at 375px;
   confirm it wraps to an additional row with still no horizontal overflow,
   then revert the temporary link before committing.
6. Update `CLAUDE.md`'s Playwright section: replace the "Known issue: app
   header/nav horizontal overflow at 375px viewport" bullet with a short
   resolved-pattern note (see "CLAUDE.md cleanup" below) — do not just delete
   it, since the underlying wrap technique is useful forward guidance for
   whoever adds the next admin nav link.
7. Run the full Definition of Done gate locally: `npm run lint`,
   `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` (CI mode, i.e.
   without `E2E_WITH_AUTH`, to confirm no regression in the unauthenticated
   smoke suite).

### Test plan (mapped to ACs)

- **AC1** (admin, 375px, `/pt-PT/` and `/pt-PT/admin/people`, no overflow):
  automated — extend `e2e/header-identity-widget.spec.ts`'s AC4 test to
  assert `scrollWidth <= 375` on both URLs. Gated
  `test.skip(!process.env.E2E_WITH_AUTH, ...)` per convention; this is the
  "real (not test.skip)" assertion AC5 of this story requires.
- **AC2** (member, 375px, any accessible page, no overflow): automated —
  extend the existing AC5 test in the same file to also check
  `/pt-PT/settings` in addition to `/`. Same gating.
- **AC3** (robust to future nav link growth): structural, not a pixel-budget
  test — satisfied by the `flex-wrap` design itself. Documented as a manual
  verification step (temporary extra `<li>`, see step 5 above) directly in
  this story file, per the Definition of Done's "AC coverage... or a
  documented manual verification step" allowance.
- **AC4** (stale known-issue references updated/removed): manual — confirmed
  by grep that the *only* prose reference to this bug is CLAUDE.md's
  Playwright-section "Known issue" bullet (searched all of
  `docs/stories/*.md` and `e2e/*.spec.ts`; `STORY-14`'s and `STORY-01`'s test
  files do not themselves contain bug-referencing prose — CLAUDE.md's bullet
  merely *cites* STORY-14's AC3 as an example of an affected test). Verified
  by re-grepping for "Known issue" / "391px" / "approximately 16px" after the
  CLAUDE.md edit lands — should return zero matches outside this story file's
  own Context section (which is a historical quote, fine to leave as-is).
- **AC5** (full DoD gate green, with a real assertion for AC1): covered by
  step 7 above plus the extended AC4 test in
  `e2e/header-identity-widget.spec.ts`.

### CLAUDE.md / known-issue cleanup plan

- Remove the existing bullet (Playwright section, starts "**Known issue: app
  header/nav horizontal overflow at 375px viewport**...").
- Replace with a concise resolved-pattern bullet, e.g.: "**Nav wrap for
  admin-link growth (STORY-23)**: `AppNav.tsx`'s `<ul>` uses `flex-wrap` (with
  `min-w-0` on itself and on `AppHeader.tsx`'s nav/user-widget wrapping div)
  so additional admin nav links wrap onto new rows at narrow viewports instead
  of overflowing the page horizontally. When adding a new admin nav link,
  no extra width-budget work is needed — just verify at 375px that wrapping
  still looks visually clean." This keeps the institutional knowledge (why the
  wrap classes exist) instead of just deleting the paragraph, consistent with
  this file's existing style of codifying resolved patterns rather than
  leaving no trace (see CHORE-06/CHORE-11 precedent, commit 30651e6).
- No changes needed to `e2e/people-table-alignment.spec.ts` or
  `docs/stories/STORY-14-*.md` / `docs/stories/STORY-01-*.md` — confirmed via
  grep that none of them contain prose referencing this bug directly; they
  only contain their own (unrelated, still-valid) `scrollWidth <= 375`
  assertions.

### Risks and rollback

- **Risk**: `flex-wrap` causes a visually awkward wrapped state at some
  intermediate width between 375px and the `sm` breakpoint (640px). Mitigated
  by step 4's real-browser visual check across a couple of widths (375, 480,
  600px), not just the exact 375px test point.
- **Risk**: reducing `gap-4` → `gap-2` below `sm` could make the nav buttons
  and user-widget avatar feel visually cramped. Low risk (8px is a small
  reduction) but confirm visually in step 4.
- **Rollback**: the change is two small class-list diffs in two files plus a
  documentation edit — trivially revertible with `git revert` if a regression
  is found; no data migrations or feature flags involved.
- **No auth/data/security surface touched** — rollback risk is purely visual/
  layout, not functional.

### Complexity tag

**standard** (confirms the story's own pre-label). Rationale: touches two
components used on every authenticated page (`AppHeader.tsx`, `AppNav.tsx`),
requires understanding Flexbox's `min-width: auto` default and an existing
shared `Button` component's base classes to avoid an app-wide regression, and
requires a real authenticated Playwright run to verify (per the
`E2E_WITH_AUTH` convention) — more reasoning risk than a `trivial` copy/config
change, even though no data/auth/security logic is modified. Not `complex`:
single cohesive layout mechanism, two files, no interacting backend systems.

### Blocking questions

None. The story's ACs, scope, and technical notes are unambiguous enough to
proceed; the root cause is confirmed by reading the actual component/CSS code
(not guessed), and the fix stays within the story's stated scope (layout/CSS
only, no hamburger menu, no tablet/desktop changes).
