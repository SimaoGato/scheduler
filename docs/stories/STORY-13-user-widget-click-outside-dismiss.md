# STORY-13: User identity widget — click outside to dismiss
Epic: EPIC-01
Status: in-progress (implementation complete, pending review)

## User story
As a logged-in user, I want the user menu to close when I click anywhere
outside it, so that I don't have to click the trigger again just to dismiss
it.

## Context
STORY-12 implemented `UserWidget` using a native `<details>`/`<summary>`
element specifically because shadcn's `DropdownMenu`
(`@radix-ui/react-dropdown-menu`) was not installed at the time. CLAUDE.md
documents the resulting trade-off explicitly: "clicking outside does NOT
close the panel (browsers provide no native outside-click dismissal)... Only
use this pattern when ACs don't require click-outside behavior."

User feedback (2026-07-02 triage) confirms this trade-off is now a real
usability problem: users must click the avatar/name trigger a second time to
close the menu, rather than clicking anywhere else on the page as they would
expect from Gmail/GitHub-style menus (the exact reference pattern STORY-12
cited when choosing this UI).

This story revisits that accepted limitation. Two implementation paths are
worth weighing during Refine:
1. Keep the Server Component base and add a small `'use client'` wrapper
   that listens for outside clicks (and ideally Escape) and force-closes the
   `<details>` via a ref.
2. Install `@radix-ui/react-dropdown-menu` and migrate `UserWidget`'s trigger
   onto shadcn's `DropdownMenu`, which has this behavior built in. This
   requires promoting the trigger to a Client Component and adding a new
   dependency.

See EPIC-01 (app shell/navigation) and STORY-12 for prior context.

## Acceptance criteria
1. Given the user menu is open, when the user clicks anywhere outside the
   menu (header background, page body, another nav link), then the menu
   closes.
2. Given the user menu is open, when the user clicks the trigger itself
   again, then the menu still closes (existing toggle behavior preserved).
3. Given the user menu is closed, when the user clicks the trigger, then the
   menu still opens (regression check).
4. Given the fix, when the widget is rendered at a 375 px viewport, then no
   horizontal overflow is introduced (regression of STORY-12 AC4/AC5).
5. Given the user menu is open, when the user presses Escape, then the menu
   closes (nice-to-have for parity with standard menu UX; Refine may drop
   this if it meaningfully complicates the chosen approach — note the
   trade-off if dropped).

## Out of scope
- A full user settings/profile page.
- Changing what's inside the menu (name, role, sign out).
- Changing nav links or destinations.

## Technical notes
- `components/UserWidget.tsx` is currently an async Server Component using
  native `<details>`/`<summary>` (STORY-12).
- Whichever approach is chosen, keep SSR of the name/role content where
  possible to avoid a layout shift/flash on first paint.
- Once resolved, update the CLAUDE.md note under "Native `<details>`/
  `<summary>` as a lightweight dropdown" — it currently documents
  click-outside as an "acceptable limitation," which will no longer be
  accurate after this story ships. Supersede or qualify it, don't just leave
  it stale.
- Priority: normal — reported usability annoyance, not a functional defect.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Recommended approach: Approach 1 — client wrapper around native `<details>`

Keep the native `<details>`/`<summary>` element and add a small `'use client'`
component that owns the DOM node via a `ref` and force-closes it on outside
click / Escape. Do **not** install `@radix-ui/react-dropdown-menu` for this
story.

**Why, weighed against Approach 2:**
- **SSR / layout shift**: `UserWidget.tsx` stays an async Server Component
  that resolves translations and computes `displayName`/`initial`/
  `roleLabel` server-side (unchanged from STORY-12). Those resolved *values*
  are passed as plain string props into the new client leaf, so the initial
  HTML is still fully server-rendered with correct content — no client-side
  fetch, no flash/layout shift. This matches the Technical note's intent
  ("keep SSR of the name/role content where possible") even though the
  interactive DOM node itself becomes a Client Component.
- **Bundle size / new dependency**: Approach 1 adds zero new dependencies —
  just `useRef`/`useEffect` and two `document` event listeners. Approach 2
  requires installing `@radix-ui/react-dropdown-menu`, hand-building a
  shadcn-style `components/ui/dropdown-menu.tsx` wrapper (multiple exported
  primitives: Root, Trigger, Content, Item, Separator), and — because Radix's
  `DropdownMenuTrigger`/`Content` require client context — converting the
  *entire* rendered widget (not just the interactivity) to a Client
  Component, which is a materially bigger diff for a single reported
  usability annoyance.
- **New risk surface**: Radix `DropdownMenu.Content` defaults to Popper-based
  portal positioning, which is a plausible reintroduction vector for the
  375 px horizontal-overflow regression this story explicitly must not
  reintroduce (AC4). Approach 1 keeps the exact same DOM structure and CSS
  (`absolute right-0 top-full`) already proven not to overflow in STORY-12,
  so AC4 is materially lower-risk.
