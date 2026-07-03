# STORY-16: Use "Escala" wordmark as the home link, remove redundant "Início" nav item
Epic: EPIC-01
Status: draft

## User story
As a user, I want the "Escala" wordmark in the header to take me home, so
that the nav isn't cluttered with a redundant "Início" link doing the same
thing.

## Context
`components/AppHeader.tsx` renders `{t('name')}` ("Escala") as a plain,
non-interactive `<span>` (line 33). `components/AppNav.tsx` separately
renders an "Início" (Home) `<Link href="/">` nav item. Using the
logo/wordmark as the home link and dropping a separate "Home" nav entry is a
long-established, near-universal convention on both marketing sites and web
apps — this is **not** bad practice. The only requirement is preserving a
clear accessible name on the link (visible "Escala" text already satisfies
this; no icon-only ambiguity here).

The one real risk: several existing e2e specs currently interact with the
"Início" link, not just assert its presence:
- `e2e/user-widget-click-outside.spec.ts` clicks the "Início" link as a
  safe no-op target to test outside-click dismissal of the user menu.
- `e2e/member-gating.spec.ts` and `e2e/header-identity-widget.spec.ts` assert
  on the *count* of nav links (e.g. "1 nav link visible: Início" for Members,
  "3 nav links visible: Início, Utilizadores, Equipa" for Admins) to verify
  role-based nav gating.

Removing "Início" from `AppNav` changes both of these — they need
deliberate updates, not silent breakage.

## Acceptance criteria
1. Given a user is on any authenticated page, when they view the header, then
   "Escala" is rendered as a locale-aware link (`@/i18n/navigation` `Link`)
   with an href resolving to the home route.
2. Given a user clicks "Escala" in the header, when the click completes, then
   they land on the home page.
3. Given the "Início" item is removed from `AppNav`, when an Admin views the
   nav, then it shows exactly "Utilizadores" and "Equipa" (2 links, not 3);
   when a Member views the nav, then it shows 0 nav links (no bare/empty nav
   region left behind — decide whether the `<nav>` element should still
   render with just an aria-label for Members, or be omitted entirely, and
   document the choice).
4. Given `e2e/user-widget-click-outside.spec.ts` currently clicks "Início" as
   a no-op outside-click target, when this story ships, then that test is
   updated to click a different safe no-op element (e.g. the header
   background, or another stable non-menu element) so it keeps testing
   outside-click dismissal correctly.
5. Given `e2e/member-gating.spec.ts` and `e2e/header-identity-widget.spec.ts`
   assert on nav link counts/text including "Início", when this story ships,
   then both specs are updated to match the new nav contents and still pass.

## Out of scope
- Broader logo/branding redesign (colors, icon, etc.).
- Mobile nav collapse/hamburger patterns.
- Changing the `Nav.ariaLabel` landmark or overall header layout.

## Technical notes
- `components/AppHeader.tsx` line 33: wrap `{t('name')}` in a `Link` to `/`.
- `components/AppNav.tsx`: remove the `Início` `<li>` block (lines ~16-20).
- `messages/pt-PT.json`: `Nav.home` ("Início") becomes unused once removed
  from `AppNav` — per i18n key hygiene (CLAUDE.md), either delete it or
  repurpose it as an `aria-label` on the new logo link if a distinct
  "home"-labeled accessible name is wanted alongside the visible "Escala"
  text (probably unnecessary — visible text is already a clear accessible
  name — but flag for refiner judgment).
- Grep `e2e/*.spec.ts` for "Início" before implementing; at least 5 files
  reference it (see Context section above) — some are simple text
  assertions, one (`user-widget-click-outside.spec.ts`) depends on it as an
  interactive no-op click target and needs a functional replacement, not
  just a text swap.
- Complexity: `standard` (touches shared header/nav component + multiple
  e2e specs, low logic risk but broad touch surface).

## Definition of Done
See CLAUDE.md.

## Implementation plan

### Codebase verification (done during refinement, 2026-07-03)
All line-number references in the original Context/Technical notes were
re-checked against the current tree and are still accurate:
- `components/AppHeader.tsx` line 33: `<span className="text-lg font-semibold">{t('name')}</span>` — confirmed.
- `components/AppNav.tsx` lines 16-20: the "Início" `<li>` block — confirmed, exact match.
- `messages/pt-PT.json` line 8: `"home": "Início"` inside `"Nav"` — confirmed, and grep confirms
  `Nav.home` / `t('home')` has exactly one consumer in the whole repo
  (`components/AppNav.tsx:18`). No other component or spec calls `t('home')`.
