# CHORE-32: Retune base surface tokens (background/card/border) to match the mockup's dark-theme palette
Epic: maintenance
Priority: standard — affects every page's dark mode, found via user-reported
visual comparison, not aesthetic taste
Status: refined — ready for Challenge
Depends on: none (should land before/alongside CHORE-21/29/30/31 so those
land against the correct final palette instead of the stale one)
Related: CHORE-23 (design language foundation — deliberately left these
tokens untouched, see its Design Decision 1), CHORE-28 (header recolor,
which DID retune `--header`/`--header-border` the same way this chore needs
to do for `--background`/`--card`/`--border`), updated mockup in
`App design refinement/Escala Dashboard.dc.html` (`theme()` function)

## Task
As any user in dark mode, I want the page background and card/row surfaces
to have visible tonal separation (matching the design mockup), instead of
today's flat, undifferentiated near-black on every page, so dark mode
actually looks like the intended design rather than a generic default theme.

## Context
Triage finding (2026-07-19): user compared a live screenshot of the Users
page in dark mode against the design mockup's dashboard screen and asked
"is this expected?" It is expected given the code as it stands today, but it
does not match the design direction the rest of this UI push has been
chasing.

Root cause: `app/globals.css`'s `.dark` block still has the original
create-next-app/shadcn scaffold defaults from CHORE-01:
```
--background: 240 10% 3.9%;
--card: 240 10% 3.9%;
```
`--background` and `--card` are **identical** — there is no tonal separation
between the page and any card/row surface in dark mode, so everything reads
as one flat black block.

