# CHORE-19: Redesign availability page visual design (Card-based layout)
Epic: maintenance
Priority: low (visual-quality debt, not a functional defect)
Status: draft
Depends on: CHORE-17 (Card UI primitive)
Related story: STORY-26 (member-block-unblock-sundays), STORY-25
(blocked-dates-data-model-and-api) — this chore restyles their output; no
data/logic changes.

## Task
As a Member (or Admin editing on someone's behalf), I want the "Disponibilidade"
page to look intentionally designed instead of a plain list of dates and a
lone bordered button, so it feels as trustworthy and finished as the rest of
a polished app.

## Context
The user's desktop screenshot of `/pt-PT/availability` shows: a title, a
one-line "Nos próximos 12 domingos:" caption, two plain stat lines (available
/ blocked counts), a "next unavailable" line, and a single outline button —
all rendered as unstyled stacked text with a large empty page below. Feedback
tied to this screenshot: "I don't want slop, I want good design. Simple, but
good."

The summary block lives in `app/[locale]/(app)/availability/page.tsx`
(Server Component) before handing off to `AvailabilityToggleList` (Client
Component, STORY-26) for the actual per-Sunday block/unblock list. This
chore is purely visual: give the summary block a `Card` treatment (CHORE-17)
consistent with whatever CHORE-18 establishes for the home page's summary
card, and review `AvailabilityToggleList`'s per-Sunday rows for the same
"simple, but good" bar (clearer row separation, consistent spacing, tap
target affordance) without changing its state machine or optimistic-update
logic.

## Acceptance criteria
1. Given the availability page, when rendered, then the summary (available
   count, blocked count, next-unavailable date) renders inside a `Card`
   consistent with the visual language CHORE-18 establishes for the home
   page's member summary card — not as bare stacked text.
2. Given the per-Sunday list rendered by `AvailabilityToggleList`, when
   viewed, then each row has clear visual separation and consistent spacing
   (e.g. alternating/bordered rows or card-per-row treatment), a visible
   distinction between available and blocked state beyond text alone
   (e.g. a color/badge cue using existing design tokens), while preserving
   its existing one-tap block/unblock interaction and optimistic-update
   behavior exactly as-is.
3. Given all existing `data-testid` attributes in both the Server Component
   (`availability-load-error`, `noLinkedPersonTitle` container, etc.) and
   `AvailabilityToggleList`, when the redesign ships, then they are
   preserved unchanged so STORY-25/STORY-26/STORY-27's existing e2e tests
   keep passing without modification.
4. Given the page at 375px and 1280px viewports, when rendered, then there
   is no horizontal overflow and all interactive block/unblock controls
   retain their existing ≥44px tap targets (per STORY-26/STORY-18's
   established tap-target standard).
5. Given light and dark theme, when the redesigned card/rows render, then
   text and state-indicator contrast meets WCAG AA in both themes, reusing
   CHORE-17's verified tokens.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0 with STORY-25/26/27's existing availability
   e2e tests passing unmodified.

## Out of scope
- Any change to blocked-dates data model, API routes, or the optimistic
  update/revert logic in `AvailabilityToggleList` — purely visual.
- The Admin-on-behalf variant's URLs/props (STORY-27) — the visual change
  should apply uniformly since `AvailabilityToggleList` is shared between
  Member and Admin-on-behalf modes per its existing optional-props pattern
  (CLAUDE.md), but no new admin-specific UI is in scope.
- The header/nav chrome — that's BUGFIX-06.
- The home page — that's CHORE-18 (sequence this chore after or alongside
  it so the two summary cards share one consistent visual language).
- Icons/illustrations — text, color, spacing, and card grouping only.

## Technical notes
- Depends on CHORE-17 landing first. Consider sequencing after CHORE-18 so
  the "stat card" pattern only needs to be designed once and is then reused
  here, rather than two stories independently inventing similar-but-slightly-
  different card styles.
