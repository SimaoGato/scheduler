# CHORE-26: Roll out mono-digit/date treatment on the Availability page
Epic: maintenance
Priority: standard — visual-only, sequenced as part of the pre-EPIC-04 UI
push the user explicitly requested
Status: done ✅
PR: 62
Depends on: CHORE-23 (tokens/fonts), CHORE-24 (shared pill-shape primitives)
Related: CHORE-19 (existing availability page Card redesign, being extended
here, not replaced), user-provided mockup in `App design refinement/`

## Task
As a Member or Admin viewing the Availability page
(`app/[locale]/(app)/availability/page.tsx`, `AvailabilityToggleList.tsx`),
I want the Sunday date rows and summary stat numbers to use the new
monospace font treatment from the design mockup, so this page visually
matches the Dashboard's data-vs-prose distinction (CHORE-25) once the new
design language rolls out.

## Context
CHORE-19 already gave this page a Card-wrapped structure with a live
summary block and WCAG-contrast-fixed blocked-state badges. This chore does
**not** revisit that structure or the contrast fixes — it only applies the
monospace font (from CHORE-23) to the numeric/date content the mockup
treats as data: each Sunday row's date, the available/blocked summary
counts, and the "Next blocked Sunday" date, while status badge text
("UNAVAILABLE"/"Available"/equivalent pt-PT strings) and all prose labels
keep the display font.

## Acceptance criteria
1. Given the Availability page's summary card, when rendered, then the
   available-count and blocked-count numbers use the CHORE-23 monospace
   font token; their labels ("available Sundays"/"blocked Sundays" or
   pt-PT equivalents) keep the display font.
2. Given the Availability page's Sunday row list, when rendered, then each
   row's date text uses the monospace font token; the status badge
   ("Disponível"/"Indisponível" or equivalent) keeps its existing font and
   the WCAG-AA-verified contrast treatment from CHORE-19 — this chore must
   not touch badge color/contrast, only the date's font.
3. Given the "Next blocked Sunday" line, when rendered, then the date value
   uses the monospace font token while the surrounding sentence stays in
   the display font.
4. Given this is purely a font-family change on existing elements, when
   applied, then no existing WCAG AA contrast measurement from CHORE-19
   regresses (font-family does not affect contrast ratio, but re-run/
   spot-check the existing contrast e2e test to confirm no incidental
   change).
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0, with existing availability e2e tests
   (STORY-25/26/27, CHORE-19) passing unmodified.

## Out of scope
- Any change to the blocked/available toggle logic, API calls, or the
  admin-on-behalf mode (`AvailabilityToggleList`'s `personId` prop path,
  STORY-27) — purely a font-family visual change.
- Badge shape/color — already pill-shaped and contrast-verified by CHORE-19;
  CHORE-24 covers shape language for any remaining non-pill elements, not
  this chore.
- The Dashboard's mirrored summary card — CHORE-25 owns that instance even
  though it shares the same stat markup pattern; keep the two chores
  independent so either can land without waiting on the other, and note in
  each PR if a shared subcomponent naturally covers both (in which case the
  second chore to land should reference this one rather than duplicate the
  change).

## Technical notes
- Primary files: `app/[locale]/(app)/availability/page.tsx`,
  `components/AvailabilityToggleList.tsx`.
- If Dashboard (CHORE-25) and Availability share a summary-card
  subcomponent already (both render "available/blocked Sundays" stats),
  check for that reuse before duplicating the font change in two places —
  applying it once in the shared component may satisfy both chores'
  acceptance criteria simultaneously; call this out explicitly in whichever
  PR lands second.
- Reuse CHORE-23's verified mono token directly; no new font or color
  values.
- Visually render (dev server) both Member and admin-on-behalf modes, both
  themes, at 375px and 1280px, before marking done.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