The mockup's `theme()` function (lines ~508-534) specifies distinctly
different, lighter values for dark mode:
```
page: oklch(0.26 0.025 250)      // page background
card: oklch(0.32 0.028 250)      // card/row surface — visibly lighter than page
cardBorder: oklch(0.42 0.03 250) // border — lighter still, for definition
```
(Light theme's mockup values — `page: oklch(0.97 0.008 85)`,
`card: oklch(1 0 0)` — are close enough to the current `--background: 0 0%
100%` / `--card: 0 0% 100%` that light mode is not the concern here; this
chore is scoped to the dark block, but re-verify light doesn't regress.)

CHORE-23 explicitly and deliberately chose **not** to touch `--background`/
`--card`/`--border` when it added `--brand` and `--header` — its own plan
doc's Design Decision 1 says "do not modify the values of `--primary`,
`--accent`, `--secondary`, `--ring`, or any other existing token," to avoid
an app-wide regression while shipping only additive tokens. That was the
right call for an additive-tokens chore, but no later chore ever came back
to finish the job for the base surface tokens — CHORE-25/26/27/28 all
worked within the existing (stale) `--background`/`--card`, and the open
CHORE-21/29/30/31 all say "reuse existing verified tokens, no new colors,"
which just perpetuates today's flat look into the new layouts too. This
chore is that follow-up.

## Acceptance criteria
1. Given `app/globals.css`'s `.dark` block, when retuned, then `--background`
   and `--card` (and `--border`/`--input`, which currently share the
   near-black scale) are converted from the mockup's `oklch(0.26 0.025 250)`
   (page), `oklch(0.32 0.028 250)` (card), `oklch(0.42 0.03 250)`
   (cardBorder) via the established OKLab→linear-sRGB→sRGB→HSL matrix method
   (CHORE-23/CHORE-28 precedent) and land as new HSL values, with `--card`
   visibly lighter than `--background`, and `--border` lighter still.
2. Given every existing verified text/background pairing that depends on
   `--background`/`--card`/`--border` (e.g. `--foreground` on `--card`,
   `--muted-foreground` on `--card`, `--popover` usages, `--destructive`/
   `--warning` translucent-tint banners composited over `--card`), when the
   base tokens change, then each pairing is re-measured with the project's
   HSL→luminance→ratio helper and still clears WCAG AA (4.5:1 normal text) —
   any pairing that regresses gets its own token adjusted (e.g.
   `--muted-foreground`) with the new ratio documented inline, following the
   CHORE-17/19 comment convention.
3. Given the `:root` (light) block, when reviewed, then confirm the current
   `--background: 0 0% 100%` / `--card: 0 0% 100%` still reasonably match the
   mockup's light `page`/`card` values (`oklch(0.97 0.008 85)` / `oklch(1 0
   0)`) — adjust only if a real mismatch is found; do not change light mode
   without a documented reason.
4. Given every already-shipped page (Dashboard, Availability, Login, header/
   nav, Team, Roles, Users, Settings, Manage hub, admin sub-pages, Claim),
   when viewed in dark mode after this change, then card/row surfaces are
   visibly distinct from the page background — verify by rendering the dev
   server in dark mode and visually comparing at least the Users, Dashboard,
   and Availability pages against the mockup's dark screen.
5. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0. Extend or add a static/computed-contrast test
   (following `e2e/card-ui-primitive.spec.ts` / `e2e/header-surface-tokens.spec.ts`
   pattern) asserting the new `--background`/`--card`/`--border` HSL values
   and their re-verified contrast ratios, so a future edit can't silently
   flatten the tokens back together.

## Out of scope
- `--primary`, `--secondary`, `--accent`, `--destructive`, `--ring`,
  `--muted`/`--muted-foreground` base *hue* — only touch these if AC2's
  re-verification shows an actual contrast regression; otherwise leave as-is
  (CHORE-23 precedent: don't touch heavily-consumed tokens without cause).
- `--brand`/`--brand-foreground` and `--header`/`--header-*` — already
  correctly migrated (CHORE-23/CHORE-28); not touched here.
- Any layout/component redesign (card-list rows, avatars, badges) — that's
  CHORE-21/29/30/31, independent of this token-level fix. This chore should
  ideally land first so those four build against the corrected palette, but
  is not a hard blocker either way since none of them are implemented yet.
- Light theme changes beyond the AC3 spot-check.

## Technical notes
- Primary file: `app/globals.css` (`.dark` block, `@theme inline` mapping is
  unaffected since it just references the custom properties).
- Follow the CHORE-23/CHORE-28 documentation convention: inline CSS comments
  citing the mockup source `oklch(...)` value, the conversion method, and
  the measured contrast ratio for every pairing touched.
- This is a "touches inherited/global CSS properties" change per CLAUDE.md's
  complexity-upgrade rule — classify as `standard` regardless of diff size,
  and do a full-tree visual audit before marking done, not just the Users
  page that prompted this triage finding.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **Frontend / UX** (only area touched): `app/globals.css` (`.dark` block —
  `--background`, `--card`, `--border`, `--input`). No `:root` (light)
  values change (see AC3 finding below).
- **Test infra**: one new CI-safe static/contrast spec (`e2e/`), no other
  files touched. Several already-shipped dynamic-read specs
  (`e2e/design-language-foundation.spec.ts`, `e2e/card-ui-primitive.spec.ts`)
  re-verify automatically with zero code changes because they extract HSL
  values from `globals.css` at test-run time rather than hardcoding numbers
  (confirmed by reading both files during refine).
- No backend/data/auth/migration files touched — this is a single-file CSS
  token diff. It does **not** reach `complex` (no auth, data integrity,
  concurrency, or money), but per CLAUDE.md's inherited/global-CSS rule it
  is `standard` at minimum regardless of diff size (confirmed in
  Complexity classification below) — `--background`/`--card`/`--border` are
  consumed by literally every page in the app (`body` uses `--background`
  directly per `globals.css`'s base layer; `--card` and `--border` are
  consumed by dozens of components), so the blast radius is total even
  though the diff itself is ~6 lines.

### Mockup source values (confirmed against the live file)

Read `App design refinement/Escala Dashboard.dc.html` lines 508–534
(`theme()` method) directly during refine — the story's cited OKLCH values
are an exact, verbatim match to the live mockup file, no discrepancy found:

```
dark:  page: oklch(0.26 0.025 250), card: oklch(0.32 0.028 250),
       cardBorder: oklch(0.42 0.03 250)
light: page: oklch(0.97 0.008 85), card: oklch(1 0 0),
       cardBorder: oklch(0.89 0.01 250)
