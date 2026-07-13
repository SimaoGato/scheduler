# BUGFIX-04: Link-account `<select>` picker is unreadable in dark mode until hovered
Status: done ✅
PR: 39
Related story: STORY-20 (introduced the "Ligar conta" picker in `components/PeopleTable.tsx`)
Epic: EPIC-02

## Bug
On `/admin/equipa` (Equipa/people admin screen), clicking "Ligar conta" opens
an inline `<select>` picker of unlinked users. In dark mode (the app's
default per CHORE-11's class-driven `.dark` toggle), the dropdown's option
list renders with almost no contrast — confirmed via screenshot: the
placeholder row ("Selecionar utilizador") is faintly legible, but the actual
user option below it ("Simão Gato") is rendered as near-white text on a
near-white background and is effectively unreadable unless the mouse is
hovering over that specific row (hover applies the OS's native highlight
color, which happens to restore contrast). A user relying on keyboard
navigation (arrow keys, no mouse) would see the same low-contrast rendering
with no way to "hover" it into readability.

## Cause (to be confirmed by implementer)
`components/PeopleTable.tsx` (STORY-20, around line 410) renders:
```
<select
  ...
  className="min-h-[44px] rounded-md border px-2 text-sm"
>
```
with no explicit background/text color utility classes and no `dark:`
variants. This is the **first `<select>` element in the codebase**
(confirmed via `grep -rn "<select" --include=*.tsx .` — only this one
match). Every other themed surface in the app is a `div`/`button`/`input`
styled entirely through Tailwind's CSS-variable-driven tokens
(`bg-background`, `text-foreground`, etc. — see CHORE-11), which work
because the app controls their rendering directly.

A native `<select>`'s *closed* control inherits ordinary CSS (text/background
color), but its *open dropdown popup* (the list of `<option>`s) is rendered
by the browser/OS using its own native widget theme, governed by the CSS
`color-scheme` property — not by inherited `color`/`background-color`
alone. This project's `globals.css` (`app/globals.css`) sets CSS custom
properties for `.dark` but never sets `color-scheme: dark` (confirmed via
`grep -rn "color-scheme"` — no matches anywhere in the codebase). Without
it, the browser defaults the native popup to a light color-scheme
regardless of the app's `.dark` class, while the `<select>`'s inherited
`color` (near-white, from `--foreground` in dark mode) is still applied to
the option text — producing near-white text on the browser's default
white/light popup background. The hover state is only "readable" because
the OS applies its own highlight (usually a blue/gray selection background)
that happens to contrast with the white text.

## Acceptance criteria
1. Given dark mode is active, when the "Ligar conta" `<select>` picker is
   opened, then every option (including the placeholder and all listed
   users) is clearly readable without hovering or clicking — verified by
   contrast-checking the rendered option text/background in a headless
   Chromium screenshot or computed-style check.
2. Given light mode is active, when the same picker is opened, then options
   remain readable (no regression to the light-mode case).
3. Given the fix, when checked via keyboard-only navigation (arrow keys to
   move through options, no mouse), then the currently-focused option is
   distinguishable from the rest without relying on a mouse-hover-only
   affordance.
4. Given the fix, when applied, then it does not regress the existing
   `min-h-[44px]` tap target or the existing `pm-link-select-{id}`
   `data-testid`/`aria-label` wiring from STORY-20.

## Out of scope
- Redesigning the picker away from a native `<select>` to a custom
  listbox/combobox component — keep the existing native-`<select>`
  structure; this is a contrast/theming fix, not a redesign.
