# CHORE-25: Roll out mockup's Dashboard-specific treatments (hero stat, mono digits)
Epic: maintenance
Priority: standard — visual-only, but sequenced as part of the pre-EPIC-04
UI push the user explicitly requested
Status: done ✅
PR: #58
Depends on: CHORE-23 (tokens/fonts), CHORE-24 (shared pill-shape primitives)
Related: CHORE-18 (existing home page Card redesign, being extended here,
not replaced), user-provided mockup in `App design refinement/`

## Task
As the coordinator, I want the home/Dashboard page
(`app/[locale]/(app)/page.tsx`) to pick up the Dashboard-specific visual
treatments from the design mockup — the solid-accent "hero" stat card for
the admin's primary metric, and monospace styling for stat numbers and
dates — so the most-visited screen in the app matches the approved
direction. (The mockup's dashed-border "empty state" card is explicitly
descoped from this chore — see AC2 and "Out of scope" below.)

## Context
CHORE-18 already gave this page a Card-based structural redesign (stat
cards, a Member availability-summary card). This chore does **not** redo
that structure — it layers the mockup's specific finishing details on top,
now that CHORE-23 (tokens/fonts) and CHORE-24 (pill shapes) have landed:
- The Admin view's primary metric ("Active people") rendered as a
  solid-accent-background "hero" card with a flat offset shadow, visually
  distinct from the other (outlined) stat cards next to it.
- All stat numbers and the "Next blocked Sunday" date rendered in the new
  monospace font token (from CHORE-23), distinguishing data from prose.

**Correction made during refinement:** the Context previously (incorrectly)
claimed CHORE-18 had already added a Member-view "empty state card" and
that this chore would only restyle its border. That element does not exist
anywhere in the codebase — see AC2 and "Out of scope" for the full finding
and the resolution.

## Acceptance criteria
1. Given the Admin view of the Dashboard, when rendered, then the "Active
   people" stat card (or whichever is designated the primary metric) uses
   a solid accent background with the mockup's flat offset-shadow treatment,
   visually distinct from the "Active roles" / "Blocks · next 30 days"
   cards, in both light and dark theme.
2. **DESCOPED — not part of this chore.** The mockup's Member-view
   "empty state" card ("No schedule published yet", dashed border) does not
   exist anywhere in the current codebase — it previews a future
   EPIC-04/EPIC-05 schedule-publishing feature that has not shipped. There
   is nothing on this page to restyle. Confirmed by the coordinator during
   refinement (Option A): this AC is dropped from CHORE-25 entirely, with
   no replacement text, and the dashed-border treatment moves to
   "Out of scope" below for future reference. AC numbering (1, 3, 4, 5) is
   left as-is rather than renumbered, to avoid churn in this story's own
   Implementation Plan (which already cross-references AC1/AC3/AC4/AC5 by
   number) and to keep a stable paper trail of what was originally asked
   for and why it was cut.
3. Given any stat number (available/blocked Sunday counts, people/roles/
   blocks counts) or date value (next blocked Sunday) on this page, when
   rendered, then it uses the monospace font token introduced in CHORE-23,
   while surrounding prose/labels keep the display font.