- **Existing test contract**: Approach 1 preserves every `data-testid` in
  `e2e/header-identity-widget.spec.ts` verbatim (`user-widget`,
  `user-widget-trigger`, `user-widget-menu`, `user-identity`,
  `user-role-label`, `sign-out-button`), so that spec needs no changes.
  Migrating to Radix would risk touching that contract (Radix injects its
  own `data-state`/`data-radix-*` attributes and typically wraps content in
  a portal, which can change DOM nesting assumptions in the existing tests).
- **AC5 (Escape)**: Trivial to add under Approach 1 — one more `keydown`
  listener alongside the outside-click listener in the same `useEffect`, no
  extra library API to learn. This removes the need to invoke the "Refine
  may drop this" escape hatch — AC5 is kept.
- **Counterpoint noted for the epic**: If future stories need richer menu
  behavior (nested items, keyboard roving focus, submenus) across multiple
  components, installing shadcn `DropdownMenu` as a shared primitive would
  pay off. That is out of scope here (single trigger, one flat list of
  actions) — flag it as a candidate for a future story if more
  dropdown/menu needs emerge elsewhere in the app, rather than pulling it in
  now for one component.

### Affected areas
- **Frontend** (Client/Server Component split, DOM event handling,
  accessibility) — the only code area touched.
- **Docs** — CLAUDE.md's `<details>`/`<summary>` note must be updated to
  stop calling click-outside an "acceptable limitation" (per Technical
  notes). No backend, data, infra, or ai-ml surface is touched.

### Files to create/modify
1. **Create** `components/UserWidgetMenu.tsx` (new, `'use client'`):
   - Props: `displayName: string`, `initial: string`, `roleLabel: string | null`,
     `triggerAriaLabel: string`, `signOutLabel: string`,
     `signOutAction: () => Promise<void>` (the `signOut` server action,
     passed through — Server Actions are valid props across the
     server/client boundary; `'use server'` already present in
     `app/[locale]/login/actions.ts`, no change needed there).
   - Owns the `<details ref={detailsRef}>` DOM node (moved verbatim from
     the current `UserWidget.tsx` JSX, same classNames/testids).
   - `useEffect` (mount-only, deps `[]`) that:
     - Adds a `document` `click` listener: if `detailsRef.current?.open` is
       true and the click target is **not** contained by the `<details>`
       node, set `detailsRef.current.open = false`. Clicks on the trigger
       or inside the menu are left alone — the browser's native `<details>`
       toggle behavior (open ↔ closed on `<summary>` click) is untouched,
       which is what naturally satisfies AC2 and AC3 as regression checks.
     - Adds a `document` `keydown` listener: if `event.key === 'Escape'`
       and `detailsRef.current?.open` is true, set `.open = false` (AC5).
     - Returns a cleanup function removing both listeners.
   - No React state for open/closed — the native `<details>` `open`
     attribute remains the single source of truth (avoids
     controlled/uncontrolled hydration mismatches).
2. **Modify** `components/UserWidget.tsx`:
   - Keep it an async Server Component. Keep the `getTranslations('Auth')`
     call and `initial` computation.
   - Replace the inline `<details>...</details>` JSX with
     `<UserWidgetMenu displayName={displayName} initial={initial} roleLabel={roleLabel} triggerAriaLabel={\`${displayName} — ${t('userMenuAriaLabel')}\`} signOutLabel={t('signOut')} signOutAction={signOut} />`.
   - No new i18n keys needed — reuses `Auth.userMenuAriaLabel` and
     `Auth.signOut`, already present in `messages/pt-PT.json`.
3. **Modify** `e2e/header-identity-widget.spec.ts`: no changes needed to
   existing tests (testids and behavior for AC1–AC3 of STORY-12 are
   preserved), but update the AC2 comment/docstring that currently reads
   *"Note: `<details>` does not close on outside click — this is accepted"*
   — that statement becomes stale after this story ships. Replace with a
   pointer to the new STORY-13 spec.
4. **Create** `e2e/user-widget-click-outside.spec.ts` (new spec, follows
   the same auth-gated pattern as `header-identity-widget.spec.ts` since
   `UserWidget` only renders for authenticated users in the `(app)` route
   group):
   - AC1: open menu, click an outside element (e.g. the header title /
     `page.locator('body')` at a point outside `user-widget`), assert
     `user-widget-menu` is not visible.
   - AC2: open menu, click `user-widget-trigger` again, assert
     `user-widget-menu` is not visible (regression).
   - AC3: with menu closed, click `user-widget-trigger`, assert
     `user-widget-menu` becomes visible (regression).
   - AC4: reuse the `document.documentElement.scrollWidth <= 375` pattern
     from `smoke.spec.ts` / `header-identity-widget.spec.ts` AC4/AC5, this
     time with the *menu open* (worst case for overflow) at 375 px.
   - AC5: open menu, press `Escape`, assert `user-widget-menu` is not
     visible.
   - All five tests gated with
     `test.skip(!process.env.E2E_WITH_AUTH, 'AppHeader requires authentication')`,
     consistent with the existing auth-gated test pattern in CLAUDE.md.
   - Since CI has no real Supabase session, also document each AC as a
     manual verification step in the spec file header comment (same
     dual-documentation pattern used in `header-identity-widget.spec.ts`),
     so the DoD's "AC coverage" requirement is satisfiable even when the
     automated test is skipped in CI.