- The only literal-string occurrences of "Início" outside `messages/pt-PT.json` are:
  `e2e/user-widget-click-outside.spec.ts` (1 real assertion, line 72, plus 2 comment mentions),
  `e2e/member-gating.spec.ts` (comment-only, no assertion touches "Início"),
  `e2e/header-identity-widget.spec.ts` (comment-only, no assertion touches "Início").
  `e2e/auth.spec.ts:52` also contains the substring "Início" but it's the unrelated
  `Auth.errorAccessDenied` string ("Início de sessão cancelado.") — not in scope.

This means the story's premise that "member-gating.spec.ts and
header-identity-widget.spec.ts assert on nav link counts/text" is slightly
stale: neither file's actual test **code** asserts nav link count/text today —
only their doc comments (manual-verification steps) mention "Início" and old
nav-link counts. So AC5's real work for those two files is a comment-only
update, not an assertion rewrite. `user-widget-click-outside.spec.ts` is the
only file needing a functional (non-comment) code change.

### Decision 1 — `Nav.home` i18n key: delete
Delete `Nav.home` from `messages/pt-PT.json` entirely; do not repurpose it as
an `aria-label` on the new logo `Link`.
Rationale:
- It has exactly one consumer (`AppNav.tsx:18`), which this story removes.
  Per CLAUDE.md i18n key hygiene, unused keys must not be left behind.