```

### Conversion (OKLab→linear-sRGB→sRGB→HSL, CHORE-23/28 precedent)

Conversion was run with a standalone Node script implementing the
standard CSS Color 4 OKLab→linear-sRGB matrices (Björn Ottosson's
published constants) followed by sRGB gamma encoding and RGB→HSL. **The
script was cross-validated by re-deriving CHORE-28's four already-shipped
`--header*` HSL values from their cited OKLCH sources** — the script's
output matched the shipped values to within 0.5 percentage points on every
channel (e.g. `oklch(0.20 0.03 250)` → `210.3 52.2% 9.1%` computed vs.
`210 52% 9%` shipped), confirming the same conversion method CHORE-23/28
used is being reproduced here, not a different/incompatible one.

Computed values (precise, before rounding):
```
dark.page (→ --background):    oklch(0.26 0.025 250) → hsl(210.7 28.2% 14.6%)
dark.card (→ --card):          oklch(0.32 0.028 250) → hsl(210.8 23.6% 20.6%)
dark.cardBorder (→ --border):  oklch(0.42 0.03 250)  → hsl(210.8 17.9% 31.0%)
```

Rounded to whole-number precision, matching the `--header*` tokens'
existing formatting convention in the same file:

```css
/* .dark */
--background: 211 28% 15%;  /* oklch(0.26 0.025 250) */
--card: 211 24% 21%;        /* oklch(0.32 0.028 250) */
--border: 211 18% 31%;      /* oklch(0.42 0.03 250) */
--input: 211 18% 31%;       /* tracks --border — confirmed both :root and
                                .dark currently duplicate --border's exact
                                literal value for --input (not a var()
                                reference); preserve that pattern. */