5. **Modify** `CLAUDE.md` — under "Native `<details>`/`<summary>` as a
   lightweight dropdown", update the sentence *"Acceptable limitation:
   clicking outside does NOT close the panel... Only use this pattern when
   ACs don't require click-outside behavior."* Supersede it with something
   like: *"As of STORY-13, click-outside and Escape dismissal are handled
   via a thin `'use client'` wrapper (ref + document-level `click`/`keydown`
   listeners) around the `<details>` node — see `components/UserWidgetMenu.tsx`
   for the reference pattern. The native element itself still requires no
   `'use client'` boundary for static/non-dismissible uses; add the wrapper
   only when outside-click or Escape dismissal is required."* Do this edit
   as part of the same PR, not a follow-up.

### Step-by-step (test-first where practical)
1. Write `e2e/user-widget-click-outside.spec.ts` first (all 5 tests +
   manual-verification header comment), matching the current AC wording.
   Confirm it fails to compile/run meaningfully against the *old*
   `UserWidget.tsx` (or is trivially skipped in CI) before implementing.
2. Extract `UserWidgetMenu.tsx` from the current inline JSX in
   `UserWidget.tsx`, unchanged visually — commit/verify no regression
   first (pure refactor, no new behavior yet).
3. Add the `useRef` + `useEffect` outside-click/Escape logic to
   `UserWidgetMenu.tsx`.
4. Update `UserWidget.tsx` to pass props into `UserWidgetMenu`.
5. Update the stale AC2 comment in `e2e/header-identity-widget.spec.ts`.
6. Update the CLAUDE.md note.
7. Run locally with `E2E_WITH_AUTH=1` (real Supabase + Google OAuth per
   CLAUDE.md's auth-gated test pattern) if credentials are available;
   otherwise rely on the manual verification steps documented in the spec
   file, per the Definition of Done's AC-coverage clause.
8. Run full gate: `npm run lint`, `npx tsc --noEmit`, `npm run build`,
   `npm run test:e2e`.

### Test plan (AC → test)
| AC | Automated test | Notes |
|----|----------------|-------|
| AC1 — outside click closes menu | `e2e/user-widget-click-outside.spec.ts` "AC1" | Auth-gated; manual step documented as fallback |
| AC2 — trigger click still closes (regression) | `e2e/user-widget-click-outside.spec.ts` "AC2" | Also implicitly covered by existing STORY-12 AC2 toggle test |
| AC3 — trigger click still opens (regression) | `e2e/user-widget-click-outside.spec.ts` "AC3" | Overlaps STORY-12 AC1/AC2 |
| AC4 — no horizontal overflow at 375 px, menu open | `e2e/user-widget-click-outside.spec.ts` "AC4" | Menu open is the worst case not covered by STORY-12's closed-state 375px checks |
| AC5 — Escape closes menu | `e2e/user-widget-click-outside.spec.ts` "AC5" | Kept (not dropped) — cheap under Approach 1 |

### Risks and rollback
- **Risk**: `document`-level click listener could interfere with other
  future overlays/modals if they don't stopPropagation appropriately.
  Mitigation: listener only ever mutates *this* widget's own `<details>`
  node (via `detailsRef`), never global state, so blast radius is
  contained to `UserWidgetMenu`.
- **Risk**: Hydration mismatch if `<details open>` were ever
  server-rendered as open. Mitigation: `open` is never set server-side
  (uncontrolled, defaults closed), consistent with current behavior.
- **Risk**: Escape-key listener firing globally could clash with an
  unrelated future global Escape handler (e.g. closing a modal that should
  take precedence). Low likelihood today (no other Escape handling exists
  in the codebase); revisit if a modal/dialog pattern is introduced later.
- **Rollback**: Single component extraction with no schema/data changes —
  revert the PR (delete `UserWidgetMenu.tsx`, restore inline JSX in
  `UserWidget.tsx`, revert the two doc edits) with no other cleanup
  required.

### Complexity tag: standard
Justification: touches Next.js Server/Client Component composition
(passing a Server Action and server-resolved strings across the boundary),
requires correct reasoning about native `<details>` toggle semantics vs.
manually-added DOM event listeners (ordering, cleanup, avoiding
interference with existing toggle behavior), and must not regress two
previously-verified ACs (STORY-12 AC4/AC5 overflow, AC1-AC3 toggle
behavior) while modifying the same file. Not `trivial` — there is real
reasoning risk in the event-listener interaction logic — but also not
`complex` — it's a single component, no auth/data/concurrency/money
surface.
