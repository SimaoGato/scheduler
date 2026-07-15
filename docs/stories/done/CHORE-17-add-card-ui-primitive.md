# CHORE-17: Add a Card UI primitive to the design system
Epic: maintenance
Priority: low (foundational — enables CHORE-18/CHORE-19, no user-visible
change on its own)
Status: done ✅
PR: 53

## Task
Add a shadcn/ui `Card` component (and the small set of subcomponents that
ship with it: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
`CardFooter`) to `components/ui/`, matching the same integration pattern
already used for `Button` and `Select`. This is a pure infrastructure
addition — no page changes — that unblocks the visual-design chores raised in
this triage round.

## Context
CHORE-01 (done ✅) set up Tailwind + shadcn/ui as the project's design
system, but `components/ui/` currently only contains `button.tsx` and
`select.tsx`. Every page that presents grouped information (home page team
summary, availability summary, etc.) currently does so as bare `<div>`/`<ul>`
text blocks with no visual container — no border, no background
differentiation, no elevation. This reads as "raw browser defaults" rather
than the "intentionally designed" bar CHORE-01's AC2 set. A reusable `Card`
primitive is the standard building block for fixing that without every story
reinventing its own container styling.

## Acceptance criteria
1. Given `components/ui/card.tsx`, when a consumer imports `Card`,
   `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and
   `CardFooter`, then each renders semantic, accessible markup styled with
   the project's existing design tokens (the same CSS custom properties
   `Button` already uses — `bg-card`, `text-card-foreground`, border tokens,
   etc. — defined in `app/globals.css`).
2. Given the component in both light and dark theme (`.dark` class per
   CHORE-11's class-driven strategy), when rendered, then contrast of card
   text against the card background meets WCAG AA, verified the same way
   STORY-19 verified `--warning`/`--warning-foreground` (measured contrast
   ratio in compiled CSS output, not eyeballed).
3. Given the component at 375px and 1280px viewports, when rendered with
   representative content (a title + a short list, similar to what CHORE-18
   will use it for), then it has no horizontal overflow and no
   sub-44px-effective tap targets if it contains interactive children.
4. Given `npm run lint && npx tsc --noEmit && npm run build`, then all exit
   0. (No e2e test is required for this chore alone since it adds no new
   page-visible behavior; CHORE-18/CHORE-19 will add the first real usage
   and its own AC-driven tests.)

## Out of scope
- Using the Card component anywhere yet — that's CHORE-18 (home page) and
  CHORE-19 (availability page).
- Any other new shadcn primitives (Badge, Separator, etc.) — add only if a
  later story concretely needs one; don't speculatively bulk-add components.
- Changing existing tokens in `app/globals.css` — reuse what CHORE-01/
  CHORE-11/STORY-19 already established.

## Technical notes
- Per CLAUDE.md: `npx shadcn@latest add card` may be blocked in sandboxed
  environments — if so, create `components/ui/card.tsx` manually; the CLI
  output is deterministic and well-documented (shadcn's Card source is a
  small set of `React.forwardRef` div wrappers with fixed class strings).
- Follow the same pattern as `components/ui/button.tsx` re: `'use client'`
  only if the component actually needs client-side behavior (Card itself
  typically doesn't — it's presentational — so it likely does NOT need
  `'use client'` and can be used directly from Server Components).
- No database, auth, or business-logic surface — this is a pure UI/styling
  chore, safe to classify as `trivial`-to-`standard` complexity.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Correction to Technical notes (verified against existing code)

The Technical notes describe the expected shadcn `Card` source as "a small
set of `React.forwardRef` div wrappers." That is the **old** shadcn output
shape. This codebase's actual installed pattern (confirmed by reading
`components/ui/button.tsx` and `components/ui/select.tsx`) is the **newer**
shadcn convention: plain functions (no `forwardRef`), each stamped with a
`data-slot="..."` attribute, styled via `cn(...)` from `lib/utils.ts`, no
`'use client'` unless the component needs interactivity. `card.tsx` must
follow this newer pattern to stay consistent with the two existing
primitives — not the story's forwardRef description.

### Affected areas
- **Frontend / UX (design system)** — one new file, `components/ui/card.tsx`.
  No page, route, or business-logic files touched. No new dependencies (all
  of `clsx`, `tailwind-merge` are already installed and used by
  `lib/utils.ts`; Card needs no Radix primitive, unlike Select).
- **Tests** — one new CI-safe, non-auth-gated e2e spec,
  `e2e/card-ui-primitive.spec.ts`, using only static filesystem checks (no
  browser page load, no auth) — same category as `dark-mode.spec.ts`'s AC5
  and the BUGFIX-02 "static source guard" pattern.
- No backend, auth, data, or infra surface.

### Design decisions (pinned so implementation is mechanical)

1. **Exact shadcn Card source, adapted to this repo's token names.** The
   six required exports (`Card`, `CardHeader`, `CardTitle`,
   `CardDescription`, `CardContent`, `CardFooter`) plus their standard
   internal class strings (`bg-card text-card-foreground ... rounded-xl
   border ... shadow-sm` for `Card`; `text-muted-foreground text-sm` for
   `CardDescription`; etc.) — this is deterministic, well-documented shadcn
   output, not a judgment call.
2. **`CardAction` is intentionally excluded.** Upstream shadcn's `card.tsx`
   registry item also ships a `CardAction` subcomponent (for a
   header-corner action button/icon). AC1 enumerates exactly six exports and
   does not mention it; neither CHORE-18 nor CHORE-19 (the only two known
   consumers) reference it. Per the story's own Out-of-scope guidance
   ("don't speculatively bulk-add"), omit it. It can be added later in a
   near-zero-cost follow-up if a future story needs a header action slot —
   flagging this explicitly so Challenge/Review can confirm the omission is
   deliberate, not a miss.
3. **No `'use client'` directive.** All six components are plain
   `<div>` wrappers with no hooks, no event handlers, no browser-only APIs.
   They are safe to import directly from async Server Components (both
   `app/[locale]/(app)/page.tsx` and `app/[locale]/(app)/availability/page.tsx`,
   CHORE-18/19's targets, are Server Components today) with no client
   boundary introduced. This mirrors the "Card itself is presentational"
   expectation already stated in the story's Technical notes.

### Step-by-step

1. Create `components/ui/card.tsx`:
   - Import `* as React from "react"` and `{ cn } from "@/lib/utils"`.
   - `Card`: `<div data-slot="card" className={cn("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm", className)} {...props} />`.
   - `CardHeader`: `<div data-slot="card-header" className={cn("flex flex-col gap-1.5 px-6", className)} {...props} />` (simplified from upstream's `@container`/grid variant, since `CardAction` — the only reason for the grid layout — is excluded; a plain flex column is sufficient and avoids referencing an unused subcomponent's positioning classes).
   - `CardTitle`: `<div data-slot="card-title" className={cn("leading-none font-semibold", className)} {...props} />`.
   - `CardDescription`: `<div data-slot="card-description" className={cn("text-muted-foreground text-sm", className)} {...props} />`.
   - `CardContent`: `<div data-slot="card-content" className={cn("px-6", className)} {...props} />`.
   - `CardFooter`: `<div data-slot="card-footer" className={cn("flex items-center px-6 [.border-t]:pt-6", className)} {...props} />`.
   - Each component typed `React.ComponentProps<"div">`.
   - Single `export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }` at the bottom, matching the existing multi-export style in `select.tsx`.
2. Write `e2e/card-ui-primitive.spec.ts` (test-first is of limited value here since there's no behavior to red/green-cycle against — a plain presentational component — but write the static-check test immediately after the file exists and before running the full gate, so verification isn't an afterthought):
   - **AC1 test** — static source check: read `components/ui/card.tsx` via `fs.readFileSync`, assert (single full-string regex per component, not independent substring checks — per the BUGFIX-02 lesson on catching typos) that each of the six components is exported and that `Card`'s class string contains `bg-card` and `text-card-foreground`.
   - **AC1 test (compiled CSS)** — after `npm run build`, reuse the `findCssFiles` helper pattern from `e2e/dark-mode.spec.ts` to scan `.next/static` for compiled CSS, and assert the combined output contains `.bg-card` and `.text-card-foreground` selector definitions (proves Tailwind v4's content scanner picked up `card.tsx` even though nothing imports it yet — Tailwind v4 scans all project source files by default, not just the reachable/imported graph). Skip gracefully if `.next/static` doesn't exist yet (same skip pattern as `dark-mode.spec.ts` AC5).
   - **AC2 test** — WCAG AA contrast, computed (not eyeballed), CI-safe, no browser: read `app/globals.css`, extract the `--card`/`--card-foreground` and `--muted-foreground` HSL triples from both the `:root` and `.dark` blocks via regex, convert HSL → sRGB → relative luminance (standard WCAG formula), compute the contrast ratio for `--card-foreground` on `--card` and for `--muted-foreground` on `--card` (this second pair matters because `CardDescription` uses `text-muted-foreground`, which is explicitly "card text" under AC2's wording), and assert each ratio is `>= 4.5` in both themes.
   - **AC3 test** — static source check: assert `card.tsx`'s class strings contain no fixed pixel/rem width utility (e.g. no `w-[`, no bare `w-<number>` that isn't `w-full`) and no `min-w-` beyond `min-w-0`, so the component cannot introduce horizontal overflow by construction (no interactive children exist to tap-target-check — see AC3 verification note below).
3. Run `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` — all must exit 0 (AC4).

### AC2 verification — concrete method and result

STORY-19 established the precedent: "measured contrast ratio in compiled CSS
output, not eyeballed." `Card` introduces **no new tokens** (Out of scope
explicitly forbids touching `app/globals.css`), so this verification is
lower-risk than STORY-19's — it's confirming already-relied-upon pairs, not
tuning new ones. Concretely:

- **`--card-foreground` on `--card`**: in the light theme these are
  *identical values* to `--foreground`/`--background` (`0 0% 100%` /
  `240 10% 3.9%`), i.e. near-black text on white. Computed contrast ratio ≈
  **19.9:1** (light) and, by symmetry, ≈19.9:1 in dark (`--card`/
  `--card-foreground` = `240 10% 3.9%` / `0 0% 98%`). Both far exceed the
  4.5:1 AA floor (and clear AAA's 7:1 too).
- **`--muted-foreground` on `--card`** (relevant because `CardDescription`
  uses `text-muted-foreground`, not `text-card-foreground`): light theme is
  the tight case — `--muted-foreground: 240 3.8% 46.1%` on `--card: 0 0%
  100%` computes to **≈4.83:1**, just above the 4.5:1 AA floor for normal
  text (comfortably above the 3:1 large-text floor). Dark theme
  (`--muted-foreground: 240 5% 64.9%` on `--card: 240 10% 3.9%`) computes to
  **≈7.76:1**, a comfortable margin. The light-theme 4.83:1 case is *not* a
  new risk introduced by this story — `text-muted-foreground` is already
  used directly inside a `bg-card` container in production today
  (`app/[locale]/login/page.tsx:33`, `app/[locale]/claim/page.tsx:92`), so
  Card is reusing an existing, already-shipped pairing rather than
  inventing a new one. Flagging the exact ratio explicitly here (rather
  than silently assuming "reuses existing tokens = automatically fine") is
  the STORY-19-style rigor this AC asks for — the margin is real and narrow
  enough that it should not shrink further; do not darken `--card` or
  lighten `--muted-foreground` in any later story without re-running this
  check.
- This calculation is encoded as the automated `e2e/card-ui-primitive.spec.ts`
  AC2 test above (reads the real `app/globals.css` values at test time, so
  it self-invalidates if a future edit changes the tokens), satisfying DoD
  item 5 with an automated test rather than only a manual note.

### AC3 verification — concrete method, and why the tap-target clause is N/A here

AC3 has two parts: "no horizontal overflow" and "no sub-44px tap targets
**if it contains interactive children**." As shipped by this story, `Card`
and all five subcomponents render only `<div>` elements — zero interactive
children — so the tap-target clause is structurally not applicable yet. It
becomes applicable, and testable with real content, only once a consumer
places interactive elements (buttons, links) inside a `CardFooter`/
`CardContent` — that's CHORE-18 (home page) and CHORE-19 (availability
page), both of which already carry their own 375px/1280px overflow +
44px tap-target AC (see CHORE-18 AC4). Per this story's own Out-of-scope
list ("Using the Card component anywhere yet... that's CHORE-18/19"),
adding a live page render here to visually verify would itself be a scope
violation.

For "no horizontal overflow," verify structurally instead of visually: `Card`
and its subcomponents use no fixed pixel/rem widths and no `min-w-`
beyond `min-w-0` — they only ever take the width their parent gives them
(default block-level `<div>` behavior) plus fixed horizontal *padding*
(`px-6`), which cannot force overflow at any viewport width down to
roughly 96px (2× `px-6`'s 1.5rem = 48px, far below any real device width).
This is the `e2e/card-ui-primitive.spec.ts` AC3 static test described in
Step 2 above. Document this explicitly as the AC3 verification method in
this story (satisfying DoD item 5 with an automated static check), and
explicitly note that the *live, real-content* 375px/1280px check (the part
that actually exercises "representative content" and "interactive
children") is deferred to and owned by CHORE-18/CHORE-19's own AC4-style
tests — not a gap in this story, a declared boundary.

### Test plan (AC → test)

| AC | Automated test | Notes |
|----|-----------------|-------|
| AC1 — all six components render with existing design tokens | `e2e/card-ui-primitive.spec.ts` "AC1" (static source check) + "AC1 compiled" (compiled CSS contains `.bg-card`/`.text-card-foreground`) | CI-safe, no auth, no browser page load |
| AC2 — WCAG AA contrast in both themes, measured not eyeballed | `e2e/card-ui-primitive.spec.ts` "AC2" — computes contrast ratio for `--card-foreground`/`--card` and `--muted-foreground`/`--card` from the real `app/globals.css` values, asserts `>= 4.5` in both `:root` and `.dark` | CI-safe; see worked calculation above (≈19.9:1 and ≈4.83:1/7.76:1) |
| AC3 — no horizontal overflow / no sub-44px tap targets if interactive children exist | `e2e/card-ui-primitive.spec.ts` "AC3" (static: no fixed-width utilities) — documented deferral of the live-render/tap-target check to CHORE-18/CHORE-19, whose own AC4-equivalent tests cover it with real interactive content | Tap-target clause is N/A for this story (zero interactive children shipped); explicitly documented, not silently skipped |
| AC4 — lint/typecheck/build exit 0 | CI (`npm run lint && npx tsc --noEmit && npm run build`) | No e2e smoke test required per the story's own AC4 wording; `card-ui-primitive.spec.ts` still runs in the smoke suite as it's CI-safe and cheap |

### Risks and rollback

- **Risk — marginal contrast pairing (`text-muted-foreground` on `bg-card`,
  light theme, ≈4.83:1).** Mitigated by: (a) confirming this pairing is
  pre-existing production behavior, not new; (b) the automated AC2 test
  asserting `>= 4.5` will fail loudly (not silently regress) if either
  token's value ever drifts closer to the floor in a future story.
- **Risk — Tailwind v4 tree-shaking could theoretically omit unused
  utility classes if content scanning is misconfigured.** Mitigated by the
  AC1 "compiled CSS" test, which fails the build-verification step if
  `.text-card-foreground` (a class not used anywhere else in the codebase
  today) doesn't actually appear in the compiled output.
- **Risk — `CardAction` omission could block CHORE-18/19 if they turn out
  to need a header-action slot.** Low probability (neither story's AC
  mentions one); if it comes up, adding `CardAction` later is a trivial,
  additive, single-function change with no migration cost.
- **Rollback**: delete `components/ui/card.tsx` and
  `e2e/card-ui-primitive.spec.ts`. No schema, no i18n keys, no other file
  touched — a clean, single-commit revert.

### Complexity tag: standard

Justification: the code itself is mechanical (two very close, in-repo
precedents — `button.tsx`, `select.tsx` — define the exact house style, and
shadcn's Card output is deterministic). What pushes this above `trivial` is
the genuine reasoning work AC2 demands: this plan's own contrast
calculation surfaced a real, non-obvious marginal case (`text-muted-foreground`
on `bg-card` ≈ 4.83:1 in light theme, a hair above the AA floor) that a
purely mechanical "copy the shadcn source" pass would not have surfaced or
verified. Per CLAUDE.md's routing guidance ("when in doubt, do NOT mark
trivial"), the presence of a real WCAG verification obligation with a
non-trivial outcome — even on a single, low-blast-radius file — is enough
to keep this at `standard` rather than `trivial`.