- Per CLAUDE.md's "Extending a Member-facing Client Component for admin use"
  pattern: `AvailabilityToggleList` already gates admin-mode via optional
  `personId`/`personName` props — do not duplicate the component; restyle
  the one shared implementation.
- Re-verify STORY-26's flexbox `justify-between` + `gap` lesson (CLAUDE.md)
  if row layout changes — long pt-PT date strings need explicit `gap-2`
  minimum spacing against adjacent state labels.
- Visually render (dev server or Vercel preview) before marking done — do
  not rely on structural assertions alone to judge "good design."

## Implementation Plan

### Human decision (confirmed, resolves prior blocker)

Interpretation B is confirmed: this chore **adds** a new summary block
(available count, blocked count, next-unavailable date) to `/availability`,
in addition to restyling the per-Sunday rows (AC2). Confirmed constraints:

1. The summary lives in `AvailabilityToggleList` (Client Component), derived
   via `useMemo` from the `sundays` prop + live `blockedDates` state — stays
   live-accurate as the user toggles. Zero new Supabase queries, zero new
   API routes, zero changes to `app/[locale]/(app)/availability/page.tsx`.
2. Fully neutral/shared copy between Member self-service and Admin-on-behalf
   modes (no personalized second-person text) — no new admin-specific UI
   branch. (The pre-existing `title`/`adminTitle` distinction, which already
   personalizes the page's `<h1>` with the person's name in admin mode, is
   untouched and out of scope for this neutrality rule — it predates this
   story.)
3. New i18n keys under the `Availability` namespace only, in both
   `messages/pt-PT.json` and `messages/en.json`: a summary intro line,
   ICU-plural available/blocked count lines, a next-unavailable line, and a
   no-upcoming-blocks line. Reuse the existing `Availability.title` /
   `Availability.adminTitle` keys for the Card's heading (no redundant new
   title key).

### Affected areas

- **Frontend (Client Component)** — `components/AvailabilityToggleList.tsx`
  is the only component file touched. Restructures its JSX into a `Card`
  layout (CHORE-17 primitive) and adds a `useMemo`-derived summary. No
  change to its state machine (`blockedDates`, `pendingDates`,
  `errorMessage`), optimistic-update logic, or admin-mode gating.
- **i18n / copy** — `messages/pt-PT.json` and `messages/en.json`, new keys
  under `Availability` only (5 new keys, added to both files in the same
  step to satisfy `e2e/i18n-key-parity.spec.ts`).
- **UX / visual design** — Card-based layout, WCAG AA contrast
  verification, tap-target and overflow re-verification at 375px/1280px.
- **Tests** — new assertions added to `e2e-integration/availability.spec.ts`
  and `e2e-integration/admin-availability.spec.ts` (additive only — no
  existing test bodies in these files, or in `e2e/availability-blocks.spec.ts`
  / `e2e/admin-availability.spec.ts`, are modified, per AC3/AC6). One new
  CI-safe contrast test file for AC5's blocked-state badge check (solid
  `--destructive-foreground` on `--destructive`, corrected per Design
  decision 4 below).
- **No backend/data/API/migration changes** — confirmed out of scope by the
  story and unaffected by this plan.

### Proposed i18n keys (Design decision — wording, not yet QA'd; open to a
neutral/AO90-compliant tweak at implementation time as long as the shape
below is preserved)

`messages/pt-PT.json` → `Availability`:
```
"summaryIntro": "Nos próximos {total} domingos:",
"summaryAvailableCount": "{count, plural, one {# domingo disponível} other {# domingos disponíveis}}",
"summaryBlockedCount": "{count, plural, one {# domingo bloqueado} other {# domingos bloqueados}}",
"summaryNextUnavailable": "Próximo domingo indisponível: {date}",
"summaryNoUpcomingBlocks": "Nenhum domingo indisponível nos próximos {total}."
```