- The new logo `Link` already has clear visible text (`{t('name')}` =
  "Escala") as its accessible name. WCAG SC 1.3.1 / accessible-name
  computation don't require a redundant `aria-label` when visible text
  already unambiguously names the link's destination — this isn't an
  icon-only-button case (the `aria-label` composition pattern documented in
  CLAUDE.md exists for identity widgets combining an avatar + affordance
  text, which doesn't apply here).

### Decision 2 — empty `<nav>` for Members: omit the element entirely
When a user has 0 nav items (role `'member'` or `null`), `AppNav` returns
`null` — no `<nav>` element rendered — rather than rendering an empty
`<nav aria-label=...><ul></ul></nav>`.
Rationale:
- AC3 itself signals this preference: "no bare/empty nav region left behind."
- ARIA authoring-practice convention treats empty landmark regions as an
  anti-pattern — screen-reader users navigating by landmark list land on a
  region with nothing in it.
- No existing test asserts the opposite. `member-gating.spec.ts`'s one
  automated (non-skipped) test checks nav absence on the **login page**
  (unauthenticated, redirected before `AppHeader` ever renders) — that
  assertion is unaffected either way, since login page has no `AppHeader` at
  all (STORY-10 route group). No test currently relies on an empty
  authenticated `<nav>` being present for Members.
- `AppHeader.tsx` currently renders `<AppNav role={role} />` unconditionally,
  even when `role` is `null` (unauthenticated path — dead in practice today
  since `proxy.ts` redirects unauthenticated users before reaching this
  component, but the prop type permits it). With this decision, `role: null`
  also yields no `<nav>`, which is consistent and requires no special-casing
  in `AppHeader.tsx`.

### File-by-file changes

**`components/AppHeader.tsx`**
- Add `import { Link } from '@/i18n/navigation';` (next-intl v4's
  `createNavigation` factory ships separate `react-server`/`react-client`
  conditional exports specifically so `Link` resolves correctly whether the
  importing component is a Server Component or a Client Component —
  `AppHeader.tsx` has no `'use client'` and stays a Server Component. Note
  this is in fact the *first* Server Component usage of this `Link` in the
  codebase — `AppNav.tsx` and `UserWidgetMenu.tsx` both use it too, but both
  are `'use client'` components, so they are not precedent for the Server
  Component case; the correctness argument rests on next-intl v4's
  documented conditional-export support, not on local precedent).
- Replace line 33:
  `<span className="text-lg font-semibold">{t('name')}</span>`
  with:
  `<Link href="/" className="inline-flex items-center min-h-[44px] text-lg font-semibold">{t('name')}</Link>`
  No wrapping in the shadcn `Button` component — this is a wordmark, not a
  button, and the out-of-scope section excludes layout/branding changes.
  `inline-flex items-center min-h-[44px]` is required per CLAUDE.md's
  mandatory WCAG 44px tap-target rule — every other interactive element in
  this same header (`AppNav`'s `Button`s, `UserWidgetMenu`'s trigger) already
  follows this convention via `min-h-[44px]`, and the new logo link must too.
  This only grows the click/tap target height; visible branding is
  unchanged — `min-h-[44px]` is a floor, not a fixed height, and
  `inline-flex items-center` keeps `text-lg font-semibold` vertically
  centered within that floor without visually enlarging the text.
  No extra `aria-label` (see Decision 1). No global CSS suppresses `outline`
  on anchors, so the browser's default focus-visible ring is preserved for
  keyboard users with no extra classes needed.

**`components/AppNav.tsx`**
- Remove the "Início" `<li>` block (lines 16-20).
- Restructure to build a `role`-derived array of nav items and return `null`
  when the array is empty (Decision 2):
  ```tsx
  export default function AppNav({ role }: Props) {
    const t = useTranslations('Nav');
    if (role !== 'admin') return null;
    return (
      <nav aria-label={t('ariaLabel')}>
        <ul className="flex gap-1">
          <li>
            <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
              <Link href="/admin/users">{t('userManagement')}</Link>
            </Button>
          </li>
          <li>
            <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
              <Link href="/admin/people">{t('people')}</Link>
            </Button>
          </li>
        </ul>
      </nav>
    );
  }
  ```
  (Since only Admin ever has nav items today, `role !== 'admin'` is
  equivalent to "items array is empty" and is simpler than building/checking
  an array — use whichever reads more clearly at implementation time; the
  behavior must match: Admin gets exactly `Utilizadores` + `Equipa`, anyone
  else gets no `<nav>` at all.)

**`messages/pt-PT.json`**
- Remove the `"home": "Início",` line from the `"Nav"` object (Decision 1).

**`e2e/user-widget-click-outside.spec.ts`**
- Update the file-header comment block (lines 15-19) mentioning "another nav
  link such as 'Início'" to reference the logo link instead.
- Rewrite the second test (currently lines 60-74,
  `'AC1: clicking another nav link closes the open menu'`): replace
  ```ts
  await page.getByRole('link', { name: 'Início' }).click();
  ```
  with
  ```ts
  await page.getByRole('link', { name: 'Escala' }).click();
  ```
  This preserves the test's original intent exactly: click a real
  interactive `<a>` element outside the widget that safely no-ops (its
  `href` resolves to `/`, and the test is already on `/`), proving outside
  click on an interactive element (not just blank space) still dismisses the
  menu. The "Escala" wordmark `Link` added by this story is the direct,
  intentional replacement — no other stable no-op link exists once "Início"
  is removed (the remaining Admin nav links navigate to different routes and
  are not no-ops, and would also not exist at all for a Member-role test
  session). Update the surrounding comment (line 60-62) to describe "the
  Escala wordmark, a safe no-op navigation link" instead of "another nav
  link ('Início')".
- No change needed to the first test (`'AC1: clicking outside the open menu
  closes it'`, lines 46-58) — it already uses the header background click,
  unaffected by this story.

**`e2e/member-gating.spec.ts`**
- No test *code* changes required (confirmed above: the only automated test,
  lines 58-65, asserts nav absence on the unauthenticated login page, which
  is untouched by this story).
- Update doc comments only: lines 8, 11, 24, 29 currently describe Member
  nav as showing "Início" and Admin nav as showing "Início" + "Utilizadores".
  Update to describe the new reality: Member nav renders no `<nav>` element
  at all (0 links); Admin nav shows "Utilizadores" and "Equipa" (2 links).
- **Pre-existing stale comment, unrelated to this story but caught while
  touching this file (fix in the same pass, per CLAUDE.md's spirit of not
  leaving known-stale docs behind):** the header block's "AC2 (partial)"
  paragraph (lines 8-12) currently claims "we verify the nav renders with
  'Início' and without 'Utilizadores'" — but the actual test (lines 58-65)
  asserts the `<nav>` element has count **0** (fully absent), not that it
  renders with "Início" present. Reword lines 8-12 to state that the test
  verifies no `<nav>` element is rendered at all for unauthenticated
  visitors (redirected to the chrome-less login page per STORY-10), rather
  than describing a partial/"Início"-only nav that the code never actually
  checks for.

**`e2e/header-identity-widget.spec.ts`**
- No test *code* changes required (all 5 tests are gated on
  `E2E_WITH_AUTH` and assert via `data-testid` / viewport overflow, never
  nav text/count).
- Update doc comments only: AC4 (line 34, "3 nav links visible: Início,
  Utilizadores, Equipa") → "2 nav links visible: Utilizadores, Equipa"; AC5
  (line 42, "1 nav link visible: Início") → "0 nav links visible (no `<nav>`
  element rendered for Members)".

**`e2e/app-nav.spec.ts` (new file)**
- New `E2E_WITH_AUTH`-gated spec, added because AC2 and AC3 need dedicated,
  non-tautological coverage that doesn't belong bolted onto
  `user-widget-click-outside.spec.ts` (that file's job is outside-click
  dismissal, not logo navigation or nav-content assertions — see AC4 note
  below for why they must stay separate).
- Test 1 — `'AC2: clicking the Escala wordmark from a non-home route
  navigates to home'`: sign in as Admin, `await page.goto('/admin/people')`,
  assert arrival on that route first (e.g. `await
  expect(page).toHaveURL(/\/admin\/people/)` or assert a stable
  Admin-only heading is visible) so the test provably starts **off** the
  home page, then click `page.getByRole('link', { name: 'Escala' })`, then
  assert `await expect(page).toHaveURL(/\/(pt-PT)?\/?$/)`. Starting from a
  genuinely different route (not `/`) makes this assertion meaningful: a
  dead or broken link would leave the test on `/admin/people` and the final
  `toHaveURL` check would fail, whereas a "start on / → click → still on /"
  version would pass even with a broken link, since the page never left `/`
  either way.
- Test 2 — `'AC3: Admin nav shows exactly Utilizadores and Equipa'`: sign in
  as Admin, assert `page.getByRole('navigation', { name: 'Navegação
  principal' })` has count 1 and contains exactly 2 links named
  "Utilizadores" and "Equipa" (no "Início").
- Test 3 — `'AC3: Member nav renders no <nav> element'`: sign in as Member,
  assert `page.getByRole('navigation', { name: 'Navegação principal' })` has
  count 0.
- All three tests use `test.skip(!process.env.E2E_WITH_AUTH, ...)`, matching
  the established pattern in this codebase, plus a header comment block with
  manual-verification steps for each AC (same convention as the other two
  auth-gated spec files) so CI's lack of real credentials doesn't leave AC2
  or AC3 undocumented per the DoD's AC-coverage rule.

**No other files require changes.** Grep confirmed no other e2e spec,
component, or page references `Nav.home`, `t('home')`, or the literal
"Início" (beyond the unrelated `Auth.errorAccessDenied` string).

### Test plan (AC → automated test)

| AC | Test | Notes |
|----|------|-------|
| AC1 (logo is a locale-aware `Link` to home) | Existing `e2e/user-widget-click-outside.spec.ts` "AC1: clicking another nav link closes the open menu" (rewritten to target `getByRole('link', { name: 'Escala' })`) exercises the logo as a real `<a>` link; `npx tsc --noEmit` + manual render confirm `Link` from `@/i18n/navigation` is used, not a plain `<span>`. | Gated on `E2E_WITH_AUTH`; document as manual verification step too, consistent with this file's existing pattern (all 5 ACs there are auth-gated). |
| AC2 (clicking logo lands on home) | New, dedicated test in `e2e/app-nav.spec.ts`: `'AC2: clicking the Escala wordmark from a non-home route navigates to home'` — sign in as Admin, navigate to `/admin/people` (a non-home authenticated route) and assert arrival there first, click `getByRole('link', { name: 'Escala' })`, then assert `await expect(page).toHaveURL(/\/(pt-PT)?\/?$/)`. Gated on `E2E_WITH_AUTH`, with a matching manual-verification bullet in the file's header comment. | Deliberately kept as its own test, separate from AC4's outside-click-dismissal test, and starts from a non-home route so the final assertion cannot pass vacuously (a broken/dead link would leave the test on `/admin/people`, causing a real failure). |
| AC3 (Admin nav = exactly Utilizadores + Equipa; Member nav = 0 links, `<nav>` omitted) | Two more tests in the same new `e2e/app-nav.spec.ts` file, both `E2E_WITH_AUTH`-gated: (a) as Admin, `page.getByRole('navigation', { name: 'Navegação principal' })` has count 1 and contains exactly 2 links with names "Utilizadores" and "Equipa"; (b) as Member, `page.getByRole('navigation', { name: 'Navegação principal' })` has count 0. Document both as manual-verification steps too (matching file conventions), since CI has no real auth. | This is new coverage — no prior test asserted nav item count precisely. |
| AC4 (`user-widget-click-outside.spec.ts` updated to a functional no-op target) | The rewritten "AC1: clicking another nav link closes the open menu" test itself, using `getByRole('link', { name: 'Escala' })`, is the test — passing (under `E2E_WITH_AUTH=1` locally) demonstrates the replacement works. This test's purpose stays scoped to outside-click dismissal only; it does not also assert navigation (that's AC2's job in `app-nav.spec.ts`), keeping each test's failure signal unambiguous. | Directly covered by the file edit above; deliberately kept separate from AC2. |
| AC5 (`member-gating.spec.ts` + `header-identity-widget.spec.ts` updated, still pass) | `npm run test:e2e` (CI + local) — both files' existing automated tests continue to pass unmodified in code; comment updates (including the pre-existing stale-comment fix in `member-gating.spec.ts`, see file-by-file section) verified by review/read-through, not a runnable assertion (comments have no automated check). | Confirm no other CI-run assertion regresses. |

All of the above are gated identically to the existing pattern in this
codebase (`test.skip(!process.env.E2E_WITH_AUTH, ...)`) since `AppHeader`
requires a real authenticated session and CI has no such credentials. Each
new/changed assertion must also get a matching manual-verification bullet in
its file's header comment block, per this codebase's established convention
(see all three files' existing header comments) — this satisfies the DoD's
"AC coverage… automated test or documented manual verification step" rule
even though CI cannot execute the auth-gated paths.

### Risks and rollback
- **Risk**: `Link` from `@/i18n/navigation` may not resolve correctly in a
  Server Component context if the project's `next-intl` version/exports
  differ from expectation. Note this is genuinely the first Server Component
  usage of this `Link` in the codebase — `AppNav.tsx` and
  `UserWidgetMenu.tsx` both use it too, but both are `'use client'`
  components, so they are **not** valid precedent for the Server Component
  case and the risk assessment should not lean on them. Mitigation instead
  rests on: (1) `npx tsc --noEmit` and `npm run build` will catch a
  resolution failure immediately, and (2) next-intl v4's `createNavigation`
  explicitly documents separate `react-server`/`react-client` conditional
  exports built for exactly this Server-vs-Client-Component usage split, so
  the failure mode this risk describes is one the library is designed to
  prevent. Net assessment: low risk, with fast, deterministic build-time
  detection if it does occur.
- **Risk**: Removing the always-present `<nav>` landmark for Members is a
  structural DOM change with no direct automated CI coverage (auth-gated).
  Mitigation: explicit manual-verification steps added per the test plan
  above; low blast radius since no other feature currently depends on
  `<nav>` being present for Members (grep-confirmed).
- **Rollback**: All changes are additive/subtractive text edits to 6 files
  (5 modified + 1 new `e2e/app-nav.spec.ts`) with no data/schema/migration
  component — revertible via a single git revert with no follow-up cleanup
  needed.

### Complexity: `standard`
Confirms the story's own pre-guess. Touches a shared layout component
(`AppHeader.tsx`, rendered on every authenticated page), a role-gating
component (`AppNav.tsx`) whose behavior affects three existing e2e specs,
and an i18n key removal — multi-file, cross-cutting UI/test change, but each
individual change is mechanically simple (no auth/data/concurrency/money
logic). Not `trivial` because it changes role-based rendering behavior
(`AppNav` returning `null`) that other tests/personas (a11y, e2e) need to
reason about; not `complex` because there's no security, concurrency, or
data-integrity dimension.