*Revision note: revised after Challenge cycle 1 returned NEEDS REVISION.
CRITICAL — Decision 3's default (stripping `text-xl font-bold` off the
summary `<li>` and moving it onto the numeral `<span>` alone, dropping the
label to plain ambient text) exceeded AC4's font-family-only scope and
misapplied its own cited CHORE-25 precedent; fixed by locking in the
alternative (leave `<li>` unchanged, numeral `<span>` gets only `font-mono`,
inheriting size/weight). WARNING — the `summaryNextUnavailable` date span's
added `font-medium` (matching CHORE-25's Dashboard treatment) was a
judgment call that wasn't flagged as such; now called out explicitly in the
plan and required to be named in the PR description. Both fixes are
reflected below; see Decision 3 and the "Judgment call" note under the
concrete markup plan.*

### Pre-work findings (Story Context accuracy check)

- **CHORE-25 (Dashboard rollout) has landed** (`docs/stories/done/CHORE-25-dashboard-page-design-language-rollout.md`,
  merged as PR #58). It applies `font-mono` directly on `app/[locale]/(app)/page.tsx`
  (the Home/Dashboard Server Component) — there is **no shared summary-card
  subcomponent** between Dashboard and Availability. Dashboard's markup lives
  entirely inline in `page.tsx`; Availability's summary lives entirely inline
  in `components/AvailabilityToggleList.tsx` (a separate Client Component with
  its own `useTranslations`/`t.rich()` calls). The Technical notes' "check for
  shared subcomponent reuse" question is answered: **no reuse opportunity
  exists today** — this chore must apply the font change independently, per
  the story's own "Out of scope" section (which already anticipated this and
  says to proceed independently, only flagging in the PR if a shared
  component naturally exists). Nothing to call out in the PR beyond this
  confirmation.
- **CHORE-23 established the mono token**: `app/globals.css` maps
  `--font-mono: var(--font-jetbrains-mono), ui-monospace, ...` and the
  Tailwind utility class is simply **`font-mono`** (see `app/globals.css`
  lines 174, 190–193). The `app/globals.css` comment at line 192 explicitly
  says `font-mono (JetBrains Mono, for numeric/date data — CHORE-25/26 apply
  this per-element; not yet consumed by any component in this diff)`. CHORE-25
  already consumed it on the Dashboard; this comment is now stale for the
  Dashboard half. This story updates that comment line as a small doc-accuracy
  fix (see Step 0 below) — zero behavioral change, just correcting a stale
  claim per the CHORE-19/CHORE-25 "Story Context accuracy" convention.
- **CHORE-25's exact technique is directly reusable**: `t.rich(key, {
  ...values, num: (chunks) => <span className="font-mono ...">{chunks}</span>
  })` wrapping a `<num>...</num>` tag embedded in the JSON message *value*
  (no key renames), verified working for both `#`-inside-ICU-plural-branch and
  plain-`{var}`-inside-tag cases against this project's `intl-messageformat`
  version (CHORE-25 Decision 2). The only novelty this story adds: CHORE-25
  used `t.rich()` from `getTranslations()` in an **async Server Component**;
  this story uses `t.rich()` from `useTranslations()` in a **Client
  Component** (`'use client'`). next-intl v4's hook-based translator object
  exposes the same `.rich()`/`.markup()`/`.raw()` methods as the server
  helper (documented API surface, not version-gated) — flagged as a risk to
  verify early via `npm run build`+visual render, not assumed correct
  (Risks section below).
- **Exact current markup** (`components/AvailabilityToggleList.tsx`, read in
  full during refinement):
  - Summary counts (lines 179–197): two `<li className="text-xl
    font-bold">{t('summaryAvailableCount'/'summaryBlockedCount', {
    count })}</li>` inside a `<ul>`, plus a conditional `<p
    className="text-sm">{t('summaryNextUnavailable', { date
    })}</p>` / `{t('summaryNoUpcomingBlocks', { total })}</p>`. All three are
    plain `t()` calls today — number/label are one un-splittable string.
  - Sunday row list (lines 212–244): each row is a `<button>` containing
    `<span>{formattedDate}</span>` (plain JS-formatted date via
    `useFormatter().dateTime(...)`, **not** an i18n key — no ICU/`t.rich()`
    involved for this one) and a sibling `<span className={isBlocked ?
    'rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold
    text-destructive-foreground' : 'font-medium'}>{stateLabel}</span>` — this
    is the CHORE-19 WCAG-AA-verified badge, **not** to be touched.
  - `app/[locale]/(app)/availability/page.tsx` (the Server Component) has
    **no** date/count rendering of its own — it only computes `sundays` and
    `initialBlockedDates` and passes them as props. All AC1–AC3 markup lives
    entirely in `AvailabilityToggleList.tsx`. `page.tsx` itself needs **zero**
    edits for AC1–AC3 (only its own no-linked-person/load-error branches
    exist there, both out of scope — no stat numbers or dates in either).
  - Current pt-PT values (`messages/pt-PT.json` `Availability` namespace):
    `summaryAvailableCount`/`summaryBlockedCount` are bare ICU plural blocks
    (`"{count, plural, one {# domingo disponível} other {# domingos
    disponíveis}}"` etc.); `summaryNextUnavailable` is `"Próximo domingo
    indisponível: {date}"`; `summaryIntro` and `summaryNoUpcomingBlocks` both
    contain a `{total}` numeral but read as prose sentences (same shape as
    Dashboard's `Home.memberSummaryIntro`/`Home.memberSummaryNoUpcomingBlocks`,
    which CHORE-25 Decision 3 judged as "incidental number in prose," left
    unwrapped). `Availability.summaryNoUpcomingBlocks` is already in
    `e2e/i18n-neutral-copy.spec.ts`'s `GUARDED_KEYS` list (added by CHORE-19)
    — leaving it unwrapped (plain `t()`) minimizes edits to a guarded key,
    matching CHORE-25's stated preference. `en.json` mirrors the same 5 keys
    structurally 1:1.