```

This satisfies AC1's ordering requirement directly: background L=15% <
card L=21% < border L=31%, strictly increasing.

### AC2 — dependent-pairing re-verification (computed, not eyeballed)

Every pairing below was computed with the repo's existing
HSL→luminance→ratio helper (same formulas as
`e2e/card-ui-primitive.spec.ts` / `e2e/header-surface-tokens.spec.ts`),
using the **rounded** new dark values above. Full pairing inventory found
by grepping the codebase for every consumer of `bg-background`, `bg-card`,
`bg-popover`, `bg-destructive/10`, `bg-warning/10` during refine:

| Pairing | Old ratio (dark) | New ratio (dark) | AA floor | Result |
|---|---|---|---|---|
| `--foreground` on `--background` | 19.05:1 | **14.69:1** | 4.5 | pass, large margin |
| `--card-foreground` on `--card` | 19.05:1 | **11.94:1** | 4.5 | pass, large margin |
| `--muted-foreground` on `--background` (new pairing, not previously tested) | n/a | **5.99:1** | 4.5 | pass |
| `--muted-foreground` on `--card` (`CardDescription` consumer) | ~19:1-ish (old card ≈ old background) | **4.87:1** | 4.5 | pass, thin margin — document explicitly per CHORE-17 "surfacing marginal-but-pre-existing contrast" precedent |
| `--popover-foreground` on `--popover` | 19.05:1 | **19.05:1 (unchanged — `--popover` is not one of AC1's target tokens, its literal value is untouched)** | 4.5 | pass, unaffected |
| `--ring` on `--background` (non-text 3:1 floor, informational — `--ring` is out of scope) | n/a | **10.38:1** | 3.0 | pass, comfortably |
| `--ring` on `--card` (non-text 3:1 floor, informational) | n/a | **8.43:1** | 3.0 | pass, comfortably |
| `--destructive-foreground` on `--destructive` (solid-fill banners, e.g. `AvailabilityToggleList.tsx`, `login/page.tsx`) | 9.59:1 | **9.59:1 (unaffected — solid fill, self-contained, doesn't depend on background/card)** | 4.5 | pass, unaffected |
| `text-destructive` on `bg-destructive/10` composited over new `--background` (banners in `PersonSkillsEditor.tsx`, `PeopleTable.tsx`, `UserTable.tsx`, `RoleTable.tsx`, `app/[locale]/(app)/page.tsx`, `ClaimPersonForm.tsx` — all render directly on page background, **not** inside a `Card`, confirmed by reading each file's surrounding JSX) | **1.93:1 (already failing AA before this chore)** | **1.51:1 (still failing, slightly worse)** | 4.5 | **pre-existing failure, not a new regression — see Design decision 3** |
| `text-warning` on `bg-warning/10` composited over new `--background` (`PeopleTable.tsx`, `RoleTable.tsx`) | 9.35:1 | **6.82:1** | 4.5 | pass, margin decreased but still comfortable |

**Conclusion: no dependent token needs adjustment.** `--muted-foreground`
(the token CLAUDE.md/AC2 flag as the likely candidate) still clears AA in
both new pairings — 5.99:1 and 4.87:1 — so it is left untouched, consistent
with the story's own Out of scope list ("only touch `--muted-foreground`
base hue if AC2's re-verification shows an actual contrast regression").

### Design decision 1 — `--input` gets the same new value as `--border`

Confirmed by reading `globals.css`: `--input` is not a `var()` reference to
`--border`, it's an independently-declared literal that happens to always
duplicate `--border`'s exact value in both `:root` and `.dark` today.
Preserve that existing pattern rather than introducing a `var()` reference
(a larger, unrelated refactor) — set `--input: 211 18% 31%;` as a literal,
matching `--border`.

### Design decision 2 — `--popover` is explicitly not retuned; flag the
### visual side-effect for the AC4 audit

AC1 names exactly four tokens (`--background`/`--card`/`--border`/
`--input`); `--popover` is not one of them and the story's Out of scope
list does not list it either — retuning it would be undeclared scope
creep. However: `--popover` in `.dark` is currently `240 10% 3.9%`, a
**literal duplicate of the OLD `--background` value**, not a `var()`
reference. After this chore, `--popover` stays at `240 10% 3.9%` while the
new `--background` becomes `211 28% 15%` (lighter) — so the shadcn
`Select` dropdown (`components/ui/select.tsx`'s `bg-popover
text-popover-foreground`) will render **darker than the page it floats
over**, an elevation-order inversion that didn't exist before (previously
popover and background were visually identical). `--popover-foreground`
on `--popover`'s contrast ratio is unaffected and still passes (19.05:1,
unchanged), so this is not an AC2 contrast failure — it's a visual
consistency question for human judgment. **Decision: do not touch
`--popover` in this chore** (AC1 doesn't ask for it, and retuning it
would require re-verifying yet another pairing's contrast + expanding the
diff beyond the four named tokens). **Flag explicitly for the AC4 manual
visual audit**: when reviewing the Roles/Users/People pages (which use
`Select`), open a dropdown in dark mode and confirm it doesn't look
visually broken. If it does look wrong, that becomes a follow-up chore
(retune `--popover` to track `--card`), not scope creep into this one.

### Design decision 3 — pre-existing `text-destructive` on
### `bg-destructive/10` failure is not this chore's to fix

Per the AC2 table above, the translucent-tint destructive banner pairing
was **already failing WCAG AA before this chore** (1.93:1, well below
4.5:1) — this matches CLAUDE.md's own documented CHORE-19 finding that
`text-destructive` on `bg-destructive/10` "can fail (example: 4.14:1 light
/ 1.93:1 dark)" and was only remediated for specific badges via a
solid-fill swap, not universally. After this chore the same pairing drops
further to 1.51:1 (because the background it's composited over got
lighter, reducing the tint's effective darkness). AC2's wording scopes the
re-verification requirement to "every existing **verified** [i.e.
previously-passing] pairing" — this pairing was never verified/passing, so
it is not in AC2's mandatory "must stay ≥4.5:1 or get adjusted" set, and
fixing it would require touching `--destructive`, which the story's Out of
scope list forbids unless AC2 shows a **regression** (pass→fail), not an
already-failing pairing getting marginally worse. **Decision: document via
an inline `globals.css` comment (not a new test, not a token change) and
leave as a known, pre-existing, unrelated gap** — a candidate for a future
dedicated bugfix chore (solid-fill remediation, same pattern CHORE-19 used
for the blocked-row badge), not this one. Flagging for Challenge to
confirm this reading of AC2's scope is correct.

### AC3 — light theme: confirmed no change needed

Computed the mockup's light `page` value: `oklch(0.97 0.008 85)` → `hsl(40.3
35.8% 95.4%)`. Compared against the current `:root --background: 0 0%
100%` (pure white): contrast ratio between the two is **1.09:1** —
essentially imperceptible. Critically, this is not a coincidence: the
mockup's own light `card` value (`oklch(1 0 0)` = pure white) is an exact
match for the current `:root --card: 0 0% 100%`, and the mockup's own
intended page-vs-card separation in light mode (`page` vs `card`) is
**also 1.09:1 apart** — i.e. the current app's "flat" light
`--background`/`--card` (both pure white, 1.00:1 apart) is visually
indistinguishable from what the mockup itself ships in light mode. This is
categorically different from the dark-mode bug (page 0.26 vs card 0.32 —
a large, clearly intentional 6-lightness-point separation at higher
chroma) — light mode's mockup separation is deliberately subtle-to-the-
point-of-invisible, unlike dark's. **Decision: no change to `:root`.**
Changing it for a ~1.09:1, sub-perceptual delta would require re-verifying
every light-theme contrast pairing app-wide (AC2-equivalent work) for zero
visible benefit — disproportionate, and AC3 explicitly says "do not change
light mode without a documented reason." Add a regression-guard test (see
Test plan) asserting `:root`'s `--background`/`--card` remain exactly
unchanged, so a future accidental edit to the wrong block is caught.

### Step-by-step approach (test-first where practical)

1. Write `e2e/surface-tokens-retune.spec.ts` first (red — new
   ordering/contrast assertions fail against the current stale, identical
   `--background`/`--card` values).
2. Update `app/globals.css`'s `.dark` block: `--background`, `--card`,
   `--border`, `--input` to the new HSL values above, with inline comments
   citing the mockup `oklch(...)` source, the conversion method, and the
   verified ratios — matching the CHORE-23/28 comment convention exactly.
3. Add the Design decision 2 (popover elevation-order) and Design decision
   3 (pre-existing destructive/10 gap) findings as inline `globals.css`
   comments near the relevant tokens, so a future reader has the same
   context without re-deriving it.
4. Get the new spec green.
5. Re-run `e2e/design-language-foundation.spec.ts`,
   `e2e/card-ui-primitive.spec.ts`, `e2e/header-surface-tokens.spec.ts`
   unmodified — confirm all still pass (these dynamically re-read
   `globals.css`, so this proves AC2's core pairings automatically without
   any code change to those files).
6. `npm run lint && npx tsc --noEmit && npm run build`.
7. `npm run test:e2e` (full smoke suite).
8. Manual visual audit (dev server, dark mode) — see AC4 checklist below.
9. Update story status.

### AC4 — full-tree visual audit checklist (concrete routes, confirmed
### against the actual `app/[locale]` route tree during refine)

Toggle dark mode via the existing theme toggle and visually confirm
card/row surfaces are visibly distinct from the page background on each:

- `/` — Dashboard (member and admin views — `app/[locale]/(app)/page.tsx`)
- `/availability` — Availability (`app/[locale]/(app)/availability/page.tsx`)
- `/login` — Login (`app/[locale]/login/page.tsx`, unauthenticated)
- Header/nav — persistent chrome on every `(app)` route (already-retuned
  `--header*` tokens, confirm no unexpected interaction with the new
  `--background`/`--card`)
- `/admin/people` — Team (`app/[locale]/(app)/admin/people/page.tsx`)
- `/admin/roles` — Roles (`app/[locale]/(app)/admin/roles/page.tsx`)
- `/admin/users` — Users (`app/[locale]/(app)/admin/users/page.tsx` — the
  page that prompted the original triage finding)
- `/settings` — Settings (`app/[locale]/(app)/settings/page.tsx`)
- `/admin/manage` — Manage hub (`app/[locale]/(app)/admin/manage/page.tsx`)
- `/admin/people/[id]/availability` and `/admin/people/[id]/skills` —
  admin sub-pages (admin-on-behalf views)
- `/claim` — Claim (`app/[locale]/claim/page.tsx`, unauthenticated)

Priority spot-checks per AC4's explicit wording: Users, Dashboard,
Availability against the mockup's dark screen. Additionally check any
open `Select` dropdown (Roles/Users/People pages) per Design decision 2.

### Test plan mapped to acceptance criteria

- **AC1** (background/card/border/input converted, card lighter than
  background, border lighter still): automated —
  `e2e/surface-tokens-retune.spec.ts`: (a) static HSL-format check for all
  four tokens in `.dark` + no stray `oklch(...)` left behind; (b) ordering
  check — dynamically extract `--background`/`--card`/`--border`
  lightness values and assert `card L > background L` and
  `border L > card L` (strict inequalities) — this is the concrete
  "future edit can't silently flatten the tokens back together" gate AC5
  asks for.
- **AC2** (dependent pairings re-verified, still clear AA): automated — no
  code change needed for `--foreground`/`--background`,
  `--card-foreground`/`--card`, `--popover`/`--popover-foreground`
  (all three already dynamically re-verified by
  `e2e/design-language-foundation.spec.ts`'s `EXISTING_SEMANTIC_PAIRS`
  loop, which reads `globals.css` at test time) and
  `--muted-foreground`/`--card` (already dynamically re-verified by
  `e2e/card-ui-primitive.spec.ts`). New test in
  `e2e/surface-tokens-retune.spec.ts` for the previously-untested
  `--muted-foreground` on `--background` pairing. The pre-existing
  destructive/10 gap (Design decision 3) is documented via code comment,
  not a new gating test, since it was never a "verified" pairing per AC2's
  own wording.
- **AC3** (light theme unchanged, confirmed reasonable match): automated —
  new test in `e2e/surface-tokens-retune.spec.ts` asserting `:root`'s
  `--background: 0 0% 100%` and `--card: 0 0% 100%` remain byte-for-byte
  unchanged (regression guard against an accidental edit to the wrong
  block); the 1.09:1-delta reasoning is documented in this story (Design
  decision above), not re-derived at test time (OKLCH conversion isn't
  worth replicating in the test suite for a "no-op" AC).
- **AC4** (full-tree visual audit): manual — dev server walk of the
  concrete route checklist above, both themes, recorded in this story's
  Manual Verification section once run.
- **AC5** (quality gates + regression test): automated —
  `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e`,
  all exit 0; `e2e/surface-tokens-retune.spec.ts` is the new/extended test
  this AC asks for.

### Risks and rollback

- **Risk**: rounding precision could erode the intended tonal separation
  if done carelessly — mitigated by the strict-inequality ordering test
  (AC1b) rather than relying on eyeballing the rounded numbers.
- **Risk**: `--popover` elevation-order inversion (Design decision 2) —
  accepted, documented, non-blocking; flagged explicitly for the AC4
  manual audit and as a candidate follow-up chore if it looks visually
  broken.
- **Risk**: pre-existing `text-destructive`/`bg-destructive/10` contrast
  failure gets marginally worse (Design decision 3) — accepted, already
  broken before this chore, documented via code comment, explicitly out of
  this chore's scope to fix (would require touching `--destructive`).
- **Risk**: total blast radius — `--background`/`--card`/`--border` are
  consumed by every page in the app (via `body`'s base-layer rule and
  dozens of component class strings), so a mistake in the four new values
  would be visible everywhere at once. Mitigated by the full quality-gate
  run plus the explicit AC4 route-by-route manual walk (not just the Users
  page that prompted the triage finding).
- **Rollback**: pure CSS custom-property value change in one file, no
  schema/migration/data involved. Revert is a straightforward `git revert`
  of the single PR with no follow-up cleanup required.

### Complexity classification

**Standard** (not `trivial`, despite the diff being ~6 lines of CSS
values + one new test file). Justification: per CLAUDE.md's explicit rule,
changes to inherited/global CSS properties (`--background`/`--card` are
consumed app-wide via `body`'s base-layer rule and are two of the most
heavily-referenced tokens in the codebase) are a `standard` floor
regardless of diff size, precisely because the blast radius (every page,
both roles, every dark-mode screen) is not apparent from the edit site
alone and requires the full-tree audit this plan specifies (AC4). It does
not reach `complex`: no auth, data integrity, concurrency, money, or
three-or-more-interacting-backend-systems are involved — this is a single
CSS token subsystem.

### Open items flagged for Challenge (non-blocking, transparency per
### CLAUDE.md's CHORE-20 scope-enforcement lesson)

1. Design decision 2 (`--popover` left untouched, visual elevation-order
   side-effect flagged for manual audit only, not fixed here) — confirm
   this reading of AC1's four-token scope is correct.
2. Design decision 3 (pre-existing `destructive`/10 composite failure
   documented, not fixed) — confirm this reading of AC2's "verified
   pairing" wording is correct, i.e. that an already-failing pairing
   getting marginally worse is not the "regression" AC2 requires a token
   adjustment for.
3. AC3 (light theme unchanged) — confirm the 1.09:1-delta/"mockup's own
   page-card gap is the same magnitude" reasoning is accepted as
   sufficient documentation, rather than requiring an actual code change
   to `:root`.

No blocking questions found — the mockup file exists and its cited OKLCH
values were verified byte-for-byte against the live file; the conversion
method was cross-validated against CHORE-28's already-shipped values; all
dependent pairings named in AC2 were enumerated via grep and computed.
Ready for Challenge.
