# STORY-26: Member views upcoming Sundays and blocks/unblocks with one tap
Epic: EPIC-03
Status: draft

## User story
As a Member, I want to see the upcoming Sundays and block or unblock any of
them with one tap on my phone, so that I'm never scheduled on a date I can't
serve — in under a minute, with no manual.

## Context
This is the only feature most Members ever touch (EPIC-03 "Why it matters";
PRD §5 step 2, §7 usability: "a volunteer can block a date in < 1 minute").
It consumes the STORY-25 API. Default state is **available**; blocking is the
explicit action. Mobile-first: the epic calls for fast, obvious, low-friction
UX at phone sizes. Note: this is the first Member-facing navigation item —
`AppNav` currently returns `null` for non-admins (STORY-16).

## Acceptance criteria
1. Given a logged-in Member linked to a person, when they open the
   availability page, then they see a list of upcoming Sundays (default
   horizon: next 12 Sundays) with pt-PT-formatted dates, each showing an
   unambiguous available/blocked state, and unmarked dates read as available.
2. Given the availability page, when the Member taps an available Sunday, then
   it is persisted as blocked via the STORY-25 API and the UI reflects the
   blocked state; tapping a blocked Sunday unblocks it the same way.
3. Given a person with pre-existing blocked dates (seeded via API **before**
   `page.goto()`), when the page first loads, then those dates already render
   as blocked (server-rendered initial state, not only optimistic client
   state).
4. Given a toggle request in flight for one date, when the Member interacts,
   then that date's control is disabled until the request resolves, while
   other dates remain independently tappable (keyed in-flight state).
5. Given the API returns an error for a toggle, when it fails, then the date
   visually reverts to its previous state and an error message is announced
   via `aria-live="polite"` (no `role="alert"`).
6. Given a 375px viewport, when the page renders, then there is no horizontal
   overflow (`document.documentElement.scrollWidth`) and each date control has
   a ≥ 44px tap target (`min-h-[44px]`).
7. Given a logged-in Member whose account has no linked person, when they open
   the availability page, then they see an explanatory message (with a path to
   the claim flow) instead of the date list.
8. Given both roles, when a Member or an Admin is logged in, then the
   availability nav entry is visible and routes to the page (Members see it;
   this story must update `e2e/app-nav.spec.ts` count assertions and doc
   comments per CLAUDE.md).

## Out of scope
- Admin editing another person's blocked dates (STORY-27).
- Recurring availability patterns (Phase 2).
- Notifications/reminders to fill availability.
- Calendar-grid month view — a simple list of Sundays is sufficient for MVP.
- Blocking non-Sunday dates.

## Technical notes
- Page at `app/[locale]/(app)/availability/page.tsx` (Server Component fetches
  Sundays + current blocks; passes to a `'use client'` toggle list).
- Generate the upcoming-Sunday list server-side; horizon (12 Sundays ≈ 3
  months) is negotiable at Refine.
- Keyed in-flight state: `Set<string>` of dates, per the STORY-18 pattern in
  `components/PersonSkillsEditor.tsx`.
- Nav: extend `AppNav.tsx` beyond admin-only; component currently returns
  `null` for members — keep returning `null` only when there are zero items
  (empty-landmark rule).
- i18n keys in **both** `messages/pt-PT.json` and `messages/en.json` (key
  parity is enforced); AO90 spelling; pt-PT weekday/date formatting via
  next-intl.
- Tests: auth-gated e2e (`E2E_WITH_AUTH`) for the toggle flow with fixture
  cleanup (worker-isolated, `afterEach` unblock); AC3 must seed via
  `page.request` before `goto` per the BUGFIX-03 lesson.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **frontend** (new page + Client Component) — primary area.
- **ux** (mobile-first toggle list, 44px tap targets, aria-live error
  announcement, empty/no-linked-person state).
- **i18n** (new `Availability` namespace + `Nav.availability` key in **both**
  `messages/pt-PT.json` and `messages/en.json`).