### Affected areas
- **Frontend** (primary): `components/AvailabilityToggleList.tsx` — markup
  edits only (summary `<li>`/`<p>` blocks get `t.rich()` + `font-mono`
  numeral spans; row-date `<span>` gets a `font-mono` class). No state,
  props, handlers, or endpoint logic touched.
- **i18n**: `messages/pt-PT.json` and `messages/en.json` — **values only**
  edits on 3 existing keys (`summaryAvailableCount`, `summaryBlockedCount`,
  `summaryNextUnavailable`), wrapping the numeral/date placeholder in
  `<num>...</num>`. No key renames/additions/removals —
  `e2e/i18n-key-parity.spec.ts` and `e2e/i18n-neutral-copy.spec.ts`'s
  `GUARDED_KEYS` list need no changes.
- **Testing**: one new CI-safe static-source-guard spec file
  (`e2e/availability-mono-digit.spec.ts`), plus additive and three
  intentionally-updated raw-string-comparison sites across
  `e2e-integration/availability.spec.ts` and
  `e2e-integration/admin-availability.spec.ts` (both have a locally-duplicated
  `renderPlural()` helper — this repo's established non-shared-test-helper
  convention — that needs the same tag-stripping fix independently in each
  file).
- **`app/globals.css` (doc-only)**: one comment-line correction (see
  Pre-work findings above) — no new tokens/values, no selector/rule changes.
- No backend/API/DB/auth/infra changes. No new dependencies. `page.tsx`
  (Server Component) is unaffected — see Pre-work findings.

### Design decisions

**Decision 1 — reuse CHORE-25's `t.rich()`/`<num>` technique verbatim, no
key-split.** Already verified working for this exact class of ICU
plural+tag and plain-var+tag templates (CHORE-25 Decision 2); no new
verification needed for the templating mechanics themselves. The only new
surface is calling `.rich()` on a **hook-based** translator (`useTranslations`)
instead of the async server helper — verify via `npm run build` + dev-server
visual render early (Step 2 below), not assumed.

**Decision 2 — which keys get the `<num>` treatment**, mirroring CHORE-25
Decision 3's reasoning applied to the `Availability` namespace:
| Key | Wraps | Rationale |
|---|---|---|
| `Availability.summaryAvailableCount` | `#` | AC1 "available-count number" |
| `Availability.summaryBlockedCount` | `#` | AC1 "blocked-count number" |
| `Availability.summaryNextUnavailable` | `{date}` | AC3 "Next blocked Sunday" date value |
| `Availability.summaryIntro` | — (unwrapped) | prose sentence, `{total}` incidental — matches `Home.memberSummaryIntro` precedent |
| `Availability.summaryNoUpcomingBlocks` | — (unwrapped) | prose + already a `GUARDED_KEYS` entry — matches `Home.memberSummaryNoUpcomingBlocks` precedent |

Row-list Sunday dates (AC2) need **no i18n key change at all** — they are
plain JS-formatted strings (`formatSunday()` via `useFormatter().dateTime()`),
never routed through `t()`. Adding `font-mono` there is a pure className
edit.