- Redesigning or changing the markup of any other native form control in
  the app (e.g. `ClaimPersonForm.tsx`'s radio buttons) — the fix itself is
  still scoped to a two-line, single-file CSS change; no other component's
  code changes. Note that because `color-scheme` is inherited from
  `:root`/`.dark`, other native controls' *visual appearance* will still be
  affected app-wide as a side effect — see the Implementation Plan's
  Affected areas / Risks for the confirmed full blast radius (grep across
  all native `<input type>` values, not just `<select>`) and the required
  manual spot-check. That accounting is in-scope for this story even though
  no code changes to those components are.
- The STORY-20 link/unlink business logic (guard clauses, race-safety,
  error mapping) — unaffected, out of scope.

## Technical notes
- Likely fix: add `color-scheme: light dark;` (or theme-conditional
  `color-scheme: dark`/`light`) so the browser's native popup rendering
  tracks the app's actual theme. This can be set globally in
  `app/globals.css` (e.g. `:root { color-scheme: light dark; }` or gated by
  the existing `.dark` class selector, consistent with CHORE-11's
  class-driven — not media-query-driven — dark mode strategy: `.dark {
  color-scheme: dark; }` and a light equivalent) rather than only on the
  `<select>` element, since `color-scheme` is inherited and this is the
  simplest fix if/when more native controls (`<input type="date">`,
  scrollbars, etc.) are added later.
- Verify the fix by actually rendering the dropdown open in a headless
  browser and sampling pixel/computed style — per
  [[feedback_qa_visual_rendering]], do not rely on structural/DOM checks
  alone; this exact bug (JSX/logic correct, visual output broken) is the
  same class of gap documented in BUGFIX-03.
- Since Playwright cannot easily open a native `<select>` popup's rendered
  option list (it's OS-native, outside the DOM/CSSOM in most browsers), an
  automated pixel-level regression test may not be feasible. If so, verify
  manually (screenshot before/after in both themes) and document the
  manual verification step in the story per CLAUDE.md's AC-coverage rule
  ("every acceptance criterion has at least one automated test or a
  documented manual verification step").
- Re-check contrast in both themes after the fix, following STORY-19's
  precedent of verifying actual computed contrast rather than guessing.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Exploration findings (confirming the cause analysis)
- `app/globals.css` has exactly one `:root { ... }` block and one
  `.dark { ... }` block (from CHORE-01/CHORE-11), both defining HSL custom
  properties only — no `color-scheme` declaration anywhere in either block,
  or anywhere else in the file. Confirmed via direct read of the file.
- `@custom-variant dark (&:is(.dark *));` (CHORE-11) is present immediately
  after `@import "tailwindcss";`, confirming the class-driven (not
  media-query-driven) dark mode strategy the fix must stay consistent with.
- `grep -rn "<select" --include=*.tsx .` returns exactly one match:
  `components/PeopleTable.tsx:410`, confirmed to be the "Ligar conta" picker
  with `data-testid={\`pm-link-select-${person.id}\`}`,
  `aria-label={t('linkPickerLabel')}`, and
  `className="min-h-[44px] rounded-md border px-2 text-sm"` — no
  background/text color utilities, no `dark:` variants, matching the story's
  cause analysis exactly.
- `grep -rn "color-scheme"` across the repo returns zero matches in app
  source; the only hits are in `e2e/dark-mode.spec.ts`, which checks for
  `prefers-color-scheme` media queries in *compiled* CSS (a different,
  unrelated concept — CHORE-11's own dark-mode toggle mechanism, not this
  bug). Confirms the story's claim that `color-scheme` is never set.
- **Revision (cycle 1): broader native-control grep.** `color-scheme` is a
  root-scoped, *inherited* CSS property — it governs native widget painting
  (radio/checkbox rings, date/range/color pickers, scrollbars) for **every**
  native form control on the page, not just `<select>`. The original pass
  only ran `grep -rn "<select"`, which cannot surface this. Re-ran across all
  `type=` values and all bare `<input>` elements:
  ```
  grep -rn 'type="[a-z]*"' --include=*.tsx . | grep -iE 'type="(radio|checkbox|date|range|color|time|datetime|month|week|search|number|file)"'
    components/ClaimPersonForm.tsx:107:                type="radio"
    components/PersonSkillsEditor.tsx:130:                      type="radio"
    components/PersonSkillsEditor.tsx:147:                        type="radio"

  grep -rn "<input" --include=*.tsx .
    components/DisplayNameForm.tsx:89   (type="text")
    components/PersonSkillsEditor.tsx:129, 146   (type="radio", both above)
    components/ClaimPersonForm.tsx:106   (type="radio", above)
    components/RoleTable.tsx:213, 223, 282, 299   (all type="text")
    components/PeopleTable.tsx:275, 340   (all type="text")
  ```
  True full blast radius of `color-scheme`: **3 native `type="radio"`
  inputs**, plus several `type="text"` inputs (text inputs have no
  browser-painted widget chrome beyond caret/scrollbar, so they carry
  negligible visual risk and are not called out further) and OS scrollbars
  (already flagged in Risks).
  - `components/PersonSkillsEditor.tsx:129-154` — two `type="radio"` inputs
    per role, both `className="sr-only"` (visually hidden; the visible
    affordance is the sibling `<label>`'s `has-[:checked]:` Tailwind
    styling, not native widget painting). **Confirmed out of scope** —
    correctly, but only by explicitly checking the className this time, not
    by luck as in the original pass.
  - `components/ClaimPersonForm.tsx:106-113` — **one `type="radio"` input
    per listed person, NOT `sr-only`** (no `className` at all on the
    `<input>`; the browser renders its native radio ring/dot directly,
    inside a `<label>` with only layout/hover utilities
    `flex min-h-[44px] items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent`).
    This is the self-service Claim-account flow. Tailwind Preflight resets
    `background-color`/`color`/`appearance` baseline properties on native
    controls but does **not** neutralize `color-scheme`-driven native widget
    painting — that is an orthogonal browser rendering channel. This radio's
    ring/dot appearance **will** change once `color-scheme: dark` cascades
    from `.dark` down to this element. It was never accounted for in the
    original plan's affected-areas, risk analysis, or verification
    checklist — now added below (Affected areas, Risks, Test plan).
- The cause analysis and suggested fix in the story are accurate and
  sufficient to implement directly; no design ambiguity found beyond the
  broadened blast-radius accounting above.

### Affected areas
- **Frontend/UX (CSS only)** — `app/globals.css`. No backend, data, auth, or
  infra changes. `components/PeopleTable.tsx` itself needs no edits: because
  `color-scheme` is an inherited CSS property, setting it on `:root`/`.dark`
  (the same layer that already owns every other themed CSS custom property)
  cascades down to the `<select>` automatically — there is no Tailwind
  utility class needed on the element itself.
- **Cross-cutting UX impact (no code change, but must be verified)** —
  because `color-scheme` is inherited from `:root`/`.dark`, it also cascades
  to `components/ClaimPersonForm.tsx`'s visible `type="radio"` inputs
  (lines 106-113, self-service Claim-account flow) and, harmlessly, to
  `components/PersonSkillsEditor.tsx`'s `sr-only` `type="radio"` inputs
  (lines 129-154, invisible so no visual risk) and to OS-rendered
  scrollbars app-wide. `ClaimPersonForm.tsx` requires no code change — the
  fix is still a two-line, single-file CSS addition — but its radio
  buttons' native ring/dot appearance **will change** app-wide the moment
  the CSS change lands, and must be explicitly spot-checked in both themes
  as part of this story's manual verification (see Test plan), not assumed
  fine.

### Step-by-step approach
1. In `app/globals.css`, add `color-scheme: light;` inside the existing
   `:root { ... }` block (alongside the other custom properties).
2. Add `color-scheme: dark;` inside the existing `.dark { ... }` block.
3. Do **not** use the shorthand `color-scheme: light dark;` on `:root`
   alone as the only declaration. That form tells the browser "either
   scheme is supported, pick based on the OS/browser's own preference" —
   which would re-couple native popup theming to `prefers-color-scheme`,
   the exact media-query-driven behavior CHORE-11 deliberately moved away
   from (a user who explicitly picks "Escuro" in Settings while their OS is
   in light mode — CHORE-11 AC3 — would regress back to a light popup).
   Explicit per-class values (`:root { color-scheme: light }` /
   `.dark { color-scheme: dark }`) keep native-widget theming tied to the
   same `.dark` class signal that drives every other themed surface,
   consistent with CHORE-11.
4. Run `npm run build` and diff `.next/static/chunks/*.css` (Turbopack
   output location, per CLAUDE.md) to confirm `color-scheme` appears in the
   compiled `:root`/`.dark` rules as expected.
5. Run the automated checks below, then perform the manual visual
   verification pass (required — see Test plan) before marking done.

### Test plan (mapped to acceptance criteria)

New spec file: `e2e/link-picker-color-scheme.spec.ts` (naming follows the
project's descriptive, feature-named convention — see existing files like
`people-table-alignment.spec.ts`). Reuses the minimal `createPerson`/
`deletePerson`/`uniqueSuffix` fixture-helper pattern from
`e2e/admin-link-person.spec.ts`, duplicated locally per this project's
established convention of self-contained spec files (each bugfix/story spec
owns its fixture helpers rather than importing from another spec file).

- **AC1** (dark mode: every option readable without hovering):
  - *Automated, CI-safe, no auth* — static-source guard: read
    `app/globals.css` and assert (via a regex scoped to the `.dark { ... }`
    block, brace-balanced like the existing `extractPrefersColorSchemeDarkBlocks`
    helper in `e2e/dark-mode.spec.ts`, not a naive substring match) that
    `color-scheme: dark;` is present inside `.dark { ... }`.
  - *Automated, CI-safe, no auth* — mechanism check: 
    `browser.newContext({ colorScheme: 'dark' })` + `page.goto('/pt-PT/login')`
    (mirrors `e2e/dark-mode.spec.ts`'s AC2 pattern, which confirms `.dark` is
    applied under OS dark preference), then
    `page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)`
    and assert it equals `'dark'`.
  - *Automated, E2E_WITH_AUTH-gated* — element-level check: navigate to
    `/pt-PT/admin/people` with dark theme forced (reuse the
    `localStorage.setItem('theme', 'dark')` init-script pattern from
    `e2e/dark-mode.spec.ts`), create a fixture person, click "Ligar conta",
    locate `pm-link-select-{id}`, and assert
    `getComputedStyle(select).colorScheme === 'dark'`. This is the closest
    automatable proxy to "this exact element's native popup renders dark" —
    Playwright/Chromium does not expose the OS-native `<option>` popup's
    rendered pixels to the DOM/CSSOM (confirmed limitation, matches the
    story's own Technical notes), so computed-style on the element is the
    ceiling of automated coverage here.
  - *Manual verification (required — pixel truth is not automatable)*: open
    `/pt-PT/admin/people` in a real browser, switch to dark mode (Settings →
    Escuro), click "Ligar conta" on any person row, open the native
    dropdown (click the closed control), and visually confirm every option
    (the placeholder "Selecionar utilizador" and all listed users) is
    clearly readable without hovering. Take a screenshot before and after
    the fix as evidence, per the `feedback_qa_visual_rendering` lesson (do
    not rely on structural/DOM checks alone for a visual-rendering bug).
    Sample the option-row background/text pixel colors from the screenshot
    (e.g. via a quick color-picker/eyedropper on the captured PNG, or a
    small Node script using a PNG-decoding lib) and compute the WCAG
    contrast ratio, confirming it meets the 4.5:1 AA threshold — consistent
    with STORY-19's precedent of measuring actual contrast rather than
    eyeballing it, rather than a purely subjective "looks readable" call.
- **AC2** (light mode: no regression):
  - *Automated, CI-safe* — same static-source guard also asserts
    `color-scheme: light;` is present inside `:root { ... }`.
  - *Automated, CI-safe* — `browser.newContext({ colorScheme: 'light' })`
    variant of the mechanism check above, asserting `getComputedStyle(...).colorScheme === 'light'`.
  - *Manual*: repeat the AC1 manual steps in light mode; confirm the picker
    still reads correctly (this path already worked pre-fix — screenshot for
    before/after parity, catching any accidental light-mode regression from
    the new `:root` declaration).
- **AC3** (keyboard-only navigation: focused option distinguishable):
  - Not automatable — the native popup's focus/highlight rendering during
    ArrowUp/ArrowDown navigation is OS-level chrome outside Playwright's
    reach, same limitation as AC1's pixel truth.
  - *Manual verification (required)*: with the dropdown open in dark mode,
    press ArrowDown/ArrowUp without touching the mouse; confirm the
    currently-highlighted option is visually distinguishable from the
    others. Do not assume this is automatically fixed as a side effect of
    AC1 — verify it explicitly, since keyboard-focus highlighting and
    mouse-hover highlighting can theoretically use different native
    rendering paths depending on browser/OS.
- **AC4** (no regression to tap target / testid / aria-label wiring):
  - *Automated, E2E_WITH_AUTH-gated*, same new spec file: after opening the
    picker, call `await expect(select).toBeVisible()` then
    `boundingBox()` and assert `height >= 44` (per the project's
    `boundingBox()` guard convention); assert
    `data-testid="pm-link-select-{id}"` resolves (already implicit via the
    locator) and `aria-label` equals the `linkPickerLabel` string from
    `messages/pt-PT.json` (extracted at test-write time, not guessed, per
    the button-text-extraction discipline documented in CLAUDE.md).
  - Fully automatable; no manual step needed for this AC.
- **Cross-cutting spot-check (not tied to a single AC, risk-driven — see
  Affected areas)**:
  - *Manual verification (required)*: navigate to the self-service Claim
    flow (`/pt-PT/claim`, rendered by `app/[locale]/claim/page.tsx`, which
    mounts `ClaimPersonForm` — confirmed via source read) in **both** light
    and dark mode, and visually confirm `ClaimPersonForm.tsx`'s native radio
    buttons
    (the person-selection list) are still clearly visible and legible
    against their `<label>` background in both themes — not washed out,
    not invisible, not low-contrast. Screenshot both themes as before/after
    evidence, same discipline as the AC1/AC2 manual steps.
  - `components/PersonSkillsEditor.tsx`'s radios are `sr-only` (confirmed
    via source read, see Exploration findings) — no visual verification
    needed there; their visible affordance is the sibling `<label>`'s
    `has-[:checked]:` Tailwind classes, which are unaffected by
    `color-scheme`.

### Risks and rollback
- **Risk**: low, not negligible. `color-scheme` is a rendering hint for
  native UA chrome (form control popups, scrollbars, radio/checkbox
  ring-and-dot painting, etc.) — it does not affect the box model, layout,
  or any app-controlled `background-color`/`color` utility, which remain
  authoritative everywhere else in the app. However, it is a **root-scoped,
  inherited property**, so its actual blast radius is every native form
  control in the tree, not just the `<select>` this bug report is about.
  The broadened grep (see Exploration findings) found one additional
  visible native control affected: `components/ClaimPersonForm.tsx`'s
  `type="radio"` inputs (self-service Claim-account flow, lines 106-113,
  not `sr-only`). Their native ring/dot rendering will change in dark mode
  once this fix lands. This is very likely a *desirable* side effect (dark
  radios on a dark-mode page, versus today's un-themed light-scheme radios)
  but it is a real, in-scope visual change that must be spot-checked, not
  assumed — see the cross-cutting manual verification step above.
- **Secondary check during manual verification**: `color-scheme: dark` can
  also retint other native browser chrome (e.g. scrollbars) app-wide. Do a
  quick spot-check of scrollbar appearance on a long page in both themes
  while doing the manual pass above, just to be safe.
- **Rollback**: revert the two-line CSS addition in `app/globals.css`. No
  schema, API, or data changes are involved, so rollback is a trivial single
  git revert with no follow-up cleanup.

### Complexity tag
**standard** (revised from `trivial` in cycle 1). The *mechanical* size of
the diff is still tiny — a two-line, single-file CSS addition
(`color-scheme: light;` / `color-scheme: dark;` inside the existing
`:root`/`.dark` blocks in `app/globals.css`) with zero auth, data,
concurrency, security, or multi-module code surface area. What changed the
classification is not the diff size but the **reasoning risk**: this is a
root-scoped, inherited CSS property change, so its actual blast radius
(every native form control app-wide, confirmed via the broadened grep
above to include `ClaimPersonForm.tsx`'s visible radios) is *not* apparent
from the one file being edited. The original `trivial` pass under-scoped
this exact risk by grepping only for `<select>` and concluding "no other
native form controls exist" — a plausible-looking but incomplete
investigation that a cost-optimized implementer (Haiku, per CLAUDE.md's
`implementer-light` routing for `trivial`) is more likely to repeat, since
the fix itself compiles and looks correct in isolation while silently
missing a real visual side effect elsewhere in the app. Routing this story
to the standard implementer model (Sonnet) matches CLAUDE.md's own
complexity guidance: "when in doubt, do NOT mark it `trivial`," and this
cross-cutting-surface miss is precisely the kind of gap the guidance is
meant to catch. The manual-verification steps this plan now specifies
(scrollbar spot-check, `ClaimPersonForm.tsx` radio spot-check in both
themes, contrast-ratio sampling) must actually be carried out by the
implementer, not skipped — worth the extra reasoning budget of the
standard-tier model.

### Blocking questions
None. The cause analysis and suggested fix in the story file are accurate
and sufficient to implement directly with no material ambiguity. (Revision
cycle 1 addressed the challenger's critical finding — incomplete blast-radius
analysis of the inherited `color-scheme` property — via a broadened grep,
updated Affected areas/Risks/Test plan, and a complexity re-classification;
no new open questions resulted from that fix.)

---

## QA / Manual verification (implementer's report)

### Fix applied
`app/globals.css`: added `color-scheme: light;` inside `:root { ... }` and
`color-scheme: dark;` inside `.dark { ... }`, exactly as specified (per-class
values, not the `light dark` shorthand). No changes to
`components/PeopleTable.tsx` or `components/ClaimPersonForm.tsx`. Confirmed
post-`npm run build` that the compiled Turbopack CSS output
(`.next/static/chunks/*.css`) contains both `color-scheme:dark` and
`color-scheme:light`.

### Runtime investigation note (does not change the fix, documented for
future readers)
While building the automated "mechanism check" test, direct headless-browser
investigation showed that `next-themes` (configured with `enableColorScheme`
default-on via `attribute="class"`) already sets an inline
`style="color-scheme: dark|light"` on `<html>` client-side, independent of
this project's own CSS. In isolation this made it look like the CSS fix
might be redundant. Further testing showed it is **not** redundant: this
inline style is only applied by next-themes' JS (blocking pre-hydration
script or the post-mount effect) — it is not present in the raw SSR HTML.
Per CHORE-13, this repo's `.dark` class itself *is* rendered server-side from
a cookie (so the `.dark` class is already correct at first paint), but
without this fix's CSS-level `color-scheme` declaration there is a real
window — before next-themes' script/effect runs, and potentially during a
same-route-group soft navigation where next-themes' effect does not
necessarily re-fire even though the SSR'd `<html>` class was recomputed
(the exact class of bug CHORE-13 fixed for the `.dark` class itself) — where
`.dark`'s background/foreground custom properties are already active but
`color-scheme` is not, reproducing this exact bug. The CSS declaration is
authoritative immediately at SSR paint time, closing that gap without any
JS-timing dependency. A comment explaining this was added at the fix site in
`app/globals.css`.

### Automated tests (`e2e/link-picker-color-scheme.spec.ts`)
All CI-safe (no-auth) tests written first, confirmed red (failing for the
right reason) before the fix, then green after:
- **AC1/AC2 static-source guard** — brace-balanced regex confirms
  `color-scheme: dark;` inside `.dark { ... }` and `color-scheme: light;`
  inside `:root { ... }` in `app/globals.css`, and that neither block uses
  the disallowed `light dark` shorthand. **Failed before the fix** (real
  red), **passed after**.
- **AC1/AC2 mechanism check** — `browser.newContext({ colorScheme })` +
  `page.goto('/pt-PT/login')` + `getComputedStyle(document.documentElement).colorScheme`
  resolves to `'dark'`/`'light'` respectively. This test already passed
  before the fix too (see runtime investigation note above — next-themes'
  own inline style covers the full-navigation case Playwright's `page.goto`
  exercises), so it is not a true red/green pair, but it remains valid
  regression coverage per the approved plan and continues to pass after the
  fix.
- **AC1 (element-level) and AC4 (regression)** — `E2E_WITH_AUTH`-gated,
  written per the plan; not run in this environment (see gap below), but
  structurally complete and will run automatically once `E2E_WITH_AUTH=1` is
  set with real credentials.

Full results: `npm run lint` (0 errors), `npx tsc --noEmit` (0 errors),
`npm run build` (succeeds, compiled CSS confirmed), `npm run test:e2e`
(new spec's 3 CI-safe tests pass; 2 `E2E_WITH_AUTH`-gated tests in the new
spec correctly skip). The rest of the pre-existing smoke suite shows the
same 2-5 flaky pre-existing failures (`button-cursor.spec.ts` AC1 Google
button cursor, `dark-theme-locale-flash.spec.ts` cookie Secure-attribute
check — fails over plain `http://localhost`, `login-page-shell.spec.ts` AC3
centering) on **both** the pre-fix baseline and the post-fix branch,
confirmed by running the same subset against `main` before applying the CSS
change — these are unrelated to this bugfix and out of scope. Also observed
(and equally pre-existing/unrelated on both baseline and branch): the
"Continuar com Google" button on `/pt-PT/login` renders as a bare unstyled
native `<button>` rather than the shadcn-styled button in a plain headless
run, most likely a client-hydration issue unrelated to `color-scheme`; not
investigated further as it is out of this bugfix's scope.

### Manual verification — what was actually done vs. the honest gap
Per this project's `feedback_qa_visual_rendering` lesson, structural checks
alone are not sufficient for a visual-rendering bug, and per
`feedback_branch_and_pr_discipline`/permission policy, credentials/sessions
must not be fabricated. Here is the honest split:

**Actually performed** (real headless-Chromium rendering, not just static
analysis):
- Started the production build (`npm start`) and, using a real Chromium
  instance, screenshotted `/pt-PT/login` (the only page reachable without
  authentication) in both a forced dark `colorScheme` context and a forced
  light `colorScheme` context. Both render correctly with no regression —
  dark-mode background/text/button contrast is intact, light mode is
  unaffected. (`/pt-PT/login` has no native `<select>` or visible
  `type="radio"` input, so this does not exercise AC1/AC2/AC3 pixel-level
  option-list readability directly, but it does confirm the CSS change
  introduces no global visual regression.)
- Directly verified, via a minimal headless-Chromium script rendering a bare
  `<html style="color-scheme: dark"><select><option>...` document, that a
  `<select>` element genuinely inherits `color-scheme: dark` from an
  ancestor when the property is set — confirming the CSS inheritance
  mechanism this fix relies on is sound in this project's actual Chromium
  version, not just assumed from spec reading.
- Confirmed the compiled production CSS contains both declarations in the
  correct blocks (see "Fix applied" above).

**Not performed — explicit gap, requires a human with real credentials**:
- AC1: opening the real "Ligar conta" `<select>` popup on
  `/pt-PT/admin/people` in dark mode and visually confirming every option
  (placeholder + listed users) is readable without hovering, plus
  screenshot + WCAG contrast-ratio sampling of the actual native popup
  pixels.
- AC2: same, light mode, before/after parity.
- AC3: keyboard-only (arrow key) focused-option distinguishability check on
  the real native popup.
- Cross-cutting spot-check: `components/ClaimPersonForm.tsx`'s visible
  native radio buttons on `/pt-PT/claim`, in both themes.
- Scrollbar secondary spot-check on a long authenticated page in both
  themes.

These all require a live Supabase session reached via real Google OAuth
(this sandboxed environment has network access to the project's real
Supabase instance and its service-role key, but the agent's operating
policy correctly declined to use the service-role key to mint a new admin
user/session as a workaround — that would be an unauthorized privilege
grant, not a legitimate test fixture, since it writes a real `role: 'admin'`
row to the live `public.users` table with no cleanup path exercised here).
**Action needed**: a human (or an `E2E_WITH_AUTH=1` run from a developer
machine with `.env.local` + a real Google account already provisioned as
admin) must complete the AC1/AC2/AC3 and `ClaimPersonForm.tsx` manual
verification steps above before this story is marked fully Done per
CLAUDE.md's AC-coverage rule. The automated `E2E_WITH_AUTH`-gated tests in
`e2e/link-picker-color-scheme.spec.ts` (AC1 element-level, AC4 regression)
should also be run at that time (`E2E_WITH_AUTH=1 npm run test:e2e`).