`messages/en.json` → `Availability`:
```
"summaryIntro": "In the next {total} Sundays:",
"summaryAvailableCount": "{count, plural, one {# available Sunday} other {# available Sundays}}",
"summaryBlockedCount": "{count, plural, one {# blocked Sunday} other {# blocked Sundays}}",
"summaryNextUnavailable": "Next unavailable Sunday: {date}",
"summaryNoUpcomingBlocks": "No unavailable Sundays in the next {total}."
```

Note the deliberate difference from `Home.memberSummaryNoUpcomingBlocks`
("Estás disponível em todos os próximos..."): the `Availability.*` version
avoids the second-person subject entirely, per confirmed decision 2
(neutral copy shared with admin-on-behalf mode).

### Design decisions (flagged, non-blocking — Challenge/Review should still
independently verify each against the ACs, per CLAUDE.md's CHORE-20 lesson)

1. **Single Card, two `CardContent` blocks** — wrap the whole component in
   one `Card` (`CardHeader` → `CardTitle` nesting the existing `<h1>` +
   `CardDescription` for the intro line; first `CardContent` for the
   available/blocked counts + next-unavailable-or-no-blocks line; second
   `CardContent` for the instructions paragraph, error banner, and the
   per-Sunday `<ul>`) — rather than two separate Card elements. This mirrors
   `app/[locale]/(app)/page.tsx`'s `admin-team-summary` two-`CardContent`
   precedent (CHORE-18) and keeps the page visually simple (one bordered
   container, not a stack of cards), matching the user's "simple, but good"
   feedback. AC1 only requires the *summary* to be inside *a* Card; it does
   not forbid the list from sharing that same Card.
2. **Per-Sunday rows keep their existing bordered-button treatment as the
   *container-level* cue, but the blocked-state *text* treatment changes**
   (revised after Challenge cycle 1 — see corrected Design decision 4 below
   for the contrast math that forced this). The row's outer `<button>` keeps
   `border-destructive bg-destructive/10` when blocked (a decorative wash,
   not text-bearing, so it carries no WCAG text-contrast obligation) and
   `hover:bg-accent` otherwise — unchanged from today. What changes: the
   `text-destructive` class is **removed** from the button element (it was
   applying red text to both child `<span>`s via inheritance, which is the
   combination that fails AC5). The `stateLabel` `<span>` (the "Bloqueado"/
   "Disponível" text) becomes a small solid-fill badge —
   `rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold
   text-destructive-foreground` — only for the blocked state; the available
   state's `stateLabel` span keeps its current plain `font-medium` styling
   (unchanged, since it was never the failing combination). The
   `formattedDate` `<span>` drops `text-destructive` entirely and falls back
   to the default inherited foreground color, which — verified below — is
   comfortably AA-compliant against the `bg-destructive/10` wash in both
   themes (>17:1), so it needs no badge treatment. AC2's "(e.g.
   alternating/bordered rows or card-per-row treatment)" is illustrative,
   not mandatory, and AC2's literal "a color/badge cue using existing design
   tokens" wording is satisfied more precisely by this badge than by the
   previous plain-text-on-tint approach. The row markup structure itself
   (button, its two `<span>` children, `aria-pressed`, `disabled`,
   `onClick`) is otherwise untouched — only the blocked-state className
   string and the `stateLabel` span's className change — to protect the
   existing `e2e-integration/availability.spec.ts` AC6 span-gap check (still
   two `<span>` children in the same DOM positions) and the
   `main ul li button` locator used across STORY-25/26/27 tests. No change
   to the row's ancestor wrapping decision (still nested inside the shared
   Card's second `CardContent`, ancestor-depth-agnostic per the Risks
   section below).