- **testing infra** (new Playwright browser-auth fixtures in
  `e2e-integration/fixtures.ts`).
- No **backend**/**data** changes — this story consumes the STORY-25 API and
  query helper (`lib/availability/blocked-dates.ts`,
  `lib/people/resolve-self.ts`, `lib/validation/availability.ts`) exactly as
  merged; no migration, no Route Handler edits.
- Touches `components/AppNav.tsx` and `components/AppHeader.tsx`'s consumer
  — a shared component rendered on every authenticated page — so a
  regression here has app-wide blast radius even though the diff is small.
  This is the reason the complexity tag floors at `standard` (see below).

### Design decisions (made here, not left ambiguous for the implementer)
1. **Sunday horizon**: `getUpcomingSundays(12)` generates 12 Sundays in
   server UTC, **inclusive of today if today is a Sunday**, else starting
   from the next Sunday. 12 ≈ 3 months, per the Technical Notes' suggested
   default; short enough that no pagination/virtualization is needed. This
   is a one-line conditional either way (include vs. skip today) and low
   risk — documented explicitly here rather than left to implementer
   guesswork, since STORY-25's own test helper (`nextSunday()` in
   `e2e-integration/blocked-dates.spec.ts`) deliberately *skips* today for a
   different reason (picking a safe future fixture date), which is not the
   same question as "what should a Member see on the page."
2. **Data flow split**: the Server Component (`availability/page.tsx`) reads
   the initial state by calling `getBlockedDates()` directly (same helper
   the generator and the GET route call) — mirroring the
   `PersonSkillsPage` → `qualifiedRolesForPerson()` precedent (STORY-18) of
   Server Components calling shared query helpers directly rather than
   fetching their own HTTP API. The Client Component
   (`AvailabilityToggleList`) only calls the STORY-25 Route Handlers
   (`POST`/`DELETE /api/availability/blocks`) for user-initiated toggles,
   mirroring `PersonSkillsEditor`'s fetch-based auto-save pattern.
3. **Toggle control semantics**: each date renders as a single
   `<button type="button" aria-pressed={isBlocked}>` — not a checkbox/radio
   pair — since block/unblock is a pure boolean, not a multi-option choice.
   This sidesteps the `has-[:checked]` compound-selector class of bugs
   (BUGFIX-03) entirely: there is no underlying `<input>`, so state-driven
   styling is a plain conditional className on the button itself.
4. **Error-code mapping**: every toggle failure (`invalid_date`,
   `not_sunday`, `no_linked_person`, `internal`, and thrown network errors)
   maps to one generic `Availability.errorGeneric` message — no per-code
   mapping table like `PersonSkillsEditor`'s `ERROR_CODE_KEYS`. These codes
   are structurally near-unreachable in normal operation (dates are
   server-generated valid Sundays; a person-link removal mid-session is an
   accepted narrow race, same risk class as STORY-18's documented TOCTOU
   note) — there is no user-facing value in discriminating them, and adding
   dead-weight keys for codes that can't realistically surface would
   violate CLAUDE.md's i18n key hygiene rule.
5. **AppNav ordering**: `Disponibilidade`/`Availability` is added as the
   **first** `<li>` (the one item shared by both roles), followed by the
   three existing admin-only items. The empty-landmark rule (STORY-16) is
   preserved unchanged: `AppNav` still returns `null` when
   `role !== 'admin' && role !== 'member'` (e.g. a null-role/provisioning-
   failure edge case).
6. **New Playwright fixture — real browser auth**: `e2e-integration/fixtures.ts`
   gains `memberPage`/`adminPage` fixtures: capture real Supabase session
   cookies via the existing `signInAndGetCookies()` helper, then
   `browser.newContext()` + `context.addCookies([{ name, value, domain:
   'localhost', path: '/' }, ...])` + `context.newPage()`. This is exactly
   what that file's own header comment anticipates ("If a future story...
   needs full-page/browser-based auth testing, switch to
   `browser.newContext({ storageState: ... })`"). Because the
   `integration-test` CI job already runs against a real local Supabase
   instance with seeded credentials, this gives **every AC in this story
   fully-automated, non-`E2E_WITH_AUTH`-gated CI coverage** — a meaningfully
   stronger position than the existing `e2e/app-nav.spec.ts` pattern (manual
   verification, gated on a developer's local session). Each test must
   assert early that the page did **not** land on `/login` (fail loud if the
   cookie-auth plumbing silently breaks, per the fixture file's existing
   "fail fast" philosophy). **Cookie attributes**: `secure`/`sameSite` are
   deliberately **omitted** from the `addCookies()` call — the same
   `localhost` potentially-trustworthy-origin exception already documented
   in CLAUDE.md for CHORE-13 applies here (this is dev/CI-only test infra
   against `http://localhost:3000`, not a production cookie contract). If
   `signInAndGetCookies()` returns a session split across multiple chunked
   cookies (e.g. `sb-<ref>-auth-token.0`, `.1`, ...), every chunk must be
   passed through `addCookies()` with the **same** `domain: 'localhost'` and
   `path: '/'` applied uniformly — a partial or inconsistent domain/path
   across chunks would silently corrupt the reassembled session rather than
   fail loudly, so the helper iterates over all captured cookies and applies
   the same `domain`/`path` pair to each rather than hardcoding a single
   cookie object.
7. **No-linked-person / load-error branches render entirely server-side** —
   no client interactivity needed for either, so both live in the Server
   Component (mirrors `app/[locale]/claim/page.tsx`'s all-server-side
   branch handling), not in `AvailabilityToggleList`.
8. **Home page copy is out of scope.** The Member "no access yet" copy on
   `/` (`Member.noAccessTitle/Description`) becomes stale once a Member has
   a real nav destination, but no AC in this story asks to change it. Left
   untouched; flagged separately as a follow-up question, not blocking this
   plan.

### 1. `lib/availability/upcoming-sundays.ts` (NEW)
- `export function getUpcomingSundays(count: number, referenceDate: Date = new Date()): string[]`
- Pure UTC date math, same idiom as `lib/validation/availability.ts`
  (`Date.UTC` component construction, never a bare `new Date(dateStr)`):
  compute days-until-next-Sunday from `referenceDate`'s UTC calendar date
  (`0` if `referenceDate` is already a Sunday, per Design decision 1), then
  step 7 days at a time for `count` iterations, returning `YYYY-MM-DD`
  strings.
- No `import 'server-only'` — pure function, no secrets, no DB — same narrow
  exception class CLAUDE.md documents for `lib/validation/availability.ts`
  and `lib/availability/blocked-dates.ts` (must be directly importable by
  the Playwright integration suite).

### 2. `app/[locale]/(app)/availability/page.tsx` (NEW) — Server Component
- `getSessionUser()` → `redirect('/${routing.defaultLocale}/login')` if
  null (defensive belt-and-suspenders, matches `claim/page.tsx` /
  `admin/people/[id]/skills/page.tsx` precedent even though proxy.ts already
  guards this).
- `createServiceClient()` once; `resolveSelfPersonId(serviceClient, user.id)`:
  - `error` truthy → `console.error(...)` + render the `Availability.loadError`
    branch (defensive, no dedicated AC, degrade gracefully like
    `PersonSkillsPage`'s roles-fetch-error branch).
  - `personId === null` → render the **no-linked-person branch** (AC7):
    `Availability.noLinkedPersonTitle/Description/Cta` + `<Link href="/claim">`.
  - Otherwise: `const sundays = getUpcomingSundays(12)`;
    `const { data, error } = await getBlockedDates(serviceClient, { personIds: [personId], dateFrom: sundays[0], dateTo: sundays.at(-1) })`;
    on `error`, log and fall back to `initialBlockedDates: []` (same
    graceful-degradation precedent as above — showing "all available" on a
    transient read error is preferable to a hard page crash); otherwise map
    `data` to `blocked_date` strings.
  - Render `<AvailabilityToggleList sundays={sundays} initialBlockedDates={initialBlockedDates} />`
    inside `<main className="container mx-auto px-4 py-8">`.
- Lazy-load `getTranslations('Availability')` only for the two
  server-rendered branches (no-linked-person, load-error) — the happy-path
  strings live in the Client Component, per the lazy-namespace-load rule.

### 3. `components/AvailabilityToggleList.tsx` (NEW) — Client Component
- Props: `{ sundays: string[]; initialBlockedDates: string[] }`.
- State: `blockedDates: Set<string>` (seeded from `initialBlockedDates`),
  `pendingDates: Set<string>` (STORY-18 keyed in-flight pattern — AC4:
  concurrent toggles on different dates must not clobber each other's
  disabled state), `errorMessage: string | null`.
- `useFormatter()` (from `next-intl`) to render each date:
  `format.dateTime(new Date(Date.UTC(y, m - 1, d)), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })`.
  `timeZone: 'UTC'` is load-bearing, not decorative: without it, a browser
  west of UTC could render the UTC-midnight instant as the previous
  calendar day, silently shifting the displayed weekday — the same class of
  bug `lib/validation/availability.ts` was written to avoid server-side.
- `handleToggle(date)`: **first line** `setErrorMessage(null)` — clears any
  stale error banner from a previous failed toggle before starting a new
  action, matching the STORY-18 precedent in `PersonSkillsEditor.tsx`'s
  `handleSelect` (without this, a stale error from an earlier failed toggle
  would remain on screen indefinitely even after later toggles succeed).
  Then: optimistic flip of `blockedDates`, add `date` to `pendingDates`,
  `fetch` POST `/api/availability/blocks` (blocking) or DELETE
  `/api/availability/blocks/${date}` (unblocking); non-`ok` response →
  revert the optimistic flip + `setErrorMessage(t('errorGeneric'))` (Design
  decision 4); thrown/network error → same revert + generic message;
  `finally` → remove `date` from `pendingDates`.
- Markup: `<h1>{t('title')}</h1>` and `<p>{t('instructions')}</p>` render
  above the list (consuming the `title`/`instructions` keys listed in
  section 5 — otherwise they would be orphaned keys per CLAUDE.md's i18n key
  hygiene rule). Then `<ul>` of one `<li>` per Sunday; each `<li>` renders one
  `<button type="button" aria-pressed={isBlocked} disabled={isPending} className="min-h-[44px] w-full ..." aria-label="<formatted date> — <state>">`
  showing the formatted date and a visible state label
  (`t('stateBlocked')`/`t('stateAvailable')`) — both the visible text and
  `aria-pressed` communicate state unambiguously (AC1).
- Error region (AC5): `<div data-testid="availability-error" aria-live="polite">{errorMessage}</div>`,
  rendered only when `errorMessage` is set — never `role="alert"` (route-
  announcer collision precedent).

### 4. `components/AppNav.tsx` (EDIT)
- Guard: `if (role !== 'admin' && role !== 'member') return null;`
- Add a first `<li>` (always rendered once the guard passes):
  `<Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm"><Link href="/availability">{t('availability')}</Link></Button>`.
- Wrap the three existing admin-only `<li>`s in `{role === 'admin' && (<>...</>)}`.

### 5. i18n — `messages/pt-PT.json` / `messages/en.json` (EDIT, both files)
- `Nav.availability`: pt-PT `"Disponibilidade"`, en `"Availability"`.
- New `Availability` namespace (both locales), keys actually consumed by
  the components above only (i18n key hygiene rule): `title`,
  `instructions`, `stateAvailable`, `stateBlocked`, `errorGeneric`,
  `loadError`, `noLinkedPersonTitle`, `noLinkedPersonDescription`,
  `noLinkedPersonCta`. AO90 spelling throughout (e.g. "disponibilidade",
  "associar" — no AO90-affected forms in this vocabulary, but double-check
  at implementation time per the standing rule).

### 6. `e2e-integration/fixtures.ts` (EDIT)
- Add `memberPage`/`adminPage` fixtures per Design decision 6. Extract a
  `createAuthenticatedPage(browser, baseURL, email)` helper alongside the
  existing `createAuthenticatedRequestContext`, reusing
  `signInAndGetCookies()` (no duplication of the cookie-capture logic).

### 7. `e2e-integration/availability.spec.ts` (NEW)
Header comment must flag: this spec and the existing `blocked-dates.spec.ts`
both create/delete rows against the same fixed `MEMBER_ID` fixture; local
parallel test runs (not CI, which is single-worker) could collide — per the
STORY-11 fixture-hygiene lesson, follow the worker-isolated fixture pattern
below rather than assuming the fixed ID is safe to share across parallel
workers.

Real local Supabase + real browser, fully automated, mapped 1:1 to ACs:
- **AC1**: `memberPage` + a fresh linked-person fixture (no blocks) → goto
  `/pt-PT/availability` → assert exactly 12 date buttons render, each 7 days
  apart starting from the correct Sunday, each showing
  `stateAvailable`/`aria-pressed="false"`, **and** assert at least one
  button's visible text matches the pt-PT weekday/month output produced by
  the same `format.dateTime(..., { weekday: 'long', day: 'numeric', month:
  'long', year: 'numeric', timeZone: 'UTC' })` call used in production (e.g.
  compute the expected string in the test via `Intl.DateTimeFormat('pt-PT',
  {...})` against the known fixture date and assert the button text contains
  it) — this is the only assertion in the plan that actually verifies the
  rendered text is Portuguese, not merely that 12 buttons exist 7 days apart.
- **AC2**: click a date's button → assert UI flips to blocked
  (`aria-pressed="true"`, `stateBlocked` text) **and** a service-role
  read-back (`e2e-integration/service-client.ts`) confirms the row exists;
  click again → assert it flips back and the row is gone.
- **AC3**: seed a block via `memberRequest.post(...)` (or a direct
  service-role insert) **before** `memberPage.goto(...)` (BUGFIX-03
  lesson: seed-then-navigate, not click-then-assert-in-one-session) →
  assert that date renders blocked on first paint.
- **AC4**: `page.route()` to hold one date's POST/DELETE pending → click it
  → assert that button is `disabled` while a **different** date's button
  remains enabled and independently completes its own toggle → release the
  held route → assert the first button resolves too.
- **AC5**: `page.route()` to `fulfill({ status: 500, ... })` one date's
  toggle request → click → assert the button reverts to its prior state
  **and** `[data-testid="availability-error"][aria-live="polite"]` appears
  with text, **and** assert `page.locator('[role="alert"]')` count excludes
  this element (route-announcer collision guard, per project memory).
- **AC6**: `page.setViewportSize({ width: 375, height: 812 })` before goto
  → assert `document.documentElement.scrollWidth <= 375` and (after
  `toBeVisible()`) each button's `boundingBox()` height `>= 44`.
- **AC7**: `memberPage` with **no** linked-person fixture created (default
  seeded state) → goto → assert the no-linked-person message renders and a
  link to `/pt-PT/claim` is present (`getByRole('link', { name: ... })`).
- **AC8**: for both `memberPage` and `adminPage` — goto `/`, assert the nav
  landmark contains a "Disponibilidade" link, click it, assert the URL
  becomes `/pt-PT/availability`.
- Fixture lifecycle: worker-isolated linked-person row per
  `testInfo.workerIndex` (STORY-14/STORY-25 pattern), hard-deleted in
  `afterEach` (cascades any block rows via `ON DELETE CASCADE`); AC7's test
  is the one exception that deliberately creates no fixture.

### 8. `e2e/app-nav.spec.ts` (EDIT — required by AC8)
- Bump the admin-nav link count assertion from 3 → 4; add a
  `toBeVisible()` assertion for "Disponibilidade".
- Replace "AC3: Member nav renders no nav element" with a new assertion
  that the member nav renders **exactly one** link, "Disponibilidade" (the
  empty-landmark case no longer applies to members).
- Update the file's header doc comment (story references, hardcoded counts,
  manual-verification steps) to match — CLAUDE.md's "doc comments drift
  silently" rule (STORY-17 precedent).

### 9. `e2e/availability-blocks.spec.ts` — no change
API-only smoke suite for the STORY-25 Route Handlers; unaffected by this
story's UI-only scope.

### Risks and rollback
- **Risk**: `AppNav.tsx`/`AppHeader.tsx` are rendered on every authenticated
  page — a mistake here has app-wide blast radius, not just the new
  `/availability` route. Mitigated by the updated `e2e/app-nav.spec.ts`
  count assertions plus the new full-automation AC8 coverage in
  `e2e-integration/availability.spec.ts`.
- **Risk**: the new `memberPage`/`adminPage` browser-cookie fixture is new
  test infra; a domain/path mismatch against `baseURL` would silently
  redirect every test to `/login` instead of failing loudly. Mitigated by
  an explicit not-on-`/login` assertion at the top of each new integration
  test (fail fast, matching the existing fixture file's philosophy).
- **Risk**: Design decision 1's "include today if Sunday" choice is a
  judgment call with no AC backing either way — low material impact (one
  extra/missing list item), documented here rather than guessed silently.
- **Rollback**: fully additive — new page, new component, new nav `<li>`,
  new i18n keys, new test file/fixtures. No migration, no changes to the
  STORY-25 Route Handlers or table. Reverting this story's commits removes
  the feature cleanly; `AppNav.tsx`'s edit is a small, easily-revertible
  diff (the three existing admin `<li>`s are untouched, just re-wrapped).

### Complexity tag: **standard**
Multi-file (new Server + Client Component, shared-nav-component edit,
two locale files, new Playwright fixture infra) spanning at least three
modules (frontend rendering, i18n, test infra) — CLAUDE.md's default per
its classification table. Floors at `standard` (not `trivial`) because it
edits `AppNav.tsx`, a component with app-wide blast radius (every
authenticated page renders it), and because it resolves the caller's
identity via `resolveSelfPersonId` (auth-adjacent, though reused unchanged,
not new logic) to decide what a user is allowed to see/do — CLAUDE.md's
"auth" reasoning-risk signal. Not `complex`: no new auth-guard *logic*, no
new migration, no concurrency/locking design beyond the already-precedented
`Set<string>`-keyed in-flight pattern (STORY-18), and the STORY-25 API
surface is consumed exactly as merged, not modified.

### Revision (cycle 1)
Addressed challenger findings:
1. **(Critical)** Section 3's `handleToggle` now explicitly calls
   `setErrorMessage(null)` as its first line, before the optimistic flip,
   matching `PersonSkillsEditor.tsx`'s `handleSelect` precedent — fixes the
   stale-error-banner bug.
2. **(Warning)** Section 7's AC1 test now asserts a button's visible text
   matches the pt-PT weekday/month string produced by the same
   `format.dateTime(...)` call used in production, not just button
   count/spacing/state.
3. **(Warning)** Section 3's markup now explicitly renders `<h1>{t('title')}</h1>`
   and an instructions `<p>`, so the `title`/`instructions` keys listed in
   section 5 are actually consumed (no orphaned keys).
4. **(Warning)** Design decision 6 now spells out that `secure`/`sameSite`
   are deliberately omitted (localhost trustworthy-origin exception, per
   CHORE-13) and that every captured cookie chunk gets the same
   `domain`/`path` applied uniformly.
5. **(Note)** Section 7 now opens with a header-comment requirement flagging
   the shared `MEMBER_ID` fixture collision risk with `blocked-dates.spec.ts`
   under local parallel runs, per the STORY-11 fixture-hygiene lesson.

No other sections changed; complexity tag remains `standard`.