**Decision 3 — numeral styling: leave `<li className="text-xl font-bold">`
unchanged; wrap only the numeral in `<span className="font-mono">`, with no
redeclaration of `text-xl`/`font-bold` on the span. Locked decision — revised
after Challenge cycle 1 rejected the original default.** Cycle 1 of this plan
defaulted to the opposite approach — stripping `text-xl font-bold` off the
`<li>` wrapper and moving it onto only the numeral `<span>`. Challenge
correctly flagged this as CRITICAL: it would drop the label ("domingos
disponíveis") from bold+text-xl down to plain ambient `text-sm`, a visible
typographic downgrade of the label that exceeds AC4's "purely font-family
change" scope.

**Correction (Challenge cycle 2):** an earlier draft of this note claimed
CHORE-25 "only added `font-mono`" to its numeral without any size/weight
redeclaration. That citation was wrong and has been corrected here after a
direct re-read of `app/[locale]/(app)/page.tsx` lines 180–216: CHORE-25's
numeral spans are actually `className="font-mono text-3xl font-bold"` —
CHORE-25 *does* redeclare `text-3xl font-bold` on the numeral, overriding the
parent `<p className="text-sm font-semibold">`, to create a deliberate
large-numeral/small-label size contrast. Replicating that here would itself
be scope creep against AC4 ("purely a font-family change"), so this story
does **not** follow CHORE-25's sizing precedent — only its `font-mono`/
`t.rich()` mechanism. One consequence: unlike the Dashboard, Availability's
label and numeral will render at the same size, differing only by
font-family — the Task's framing ("visually matches the Dashboard's
data-vs-prose distinction") is achieved only partially (font treatment, not
size contrast). This divergence is intentional and AC4-driven; call it out
explicitly in the PR description alongside the `font-medium` disclosure.

The now-locked approach: the `<li>` keeps its existing `text-xl font-bold`
untouched — the label continues to render bold+large exactly as it does
today, zero visual change to the label — and the numeral `<span>` inside it
needs only `font-mono`; `text-xl` and `font-bold` are inherited from the
`<li>` ancestor and must not be redeclared on the span (redeclaring them
would be harmless visually but is unnecessary duplication and slightly
obscures the inheritance). This is both the smaller diff and the AC-faithful
reading. No open question remains here — this is the only option.