3. **Two testids, correctly scoped** (revised after Challenge cycle 1
   WARNING — the original single `availability-summary` testid on the whole
   Card root was misleadingly broad, since that Card also contains the
   per-Sunday list, not just the summary). `data-testid="availability-card"`
   goes on the outer `Card` root (the whole-page container — title, intro,
   summary metrics, and the per-Sunday list all live inside it).
   `data-testid="availability-summary"` moves to the first `CardContent`
   block specifically — the one containing only the available/blocked
   ICU-plural counts and the next-unavailable-or-no-blocks line — so a
   future test author querying `[data-testid="availability-summary"]` gets
   exactly the summary metrics, not the list. Both testids are net-new
   additions (not replacements of any existing testid) — does not touch
   AC3's "preserved unchanged" set.
4. **Corrected finding (Challenge cycle 1, CRITICAL) — `--card`/
   `--background` being numerically identical was the wrong question.**
   The original Design decision 4 reasoned that because `--card` and
   `--background` share the same HSL value in both themes, moving the list
   into a Card introduces "no new contrast risk." That's true but
   irrelevant: AC5 requires the state-indicator *itself* — `text-destructive`
   solid text composited over the `bg-destructive/10`-over-`--card` wash —
   to independently clear WCAG AA (≥4.5:1), and this specific pairing was
   never verified anywhere in the codebase (CHORE-17 only verified
   `--card-foreground`/`--card` and `--muted-foreground`/`--card`).
   Independently re-computed (HSL→sRGB→relative-luminance→WCAG contrast
   formula, same method as `e2e/card-ui-primitive.spec.ts`, using the
   project's actual `app/globals.css` values — `--destructive: 0 72.2%
   50.6%` light / `0 62.8% 30.6%` dark, `--card: 0 0% 100%` light / `240 10%
   3.9%` dark):
   - Light theme, old combo (`text-destructive` solid on `bg-destructive/10`
     over `--card`): **4.14:1 — fails** the 4.5:1 AA floor.
   - Dark theme, old combo: **1.93:1 — fails badly.**

   This confirms Challenge's finding and blocks AC5 (and transitively AC6,
   once the planned contrast test is written and actually run against the
   real component).

   **Remediation (chosen): switch the blocked-state text cue from
   translucent-tint text to a solid-fill badge**, per Design decision 2
   above. A solid, fully opaque background gives far more contrast headroom
   than a 10%-alpha tint, and this reuses the *existing* `--destructive`/
   `--destructive-foreground` token pair — the same pair `components/ui/
   button.tsx`'s `destructive` Button variant already uses for its solid
   fill — so no new CSS custom property is introduced and no other
   component's styling is touched (unlike retuning the shared `--destructive`
   base token directly, which would blast-radius into every other
   `bg-destructive/10 text-destructive` error-banner instance across the
   app — `PersonSkillsEditor.tsx`, `UserTable.tsx`, `ClaimPersonForm.tsx`,
   `RoleTable.tsx`, `PeopleTable.tsx`, the home page, the login page, and
   this same component's own `availability-error` banner — all of which are
   out of scope for this purely-visual, single-component chore). Verified
   contrast for the new combo (`--destructive-foreground` text, solid
   `--destructive` background):
   - Light theme: **4.62:1 — passes** AA (margin is thin — 0.12 above the
     4.5 floor — see Risks below for the accepted-margin precedent).
   - Dark theme: **9.59:1 — passes comfortably.**

   As a side-check, the `formattedDate` span (which loses `text-destructive`
   entirely and falls back to default foreground) was also verified against
   the still-present `bg-destructive/10`-over-`--card` wash: **17.05:1
   (light) / 18.53:1 (dark)** — both far above the 4.5 floor, confirming no
   new fix is needed there. AC5's new automated test (below) asserts the new
   badge combo directly from the two raw HSL tokens (`--destructive`,
   `--destructive-foreground`) — no alpha compositing needed, since the
   badge background is fully opaque.

### Step-by-step approach (test-first)

1. Add the 5 new i18n keys to both `messages/pt-PT.json` and
   `messages/en.json` under `Availability` (data-only change; unblocks
   writing tests that reference real copy).
2. Write failing tests first (extend, do not modify, existing spec files):
   - `e2e-integration/availability.spec.ts` — new `describe` block for AC1:
     Member summary Card renders with `data-testid="availability-card"`
     (whole card) and `data-testid="availability-summary"` scoped to the
     summary metrics block only, shows a level-1 heading, correct
     available/blocked ICU-plural counts, and either the formatted
     next-unavailable date or the no-upcoming-blocks line, for both a "some
     blocks" fixture and a "zero blocks" fixture (mirrors
     `e2e-integration/home.spec.ts`'s two-scenario pattern for
     `Home.memberSummary*`, including its `renderPlural`-from-JSON helper
     style).
   - `e2e-integration/admin-availability.spec.ts` — new test confirming the
     same summary block renders in admin-on-behalf mode with the identical
     neutral copy (no personalized "you" framing), alongside the existing
     personalized `adminTitle` heading.
   - New CI-safe contrast test (e.g.
     `e2e/availability-destructive-contrast.spec.ts`, modeled on
     `e2e/card-ui-primitive.spec.ts`'s HSL-extraction + contrast-ratio
     helpers): read `--destructive` and `--destructive-foreground` directly
     from both `:root` and `.dark` blocks of `app/globals.css` and assert
     `--destructive-foreground` text on a **solid** `--destructive`
     background (the new blocked-state badge — no alpha compositing, since
     the badge is fully opaque) meets WCAG AA (≥4.5) in both themes. This
     replaces the earlier (incorrect) plan of testing `text-destructive` on
     a `bg-destructive/10`-over-`--card` alpha composite, which the
     corrected Design decision 4 shows fails AA (4.14:1 / 1.93:1) and is no
     longer the shipped combination.
   - Extend `e2e-integration/availability.spec.ts`'s AC4 coverage (this
     story's AC4, not STORY-26's) with an explicit 1280px viewport check
     (existing STORY-26/27 tests only assert 375px): no horizontal
     overflow, the summary Card and list both render without layout
     breakage at that width, **and** re-assert every block/unblock button
     and (in admin mode) the back-link still meet the ≥44px tap-target floor
     at 1280px — not just at 375px — per AC4's literal wording ("retain
     their existing ≥44px tap targets") and the `boundingBox()` guard
     pattern (CLAUDE.md: always `toBeVisible()` before `boundingBox()`).
   All new tests should fail against the current (unmodified) component,
   proving they exercise real, not-yet-built behavior.
3. Implement `components/AvailabilityToggleList.tsx`:
   - Import `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
     `CardContent` from `@/components/ui/card`.
   - Add `useMemo`-derived `availableCount`, `blockedCount`,
     `nextUnavailableDate` (first entry of `sundays` present in the live
     `blockedDates` Set — `sundays` is ascending per
     `getUpcomingSundays`), depending on `[sundays, blockedDates]`.
   - Restructure JSX per Design decision 1: `Card` → `CardHeader`
     (`CardTitle` nests the existing `<h1>` exactly as-is;
     `CardDescription` renders `t('summaryIntro', { total: sundays.length })`)
     → first `CardContent` (available/blocked count list items +
     next-unavailable-or-no-blocks paragraph) → second `CardContent`
     (existing instructions `<p>`, existing error banner, existing `<ul>`
     of Sunday buttons, existing admin-mode back-link) — with the button/
     `<li>`/error-banner/back-link markup, classes, and `data-testid`s
     copied over unchanged **except** the blocked-state button className and
     `stateLabel` span className, which change per corrected Design
     decision 2/4: remove `text-destructive` from the button's blocked-state
     class string (keep `border-destructive bg-destructive/10`), and add
     `rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold
     text-destructive-foreground` to the `stateLabel` span only when
     `isBlocked` is true (available state's span className is unchanged).
   - Add `data-testid="availability-card"` to the `Card` root and
     `data-testid="availability-summary"` to the first `CardContent` (the
     summary metrics block only, per corrected Design decision 3).
4. Run `npm run lint && npx tsc --noEmit && npm run build` — fix any
   issues.
5. Run the full test suite: `npm run test:e2e` (smoke) and the integration
   suite (`e2e-integration/*`, per the project's documented Node/Playwright
   WSL2 setup notes in CLAUDE.md) — confirm the new tests now pass and,
   critically, that **every existing STORY-25/26/27 test passes unmodified**
   (AC3/AC6).
6. Manual visual verification (per this story's own Technical Notes: "do
   not rely on structural assertions alone to judge 'good design'"): run the
   dev server, view `/pt-PT/availability` as Member and as Admin-on-behalf,
   in light and dark theme, at 375px and 1280px. Confirm the Card reads as
   intentional (not "slop"), the two-CardContent split doesn't look
   crowded, and the per-Sunday rows are legible with clear available/blocked
   distinction. Document this manual pass in the story file per Definition
   of Done item 5.
7. Update the story file with AC verification notes/screenshots reference
   before requesting review.

### Test plan (mapped to ACs)

- **AC1** (summary in Card) — new `e2e-integration/availability.spec.ts`
  tests: outer Card visible with `data-testid="availability-card"`, summary
  metrics block visible with the correctly-rescoped
  `data-testid="availability-summary"`, heading role present, ICU-plural
  counts correct for both a some-blocks and a zero-blocks fixture,
  next-unavailable/no-upcoming-blocks line correct in each case.
- **AC2** (row separation + state cue, interaction/optimistic-update
  unchanged) — regression: all pre-existing STORY-26 AC2/AC4/AC5 tests
  (toggle, in-flight disabling, error revert) pass unmodified against the
  restructured markup, proving zero behavioral change. The new blocked-state
  badge (`bg-destructive text-destructive-foreground` on the `stateLabel`
  span) is asserted directly — a stronger, more literal satisfaction of
  AC2's "a color/badge cue using existing design tokens" wording than the
  original plain-text-on-tint treatment. Visual "clear separation" itself
  remains a design judgment verified manually (step 6), per this story's own
  Technical Notes instruction, since it isn't a testable binary property in
  isolation from human eyeballing.
- **AC3** (testid preservation) — the regression gate *is* running the
  existing STORY-25/26/27 spec files with zero edits to their test bodies
  and observing 100% pass; any diff there is treated as a plan violation
  requiring fix, not test-file edits. (The two new testids in this story —
  `availability-card`, `availability-summary` — are additive, not replacing
  any preserved testid.)
- **AC4** (no overflow at 375/1280, ≥44px tap targets) — existing STORY-26
  AC6 test and STORY-27 AC7 test (375px, all buttons + back-link) continue
  passing unmodified; new explicit 1280px assertion added (step 2) covering
  both no-horizontal-overflow **and** ≥44px `boundingBox()` height on every
  block/unblock button and the admin back-link, since no existing test
  covers tap-target size at that width for this page (only 375px was
  previously covered, and AC4's wording requires both viewports).
- **AC5** (WCAG AA contrast both themes) — reuses CHORE-17's already-verified
  `--card-foreground`/`--card` and `--muted-foreground`/`--card` pairs
  (`e2e/card-ui-primitive.spec.ts`, untouched) for all new text (`CardTitle`,
  `CardDescription`, count/summary lines use default foreground/muted
  classes, no new tokens). New solid-fill contrast test for the corrected
  blocked-state badge (`--destructive-foreground` text on solid
  `--destructive` background, per corrected Design decision 4) in both
  themes: **4.62:1 light / 9.59:1 dark**, both ≥4.5 AA floor. The
  `formattedDate` span's fallback-to-default-foreground on the still-present
  `bg-destructive/10` wash is also independently verified (17.05:1 light /
  18.53:1 dark) though not gated by a dedicated automated test, since its
  values reuse the already-CHORE-17-verified foreground/card-family
  relationship with wide margin.
- **AC6** (lint/tsc/build/test:e2e all exit 0, no regressions) — step 4/5
  above; final gate before marking done.

### Risks and rollback

- **Risk**: restructuring JSX could accidentally alter the `<button>`'s
  internal two-`<span>` markup that STORY-26's AC6 gap-check test depends on
  (`el.querySelectorAll('span')[0]`/`[1]`). Mitigation: copy the existing
  `<li><button>...</button></li>` block verbatim; only its *ancestor*
  wrapping (now inside the shared Card's second `CardContent` instead of a
  bare `<div>`) changes.
- **Risk**: `main ul li button` (used by every STORY-25/26/27 e2e locator)
  depends on the `<ul>` being a descendant of `<main>` — Card/CardContent
  add extra `<div>` nesting depth but Playwright's descendant combinator
  matches any depth, so this is safe by construction, not by luck; still
  worth an explicit regression run (step 5) rather than assuming.
- **Risk**: the light-theme badge contrast (4.62:1) clears the 4.5 AA floor
  by a thin margin (0.12). Mitigation: this is a measured, not guessed,
  value (verified two independent ways during refinement — hand HSL→sRGB→
  luminance math and a standalone Python script — both agreeing to 3
  decimal places), and the automated CI-safe contrast test (step 2) gates
  this exact combination going forward, so any future token retune that
  regresses it below 4.5 fails CI immediately. This mirrors the accepted
  precedent in CLAUDE.md's CHORE-17 notes (`text-muted-foreground` on
  `bg-card` ≈ 4.83:1 — thin-but-passing, gated by test, not treated as a bug
  to fix further). Switching to the solid-fill badge (instead of retuning
  the shared `--destructive` token further) was chosen specifically to
  avoid a larger blast radius across the app's many other
  `bg-destructive/10 text-destructive` error-banner instances (see
  corrected Design decision 4) — if a future story wants more headroom here,
  retuning `--destructive`'s lightness (STORY-19 `--warning` precedent)
  would need an app-wide contrast re-audit of every consumer, which is
  explicitly out of scope for this chore.
- **Risk (reduced)**: the original plan's alpha-compositing contrast test
  (10%-tint over `--card`) carried implementation risk of incorrect alpha-
  blend math. The corrected remediation removes this risk class entirely —
  the new test compares two raw HSL tokens directly (`--destructive-
  foreground` on solid `--destructive`) with no compositing step, so the
  test is simpler and cannot have an alpha-math bug. The implementer should
  still cross-check the final computed values against a real contrast
  checker (e.g. WebAIM's contrast checker, pasting the two colors'
  hex/RGB values) once during implementation, per the STORY-19 precedent, as
  a third independent confirmation before trusting the assertion long-term.
- **Risk**: `useMemo` summary depends on `blockedDates` (a `Set`) as a
  dependency — since every existing `setBlockedDates` call already creates a
  new `Set` (STORY-26's established optimistic-update pattern), this
  recomputes correctly on every toggle with no extra work needed.
- **Rollback**: this story touches exactly two locale JSON files and one
  Client Component, with zero DB/migration/API changes. A `git revert` of
  the PR's commits fully restores prior behavior with no backend
  cleanup required.

### Complexity tag

**standard** — touches a shared, dual-mode (Member/Admin-on-behalf) Client
Component with an existing optimistic-update state machine and several
pre-existing e2e regression suites that must remain green *unmodified*;
requires careful DOM-structure preservation in two directions (existing
locator/gap-check assumptions plus new AC1/AC5 test coverage), new
cross-locale i18n keys, and a new solid-fill WCAG contrast remediation +
regression test derived from independently re-verified HSL/luminance math
(cycle 1 Challenge finding). Not `complex` — no auth, data-integrity,
concurrency, security, or migration changes, and no new API routes, no
`globals.css` edits; the actual code change is a single component's
JSX/derived-state restructure plus a className swap on one existing
element.

## Definition of Done
See CLAUDE.md.
