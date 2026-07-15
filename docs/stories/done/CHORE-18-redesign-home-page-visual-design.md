# CHORE-18: Redesign home page visual design (Card-based layout)
Epic: maintenance
Priority: low (visual-quality debt, not a functional defect)
Status: done ✅
PR: 54
Depends on: CHORE-17 (Card UI primitive)
Related story: STORY-30 (home-page-personal-quick-overview — this chore
restyles that story's output; no data/logic changes)

## Task
As a user (Admin or Member) landing on the home page, I want it to look
intentionally designed — clear visual grouping, hierarchy, and breathing
room — instead of plain stacked text, so the app feels trustworthy and
finished rather than like an unstyled placeholder.

## Context
The user's screenshot of the production home page (both the Admin "Resumo da
equipa" view and, by the same pattern, the Member availability-summary view)
shows every section as bare headings + `<ul><li>` text with no visual
container, minimal spacing, and no differentiation between the summary stats
and the quick-links section. Feedback: "the current home screens are very
simple, even ugly ... I don't want slop, I want good design. Simple, but
good."

`app/[locale]/(app)/page.tsx` (STORY-30) currently renders:
- Admin: `admin-team-summary` (title + `<ul>` of 2 stats), a separate
  `admin-blocks-next-30-days` text block, and `admin-quick-links` (title +
  wrapped `Button` row) — three visually undifferentiated sections stacked
  with only `mb-6` spacing.
- Member: `member-availability-summary` — title, intro paragraph, `<ul>` of
  2 counts, a conditional next-blocked-date line, and a CTA link — again all
  one undifferentiated text block.

This chore is purely visual: wrap the existing sections in `Card` (CHORE-17)
with sensible internal hierarchy (CardHeader/CardTitle for section titles,
CardContent for the stats/links), improve spacing and typographic hierarchy,
and give the summary numbers more visual weight than the surrounding label
text. No data, routing, auth, or copy logic changes.

## Acceptance criteria
1. Given the Admin home view, when rendered, then "Resumo da equipa" (stats)
   and "Acesso rápido" (quick links) each render inside a distinct `Card`
   with clear visual separation (border/background per the design tokens),
   not as bare stacked `<div>`s.
2. Given the Member home view, when rendered, then the availability summary
   renders inside a `Card` with the same treatment, and the summary counts
   (available/blocked) are visually emphasized (e.g. larger numeral,
   consistent with a "stat" presentation) rather than plain inline text.
3. Given all existing `data-testid` attributes (`admin-team-summary`,
   `admin-blocks-next-30-days`, `admin-quick-links`,
   `member-availability-summary`, `access-denied-banner`,
   `home-no-linked-person`, `home-availability-load-error`,
   `no-role-error`), when the redesign ships, then they are preserved
   unchanged so existing e2e assertions (STORY-30's own tests) keep passing
   without modification — this is a pure visual refactor of children inside
   those test-id'd containers, not a DOM-identity change.
4. Given the page at 375px and 1280px viewports, when rendered, then there is
   no horizontal overflow (`document.documentElement.scrollWidth <= 375` at
   mobile) and all interactive elements (quick-link buttons, the
   member CTA link) retain their existing ≥44px tap targets.
5. Given light and dark theme, when the redesigned cards render, then text
   contrast against card backgrounds meets WCAG AA in both themes (reuse
   CHORE-17's verified tokens; no new ad hoc colors).
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0 with STORY-30's existing home-page e2e tests
   passing unmodified (per AC3) plus any new visual-regression assertion
   this story adds (e.g. asserting the summary sections render inside
   `[class*="card"]`-equivalent containers, or a screenshot-diff if the
   project's Playwright config supports one already — see
   CHORE-02-playwright-screenshot-artifacts.md for existing screenshot
   tooling).

## Out of scope
- Any change to the underlying data/queries, i18n copy, or business logic in
  `app/[locale]/(app)/page.tsx` — STORY-30's metric-consistency and
  neutral-copy rules (CLAUDE.md) still apply unchanged; this chore must not
  touch the query/count logic at all.
- The header/nav chrome — that's BUGFIX-06 (separate, already-broken layout
  bug from this same triage round).
- Redesigning any other page besides home — the availability page is
  CHORE-19.
- Introducing icons, illustrations, or imagery — keep it "simple, but good":
  typography, spacing, and card grouping only, per the user's own framing.

## Technical notes
- Depends on CHORE-17 landing first (or in the same PR, sequenced first).
- Keep the STORY-30 scope-firewall lesson in mind (CLAUDE.md): do not import
  anything from `app/[locale]/(app)/availability/page.tsx` — it remains out
  of scope here too.
- Because this is a visual-quality story, structural/DOM assertions alone
  are insufficient to confirm success — `qa-verifier` (or manual review)
  must actually render both the Admin and Member views in a browser (dev
  server or Vercel preview) and visually confirm the result looks
  intentionally designed, not just that the test-ids and overflow checks
  pass.

## Implementation Plan

### Dependency check (done first — not blocking)
CHORE-17 has landed on `main` (`632228d feat(CHORE-17): add Card UI primitive`,
archived at `docs/stories/done/CHORE-17-add-card-ui-primitive.md`).
`components/ui/card.tsx` exists and exports `Card`, `CardHeader`,
`CardFooter`, `CardTitle`, `CardDescription`, `CardContent` following the
house pattern (plain function components, `data-slot` attrs, `cn()`
composition, no `'use client'`). No blocking dependency issue — safe to
proceed.

### Affected areas
- **Frontend (presentational only)**: `app/[locale]/(app)/page.tsx` — JSX
  restructuring only, using the already-shipped `Card` family. No new
  component files needed.
- **Tests**: one new CI-safe static-source spec in `e2e/` (smoke suite, no
  auth) + additive assertions in the existing `e2e-integration/home.spec.ts`
  (STORY-30's auth-backed suite).
- No backend/data/ai-ml/infra changes. This keeps the story on the
  trivial/standard boundary — see Complexity below.

### Design decisions (flagged explicitly for Challenge/Review per CLAUDE.md's
CHORE-20 scope-enforcement lesson — plan transparency does not substitute for
independent AC verification)

1. **Admin gets exactly two Cards, not three.** AC1 names only "Resumo da
   equipa" (stats) and "Acesso rápido" (quick links) as the two required
   Cards. The existing `admin-blocks-next-30-days` block has no heading of
   its own and isn't named as a third card in AC1's text. Decision: nest
   `admin-blocks-next-30-days` inside the **same** Card as
   `admin-team-summary` (as a second `CardContent` block below the stats
   `<ul>`), not as its own Card. This matches the Context section's framing
   ("summary stats" vs. "quick-links section" — two groups, not three) and
   keeps AC1's literal two-card count. `admin-blocks-next-30-days` keeps its
   own `data-testid` on its own `<div>`, just nested one level deeper than
   today — `getByTestId()` finds it regardless of DOM depth, so STORY-30's
   existing test (`adminPage.getByTestId('admin-blocks-next-30-days')`) is
   unaffected.
2. **AC2's "larger numeral" is implemented as whole-line stat emphasis, not
   digit-only extraction.** `Home.memberSummaryAvailableCount` /
   `memberSummaryBlockedCount` (and the admin equivalents) are ICU plural
   strings where the count is embedded inline in a full sentence (e.g. "10
   Sundays available" / "10 domingos disponíveis" — see
   `messages/pt-PT.json`/`en.json` `Home.*`). Splitting the numeral from its
   label into separate DOM nodes would require either (a) new i18n keys
   (label-only strings) or (b) fragile regex extraction of leading digits
   from a rendered translated string — both rejected. (a) is an i18n copy
   change, explicitly out of scope ("no ... copy logic changes"); (b) is
   fragile across locale digit placement/grammar. Decision: apply larger/
   bolder typography (`text-xl font-bold` / `text-base font-semibold`,
   final values decided during implementation to look visually correct, not
   hardcoded here) to the **entire stat `<li>` line**, distinguishing it from
   plain body text. This satisfies AC2's actual test ("visually emphasized
   ... rather than plain inline text") without touching copy or query logic.
   Apply the same treatment to the Admin stat lines too, for visual
   consistency with the Context section's general framing (not just the
   Member-specific AC2 wording) — this is presentational-only, zero AC risk.
   **Revision cycle 1 (Challenge WARNING 2) — explicit decision on
   `t.rich()` numeral-only emphasis, evaluated and rejected**: next-intl's
   `t.rich()` could in principle wrap just the `#` placeholder in
   `<strong>` inside the existing ICU plural branches (e.g.
   `"{count, plural, one {<strong>#</strong> domingo disponível} other
   {<strong>#</strong> domingos disponíveis}}"`), giving genuine
   numeral-only emphasis without changing the words. Rejected for two
   reasons: (1) it still requires editing the JSON *values* in
   `messages/pt-PT.json` **and** `messages/en.json` (embedding markup into
   the translation string) — this sits uncomfortably close to the story's
   own out-of-scope line ("no ... copy logic changes"), and the safer
   reading of that boundary is "do not touch locale file contents at all"
   for a purely presentational chore; (2) this codebase has never combined
   ICU plural (`{count, plural, ...}`) with rich-text tag substitution
   (`t.rich`) before (CLAUDE.md's ICU plural note is scoped to STORY-19's
   plain `t()` usage) — introducing that untested combination raises real
   implementation risk (does `intl-messageformat` correctly nest an XML tag
   inside a plural branch and pass it through `t.rich`'s chunk renderer for
   both singular and plural forms, in both locales?) that is disproportionate
   to AC2's actual wording, which asks for "visually emphasized ... rather
   than plain inline text" — not digit-only extraction specifically.
   Decision: **keep whole-line bold emphasis**, and instead close the gap
   Challenge identified by making the manual QA check in Step 6 explicit and
   falsifiable (see Step 6 below) rather than a vague "looks good" pass.
3. **No Card wrapping for edge-case/error states.** `access-denied-banner`,
   `no-role-error`, `home-no-linked-person`, `home-availability-load-error`
   are preserved byte-for-byte (per AC3's testid-preservation requirement)
   with **no** Card treatment. AC1/AC2 only name the team-summary,
   quick-links, and member-availability-summary states as requiring Card
   treatment; the Context section's complaint ("bare headings + `<ul><li>`
   text") is specifically about those three sections. Redesigning error
   states is not asked for and risks scope creep into copy/markup that
   currently has its own (already-reviewed) destructive-color treatment.
4. **`CardFooter` for the Member CTA link only.** `memberSummaryLink`
   ("Ver disponibilidade") is the one card in this chore with a single
   trailing call-to-action after body content — a natural `CardFooter` fit
   per the shadcn convention. Admin quick-links' entire card content *is*
   the action row, so it stays in `CardContent` (using `CardFooter` there
   would be redundant, not clearer).
5. **`CardDescription` replaces `memberSummaryIntro`'s `<p>`.**
   `CardDescription`'s default classes (`text-muted-foreground text-sm`)
   are an exact match for the existing paragraph's classes
   (`text-sm text-muted-foreground`) — a clean drop-in, zero visual
   difference, better semantic slot usage. **Revision cycle 1 (Challenge
   NOTE 4)**: this is a deliberate, accepted element-type trade-off —
   `CardDescription` renders a `<div>` (per `components/ui/card.tsx`'s house
   pattern), not a `<p>` — accepted because it carries no semantic/AT
   meaning loss (a `<p>` and a plain `<div>` are equally non-landmark,
   non-heading content) and the visual output is byte-identical.
6. **Preserve the existing `<h1>`/`<h2>` heading elements, nested inside
   `CardTitle` (Revision cycle 1 — Challenge CRITICAL finding).**
   `components/ui/card.tsx`'s own doc comment states `CardTitle` renders a
   plain `<div>` and "heading semantics ... are the consumer's
   responsibility." The current page carries the page's entire heading
   structure on three elements: Admin `<h1 className="mb-2 text-2xl
   font-semibold">` ("Resumo da equipa"), Admin `<h2 className="mb-2
   text-lg font-semibold">` ("Acesso rápido"), and Member `<h1
   className="mb-2 text-2xl font-semibold">` ("Resumo da disponibilidade").
   Naively writing `<CardTitle>{t(...)}</CardTitle>` would silently delete
   all three headings on both authenticated success paths — a screen-reader
   heading-navigation regression (cf. STORY-16's "empty landmark is an ARIA
   anti-pattern" precedent). Decision: nest the existing heading element
   **inside** `CardTitle`, e.g.
   `<CardTitle><h1 className="text-2xl font-semibold">{t('adminSummaryTitle')}</h1></CardTitle>`.
   Keep the heading's own `text-2xl font-semibold` / `text-lg font-semibold`
   sizing classes on the `<h1>`/`<h2>` itself (this is what makes the title
   visually large/bold — `CardTitle`'s own default classes are only
   `leading-none font-semibold`, which alone would under-size an `<h1>`).
   Drop the heading's old `mb-2` margin — `CardHeader`'s `flex flex-col
   gap-1.5` now provides the spacing between the title and whatever follows
   in the header, so a redundant `mb-2` on the inner `<h1>`/`<h2>` is no
   longer needed. This preserves exactly three headings — Admin `<h1>` +
   `<h2>`, Member `<h1>` — with identical text content, identical visual
   size, and a real semantic tag, just re-parented one level deeper.

### Step-by-step approach (test-first)

1. **Add the CI-safe static-source guard first (red)**: create
   `e2e/home-page-cards.spec.ts` in the smoke suite (no auth required,
   mirrors the `card-ui-primitive.spec.ts` / BUGFIX-02 static-source-guard
   pattern). Read `app/[locale]/(app)/page.tsx` via `fs.readFileSync` and
   assert via regex that: (a) the file imports `Card`, `CardHeader`,
   `CardTitle`, `CardContent` (and `CardDescription`/`CardFooter` if used)
   from `@/components/ui/card`; (b) `data-testid="admin-team-summary"`,
   `data-testid="admin-quick-links"`, and
   `data-testid="member-availability-summary"` each appear as a prop on a
   `<Card` JSX element (not a bare `<div`). This test will fail against the
   current file — expected, confirms it's a real regression guard.
2. **Add live-render assertions to the existing auth-backed suite (red)**:
   in `e2e-integration/home.spec.ts`, add one `toHaveAttribute('data-slot',
   'card')` assertion to each of the three existing tests that already
   locate `member-availability-summary` (both AC1 sub-tests) and
   `admin-team-summary` / `admin-quick-links` (AC3 test) — proving the
   testid'd element itself is Card's root, not just an ancestor. This is
   additive (existing assertions untouched) so it doesn't violate AC3's
   "existing e2e assertions keep passing unmodified" — new assertions
   appended to the same test bodies, no existing assertion changed or
   removed.
   **Revision cycle 1 (Challenge CRITICAL) — add heading-role regression
   coverage in the same step**: in the same three tests, additionally
   assert a visible heading exists within each testid'd container, scoped
   to that container's locator (not page-wide, to avoid false positives
   from any other heading on the page):
   `await expect(summary.getByRole('heading', { level: 1 })).toBeVisible()`
   for `member-availability-summary` (Member, AC1 sub-tests) and
   `admin-team-summary` (Admin, AC3 test); and
   `await expect(quickLinks.getByRole('heading', { level: 2 })).toBeVisible()`
   for `admin-quick-links` (Admin, AC3 test). These are new, additive
   assertions (nothing existing removed), so AC3's "unmodified" guarantee
   still holds for the pre-existing assertions in the same test bodies.
3. **Add the missing 1280px overflow/tap-target coverage (red)**: AC4 of
   this chore requires both 375px and 1280px checks; STORY-30's suite only
   has 375px. Add a new `test.describe('CHORE-18: AC4 desktop viewport
   (1280px)')` block in `e2e-integration/home.spec.ts` mirroring the
   existing 375px Admin/Member tests structurally, asserting
   `scrollWidth <= 1280` and quick-link/CTA tap targets still `>= 44px` (tap
   target floor doesn't shrink at wider viewports, so this is a valid reuse
   of the same assertion).
4. **Implement the redesign** in `app/[locale]/(app)/page.tsx`:
   - Import `Card, CardHeader, CardTitle, CardDescription, CardContent,
     CardFooter` from `@/components/ui/card`.
   - Admin branch: wrap `admin-team-summary` + nested
     `admin-blocks-next-30-days` in **one** `Card`:
     - `CardHeader` containing `<CardTitle><h1 className="text-2xl
       font-semibold">{t('adminSummaryTitle')}</h1></CardTitle>` (Design
       decision 6 — heading nested inside `CardTitle`, sizing classes moved
       onto the `<h1>`, `mb-2` dropped).
     - A **first** `CardContent` block containing only the stats `<ul>`
       (`adminActivePeopleCount` / `adminActiveRolesCount` `<li>`s).
     - A **second, separate** `CardContent` block, immediately below the
       first, containing the existing `admin-blocks-next-30-days` `<div>`
       unchanged except for its new parent.
       **Revision cycle 1 (Challenge WARNING 3) — reconciling the plan's
       internal inconsistency**: this is the authoritative structure —
       `admin-blocks-next-30-days` is a **second, sibling `CardContent`**
       nested inside the same `Card` as the stats `<ul>`'s `CardContent`,
       not merged into the same `CardContent` element. This matches Design
       decision 1's original wording exactly; Step 4 previously read
       ambiguously and is now explicit.
       **Revision cycle 1 (Challenge NOTE 5)** — add a one-line code comment
       directly above the `admin-blocks-next-30-days` `<div>` explaining the
       intentional nesting, e.g.: `{/* CHORE-18: intentionally nested inside
       admin-team-summary's Card as a second CardContent block (Design
       decision 1) — getByTestId is depth-independent, so this does not
       affect existing e2e assertions. */}`.
     - Wrap `admin-quick-links` in a second `Card`: `CardHeader` containing
       `<CardTitle><h2 className="text-lg font-semibold">{t('quickLinksTitle')}</h2></CardTitle>`
       (Design decision 6, same pattern, `<h2>` this time), `CardContent`
       for the existing button row, unchanged.
   - Member branch: wrap `member-availability-summary` in one `Card`:
     `CardHeader` containing `<CardTitle><h1 className="text-2xl
     font-semibold">{h('memberSummaryTitle')}</h1></CardTitle>` (Design
     decision 6) plus `CardDescription` for the intro sentence,
     `CardContent` for the stats `<ul>` + conditional
     next-blocked/no-upcoming-blocks paragraph, `CardFooter` for the CTA
     link.
   - Apply the stat-emphasis typography (Design decision 2) to the `<li>`
     elements in both branches.
   - Do **not** touch: query/count logic, translation calls/keys (including
     `messages/pt-PT.json` / `messages/en.json` values themselves — Design
     decision 2's revision explicitly rejects editing locale file contents),
     the `showDeniedBanner` block, the `role === null` / `resolveError` /
     `personId === null` branches, `SUNDAY_HORIZON`, imports from
     `availability/page.tsx` (none exist and none should be added).
5. **Run the full local verification loop**: `npm run lint`,
   `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` (smoke, confirms
   step 1's spec now passes), and the integration suite (confirms steps 2–3
   now pass and STORY-30's pre-existing assertions are unmodified/green).
6. **Manual/QA visual verification** (per the story's own Technical Notes —
   structural checks alone are insufficient for a visual-quality story): run
   the dev server, log in as Admin and as Member, view both light and dark
   theme, at 375px and 1280px, and confirm the result reads as
   intentionally designed (clear card separation, emphasized stat numbers,
   no cramped/overlapping text) — not just that tests are green.
   **Revision cycle 1 (Challenge WARNING 2) — explicit, falsifiable
   criteria for the stat-emphasis check** (replaces the previous vague
   "looks good" framing): the reviewer must specifically judge, for each of
   the four stat lines (Member available/blocked, Admin active
   people/roles), whether the numeral is visually distinguishable *within*
   its own line at a glance — i.e. does the eye land on the number first,
   the way a "10" in a dashboard stat card would stand out — or does the
   line merely read as "a bold sentence" with no particular emphasis on the
   digit itself. If the latter, the chosen `text-xl font-bold` /
   `text-base font-semibold` sizing (or whatever values were used) is
   insufficient and must be increased before sign-off — do not accept
   "technically bold" as satisfying AC2. Also confirm the three headings
   (Admin `<h1>` "Resumo da equipa", Admin `<h2>` "Acesso rápido", Member
   `<h1>` "Resumo da disponibilidade") are present and visually unchanged in
   size/weight from the pre-redesign screenshot in this story's Context
   section. Document the outcome in the story file's Manual Verification
   section before marking done.

### Test plan (1:1 to acceptance criteria)

- **AC1** (Admin: two distinct Cards): `e2e/home-page-cards.spec.ts` static
  check (Card usage on both testids) + `e2e-integration/home.spec.ts` AC3
  test's new `data-slot="card"` assertions (live render proof) + **new
  `getByRole('heading', { level: 1 })` on `admin-team-summary` and
  `getByRole('heading', { level: 2 })` on `admin-quick-links` (Revision
  cycle 1, Challenge CRITICAL — proves headings survive the `CardTitle`
  wrap, not just that a Card exists)** + manual visual check (step 6).
- **AC2** (Member: Card + emphasized counts): `e2e/home-page-cards.spec.ts`
  static check (Card usage on `member-availability-summary`) +
  `e2e-integration/home.spec.ts` AC1 sub-tests' new `data-slot` assertions +
  **new `getByRole('heading', { level: 1 })` on `member-availability-summary`
  (Revision cycle 1, Challenge CRITICAL)** + manual visual check using the
  explicit falsifiable criteria in Step 6 (numeral must be distinguishable
  within its own line, not just "the line is bold" — Revision cycle 1,
  Challenge WARNING 2), confirming numeral emphasis reads as a "stat," not
  plain text.
- **AC3** (testid preservation): STORY-30's existing
  `e2e-integration/home.spec.ts` tests pass **unmodified** (only additive
  assertions appended, nothing removed/changed) — this is the regression
  proof.
- **AC4** (no overflow at 375/1280px, ≥44px tap targets): existing 375px
  tests in `home.spec.ts` (unmodified, must still pass) + new 1280px
  `describe` block added in step 3.
- **AC5** (WCAG AA contrast, light+dark): no new tokens introduced (Design
  decisions use only `bg-card`/`text-card-foreground`/`text-muted-foreground`
  already verified by `e2e/card-ui-primitive.spec.ts` AC2 in CHORE-17) — no
  new automated test needed; reference that existing spec in the story's AC5
  verification note. Manual check: toggle dark mode in step 6 and confirm
  no eyeballed contrast issues on the new stat/typography treatments.
- **AC6** (lint/tsc/build/test:e2e green + new assertions): covered by step
  5's full verification loop; the "new visual-regression assertion" clause
  is satisfied by `e2e/home-page-cards.spec.ts` (new file) plus the
  additive `data-slot` assertions in `home.spec.ts`.

### Risks and rollback
- **Risk**: nesting `admin-blocks-next-30-days` one level deeper could in
  theory interact with some untested selector that assumes it's a sibling
  of `admin-team-summary` rather than a descendant. Mitigation: grep the
  full test suite for `admin-blocks-next-30-days` before implementation to
  confirm all consumers use `getByTestId` (depth-independent), not a
  sibling-relative CSS selector. (Already spot-checked in this plan via
  `home.spec.ts` — only `getByTestId` usage found.)
- **Risk**: `flex-wrap sm:flex-nowrap` quick-link button row now sits inside
  `CardContent`'s `px-6` padding, slightly reducing available width at
  375px. Mitigation: existing AC5 tap-target/overflow test in
  `home.spec.ts` already exercises this exact width and will fail loudly if
  wrapping breaks.
- **Risk**: stat-emphasis typography values (`text-xl`/`text-base` etc.)
  are a judgment call made during implementation, not pinned exactly in
  this plan — could look off on first pass. Mitigation: step 6's manual
  visual check is the actual gate for "looks good," not just automated
  overflow/contrast checks.
- **Risk** (Revision cycle 1 addition): forgetting to nest the `<h1>`/`<h2>`
  inside `CardTitle` (i.e. reverting to a naive `<CardTitle>{t(...)}</CardTitle>`)
  would silently delete all page headings with no lint/type/build failure —
  the only guard is the new `getByRole('heading', ...)` assertions added in
  Step 2. Mitigation: those assertions are unconditional (not gated behind
  an env var), so they run in every CI `integration-test` job and fail loudly
  if headings are dropped.
- **Rollback**: single-file (+ two test-file) change with a clean git
  history; revert-safe by reverting the implementation commit(s). No data
  migrations, no schema, no third-party config — lowest possible rollback
  risk in this codebase.

### Complexity tag: **standard**
Justification: the diff is presentational-only and reuses an
already-verified, already-reviewed primitive (CHORE-17's Card), which pulls
this toward `trivial`. However, it is **not** trivial because: (1) it spans
six distinct render branches in one Server Component and requires precisely
preserving every existing `data-testid` and every existing behavior
(query logic, translation calls, tap targets, overflow) across all of them —
a single misplaced nesting could silently break one of STORY-30's already-
passing e2e assertions; (2) it requires coordinated edits across two test
suites (`e2e/` smoke + `e2e-integration/`) per CLAUDE.md's multi-file
delivery discipline; (3) it includes non-mechanical design judgment calls
(Design decisions 1–6 above) that materially affect whether AC1/AC2 are
actually satisfied, not just copy/config tweaks. Per CLAUDE.md's rubric,
"standard" is the correct default for multi-file changes requiring
understanding of more than one module (the page's role-branching logic +
the Card primitive's contract + two test suites' conventions), and the
instruction is to route to `standard` when in doubt.

## Challenge (cycle 1)

**Verdict: NEEDS REVISION**

### Scope verification (confirmed)
Read `app/[locale]/(app)/page.tsx` directly. The plan's claim of "no
backend/data/ai-ml/infra changes" holds: all auth, Supabase queries, and
`SUNDAY_HORIZON`/`resolveSelfPersonId` logic are untouched. No references to
`availability/page.tsx` or header/nav chrome. Scope firewall: clean. Only
Frontend and QA personas activated — accurate.

### CRITICAL

**1. Heading semantics loss: `<h1>`/`<h2>` → `CardTitle` (a plain `<div>`) is
unaddressed and untested.**

`components/ui/card.tsx`'s own source comment documents: "CardTitle renders a
plain `<div>`... Heading semantics ... are the consumer's responsibility."
The current page has real semantic headings carrying the page's entire
heading structure: Admin `<h1>` "Resumo da equipa", Admin `<h2>` "Acesso
rápido", Member `<h1>` "Resumo da disponibilidade". The plan's Step 4 never
instructs nesting the existing `<h1>`/`<h2>` *inside* `CardTitle`, and none
of the five Design decisions address this. Read literally, the natural
implementation (`<CardTitle>{t('adminSummaryTitle')}</CardTitle>`) drops the
heading elements entirely — on both Admin and Member success paths, the two
most common authenticated landing states, the page would ship with **zero
heading elements**, breaking screen-reader heading-navigation (cf. STORY-16's
"empty landmark is an ARIA anti-pattern" precedent in CLAUDE.md). No test in
the plan catches this — zero `getByRole('heading', ...)` assertions exist in
`e2e-integration/home.spec.ts`, and the new static-source guard only checks
Card/testid presence, not heading tags.

**Required fix**: add an explicit Design decision requiring `<h1>`/`<h2>` to
be preserved and nested inside `CardTitle`
(`<CardTitle><h1 className="...">{t(...)}</h1></CardTitle>`), and add a
`getByRole('heading', { level: 1|2 })` regression assertion to
`e2e-integration/home.spec.ts` for both Admin and Member paths.

### WARNING

**2.** Design decision 2 (whole-line bold emphasis) is a weak reading of
AC2's "stat presentation" — consider `next-intl`'s `t.rich()` to wrap just
the numeral in `<strong>` within the existing ICU string (no new keys, no
copy change), or at minimum instruct the step-6 manual reviewer to judge
specifically whether the result reads as a "stat" (numeral distinguishable
from label), not just "the line is bold."

**3.** Internal inconsistency: Design decision 1 says
`admin-blocks-next-30-days` is "a second `CardContent` block below the stats
`<ul>`," but Step 4's bullet reads as if both live in one `CardContent`.
Reconcile before implementation.

### NOTE (non-blocking)

**4.** `CardDescription` changes element type `<p>` → `<div>` (visually
identical, but should be flagged as a deliberate accepted trade-off).

**5.** `admin-team-summary` testid now covers broader content than its name
implies (contains `admin-blocks-next-30-days` as descendant) — functionally
fine, but add a one-line code comment noting the intentional nesting.

### Verified as sound
AC3 testid preservation (all consumers use depth-independent `getByTestId`),
AC4 1280px coverage, AC5 contrast reliance on CHORE-17's already-verified
tokens, Design decisions 1/3/4.

## Refine (cycle 1 revision)

Addressed all three flagged findings and both NOTEs from Challenge cycle 1.
Existing Design decisions 1–5 and their numbering were left untouched (only
extended in place) so Challenge's "Verified as sound" cross-references
(Design decisions 1/3/4) still resolve correctly on re-read.

1. **CRITICAL (heading semantics) — fixed.** Added new **Design decision 6**
   requiring the existing `<h1>`/`<h2>` elements to be preserved and nested
   inside `CardTitle` (e.g.
   `<CardTitle><h1 className="text-2xl font-semibold">{t('adminSummaryTitle')}</h1></CardTitle>`),
   with the heading's own sizing classes moved onto the `<h1>`/`<h2>` itself
   (not left on `CardTitle`, whose defaults alone would under-size it) and
   the old `mb-2` dropped in favor of `CardHeader`'s `gap-1.5`. Step 4 now
   spells out the exact JSX for all three headings (Admin `<h1>`/`<h2>`,
   Member `<h1>`). Step 2 now adds three new, unconditional
   `getByRole('heading', { level: 1|2 })` assertions to
   `e2e-integration/home.spec.ts` — one per testid'd container
   (`member-availability-summary` level 1, `admin-team-summary` level 1,
   `admin-quick-links` level 2) — for both the Admin and Member render
   paths. The Test plan's AC1 and AC2 rows now cite this new coverage
   explicitly. A new Risk bullet documents that this is the only guard
   against silently dropping headings in a future edit.
2. **WARNING 2 (stat emphasis) — explicit decision made, documented.**
   Evaluated `t.rich()` numeral-only emphasis (wrapping just `#` in
   `<strong>` inside the existing ICU plural branches) and **rejected** it:
   it would still require editing `messages/pt-PT.json` and
   `messages/en.json` values, which sits too close to the story's own
   out-of-scope "no i18n copy... changes" line, and it introduces an
   untested ICU-plural + rich-text combination for what should stay a
   low-risk presentational chore. **Decision: keep whole-line bold
   emphasis** (Design decision 2, unchanged), but Step 6's manual QA
   instruction is now explicit and falsifiable — the reviewer must judge
   per stat line whether the numeral is visually distinguishable at a
   glance ("stat" read), not just whether the line is bold, and increase
   sizing if it fails that test. Full reasoning is inlined in Design
   decision 2 and Step 6.
3. **WARNING 3 (CardContent ambiguity) — reconciled.** Step 4 now states
   unambiguously that `admin-team-summary`'s Card contains **two separate,
   sibling `CardContent` blocks** — the first holding the stats `<ul>`, the
   second holding `admin-blocks-next-30-days` — matching Design decision
   1's original wording. The previous version's Step 4 bullet read as if
   both lived in one `CardContent`; that ambiguity is removed.
4. **NOTE 4 (CardDescription `<p>`→`<div>`) — flagged.** Design decision 5
   now includes one explicit sentence naming this as a deliberate, accepted
   trade-off (no AT/semantic meaning loss; byte-identical visual output).
5. **NOTE 5 (nesting code comment) — added.** Step 4 now instructs adding a
   one-line JSX comment directly above the `admin-blocks-next-30-days`
   `<div>` explaining the intentional nesting inside `admin-team-summary`'s
   Card, referencing Design decision 1.

No other plan sections were restructured; Steps 1, 3, 5, the Dependency
check, Affected areas, remaining Design decisions, and the Complexity tag
(justification text updated only to say "Design decisions 1–6") are
unchanged from cycle 0.

## Challenge (cycle 2)

**Verdict: APPROVED**

Re-verified directly against `app/[locale]/(app)/page.tsx`, `components/ui/card.tsx`,
and `e2e-integration/home.spec.ts` (not just plan prose).

1. **CRITICAL heading-semantics fix — sound.** `CardTitle` is confirmed a
   plain `<div>`; nesting the real `<h1>`/`<h2>` inside it does not strip
   heading role (accessibility role comes from the element itself, not
   ancestor wrappers) — `getByRole('heading', { level: N })` resolves
   correctly. Sizing classes correctly moved onto the inner heading tag.
   Step 2's three new test assertions are correctly scoped (locator-scoped,
   one per testid'd container, both Admin and Member paths) and close the
   cycle-1 gap. Minor non-blocking note: the plan's rationale attributes
   header→content spacing to `CardHeader`'s `gap-1.5`, but for the two
   single-child Admin cards it's actually `Card`'s root `gap-6` — doesn't
   change the implementation outcome, just an inaccurate one-line rationale.
2. **WARNING 2 resolution** — reasonable, documented, non-scope-creeping
   judgment call (t.rich() correctly rejected as too close to the
   copy-change out-of-scope line).
3. **WARNING 3 resolution** — now unambiguous (two sibling CardContent
   blocks, matching Design decision 1).
4. **NOTEs 4 and 5** — both addressed.
5. **Scope firewall** — clean; no new creep introduced by the revision. No
   changes to `components/ui/card.tsx`, `availability/page.tsx`, header/nav
   chrome, or any query/auth/routing/copy logic.

No CRITICAL issues remain. Per CLAUDE.md's retry budget, this is cycle 2 and
the plan is approved — safe to proceed to Implementation.

## Manual Verification (Step 6)

Performed against a real local Supabase instance (`supabase start`, test
users seeded via `supabase/seed-test-users.mjs`) and a `npm run build` +
`npm start` server, using Playwright's `adminPage`/`memberPage` auth
fixtures (`e2e-integration/fixtures.ts`) to drive real logged-in sessions —
not a static/structural check. Screenshots captured at 375px and 1280px, in
both light theme (default) and dark theme (via `page.emulateMedia({
colorScheme: 'dark' })`, since next-themes' blocking inline script is
authoritative on a cold `page.goto()` load — a `resolved-theme` cookie alone
is only authoritative for soft navigations per CLAUDE.md's CHORE-13 note).

- **Card separation**: Confirmed. Admin view renders two visually distinct
  bordered/shadowed cards ("Resumo da equipa" and "Acesso rápido"); Member
  view renders one card ("Resumo da disponibilidade"). Clear visual grouping
  in both light and dark theme, at both viewport widths — no cramped or
  overlapping text, no horizontal overflow.
- **Headings preserved**: Confirmed. All three headings (Admin `<h1>` "Resumo
  da equipa", Admin `<h2>` "Acesso rápido", Member `<h1>` "Resumo da
  disponibilidade") are present, visually unchanged in size/weight from the
  pre-redesign screenshot in this story's Context section (same
  `text-2xl font-semibold` / `text-lg font-semibold` sizing, now living on
  the inner heading tag per Design decision 6).
- **Stat-emphasis falsifiable check** (Revision cycle 1, Challenge WARNING 2
  criteria): for all four stat lines — Admin "1 pessoa ativa" / "0 funções
  ativas", Member "11 domingos disponíveis" / "1 domingo bloqueado" — the
  numeral is the first token on the line and is rendered at `text-xl
  font-bold`, visibly larger and bolder than the surrounding `text-sm` body
  copy in the same card. The eye lands on the number first, consistent with
  a dashboard "stat" read, not merely "a bold sentence." Judged sufficient;
  no further size increase needed.
- **Dark theme contrast**: Eyeballed against the screenshots — card
  background/border/text all read cleanly with no washed-out or
  low-contrast text in either the stat lines or the `CardDescription` intro
  line. No new ad hoc colors were introduced (reuses `bg-card` /
  `text-card-foreground` / `text-muted-foreground`, already
  contrast-verified by `e2e/card-ui-primitive.spec.ts` AC2 from CHORE-17).
- **Quick-links row**: unchanged visual treatment (ghost-variant buttons,
  out of this chore's scope to restyle further) now sits inside the second
  card's `CardContent` padding; no wrapping/overflow regression observed at
  375px.

Outcome: the redesign reads as intentionally designed per the user's own
"simple, but good" framing — sign-off given.

## Definition of Done
See CLAUDE.md.