**Decision 4 — new `data-testid`s on numeral/date spans**, matching CHORE-25's
per-span-testid convention (this component is shared between Member and
admin-on-behalf modes, so only **one** set of testids is needed — no
Admin/Member duplication like CHORE-25 had to do for its two separate
markup blocks):
- `availability-available-numeral` (summaryAvailableCount's `num` span)
- `availability-blocked-numeral` (summaryBlockedCount's `num` span)
- `availability-next-blocked-date` (summaryNextUnavailable's `num` span,
  named to match `Home.memberSummaryNextBlocked`'s already-shipped
  `member-next-blocked-date` testid style)

The per-row Sunday date span (AC2) needs **no** new testid — existing tests
already address it positionally (`buttons.nth(i).locator('span').first()` /
`el.querySelectorAll('span')[0]`, see Test plan below), consistent with how
`e2e-integration/availability.spec.ts`'s existing 375px gap-check test
already targets it.

### Concrete markup plan — `components/AvailabilityToggleList.tsx`

**Summary counts + next-unavailable date** (replace lines 179–197):
```tsx
<CardContent data-testid="availability-summary">
  <ul className="mb-4 flex flex-col gap-1 text-sm">
    <li className="text-xl font-bold">
      {t.rich('summaryAvailableCount', {
        count: availableCount,
        num: (chunks) => (
          <span data-testid="availability-available-numeral" className="font-mono">
            {chunks}
          </span>
        ),
      })}
    </li>
    <li className="text-xl font-bold">
      {t.rich('summaryBlockedCount', {
        count: blockedCount,
        num: (chunks) => (
          <span data-testid="availability-blocked-numeral" className="font-mono">
            {chunks}
          </span>
        ),
      })}
    </li>
  </ul>
  {formattedNextUnavailable !== null ? (
    <p className="text-sm">
      {t.rich('summaryNextUnavailable', {
        date: formattedNextUnavailable,
        num: (chunks) => (
          <span data-testid="availability-next-blocked-date" className="font-mono font-medium">
            {chunks}
          </span>
        ),
      })}
    </p>
  ) : (
    <p className="text-sm">
      {t('summaryNoUpcomingBlocks', { total: sundays.length })}
    </p>
  )}
</CardContent>
```
(`<li className="text-xl font-bold">` is byte-for-byte unchanged from today's
shipped markup — see Decision 3, locked. The numeral `<span>` adds only
`font-mono`; `text-xl`/`font-bold` are inherited from the `<li>`, not
redeclared on the span.)

**Judgment call — `summaryNextUnavailable`'s date span adds `font-medium`
(flagged per Challenge cycle 1 WARNING, not an oversight).** Today's shipped
markup for this line is `<p className="text-sm">{t('summaryNextUnavailable',
{ date: ... })}</p>` — plain, no font-weight override anywhere on the date
text. The concrete markup above adds `font-mono font-medium` to the date
`<span>`, which is a small departure from a strictly "font-family only"
change (AC3 says the date "uses the monospace font token," not that it also
gains weight). This is intentional, not accidental: it mirrors CHORE-25's
identical treatment of the Dashboard's structurally equivalent element
(`Home.memberSummaryNextBlocked`'s `num` span is also `className="font-mono
font-medium"` on a previously-unweighted `<p className="text-sm">`, verified
at `app/[locale]/(app)/page.tsx` lines 206–216) — so it is a defensible
parity choice that keeps this page's typographic treatment consistent with
the Dashboard's, matching the story's own Task text ("visually matches the
Dashboard's data-vs-prose distinction"). It is being called out explicitly
here rather than left implicit, and **must also be mentioned in the PR
description** as an intentional small departure from "font-family only,"
per Challenge cycle 1's WARNING — not bundled silently into the diff.

**Row date span** (inside the existing `sundays.map(...)` button, replace
`<span>{formattedDate}</span>` only):
```tsx
<span className="font-mono">{formattedDate}</span>
```
The sibling status-label `<span className={isBlocked ? '...bg-destructive...'
: 'font-medium'}>{stateLabel}</span>` is **byte-for-byte unchanged** — this
is the exact line Challenge/Review should diff against CHORE-19's shipped
version to confirm no incidental touch.

### i18n value edits
In both `messages/pt-PT.json` and `messages/en.json`, edit the 3 values from
Decision 2:
```
"summaryAvailableCount": "{count, plural, one {<num>#</num> domingo disponível} other {<num>#</num> domingos disponíveis}}"
"summaryBlockedCount": "{count, plural, one {<num>#</num> domingo bloqueado} other {<num>#</num> domingos bloqueados}}"
"summaryNextUnavailable": "Próximo domingo indisponível: <num>{date}</num>"
```
(and the English equivalents, same tag placement around `#`/`{date}`). No key
added/removed/renamed.

### Step-by-step approach (test-first where practical)
0. Update the stale `app/globals.css` comment (line ~192: "CHORE-25/26 apply
   this per-element; not yet consumed by any component in this diff") to
   reflect that CHORE-25 already consumes `font-mono` on the Dashboard and
   this story (CHORE-26) now consumes it on Availability — doc-accuracy only,
   zero behavioral change.
1. Write the new static-source-guard spec (`e2e/availability-mono-digit.spec.ts`,
   red) covering: AC1/AC3 `font-mono` presence on the three new testid'd
   spans + absence on their `<li>`/`<p>` wrappers; AC2 `font-mono` presence
   on the row-date span; AC2/AC4 a byte-for-byte regex assertion that the
   badge `<span>`'s className string (the `isBlocked ? '...' : 'font-medium'`
   ternary) is unchanged from its CHORE-19 shipped value and contains no
   `font-mono`. All should fail against the current file.
2. Edit `messages/pt-PT.json` and `messages/en.json` per the i18n value edits
   above.
3. Edit `components/AvailabilityToggleList.tsx` per the concrete markup plan
   above (summary block, then row-date span).
4. Run `npm run build` and visually render (dev server) both Member and
   admin-on-behalf modes, both themes, at 375px and 1280px, early — to
   surface the "first `t.rich()` in a Client Component" risk (see Risks)
   before investing in test updates.
5. Fix the three raw-string-comparison test sites (found by auditing every
   `.replace(` / `renderPlural(` call in both integration spec files against
   Decision 2's key table):
   - `e2e-integration/availability.spec.ts`'s local `renderPlural()` helper
     (used for `summaryAvailableCount`/`summaryBlockedCount`, both now
     `<num>`-wrapped): strip tags before substituting `#`:
     `branch.replace(/<\/?num>/g, '').replace('#', String(count))`.
   - `e2e-integration/admin-availability.spec.ts`'s **separately duplicated**
     local `renderPlural()` helper: identical fix, applied independently
     (this file does not import the other file's helper — matches this
     repo's established non-shared-test-helper convention, e.g.
     CHORE-17/23/24's contrast-helper duplication precedent).
   - `e2e-integration/availability.spec.ts`'s `expectedNextUnavailableText`
     (the "two blocked dates" test, ~line 494), built via
     `messages.Availability.summaryNextUnavailable.replace('{date}',
     formatPtDate(earlier))` — does **not** go through `renderPlural()`, so
     the helper fix above doesn't cover it. Fix:
     `messages.Availability.summaryNextUnavailable.replace(/<\/?num>/g, '').replace('{date}', formatPtDate(earlier))`.
   - Confirmed (during refinement, via `grep -rn "messages\.Availability\." e2e-integration/`)
     these are the **only three** sites touching a Decision-2-wrapped key;
     all other `Availability.*` references in `e2e-integration/*.spec.ts` /
     `e2e/i18n-neutral-copy.spec.ts` target unwrapped keys
     (`summaryIntro`, `summaryNoUpcomingBlocks`, `noLinkedPerson*`) and need
     no change. Re-run this grep after implementation in case a future edit
     added a new comparison site this audit missed.
6. Add new live-DOM assertions to both integration spec files (see Test plan
   below) for AC1–AC3.
7. Run `npm run lint && npx tsc --noEmit && npm run build`, then re-run the
   new static spec (should now pass) plus `e2e/availability-destructive-contrast.spec.ts`
   unmodified (AC4 — proves no incidental contrast change), then the full
   local integration suite.
8. Screenshot all 8 combinations (Member/admin-on-behalf × light/dark ×
   375px/1280px) as a manual-verification record in the PR description, per
   CLAUDE.md's "QA must visually render UI stories" memory. The PR
   description must also explicitly state, in plain language, that
   `summaryNextUnavailable`'s date span adds `font-medium` (not just
   `font-mono`) as an intentional parity choice mirroring CHORE-25's
   Dashboard treatment — per Challenge cycle 1's WARNING, this must not be
   left for Review to notice unaided in the diff.

### Test plan (1:1 with acceptance criteria)

- **AC1 (summary counts mono, labels display font)**:
  - Static: `e2e/availability-mono-digit.spec.ts` asserts `font-mono` on the
    `availability-available-numeral` and `availability-blocked-numeral` spans
    in `AvailabilityToggleList.tsx` source, and asserts the enclosing `<li>`
    elements do **not** carry `font-mono` (proves the split).
  - Live: extend `e2e-integration/availability.spec.ts`'s existing "zero
    blocks" test (`CHORE-19: AC1 availability summary Card`) with
    `toHaveCSS('font-family', /JetBrains Mono/)` on
    `memberPage.getByTestId('availability-available-numeral')` and
    `...-blocked-numeral`. Also extend
    `e2e-integration/admin-availability.spec.ts`'s equivalent
    admin-on-behalf test with the same two assertions (proves the shared
    component works identically in both modes).
- **AC2 (row date mono, badge untouched)**:
  - Static: `e2e/availability-mono-digit.spec.ts` asserts `font-mono` on the
    row-date `<span>` and asserts the badge `<span>`'s className regex is
    byte-identical to its CHORE-19-shipped value (no `font-mono` present).
  - Live: extend `e2e-integration/availability.spec.ts`'s "AC1: renders 12
    pt-PT-formatted upcoming Sundays" test with
    `toHaveCSS('font-family', /JetBrains Mono/)` on
    `buttons.first().locator('span').first()`. Extend the existing
    `CHORE-19: AC2/AC5 blocked-row badge at 375px` test with a **negative**
    assertion — the badge span (`spans[1]`) does **not** have
    `font-family: JetBrains Mono` — proving the split holds on an actual
    blocked row, not just the available-state default.
- **AC3 (Next blocked Sunday date mono, sentence stays display)**:
  - Static: `e2e/availability-mono-digit.spec.ts` asserts `font-mono` on the
    `availability-next-blocked-date` span and asserts the enclosing `<p>`
    does not carry it.
  - Live: extend `e2e-integration/availability.spec.ts`'s "two blocked
    dates" test with `toHaveCSS('font-family', /JetBrains Mono/)` on
    `memberPage.getByTestId('availability-next-blocked-date')`.
- **AC4 (no WCAG AA contrast regression)**:
  - Re-run `e2e/availability-destructive-contrast.spec.ts` **unmodified** —
    it reads only `--destructive`/`--destructive-foreground` HSL values from
    `app/globals.css`, neither of which this story touches; a pass here with
    zero file diff is the "spot-check" the AC asks for.
  - Additional static guard (folded into `e2e/availability-mono-digit.spec.ts`,
    see AC2 above): the badge span's className string is asserted
    byte-identical to CHORE-19's shipped value — this is the direct proof
    that "font-family change on existing elements" did not touch the badge
    at all (not just that colors are unaffected in the abstract).
  - Manual: both themes — confirm no visible color shift on the badge or
    summary text during Step 8's screenshot pass.
- **AC5 (lint/tsc/build/test:e2e all exit 0; existing tests pass unmodified
  except the three documented sites)**:
  - Covered by CI job execution + the intentional-update note in the PR
    description listing the three sites fixed in Step 5. All other
    pre-existing assertions in both integration spec files (badge
    presence/gap, 44px tap targets, 375px/1280px overflow, `aria-pressed`
    toggling, error-banner behavior, nav routing) are expected to require
    zero changes.

### Risks and rollback
- **First `t.rich()` call from a Client Component's `useTranslations()`
  hook** (this codebase's prior `t.rich()` use, CHORE-25, was from an async
  Server Component's `getTranslations()`). Documented as supported by
  next-intl v4's API surface but unverified in this specific context —
  verify early via `npm run build` + dev-server render (Step 4), not assumed.
- **Raw-string test comparison drift** — any test that reimplements an
  `Availability.*` key's substitution logic by hand instead of going through
  a fixed helper silently escapes the tag-stripping fix. Step 5 above fixes
  the three known sites (two duplicated `renderPlural()` helpers, one raw
  `expectedNextUnavailableText` `.replace()`); a missed site fails with a
  confusing text-mismatch diff (two similar strings differing by the
  `<num>`/`</num>` substring), not a clear "you forgot X" error. Flag for
  Review: re-run `grep -rn "messages\.Availability\." e2e-integration/` and
  cross-check every hit against Decision 2's key table once more before
  approving.
- **Font-glyph-width change on the existing 375px gap-check assertion** —
  `e2e-integration/availability.spec.ts`'s AC6 test asserts >= 8px gap
  between the date span and state-label span at 375px. JetBrains Mono's
  fixed-width glyphs render pt-PT date strings at a slightly different total
  width than Space Grotesk's proportional glyphs. Low risk (the assertion is
  a `>=` floor, not an exact match, and mono digits are typically similar or
  narrower than the display font's numerals) but explicitly re-run this test
  post-implementation rather than assuming it still passes.
- **`summaryNextUnavailable`'s added `font-medium`** is a small,
  intentionally-flagged departure from "font-family only" (see the judgment
  call note under the concrete markup plan) — mirrors CHORE-25's identical
  treatment of the Dashboard's equivalent element, so treated as low-risk
  parity, not scope creep. Must be named explicitly in the PR description
  per Challenge cycle 1's WARNING, so Review does not need to rediscover it
  from the diff.
- **Rollback**: purely additive/visual diff confined to one Client Component,
  two locale-file values (3 keys), one CSS comment line, and test files —
  revertible via a single `git revert` with no data/migration implications.

### Complexity classification: **standard**

Not `trivial` — despite being "a font-family change on existing elements"
per AC4's own framing, this touches multiple files (component markup, two
locale files' values, two independently-duplicated test helpers, one new
static-guard spec) and reuses a still-novel-to-parts-of-this-codebase i18n
technique (`t.rich()` nested inside ICU plural, now from a Client Component
context for the first time) whose correctness must be re-verified, not
assumed, per the Risks section. A missed raw-string test-comparison site
(three exist here) fails with a confusing diff rather than a clear signal,
which is exactly the kind of reasoning-risk CLAUDE.md's complexity guidance
flags. Not `complex` — no auth/data-integrity/concurrency/money/security
surface, confined to one already-well-tested Client Component with an
unambiguous scope boundary (badge markup explicitly untouched). Per
CLAUDE.md's "when in doubt, classify as standard" and consistency with
CHORE-25's identical classification for the structurally-equivalent
Dashboard rollout, `standard` is the final tag.