4. Given light and dark theme, when all of the above render, then text over
   the new hero card's accent background meets WCAG AA contrast (≥4.5:1),
   measured via the project's established HSL contrast method — do not
   assume the accent/foreground pairing verified in CHORE-23 for small text
   automatically holds for this larger stat-number use, re-check directly.
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0, with existing home-page e2e assertions
   (`e2e/home.spec.ts` or equivalent, STORY-30/CHORE-18's tests) passing
   unmodified unless they specifically assert the old solid-border/
   non-mono styling, in which case update them intentionally and say so in
   the PR description.

## Out of scope
- **The mockup's dashed-border "empty state" card (originally AC2).**
  Descoped during refinement (coordinator decision: Option A). This card
  ("No schedule published yet" / "Coming soon" badge) does not exist in the
  codebase today — it previews a future EPIC-04/EPIC-05 schedule-publishing
  feature that hasn't been built yet. There is no existing element to
  restyle, and building a new placeholder card now would require 3 new i18n
  keys and copy decisions (e.g. what "{team}" means in this app) beyond a
  visual-only restyle. The dashed-border spec (`1.5px dashed`,
  theme-appropriate muted border color, `border-radius: 10px`-equivalent)
  from the mockup should be reused as-is when a future EPIC-04/EPIC-05 story
  first ships the real schedule-publishing empty state — no need to
  re-derive it from the mockup again at that point.
- Any change to the underlying data/business logic on this page (stat
  counts, empty-state conditions, admin vs. member branching) — purely
  visual.
- The Availability and Team pages — CHORE-26 and CHORE-21, respectively.
- The header/nav — CHORE-22.
- Introducing the hero-card treatment anywhere else in the app (e.g. other
  admin pages) — confined to this page for now; a follow-up chore can
  extend the pattern if it reads well here.

## Technical notes
- Primary file: `app/[locale]/(app)/page.tsx` (and whatever Card/stat
  subcomponents CHORE-18 introduced there).
- Reuse CHORE-23's verified accent/mono tokens directly; do not introduce
  new color values or a third font in this chore.
- Visually render (dev server) both personas (Member/Admin), both themes,
  at 375px and 1280px, before marking done — per CLAUDE.md's "QA must
  visually render UI stories" note.

## Definition of Done
See CLAUDE.md.

## Resolved — AC2 descoped (Option A), decided by the coordinator

**Original finding (Story Context accuracy check, per CLAUDE.md's CHORE-19
lesson):** The Context section originally stated "CHORE-18 already gave this
page a Card-based structural redesign (stat cards, **empty state card**)"
and AC2 asked to change an existing empty-state card's border from solid to
dashed. This was **factually incorrect** — verified by reading
`app/[locale]/(app)/page.tsx` in full and grepping
`messages/pt-PT.json`/`messages/en.json`'s `Home` namespace:

- CHORE-18's Member-view Card is `member-availability-summary`, showing the
  available/blocked Sunday counts (STORY-30). It has a normal solid border
  (Card's default `border` class) and is **not** an empty state — it always
  renders once a linked person is resolved.
- There is no "No schedule published yet" copy, badge, or card anywhere in
  the codebase. This text only exists in the mockup
  (`App design refinement/Escala Dashboard.dc.html` lines 50–54), previewing
  a **future** schedule-publishing feature that belongs to EPIC-04/EPIC-05
  (schedule generation — not yet started, per the user's own stated
  sequencing: "CHORE-23..26 design rollout done before EPIC-04 story
  drafting starts").
- The closest existing "no data yet" states on this page are
  `home-no-linked-person` (Member has no linked person — reuses
  Availability's claim-guidance copy, STORY-30 AC2) and the various
  load-error paragraphs. None of these say "No schedule published yet," and
  none currently have a border to change (they are plain `<div>`/`<p>`
  elements, not Cards).

There was nothing on the page for AC2 to "change the border style of," so
two resolution options were presented to the coordinator: (A) descope AC2
entirely, correcting the Context's false claim, and defer the dashed-border
empty-state treatment to whichever future EPIC-04/EPIC-05 story first ships
real schedule data; or (B) build a new static "Coming soon" placeholder card
now (new UI + 3 new i18n keys per locale, a scope expansion beyond
"restyle").

**Decision (coordinator, this session): Option A.** AC2 is descoped from
CHORE-25 (marked DESCOPED in place, see Acceptance criteria above) and the
dashed-border spec is preserved under "Out of scope" for reuse when the real
schedule-publishing empty state ships. The Context and Task sections above
have been corrected to remove the false "empty state card already exists"
claim. AC1, AC3, AC4, AC5 are unaffected by this decision and proceed
exactly as planned below.

## Revision cycle 1 (Challenge NEEDS REVISION — fixed)

Challenge confirmed AC2 descoping, the AC4 approach, and the scope firewall
were correct, and flagged four gaps in the plan below, now fixed in place:

- **CRITICAL** — Step 4 (test updates) only covered `renderPlural()`, missing
  a second, structurally identical raw-string comparison
  (`expectedNextBlockedText` in the "two blocked dates" test, built via a
  direct `.replace('{date}', ...)` against `Home.memberSummaryNextBlocked`
  — one of Decision 3's `<num>`-wrapped keys — without going through
  `renderPlural()`). Fixed: Step 4 now explicitly covers both sites, with
  the exact before/after `.replace()` diff for each, plus a documented
  audit confirming no other `.replace(`-based comparison in the file
  targets a Decision-3-wrapped key.
- **WARNING** — "Affected areas" omitted `app/globals.css`, which
  Decision 5's fallback path may conditionally touch. Fixed: added as a
  conditional entry.
- **WARNING** — AC1's live-DOM test locator used a fragile two-level
  `.locator('..').locator('..')` parent-traversal chain with "exact chain
  TBD" left open. Fixed: the Admin markup plan now places
  `data-testid="admin-active-people-hero"` directly on the hero `<li>`,
  and the AC1 test-plan bullet asserts classes on that single, stable
  locator.
- **WARNING** — the Member markup snippet had no `data-testid`s on the
  Member numeral `num` render-prop spans, while the AC3 test plan
  referenced "the equivalent Member numeral testids" without naming them.
  Fixed: the Member markup snippet now names all three
  (`member-available-numeral`, `member-blocked-numeral`,
  `member-next-blocked-date`), and the AC3 test-plan bullet lists all four
  numeral testids (the three Member ones plus the Admin hero's
  `admin-active-people-numeral`) explicitly.

---

## Implementation Plan

### Affected areas
- **Frontend** (primary): `app/[locale]/(app)/page.tsx` — markup
  restructuring of the Admin stat row and Member stat row, no data/query
  changes.
- **i18n**: `messages/pt-PT.json` and `messages/en.json` — **values only**
  edits (embedding a `<num>...</num>` rich-text tag around existing `{...}`
  placeholders inside already-shipped keys). No key renames, no key
  additions, no key removals (AC2 is descoped, so no new placeholder-card
  keys are needed either).
- **Testing**: one new CI-safe static/contrast spec file, plus additive and
  a small number of intentionally-updated assertions in
  `e2e-integration/home.spec.ts`.
- **`app/globals.css` (conditional)**: only touched if Decision 5's
  Tailwind arbitrary-value shadow syntax (`shadow-[0_4px_0_0_hsl(var(--brand)/55%)]`)
  fails to compile under Tailwind v4, in which case a small fallback CSS
  class (e.g. `.shadow-hero`) is added there instead. No new color values
  are introduced either way — flagging this file up front so Review isn't
  surprised by a `globals.css` diff if the fallback path is taken.
- No backend/API/DB/auth/infra changes. No new dependencies.

### Design decisions

**Decision 1 — token naming: "accent" in the AC text means `--brand`, not
Tailwind's own `--accent`.** This codebase already has an unrelated
`--accent`/`--accent-foreground` token pair (neutral gray, used for
`hover:bg-accent` states on ghost/outline buttons — see `button.tsx`). The
mockup's "accent" color (`oklch(0.74 0.17 55)`, warm amber/orange) is what
CHORE-23 shipped as `--brand`/`--brand-foreground` specifically to avoid
this collision (see `app/globals.css` CHORE-23 comment block). **The hero
card must use `bg-brand text-brand-foreground`, never `bg-accent`.** This is
the single most important naming trap for the implementer to avoid.

**Decision 2 — numeral/label font split via `t.rich()`, not new i18n keys.**
AC3 requires the stat *number* to be mono while the surrounding label stays
display-font, inside what are today single ICU-plural translated sentences
(e.g. `"{count, plural, one {# pessoa ativa} other {# pessoas ativas}}"`).
CHORE-18's story (Revision cycle 1) evaluated and *rejected* using
`t.rich()` to wrap just `#` inside an ICU plural branch, calling the
combination "untested" and disproportionate risk for CHORE-18's own AC
(which only needed bold emphasis, satisfiable by styling the whole line).
That untested-risk objection doesn't survive for this story: AC3's wording
genuinely requires numeral/label font separation, which whole-line styling
cannot satisfy, and the combination **has now been verified to work**
(tested directly against this project's installed `intl-messageformat`
package, the library `next-intl` v4 wraps):
```
$ node -e (verified interactively during refinement):
  IntlMessageFormat('{count, plural, one {<num>#</num> pessoa ativa} other {<num>#</num> pessoas ativas}}', 'pt-PT')
    .format({ count: 1, num: c => `[[${c}]]` })  → "[[1]] pessoa ativa"
    .format({ count: 5, num: c => `[[${c}]]` })  → "[[5]] pessoas ativas"
  IntlMessageFormat('Próximo domingo indisponível: <num>{date}</num>', 'pt-PT')
    .format({ date: '6 de setembro de 2026', num: c => `[[${c}]]` })
    → "Próximo domingo indisponível: [[6 de setembro de 2026]]"
```
Both the `#`-inside-plural-branch case and the plain-`{var}`-inside-tag case
render correctly for singular and plural forms. This means: **keep every
existing i18n key name exactly as-is**, only edit the JSON *values* to wrap
the numeral/date placeholder in `<num>...</num>`, and call `t.rich(key, {
...values, num: (chunks) => <span className="font-mono ...">{chunks}</span>
})` instead of `t(key, values)` at each of the 6 call sites listed below.
This is lower-risk than a key-split (no key renames to propagate through
`e2e/i18n-neutral-copy.spec.ts`'s `GUARDED_KEYS` list, which references
these exact key names) and keeps `toContainText`-based assertions passing
almost unmodified (see Decision 3).

**Decision 3 — which 6 messages get the `<num>` treatment**, applying AC3's
literal "any stat number... on this page" scope broadly (not just the 3
headline admin counts):
| Key | File | Wraps |
|---|---|---|
| `Home.adminActivePeopleCount` | pt-PT.json, en.json | `#` |
| `Home.adminActiveRolesCount` | pt-PT.json, en.json | `#` |
| `Home.adminBlocksNext30Days` | pt-PT.json, en.json | `#` |
| `Home.memberSummaryAvailableCount` | pt-PT.json, en.json | `#` |
| `Home.memberSummaryBlockedCount` | pt-PT.json, en.json | `#` |
| `Home.memberSummaryNextBlocked` | pt-PT.json, en.json | `{date}` |

`Home.memberSummaryIntro` ("Nos próximos {total} domingos:") and
`Home.memberSummaryNoUpcomingBlocks` ("...todos os próximos {total}
domingos.") also contain a `{total}` numeral. Judgment call: **leave these
two unwrapped** — they read as prose sentences where the number is
incidental, not a headline "stat," and `memberSummaryNoUpcomingBlocks` is in
`i18n-neutral-copy.spec.ts`'s `GUARDED_KEYS` list (touching it adds no risk
to that specific guard, since `<num>` isn't a forbidden substring, but
minimizing edits to a guarded key is still the safer default). Flag this
line item for Challenge to confirm the AC3 scope reading.

**Decision 4 — hero/outline stat boxes stay sentence-based, not split into
separate number+label DOM nodes like the mockup.** The mockup renders each
stat as two sibling `<div>`s (bare number, separate label). Reproducing that
exactly would require the key-split Decision 2 rejected. Instead, each stat
renders as **one** `<p>` containing the `t.rich()` output — the numeral
`<span>` is styled large/bold/mono, the label words around it stay at
ambient `text-sm` display-font size. This reads visually similar to the
mockup's split treatment (the numeral dominates) while being a purely
additive, structurally-safe change: `toContainText` assertions in
`e2e-integration/home.spec.ts` keep passing (see the i18n value edits and
Test plan below) because the flattened text content is unchanged, only
nested markup and sizing changed.

**Decision 5 — hero card's offset-shadow color.** The mockup's flat offset
shadow uses a distinct `accentHover` color not shipped as a token (Technical
notes forbid introducing new color values). Approximate it with the
existing `--brand` token at reduced opacity via Tailwind arbitrary value:
`shadow-[0_4px_0_0_hsl(var(--brand)/55%)]` — a derived opacity of an
existing token (same pattern as `bg-destructive/10` elsewhere in the app),
not a new raw color. Verify this arbitrary-value bracket syntax actually
compiles under Tailwind v4 during implementation (`npm run build`); if the
embedded `/` inside the bracket doesn't parse cleanly, fall back to a plain
CSS custom class in `globals.css` (e.g. `.shadow-hero`) using the same
`hsl(var(--brand) / 55%)` value — still zero new color values introduced.
This is a decorative, non-AC-mandated exact value; the opacity percentage
may be tuned during visual QA.

### Concrete markup plan — `app/[locale]/(app)/page.tsx`

**Admin view** (replace the two-`<li>` `<ul>` + separate blocks-next-30
`CardContent` with a single 3-box row inside one `CardContent`):
```
<CardContent>
  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {activePeopleCount !== null && (
      <li
        data-testid="admin-active-people-hero"
        className="rounded-lg bg-brand p-5 text-brand-foreground shadow-[0_4px_0_0_hsl(var(--brand)/55%)]"
      >
        <p className="text-sm font-semibold">
          {t.rich('adminActivePeopleCount', {
            count: activePeopleCount,
            num: (chunks) => (
              <span data-testid="admin-active-people-numeral" className="font-mono text-4xl font-bold sm:text-5xl">
                {chunks}
              </span>
            ),
          })}
        </p>
      </li>
    )}
    {activeRolesCount !== null && (
      <li className="rounded-lg border p-5">
        <p className="text-sm font-semibold">
          {t.rich('adminActiveRolesCount', {
            count: activeRolesCount,
            num: (chunks) => <span className="font-mono text-3xl font-bold">{chunks}</span>,
          })}
        </p>
      </li>
    )}
    <li data-testid="admin-blocks-next-30-days" className="rounded-lg border p-5 text-sm">
      {blocksNext30Days !== null &&
        t.rich('adminBlocksNext30Days', {
          count: blocksNext30Days,
          num: (chunks) => <span className="font-mono text-3xl font-bold">{chunks}</span>,
        })}
    </li>
  </ul>
</CardContent>
```
Note: `admin-blocks-next-30-days` testid stays on the same logical element
(now a styled `<li>` box instead of a bare `<div>`) — text content and
conditional-render behavior unchanged. `admin-active-people-hero` is a new
testid, placed directly on the hero `<li>` itself (not a descendant), so
AC1's live-DOM assertion can target `bg-brand`/`text-brand-foreground`
classes with a single `getByTestId('admin-active-people-hero')` locator —
no parent-traversal chain needed (see Test plan below).

**Member view** (replace the two-`<li>` bold-count `<ul>`; wrap the
next-blocked date). Every numeral/date `num` render-prop span gets its own
explicit `data-testid`, matching the Admin pattern, so AC3's live-DOM
assertions have concrete locators to target rather than being left for the
implementer to improvise:
```
<ul className="mb-4 flex flex-wrap gap-6">
  <li>
    <p className="text-sm font-semibold">
      {t.rich('memberSummaryAvailableCount', {
        count: availableCount,
        num: (chunks) => (
          <span data-testid="member-available-numeral" className="font-mono text-3xl font-bold">
            {chunks}
          </span>
        ),
      })}
    </p>
  </li>
  <li>
    <p className="text-sm font-semibold">
      {t.rich('memberSummaryBlockedCount', {
        count: blockedCount,
        num: (chunks) => (
          <span data-testid="member-blocked-numeral" className="font-mono text-3xl font-bold">
            {chunks}
          </span>
        ),
      })}
    </p>
  </li>
</ul>
{formattedNextBlocked !== null ? (
  <p className="text-sm">
    {t.rich('memberSummaryNextBlocked', {
      date: formattedNextBlocked,
      num: (chunks) => (
        <span data-testid="member-next-blocked-date" className="font-mono font-medium">
          {chunks}
        </span>
      ),
    })}
  </p>
) : (
  <p className="text-sm">{h('memberSummaryNoUpcomingBlocks', { total: SUNDAY_HORIZON })}</p>
)}
```
Testid summary for this story's new hooks: `admin-active-people-hero`
(hero `<li>`, AC1), `admin-active-people-numeral` (AC3),
`member-available-numeral` (AC3), `member-blocked-numeral` (AC3),
`member-next-blocked-date` (AC3). The outlined admin stat boxes (roles,
blocks-next-30) do not need dedicated numeral testids — AC1 doesn't require
asserting their classes (only that they are *not* `bg-brand`, which the
static source-guard already covers), and AC3's mono-font check only needs
one representative Admin numeral (`admin-active-people-numeral`) plus the
two Member numerals to prove the pattern per view.
(`memberSummaryNoUpcomingBlocks` stays a plain `t()` call per Decision 3.)

### i18n value edits
In both `messages/pt-PT.json` and `messages/en.json`, edit the 6 values
listed in Decision 3 to wrap the numeral/date placeholder in `<num>...</num>`,
e.g.:
```
"adminActivePeopleCount": "{count, plural, one {<num>#</num> pessoa ativa} other {<num>#</num> pessoas ativas}}"
"memberSummaryNextBlocked": "Próximo domingo indisponível: <num>{date}</num>"
```
No key added/removed/renamed — `e2e/i18n-key-parity.spec.ts` and
`e2e/i18n-neutral-copy.spec.ts`'s `GUARDED_KEYS` list need **no** changes.

### Step-by-step approach (test-first where practical)
AC2 is descoped (see Resolution above) — no empty-state markup is touched by
this story. All steps below cover AC1/AC3/AC4/AC5 only.
1. Write the new static/contrast spec (`e2e/dashboard-hero-stat.spec.ts`,
   red) covering AC4 (contrast) and static source-guards for AC1's
   `bg-brand`/`text-brand-foreground` classes and AC3's `font-mono` classes
   in `page.tsx` — these will fail against the current file.
2. Edit `messages/pt-PT.json` and `messages/en.json` per the i18n value
   edits above.
3. Edit `app/[locale]/(app)/page.tsx` per the concrete markup plan above
   (Admin block, then Member block).
4. Update **every** raw-string comparison in `e2e-integration/home.spec.ts`
   built against a `Home.*` key wrapped in `<num>...</num>` per Decision 3.
   `t.rich()` consumes the `<num>` tag notation when rendering the real DOM
   (the tag is replaced by the `num` render-prop's output, not left as
   literal text), but any test helper that treats the JSON template as a
   plain string and does its own substitution will still produce the
   literal `<num>`/`</num>` substring in its *expected* value —
   `toContainText` then fails because the actual rendered text never
   contains those characters. There are **two** such sites in this file,
   both must be fixed in this same story (found by auditing every
   `.replace(` call against the file for any key in Decision 3's table):
   - `renderPlural()` (the shared helper, used for the 5 `#`-wrapped plural
     keys): strip tags before substituting `#`:
     `branch.replace(/<\/?num>/g, '').replace('#', String(count))`.
   - The `two blocked dates` test's `expectedNextBlockedText` (lines
     ~259–263), which builds its expectation directly via
     `messages.Home.memberSummaryNextBlocked.replace('{date}', formatPtDate(earlier))`
     — this does **not** go through `renderPlural()` at all, so the helper
     fix above does not cover it. `memberSummaryNextBlocked` is one of the
     6 keys wrapped in `<num>{date}</num>` (Decision 3), so this raw
     `.replace()` needs the identical tag-stripping treatment:
     `messages.Home.memberSummaryNextBlocked.replace(/<\/?num>/g, '').replace('{date}', formatPtDate(earlier))`.
   - Confirmed (during refinement) there are no other `.replace(`-based
     comparisons in this file against a Decision-3-wrapped key: the
     remaining two `.replace('{total}', ...)` call sites (both against
     `Home.memberSummaryNoUpcomingBlocks`) are safe as-is, because
     `memberSummaryNoUpcomingBlocks` is explicitly left unwrapped (Decision
     3's judgment call) — grep `e2e-integration/home.spec.ts` for
     `\.replace(` and cross-check every hit against Decision 3's table
     again after implementation, in case this audit missed a future test
     addition.
   Document both fixes together as the AC5-sanctioned "intentional test
   update" in the PR description — every other existing assertion in that
   file should need no change.
5. Add new live-DOM assertions to `e2e-integration/home.spec.ts` (see Test
   plan below) for AC1 (hero box classes) and AC3 (mono classes/computed
   font-family on numeral spans).
6. Run `npm run lint && npx tsc --noEmit && npm run build`, then re-run the
   AC4 contrast/source-guard spec (should now pass), then the local
   integration suite.
7. Visually render (dev server) both personas, both themes, at 375px and
   1280px, per Technical notes / CLAUDE.md's "QA must visually render UI
   stories" memory. Screenshot each of the 8 combinations as a manual
   verification record in the PR description.

### Test plan (1:1 with acceptance criteria)

- **AC1 (hero card, solid accent bg + offset shadow, visually distinct)**:
  - Static: new spec asserts `page.tsx` source contains
    `bg-brand`/`text-brand-foreground` on the active-people `<li>` and that
    the two sibling stat `<li>`s use `border` (not `bg-brand`) — proves the
    hero/outline distinction exists in source, cannot regress silently.
  - Live: extend `e2e-integration/home.spec.ts`'s existing
    `AC3 Admin team summary` test with a direct, non-traversal locator on
    the new `admin-active-people-hero` testid (placed directly on the hero
    `<li>` per the markup plan above — no parent-locator chain needed):
    `await expect(adminPage.getByTestId('admin-active-people-hero')).toHaveClass(/bg-brand/)`
    and `.toHaveClass(/text-brand-foreground/)` on the same locator.
  - Manual: both themes, both viewports — confirm hero box reads as
    visually distinct from its two siblings (step 7 above).
- **AC2**: **descoped** (Option A, see "Resolved" section above and "Out of
  scope"). No test plan — no code changes are made for this AC.
- **AC3 (mono stat numbers/dates, labels stay display font)**:
  - Static: new spec asserts `font-mono` appears on each of the 6 `num`
    render-prop spans in `page.tsx` source (regex per call site).
  - Live: extend `e2e-integration/home.spec.ts` to assert
    `toHaveCSS('font-family', /JetBrains Mono/)` on the four named numeral
    testids from the markup plan — `admin-active-people-numeral`,
    `member-available-numeral`, `member-blocked-numeral`, and
    `member-next-blocked-date` — and assert the *label* text (e.g. the
    `<p>` wrapper) does **not** carry `font-mono` — proving the split, not
    just presence.
- **AC4 (WCAG AA contrast for hero card's larger stat-number text, ≥4.5:1,
  re-verified independently, not reused from CHORE-23)**:
  - New test in `e2e/dashboard-hero-stat.spec.ts`, duplicating (not
    importing, matching CHORE-17/CHORE-23/CHORE-24's established
    non-shared-helper precedent) the HSL→sRGB→luminance→ratio helpers, and
    independently computing `--brand-foreground` on `--brand` from
    `app/globals.css` in both `:root` and `.dark`, asserting ≥4.5:1. Note in
    the test's doc comment that WCAG's large-text allowance (3:1) is *not*
    relied upon — the story's AC4 sets the stricter 4.5:1 floor explicitly,
    and since `--brand`/`--brand-foreground` HSL values are re-read directly
    from source (not hardcoded from CHORE-23's test file) this is a
    genuine independent re-check, not a copy-paste of AC1b's math.
- **AC5 (lint/tsc/build/test:e2e all exit 0; existing assertions pass
  unmodified except the two documented tag-stripping test-update sites)**:
  - Covered by CI job execution + the intentional-update note in the PR
    description for `e2e-integration/home.spec.ts`'s `renderPlural()`
    helper **and** the `expectedNextBlockedText` raw-template comparison
    in the "two blocked dates" test (both fixed in step 4 above). All
    other pre-existing assertions in that file (heading roles,
    `data-slot="card"`, link hrefs, 375px/1280px overflow/tap-target
    checks) are expected to require zero changes.

### Risks and rollback
- **Tailwind arbitrary-value shadow syntax risk** (Decision 5) — low
  severity, purely decorative; fallback is a named CSS class, not a blocker.
- **`t.rich()` in an async Server Component** — next-intl v4 supports this
  per its documented API surface (CLAUDE.md: "the v4 API surface... is
  identical for our usage"), but this is the *first* use of `.rich()` in
  this codebase (previously only plain `t()`/ICU plural, per CLAUDE.md's
  STORY-19 note scoping the plural precedent to plain `t()`). Verify via
  `npm run build` early (step 6) rather than assuming.
- **Raw-template test comparisons drift (Challenge cycle 1 finding)** — any
  test that reimplements a `Home.*` key's substitution logic by hand,
  instead of going through `renderPlural()`, silently escapes that
  helper's tag-stripping fix. Step 4 above fixes the two known sites
  (`renderPlural()` itself and `expectedNextBlockedText`'s raw
  `.replace()`); a missed site fails with a confusing text-mismatch error,
  not a clear "you forgot X" message, since Playwright's `toContainText`
  diff just shows two similar-looking strings that differ by four
  characters (`<num>`/`</num>`). Flag for Review: grep
  `e2e-integration/home.spec.ts` for `\.replace(` and cross-check every
  hit against Decision 3's key table one more time before approving.
- **Rollback**: purely additive/visual diff confined to one page component,
  two locale-file values, and test files — revertible via a single `git
  revert` with no data/migration implications.

### Complexity classification: **standard**

Not `trivial` — this touches multiple modules (page markup, two locale
files' content, two test suites including a test-helper behavior change)
and requires a novel-to-this-codebase i18n technique (`t.rich()` nested
inside ICU plural) whose correctness was only established through direct
verification during refinement, not existing precedent. Not `complex` —
no auth/data-integrity/concurrency/money/security surface, confined to one
already-well-tested page. AC2's scope question is resolved (descoped, see
"Resolved" section above), so there is no remaining ambiguity blocking
implementation. Per CLAUDE.md's "when in doubt, classify as standard," and
the multi-file/multi-module signal, `standard` is the final tag for this
story as scoped (AC1, AC3, AC4, AC5 only).
