# BUGFIX-05: Replace native `<select>` link-account picker with a custom-styled dropdown (Windows Chrome/Edge dark-mode popup still unreadable after BUGFIX-04)
Status: done ✅ (implementation + automated tests + design-time/source-level verification complete; mandatory manual checklist — Windows Chrome/Edge, mobile touch, screen reader, and all `E2E_WITH_AUTH`-gated tests — not executable from this sandbox; see QA section below for the honest split and the "Action needed" list)
Related story: STORY-20 (introduced the "Ligar conta" picker in `components/PeopleTable.tsx`),
BUGFIX-04 (attempted a `color-scheme` CSS fix for the same symptom — confirmed
insufficient on the primary target platform; superseded by this story)
Epic: EPIC-02

## Bug
BUGFIX-04 fixed the dark-mode contrast bug of the "Ligar conta" native
`<select>` picker in `components/PeopleTable.tsx` by adding
`color-scheme: light;` (`:root`) / `color-scheme: dark;` (`.dark`) to
`app/globals.css`. That fix was verified correct and complete via automated
checks (compiled CSS, computed-style tests, a synthetic headless-Chromium
popup reproduction) and shipped to production (PR #39, merged).

After shipping, the reporting user (Chrome/Edge on Windows, Windows itself in
Dark mode, reproduced in a clean Incognito window — ruling out extensions,
stale localStorage, and OS/app theme mismatch) confirmed the popup is
**still** rendering with a near-white background and near-white text,
identical to the original bug. Live investigation (screenshot: [Image
provided by user in chat, not attached to this file]) confirmed:
- The option **text** correctly renders in dark mode's near-white
  `--foreground` value (proving the app's `.dark` class and CSS variables are
  genuinely active — this is not a theme-detection bug).
- The option **popup background** stays light/white regardless.
- Independent verification (this story's investigation) confirmed the
  production CSS bundle correctly ships both `color-scheme` declarations in
  the right cascade order, and that next-themes' `enableColorScheme`
  mechanism resolves consistently with the `.dark` class across 9 tested
  scenarios (both against a local dev server and the live production JS
  bundle, via Playwright/headless Chromium on Linux).

**Root cause (browser limitation, not an app bug):** `color-scheme` reliably
affects the *closed* `<select>` control's colors in Chromium, but the *open
dropdown popup's* `<option>` background rendering on Windows is a known,
currently-unresolved Chromium behavior gap — Chromium delegates native
`<select>` popup rendering differently across platforms, and on Windows the
popup's background does not consistently follow the page's `color-scheme` CSS
even when the (inherited) `color` value does. This reproduces the exact
"unreadable text vs. background" mismatch reported. Public references
corroborating this class of issue:
- https://issues.chromium.org/issues/41006289 ("Drop-down menus in Chrome
  ignore system-wide colors")
- https://issues.chromium.org/issues/415953695 ("Browser behavior difference
  for `<option>` background-color")

Because this is a genuine cross-platform rendering gap in the browser's
native popup implementation — not a CSS specificity, cascade, deployment, or
theme-detection bug in this app — no further CSS-only change can reliably
close it. BUGFIX-04's `color-scheme` declarations should remain in place
(they are correct and still needed for other native controls per BUGFIX-04's
"Technical notes" — e.g. any future `<input type="date">`; there is no
reason to revert them), but the "Ligar conta" picker itself needs to stop
depending on the native popup's rendering to guarantee dark-mode readability.

## Acceptance criteria
1. Given dark mode is active on any supported browser/platform (including
   Chrome/Edge on Windows), when the "Ligar conta" picker is opened, then
   every option (including the placeholder and all listed unlinked users) is
   rendered using the app's own DOM/CSS (not a native OS popup) and is
   clearly readable, verified by an automated Playwright test that opens the
   dropdown and asserts computed foreground/background contrast — no longer
   limited to a synthetic repro or manual-only verification, since the popup
   is now part of the ordinary DOM/CSSOM that Playwright can inspect
   directly.
2. Given light mode is active, when the same picker is opened, then options
   remain readable (no regression to the light-mode case) — automated,
   same mechanism as AC1.
3. Given the picker is open, when navigating via keyboard only (arrow
   keys/Tab, no mouse), then the currently-focused/highlighted option is
   visually distinguishable from the rest, and Enter/Space selects it,
   and Escape closes the picker without changing the selection — automated
   via Playwright keyboard interaction + DOM assertion (this closes the gap
   BUGFIX-04 could only verify with a synthetic non-interactive repro).
4. Given the fix, when applied, then the existing `min-h-[44px]` tap target,
   the `pm-link-select-{id}` (or equivalent renamed) `data-testid`, and the
   `aria-label` wiring from STORY-20/BUGFIX-04 are preserved or equivalently
   re-implemented on the new control — automated regression test.
5. Given the existing STORY-20 link/unlink business logic (guard clauses,
   race-safety, error mapping, `unlinkedUsers` population, `selectedUserId`
   state, Confirm/Cancel flow), when the picker is replaced, then that logic
   is unchanged in behavior — the new control is a drop-in replacement for
   the value/onChange contract of the old `<select>`, not a rewrite of
   STORY-20's data flow. Automated regression test: existing
   link/unlink e2e coverage continues to pass unmodified (or with only
   selector updates, not assertion/logic changes).
6. Given the new control, when used by a screen-reader user, then it exposes
   the following exact ARIA contract (Radix `Select`'s documented,
   known-in-advance output — not "whichever the primitive provides"), and
   this is confirmed both by automated DOM assertions and one manual
   screen-reader spot-check:
   - The closed control (`SelectTrigger`) renders `role="combobox"` with
     `aria-expanded` (`"false"` closed / `"true"` open), `aria-controls`
     (pointing at the content's id when open), `aria-autocomplete`, and the
     preserved `aria-label` (STORY-20/AC4).
   - When open, `SelectContent` renders `role="listbox"`.
   - Each `SelectItem` renders `role="option"`, with `aria-selected`
     reflecting whether that item matches the current `selectedUserId`.
   - **Mandatory manual check**: one screen-reader spot-check (VoiceOver on
     macOS, or NVDA on Windows — pick whichever is available to the
     implementer; document which was used) confirming the control announces
     as a combobox/listbox with its label, options are announced when
     navigated, and the selected option's state is announced — this is not
     optional/skippable, since this is the one AC where native `<select>`'s
     battle-tested a11y is being traded for a custom implementation and
     Playwright's DOM assertions alone cannot confirm actual screen-reader
     announcement behavior.

## Out of scope
- Any other native form control in the app (`ClaimPersonForm.tsx`'s radio
  buttons, etc.) — those are native radios, not a popup-rendered `<select>`,
  and are not affected by this specific Chromium popup-rendering gap. Not
  touched by this story.
- Reverting BUGFIX-04's `color-scheme` CSS — keep it; it's still correct and
  useful for other native controls, and does not need to be removed for this
  fix to land.
- Multi-select capability, search/filter-as-you-type, or any UX capability
  beyond what the current native `<select>` offers — this is a like-for-like
  replacement of the rendering mechanism, not a feature upgrade. (A future
  story may add search/filter if the unlinked-users list grows large enough
  to warrant it — not in scope here.)

## Technical notes
- Likely implementation: use shadcn/ui's `Select` component (Radix UI
  `Select` primitive under the hood) if not already installed, following
  this project's established manual-install pattern for shadcn components
  (see CLAUDE.md's shadcn/ui + Tailwind v4 integration notes — CLI may be
  blocked in sandboxed environments; component files are deterministic and
  can be created manually). Radix `Select` renders its popup as a normal DOM
  node (via Portal, but still within the page's own render tree and CSSOM),
  fully themed by the app's existing Tailwind CSS variables — no native OS
  popup involved, so this class of bug cannot recur for this control.
  Radix's `Select` also ships built-in keyboard nav and WAI-ARIA
  listbox/combobox semantics (AC3, AC6) "for free."
- `components/PeopleTable.tsx` (~line 410) is the only call site — this is a
  single-component swap. Preserve the `value`/`onChange`-equivalent contract
  (`selectedUserId` state, `setSelectedUserId`) so STORY-20's surrounding
  logic (Confirm/Cancel, disabled-while-loading, `unlinkedUsers` population)
  needs zero changes (AC5).
- Verify AC1–AC3 with real Playwright DOM/CSSOM assertions this time (not a
  synthetic repro or manual-only step) — since the popup will now be a
  normal DOM node, Playwright can open it, read computed styles, and drive
  keyboard interaction directly, closing the exact automation gap flagged in
  BUGFIX-04's QA stage.
- Still worth a manual cross-browser spot-check (Windows Chrome/Edge at
  minimum, since that's what surfaced this bug — plus mobile Chrome/Safari,
  since this project treats touch as first-class; see Implementation Plan
  step 9 for the full checklist) before considering AC1 fully closed, per
  [[feedback_qa_visual_rendering]] — automated DOM/CSSOM checks prove the
  *intended* styles are applied, but a real-browser render is the only way
  to confirm no *other* platform-specific popup-rendering gap exists for the
  new component too.

## Implementation Plan

### Feasibility check (performed during refinement)
- `components/ui/select.tsx` does **not** exist yet; `components/ui/` only has
  `button.tsx`. `components.json` is present and configured for the
  "new-york" style / `cssVariables: true` — consistent with `button.tsx`'s
  existing pattern (`cva` + `cn` + `'use client'` + Radix primitive).
- `@radix-ui/react-select` is **not** in `package.json` or `node_modules`
  (only `@radix-ui/react-slot` and its `react-compose-refs` dependency are
  installed, pulled in by `button.tsx`/`Slot`). It must be added:
  `npm install @radix-ui/react-select`. Confirmed registry reachability from
  this environment (`npm view @radix-ui/react-select version` resolved
  `2.3.3` successfully) — network access for `npm install` is not blocked
  here, only the `shadcn` CLI's own scaffolding step is historically blocked
  per CLAUDE.md, so plan for **manual creation** of
  `components/ui/select.tsx` (deterministic shadcn "new-york" output, same
  as `button.tsx` was created) after installing the Radix dependency.
- Theme tokens the new component needs already exist and are
  contrast-established: `--popover`/`--popover-foreground` (menu surface),
  `--accent`/`--accent-foreground` (hover/highlighted item), `--input`,
  `--ring` — all present in both `:root` and `.dark` blocks in
  `app/globals.css` and already wired into `@theme inline` as
  `--color-popover`, `--color-accent`, etc. No new tokens are needed; this is
  a pure component-swap using existing design-system colors (STORY-19's
  centralization pays off here — no new contrast tuning required, but must
  still be spot-verified per AC1/AC2 test plan below since this is the first
  consumer of `--popover` in the codebase).
- Current native `<select>` (`components/PeopleTable.tsx` lines 410–426):
  - `data-testid={\`pm-link-select-${person.id}\`}`
  - `aria-label={t('linkPickerLabel')}`
  - `value={selectedUserId}` / `onChange={(e) => setSelectedUserId(e.target.value)}`
  - `disabled={isLoading}`
  - `className="min-h-[44px] rounded-md border px-2 text-sm"`
  - First `<option value="" disabled>{t('linkPickerPlaceholder')}</option>`
    (placeholder, unselectable), then `unlinkedUsers.map(...)` rendering
    `<option key={user.id} value={user.id}>{user.display_name ?? user.email}</option>`
  - `unlinkedUsers` (component-level, line 48): `UserRow[]` filtered from
    `allUsers` by `!takenUserIds.has(u.id)`; `UserRow` = `{ id, email,
    display_name, role }` (`types/user-management.ts`).
  - Surrounding logic (`handleLink`, `cancelLinking`, Confirm/Cancel buttons)
    reads/writes only `selectedUserId`/`setSelectedUserId` — no other native
    `<select>`-specific API (no `.selectedIndex`, no `<optgroup>`, etc.) is
    used, confirming a value/onChange swap is sufficient (AC5).

### Affected areas
- **Frontend / UI (primary)**: `components/PeopleTable.tsx` (single call
  site swap), new `components/ui/select.tsx` (shadcn primitive, net-new
  file), `package.json`/`package-lock.json` (new dependency).
- **Accessibility**: ARIA listbox/combobox semantics, keyboard nav, focus
  management — Radix `Select` provides this out of the box, but must be
  verified against the exact contract now pinned in AC6
  (`combobox`/`listbox`/`option` roles + `aria-expanded`/`aria-controls`/
  `aria-selected`), not assumed, plus one mandatory manual screen-reader
  spot-check (AC3, AC6).
- **Mobile/touch**: this project treats touch as first-class (44px
  tap-target convention, phone+laptop coordinator user) — a mandatory manual
  mobile Chrome/Safari spot-check (tap-to-open, tap-to-select, scroll, no
  viewport clipping) is added to this plan (see step 9), in addition to the
  existing Windows desktop spot-check.
- **Test (e2e)**: `e2e/admin-link-person.spec.ts` (STORY-20, selector
  updates only) and `e2e/link-picker-color-scheme.spec.ts` (BUGFIX-04,
  superseded assertions — see below) need updates. New spec file for this
  story's AC1–AC3/AC6 DOM/CSSOM + keyboard assertions.
- No backend, data, auth, or concurrency changes — this story does not touch
  any Route Handler, migration, or the link/unlink business logic itself.

### Step-by-step approach (test-first where practical)
1. **Install dependency**: `npm install @radix-ui/react-select`. Verify
   `npm run build` still succeeds immediately after (catches any peer-dep
   mismatch with React 19 / Next 16 early, before writing component code).
2. **Create `components/ui/select.tsx`** manually (CLI likely blocked per
   CLAUDE.md precedent), following the deterministic shadcn "new-york"
   output shape used by `button.tsx`: `'use client'` first line, wraps
   `@radix-ui/react-select`'s `Root`, `Trigger`, `Value`, `Portal`, `Content`,
   `Viewport`, `Item`, `ItemText`, `ItemIndicator` (checkmark via
   `lucide-react`, already a dependency), `ScrollUpButton`/`ScrollDownButton`.
   Style `Content`/`Item` with the existing `bg-popover`,
   `text-popover-foreground`, `focus:bg-accent`,
   `focus:text-accent-foreground` Tailwind utilities (these map to the
   tokens confirmed above) — do not invent new colors. Set `SelectContent`'s
   `position="popper"` explicitly (shadcn's standard default for
   viewport-anchored placement, rather than leaving it to whatever the
   manually-authored file's implicit default resolves to) — this also gives
   predictable anchoring behavior on narrow/mobile viewports (see step 9).
   Export `Select`,
   `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` (minimum
   surface needed here; omit `SelectGroup`/`SelectLabel`/`SelectSeparator`
   if unused, add later if a future story needs them, per YAGNI — but note
   the shadcn generated file is normally emitted as one deterministic whole,
   so component review should not flag partial-omission as an inconsistency
   as long as unused exports simply aren't included).
3. **Swap the call site** in `components/PeopleTable.tsx` (lines 410–426):
   - `<Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isLoading}>`
   - `<SelectTrigger data-testid={\`pm-link-select-${person.id}\`} aria-label={t('linkPickerLabel')} className="min-h-[44px] ...">` — preserve the exact `data-testid` and `aria-label` values so AC4 needs no selector semantics change, only DOM-shape change (see step 5).
     - Note: Radix `Select.Trigger` already sets `role="combobox"`
       (or listbox trigger semantics per Radix version) and manages
       `aria-expanded`/`aria-controls` automatically; do not manually add
       conflicting ARIA attributes — only `aria-label` needs to be passed
       through explicitly, same as before.
   - `<SelectValue placeholder={t('linkPickerPlaceholder')} />` inside the trigger.
   - `<SelectContent>` containing `unlinkedUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name ?? user.email}</SelectItem>)`.
   - Radix `Select` has no native "disabled placeholder option" concept —
     `SelectValue`'s `placeholder` prop covers the same UX (shown when
     `selectedUserId === ''`); no `<SelectItem value="">` placeholder row is
     needed or wanted (an empty-string `value` is actually invalid in Radix
     Select — it's reserved to mean "no selection").
   - Confirm/Cancel buttons and their `disabled={isLoading || !selectedUserId}` logic are untouched (AC5).
4. **Manual smoke check** (dev server, both themes, mouse + keyboard) before
   touching tests — confirms the swap renders and behaves before investing
   in test rewrites. Include, in this same pass:
   - The empty-`unlinkedUsers` edge case (temporarily link every existing
     user, or seed data so the exclusion pool is empty): open the picker and
     confirm it degrades gracefully — still shows the placeholder, does not
     crash, does not render an empty/broken-looking popup (e.g. a
     zero-height or visibly blank `SelectContent`).
   - A visual check for long `display_name`/email strings inside
     `SelectItem` (e.g. a temporarily long test name) for overflow/clipping
     behavior — confirm it truncates or wraps acceptably rather than
     breaking the popup's layout.
5. **Update `e2e/admin-link-person.spec.ts`** (selector-only changes, per
   AC5's explicit instruction that logic/assertions must not change):
   - Line 196: `.selectOption(secondUser.id)` (native-`<select>`-only API)
     must become an open-trigger + click-item interaction:
     `await row2.getByTestId(...).click(); await page.getByRole('option', { name: secondUser.displayName }).click();`
     (exact locator strategy to be finalized against the real rendered
     `role="option"` text — Radix renders the item's text content as the
     accessible name).
   - Lines 328–335 (picker-exclusion regression test): `option[value="..."]`
     CSS-attribute selector and `select.locator('option').allTextContents()`
     assume native `<option>` DOM. Replace with: open the trigger, then
     assert against `page.getByRole('option', { name: user.displayName })`
     having count 0 (or query all `role="option"` elements' text contents
     within the open `SelectContent` portal). The *intent* (already-linked
     user never appears as a selectable choice) must be preserved exactly —
     only the DOM query mechanism changes, per AC5.
   - No other test in this file touches select internals (AC1/AC2/AC3/AC4/AC6
     tests interact via `pm-link-confirm`/`pm-unlink`/text assertions, not
     the select's internal DOM) — expect no further changes needed there,
     but do a full read-through to confirm during implementation.
6. **Retire/rewrite `e2e/link-picker-color-scheme.spec.ts`**: BUGFIX-04's
   AC1 "element" test (`getComputedStyle(select).colorScheme === 'dark'`)
   was a proxy for "the native popup should render dark" and is no longer
   the right assertion for a non-native popup — it doesn't fail if the
   Radix popup is unreadable, and it doesn't need to pass for this story to
   be correct. Recommendation: **do not delete** this file outright (it
   still correctly documents/tests the CSS mechanism BUGFIX-04 shipped,
   which remains in place per this story's "Out of scope" — `color-scheme`
   is still correct/useful for other native controls). Instead:
   - Keep the static-source tests (AC1/AC2 static: `app/globals.css`
     declares `color-scheme`) and the two "mechanism" tests
     (`getComputedStyle(document.documentElement).colorScheme`) unchanged —
     these test the CSS declaration itself, not the select.
   - **Re-scope (not remove) the two `E2E_WITH_AUTH`-gated tests** inside
     `describe('BUGFIX-04: link picker <select> color-scheme (auth-gated)')`:
     once the picker is a `<button>`-like `SelectTrigger`, not a `<select>`,
     the `getComputedStyle(select).colorScheme === 'dark'` assertion is
     meaningless (the trigger element itself isn't a native popup-bearing
     control anymore) and must be removed from these two tests. The tests
     themselves are not deleted — keep whatever remains of their setup/intent
     (e.g. the AC4-regression assertions described in the next bullet) and
     update the file's header doc comment to state plainly that the
     `colorScheme` proxy assertion is superseded by BUGFIX-05's own
     DOM/CSSOM contrast tests (in the new spec file), which test the
     popup's actual rendered contrast directly instead of proxying via a
     native-control-only CSS property. Follow the existing repo convention
     (see BUGFIX-04's own doc-comment referencing STORY-20) of documenting
     *why* a mechanism changed, not just what changed. Net effect: the
     static/mechanism tests for the CSS declaration itself (kept per the
     bullet above) and the AC4 tap-target/testid/aria-label checks remain in
     this file; only the now-meaningless `colorScheme` assertion on the
     picker element is deleted.
   - The AC4-regression test in that file (44px tap target + testid +
     aria-label on the picker) is still meaningful for a `SelectTrigger` —
     keep it, but confirm `select.boundingBox()` targeting still resolves
     correctly against the trigger element (should, since `data-testid` is
     preserved on `SelectTrigger`).
7. **New spec file** `e2e/link-picker-custom-dropdown.spec.ts` (BUGFIX-05) —
   see Test plan below for full content mapping per AC.
8. Run full quality gate: `npm run lint`, `npx tsc --noEmit`, `npm run
   build`, `npm run test:e2e`.
9. Manual cross-browser spot-check — record results in this story file
   (pass/fail + date) before considering AC1 fully closed:
   - **Desktop**: Windows Chrome/Edge, both themes, per the story's
     Technical notes, since this is the exact platform/browser combination
     that motivated the story.
   - **Mobile (new — this revision)**: Chrome and Safari on a touch device
     (or device emulation if a physical device isn't available), covering
     tap-to-open, tap-to-select, list scroll behavior when the unlinked-user
     list is long enough to scroll, and confirming `SelectContent` is not
     clipped or mis-anchored at narrow viewport widths (e.g. 375px). This
     project treats touch as first-class (44px tap-target convention
     throughout CLAUDE.md; the coordinator user is phone+laptop), so this
     check is mandatory, not optional, alongside the desktop check.

### Test plan (mapped to acceptance criteria)
- **AC1 (dark mode readable, automated)**: New Playwright test —
  force dark theme via `localStorage`/cookie (existing pattern from
  `link-picker-color-scheme.spec.ts`), open the picker (`SelectTrigger`
  click), assert the open `SelectContent`/`SelectItem` elements are present
  in the DOM (`role="listbox"`/`role="option"`), then read
  `getComputedStyle()` on the content/item elements for `background-color`
  and `color`, and assert a WCAG-AA-passing contrast ratio. **Confirmed during
  refinement: no contrast-ratio helper exists anywhere in this repo** —
  `e2e/dark-mode.spec.ts`'s own header comment explicitly states "no
  axe-core/contrast tooling in this repo," and STORY-19's CLAUDE.md note
  describes contrast values being measured *externally* (WebAIM) at
  design-time, not computed in-repo at test-time. The implementer must write
  a small, local WCAG relative-luminance/contrast-ratio function (standard
  formula: relative luminance from sRGB channels, then
  `(L1 + 0.05) / (L2 + 0.05)`) inside the new spec file, parsing the
  `rgb(r, g, b)` strings returned by `getComputedStyle(...).backgroundColor`
  / `.color`. This is new test infrastructure, not a reuse — budget time for
  it and keep it simple/local to this file rather than over-engineering a
  shared util unless a second consumer emerges. This closes the exact
  automation gap BUGFIX-04 could not close (native popup pixels were
  unreachable; Radix's popup is a normal DOM node fully inspectable by
  `getComputedStyle`).
- **AC2 (light mode, no regression)**: Same mechanism as AC1, forced light
  theme, same contrast assertion.
- **AC3 (keyboard nav)**: Automated — click/focus the trigger, press
  `ArrowDown` repeatedly and assert the highlighted item changes (Radix sets
  `data-highlighted` or equivalent on the focused `SelectItem`, and/or
  `aria-activedescendant` on the trigger/listbox — verify Radix's exact
  attribute during implementation and assert against it), press `Enter` and
  assert `selectedUserId`/trigger's displayed value updates to the
  highlighted item, then re-open and press `Escape` and assert the popup
  closes AND the previously-confirmed selection is unchanged (no accidental
  re-selection on Escape).
- **AC4 (testid/aria-label/tap-target preserved)**: Automated regression —
  reuse/adapt the existing AC4 test from `link-picker-color-scheme.spec.ts`
  (boundingBox height >= 44, `data-testid` present, `aria-label` exact-match
  against `messages/pt-PT.json`'s `linkPickerLabel` value) against the new
  `SelectTrigger` element.
- **AC5 (STORY-20 logic unchanged)**: Automated — full existing
  `e2e/admin-link-person.spec.ts` suite passes with only the selector
  updates described in step 5 above (no assertion/logic changes). This is
  the primary regression gate for STORY-20's link/unlink behavior, 409
  error mapping, and the picker-exclusion test.
- **AC6 (screen-reader semantics, WCAG 4.1.2 — exact ARIA contract pinned in
  the AC, not implementer-discovered)**: Two-part verification, both
  mandatory:
  - **Automated**: assert the closed trigger has `role="combobox"` with
    `aria-expanded="false"`, `aria-label` (exact match against
    `messages/pt-PT.json`'s `linkPickerLabel`); assert `aria-expanded`
    flips to `"true"` and `aria-controls` is populated on open; assert the
    opened content has `role="listbox"`; assert each rendered item has
    `role="option"` with `aria-selected` reflecting whether it matches
    `selectedUserId`. Confirm these exact attribute names against installed
    `@radix-ui/react-select@2.3.3`'s rendered output during implementation
    (should match the contract now pinned in AC6, but verify against real
    output rather than assuming) — if a genuine mismatch is found against
    the installed version, treat that as a blocking finding to resolve
    before implementation continues, not a reason to silently loosen the
    assertion.
  - **Manual, mandatory (not optional)**: one screen-reader spot-check
    (VoiceOver or NVDA — document which was used and the date) confirming
    the control announces as a combobox/listbox with its label, options are
    announced when navigated via keyboard, and the selected option's state
    is announced. Record pass/fail + date + tool used in this story file
    before considering AC6 closed. This is the one AC where a battle-tested
    native control's accessibility is being traded for a custom
    implementation, so DOM-attribute assertions alone are not sufficient
    evidence.
- **Manual cross-browser spot-check**: Windows Chrome/Edge (desktop, light +
  dark theme, mouse-driven and keyboard-driven) AND Chrome/Safari on a touch
  device or emulation (mobile, tap-to-open/tap-to-select/scroll/no viewport
  clipping at narrow widths) — record pass/fail + date for both in this
  story file per [[feedback_qa_visual_rendering]] before closing AC1. Also
  covered in this same manual pass (per step 4 above): the empty-
  `unlinkedUsers` edge case degrades gracefully, and long
  `display_name`/email strings in `SelectItem` don't visibly break the
  popup layout.

### Risks and rollback
- **Risk**: Radix `Select`'s exact ARIA attribute names/values may not
  precisely match the Technical notes' description (`aria-activedescendant`
  vs `data-highlighted`, etc.) — mitigate by inspecting real rendered output
  during implementation rather than hardcoding assumptions into tests before
  verifying.
- **Risk**: `value=""` is reserved/invalid in Radix `Select.Item` (unlike
  native `<option value="">`), which changes how the "nothing selected yet"
  state and placeholder are represented — mitigated in the plan above by
  relying on `SelectValue`'s `placeholder` prop instead of an empty-value
  item; must double check `handleLink`'s `disabled={isLoading ||
  !selectedUserId}` guard still behaves identically (it reads
  `selectedUserId === ''` as falsy, unaffected by this Radix constraint).
- **Risk**: Adding a new npm dependency mid-project — confirmed installable
  and buildable in this environment during refinement; verify no peer-dep
  warnings against React 19/Next 16 during actual `npm install` in
  implementation (Radix packages are generally React 19-compatible as of
  2.x, but must be confirmed, not assumed).
- **Risk**: Portal-rendered content (Radix renders `SelectContent` in a
  `Portal` outside the table DOM tree by default) could break
  `row.getByTestId(...)` / `row.locator(...)`-scoped Playwright queries in
  the existing tests, since portal content is not a DOM descendant of `row`.
  Mitigate: either scope portal-content queries to `page` (not `row`) after
  opening the trigger, or set Radix's `Select.Content`'s container prop
  to render inline if that's simpler for this scale of list — evaluate
  during implementation and document the choice.
- **Rollback**: Single-file swap plus one new component file and one new
  dependency; revertible via `git revert` with no data/migration
  implications. No feature flag needed given the low blast radius (one
  admin-only control) and thorough test coverage this plan specifies.

### Complexity tag: **standard**
Justification: multi-file change (component swap + new shared UI primitive +
new dependency + updates across two existing e2e spec files + a new spec
file), requires understanding both STORY-20's existing state/data contract
and a new third-party primitive's (Radix Select) ARIA/keyboard/portal
behavior to avoid regressing accessibility or STORY-20's business logic.
Not `complex` (no auth, data integrity, concurrency, money, or
multi-service interaction — it's a self-contained, admin-only UI control
swap with a well-defined value/onChange contract), but too much
interaction-design and cross-cutting test-rewrite reasoning risk for
`trivial`. (Revision note: cycle-1 challenge review confirmed `standard` is
technically defensible but flagged the accessibility/ARIA-contract surface
for extra review scrutiny at implementation time — that flag stands; no tag
change.)

## Definition of Done
See CLAUDE.md.

---

## QA / Manual verification (implementer's report)

### Fix applied
- Installed the Select primitive via `npx shadcn@latest add select` (worked
  in this environment — CLI was not blocked this time, unlike some prior
  stories). It installed the `radix-ui` unified meta-package (v1.6.2,
  re-exporting `Select` from `@radix-ui/react-select@2.3.3`) rather than
  the standalone `@radix-ui/react-select` package named in this plan —
  current shadcn CLI convention. Functionally identical; noted as a minor,
  intentional deviation from the plan's literal package name, not a scope
  change. `components/ui/select.tsx` is the CLI's deterministic "new-york"
  output, unmodified except for confirming it already matched the plan's
  requirements (`bg-popover`/`text-popover-foreground`/`focus:bg-accent`
  tokens, `position` prop support).
- `components/PeopleTable.tsx`: swapped the native `<select>` for
  `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`
  (`position="popper"` explicit)/`SelectItem`. `selectedUserId`/
  `setSelectedUserId`/`disabled`/`data-testid`/`aria-label`/
  `min-h-[44px]` all preserved unchanged; no `<SelectItem value="">`
  placeholder row (Radix reserves the empty string — `SelectValue`'s
  `placeholder` prop covers it, per the plan's documented risk
  mitigation). No changes to `handleLink`/`cancelLinking`/Confirm-Cancel
  logic.

### Automated tests
- **New**: `e2e/link-picker-custom-dropdown.spec.ts` — CI-safe static-source
  regression test (green) plus five `E2E_WITH_AUTH`-gated tests (AC1 dark
  contrast, AC2 light contrast, AC3 keyboard nav, AC4 tap-target/testid/
  aria-label regression, AC6 automated ARIA contract), written test-first
  and confirmed failing for the right reason (native `<select>` still in
  place) before the component swap, then passing after (CI-safe subset).
  Includes a small local WCAG relative-luminance/contrast-ratio helper (no
  reusable one existed in this repo before this story, confirmed during
  refinement).
- **Updated**: `e2e/admin-link-person.spec.ts` (STORY-20) — `.selectOption()`
  and `option[value=...]`/`.locator('option')` DOM queries replaced with
  trigger-click + `page`-scoped `role="option"` queries (Portal-rendered
  content is not a descendant of the row locator — confirmed and handled
  per the plan's flagged Portal risk). No assertion/logic changes.
- **Updated**: `e2e/link-picker-color-scheme.spec.ts` (BUGFIX-04) —
  doc comment now documents supersession by this story; the
  `getComputedStyle(select).colorScheme === 'dark'` element-level
  assertion (meaningless against a non-`<select>` trigger) is removed; the
  static CSS-declaration tests, the `colorScheme`-mechanism tests, and the
  AC4 tap-target/testid/aria-label regression check are all kept
  unchanged, per the plan's explicit "re-scope, don't delete" instruction.

**Full results**: `npm run lint` (0 errors), `npx tsc --noEmit` (0 errors),
`npm run build` (succeeds), `npm run test:e2e` — 65 CI-safe tests pass
(including the new static-source test and both updated spec files' CI-safe
tests), 91 tests correctly skip (`E2E_WITH_AUTH` not set in this sandbox —
same count-shape as before this story, plus this story's own 5 new gated
tests), 0 failures, no regressions to any pre-existing passing test. (Ran
via the documented WSL2 headless-Chromium `libnspr4`/`libnss3`/
`libasound2t64` workaround from CLAUDE.md — this sandbox's Chromium had the
same missing-shared-library issue on first run; resolved with the
documented `apt-get download` + `dpkg -x` + `LD_LIBRARY_PATH` steps, no
root required.)

### Verification performed without a live authenticated admin session
This sandbox cannot reach `/pt-PT/admin/people` (or any non-`/login`,
non-`/auth` route — `proxy.ts` guards **every** route, not just
`/admin/*`) without a real Google OAuth session, which requires interactive
browser-based login this environment cannot perform. Per this project's
established discipline (see BUGFIX-04's own QA section and this session's
explicit operating constraints), the `SUPABASE_SERVICE_ROLE_KEY` present in
`.env.local` must not be used to mint or work around an authenticated
session — confirmed in practice: an attempted **read-only** service-role
query (just to check whether any people/user fixture rows already existed,
with no intent to mutate anything) was proactively blocked by this
environment's own permission system as "credential exploration to bypass
authorized access," which is the correct outcome and this report treats it
as such, not as an obstacle to work around.

Given that constraint, the following were done instead, all without
touching the live database or any auth mechanism:

1. **Radix `Select` source inspection** (`node_modules/@radix-ui/react-select/dist/index.mjs`,
   the actual installed v2.3.3, not documentation) — confirmed the AC6 ARIA
   contract directly against the real implementation:
   - Trigger: `role="combobox"`, `aria-controls` (set to the content's id
     only when open, `undefined` otherwise), `aria-expanded`,
     `aria-autocomplete="none"` (lines ~190–194).
   - Content: `role="listbox"` with `id={context.contentId}` (line ~489),
     shared by both `position="popper"` and `position="item-aligned"` — the
     `position="popper"` choice this story makes does not change the ARIA
     contract.
   - Item: `role="option"`, and — genuinely worth flagging, since the plan
     explicitly asked for this to be checked rather than assumed —
     `aria-selected` is computed as `isSelected && isFocused` (line 874),
     not simply `isSelected`. Radix auto-focuses the item matching the
     current value when the content opens, so `aria-selected` is still
     observably `"true"` for the matching item immediately after opening
     (which is what the new spec's AC6 test asserts and what a
     screen-reader user encounters on open) — but it will read `"false"`
     again the instant keyboard focus moves elsewhere before a new
     selection is committed. This is real, verified Radix behavior, not a
     mismatch to "fix" — the AC's wording ("aria-selected reflecting
     whether that item matches the current selectedUserId") holds at the
     moment of inspection this story's test exercises. Documented here so
     a future reader investigating a similar design ambiguity applies the
     same source-level rigor next time, per the plan's instruction.

2. **Direct SSR-markup check of the real compiled component** (not
   Playwright, not the dev server — `react-dom/server`'s
   `renderToStaticMarkup` invoked via `npx tsx` against a throwaway,
   never-committed script that imported the actual
   `components/ui/select.tsx` and rendered the exact
   `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` tree
   used in `PeopleTable.tsx`, with the same `data-testid`/`aria-label`
   values): confirmed the closed trigger's real rendered markup is
   `<button type="button" role="combobox" aria-expanded="false"
   aria-autocomplete="none" ... data-testid="pm-link-select-test"
   aria-label="Escolher conta a ligar" class="... min-h-[44px] ...">` —
   i.e., the AC4/AC6 closed-state contract is genuinely present in the
   actual component's output, not just in the source code's intent. The
   throwaway script and its output were not committed; deleted immediately
   after (`git status` confirmed clean before continuing).
3. **Design-time WCAG contrast computation of the actual shipped CSS token
   values** (mirrors STORY-19's precedent of computing/measuring real
   contrast rather than eyeballing it) — extracted the exact `--popover`/
   `--popover-foreground` (resting `SelectItem` state) and `--accent`/
   `--accent-foreground` (focused/highlighted `SelectItem` state) HSL
   values from `app/globals.css` for both `:root` and `.dark`, converted to
   RGB, and ran them through the same relative-luminance/contrast-ratio
   formula used in the new e2e spec's helper (in a throwaway, never-committed
   Node script — deleted after use):
   | Theme | Resting item (popover-fg on popover) | Highlighted item (accent-fg on accent) |
   |---|---|---|
   | Light | 19.90 : 1 | 16.13 : 1 |
   | Dark  | 19.05 : 1 | 14.25 : 1 |

   All four combinations clear the WCAG AA normal-text threshold (4.5:1) by
   a wide margin — strong design-time evidence that AC1/AC2's live
   render will pass the new spec's contrast assertions. This is not a
   substitute for the live-render test (font antialiasing, browser
   rendering quirks, and the genuine cross-platform popup-rendering gap
   this story exists to fix cannot be ruled out by a CSS-token calculation
   alone — which is exactly why this bug slipped past BUGFIX-04's
   otherwise-thorough verification), but it is real, honest evidence, not
   a guess.

### Not performed — explicit gaps, require a human with real credentials/devices
The following require either a live authenticated admin session (Google
OAuth, unavailable in this sandbox) or physical/platform access this
sandbox does not have. None of these were fabricated or approximated —
they are listed here exactly as open per this project's
`feedback_qa_visual_rendering` and credential-handling discipline:

1. **All five new `E2E_WITH_AUTH`-gated tests** in
   `e2e/link-picker-custom-dropdown.spec.ts` (AC1 live dark-mode contrast,
   AC2 live light-mode contrast, AC3 live keyboard-nav interaction, AC4
   live tap-target/testid/aria-label regression, AC6 live automated ARIA
   contract) — structurally complete and confirmed correct by static
   analysis/type-checking, but not executed end-to-end against a real
   rendered `/pt-PT/admin/people` page.
2. **`e2e/admin-link-person.spec.ts`'s updated `E2E_WITH_AUTH`-gated tests**
   (AC1's UI-reflection step and the picker-exclusion test, both updated
   for the new DOM shape in this story) — not re-run against a live
   session; the DOM-query updates were validated by code review and by the
   SSR-markup check above (confirms the queried attributes/roles exist),
   not by an actual Playwright run against the live picker.
3. **Windows Chrome/Edge desktop spot-check, light + dark mode** — the
   exact platform/browser combination that motivated this story. Not
   available in this Linux sandbox. **This is the single most important
   unperformed check**, since this story exists specifically because
   BUGFIX-04's fix looked correct everywhere it was checked except this
   platform.
4. **Mobile Chrome/Safari touch spot-check at 375px** (tap-to-open,
   tap-to-select, scroll, no `SelectContent` clipping) — no physical or
   emulated touch device driven interactively in this sandbox.
5. **Empty-`unlinkedUsers` graceful-degradation check** — requires either
   live data (every user already linked) or interactive DB seeding through
   the authenticated app, neither available here.
6. **Long `display_name`/email overflow check inside `SelectItem`** —
   same constraint; the SSR-markup check above used a deliberately long
   name/email string and the resulting markup did not error or produce
   obviously broken output, but this is not equivalent to visually
   confirming truncation/wrapping behavior in a real rendered popup.
7. **Screen-reader spot-check (VoiceOver or NVDA)** — mandatory per AC6,
   explicitly "not optional/skippable" per the plan. No screen reader
   available in this sandbox. **Not performed. This must be done by a
   human before AC6 can be considered fully closed**, per the plan's own
   wording.

### Action needed
A human (or a developer machine with `.env.local` + `E2E_WITH_AUTH=1` +
a real Google-OAuth-provisioned admin account, plus a Windows machine with
Chrome/Edge, a touch device or device emulator, and VoiceOver/NVDA) must,
before this story is considered fully closed per CLAUDE.md's AC-coverage
rule:
1. Run `E2E_WITH_AUTH=1 npm run test:e2e` and confirm the five new
   `link-picker-custom-dropdown.spec.ts` tests and the updated
   `admin-link-person.spec.ts`/`link-picker-color-scheme.spec.ts` tests all
   pass.
2. Perform the Windows Chrome/Edge, mobile touch, empty-list,
   long-name-overflow, and screen-reader checks listed above, and record
   pass/fail + date + tool used (for the screen-reader check) in this
   section.
