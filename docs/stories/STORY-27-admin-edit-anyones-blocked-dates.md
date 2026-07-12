# STORY-27: Admin views and edits anyone's blocked dates
Epic: EPIC-03
Status: draft

## User story
As an Admin, I want to see and edit any person's blocked Sundays on their
behalf, so that availability stays accurate even for people who don't use the
app themselves (e.g. told me on WhatsApp, or have no login).

## Context
PRD §6 FR5: "Volunteers **and the coordinator on their behalf** can block
specific Sundays." Many people records have no linked account (EPIC-02 /
STORY-07 allows person-without-login), so availability editing must be
**person-centric**, not account-centric. Builds on STORY-25 (data model) and
reuses the STORY-26 toggle UX where practical.

## Acceptance criteria
1. Given a logged-in Admin on the people management area, when they choose a
   person's availability action, then they see that person's upcoming Sundays
   with current blocked/available states (same horizon as STORY-26).
2. Given the Admin availability view for a person, when the Admin taps an
   available Sunday, then it is persisted as blocked **for that person**;
   tapping a blocked date unblocks it — identical toggle semantics and
   idempotency as the Member flow.
3. Given a person with **no linked user account**, when the Admin opens their
   availability, then viewing and editing work exactly the same
   (person-centric storage).
4. Given a Member's own blocks created via STORY-26, when an Admin views that
   person, then the same blocks appear (one shared source of truth); edits by
   the Admin are visible to the Member on next load.
5. Given a logged-in non-admin Member, when they call the admin availability
   endpoint or open the admin page for any person, then the API returns 403
   and the page redirects with the access-denied pattern
   (`/?denied=1`, banner guarded by `role !== 'admin'`).
6. Given an invalid person id (malformed UUID or nonexistent), when the Admin
   endpoint is called, then it returns 400 (`invalid_id`) or 404 with stable
   error codes — never 500.
7. Given a 375px viewport, when the Admin availability view renders, then
   there is no horizontal overflow and controls keep ≥ 44px tap targets.

## Out of scope
- Bulk operations (block a date for several people at once).
- Recurring availability patterns (Phase 2).
- Notifications to the affected member about admin edits.
- Availability summary/matrix across the whole team (useful for EPIC-05, not
  here).

## Technical notes
- Admin Route Handler at `app/api/admin/people/[id]/availability/` following
  the `requireAdmin(request)` guard-first-then-`await params` convention and
  UUID validation from CLAUDE.md.
- Page/section under `app/[locale]/admin/people/` — likely an availability
  subpage or expandable panel per person row; Refine decides the entry point.
  Per-page admin role-guard redirect applies.
- Reuse the STORY-26 client toggle component with a person-id-aware endpoint
  prop rather than duplicating it (same keyed in-flight state, error
  handling, and tap-target classes).
- Same `blocked_dates` table and query helper as STORY-25 — no parallel
  storage.
- i18n keys in both locale files; AO90 spelling.
- Tests: auth-gated e2e for the admin toggle flow with worker-isolated fixture
  people and unconditional cleanup (STORY-14 pattern); a 403 regression test
  for the member-calling-admin-endpoint case.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **backend** (2 new Route Handler files under `app/api/admin/people/[id]/availability/`).
- **frontend** (1 new admin subpage; edits to a shared Client Component and
  to `PeopleTable.tsx`).
- **ux** (reuses the STORY-26 toggle list's tap targets, keyed in-flight
  state, and `aria-live="polite"` error region unchanged).
- **i18n** (3 new keys, both locale files).
- **testing infra** — no new fixtures needed; reuses STORY-26's
  `adminPage`/`memberPage`/`adminRequest`/`memberRequest` fixtures
  (`e2e-integration/fixtures.ts`) as-is.
- No **data** changes — no new migration; reuses the STORY-25
  `public.blocked_dates` table, `getBlockedDates()`, `parseBlockedDate()`/
  `isSunday()`, and `getUpcomingSundays()` exactly as merged.

### Design decisions (made here, not left ambiguous for the implementer)
1. **Entry point (AC1): a per-person subpage**, `/admin/people/[id]/availability`,
   mirroring the existing `/admin/people/[id]/skills` subpage (STORY-18)
   rather than an expandable inline panel in `PeopleTable`. An inline panel
   would need new row-expansion state in an already-complex table component
   and would duplicate a 12-item list inside a table row; a subpage keeps
   `AvailabilityToggleList`'s DOM structure (`main ul li button`) byte-for-byte
   identical to STORY-26, which is what makes "reuse ... rather than
   duplicating" (Technical Notes) actually true, not just nominally true.
2. **Toggle-component reuse — exact prop shape**: extend
   `AvailabilityToggleList` with two new **optional** props, `personId?: string`
   and `personName?: string`. `const isAdminMode = personId !== undefined`
   gates only: (a) which endpoint URLs `handleToggle` calls, (b) the page
   title text, (c) whether a "back to team" link renders. Nothing else
   changes — `blockedDates`/`pendingDates`/`errorMessage` state, the
   optimistic-flip/revert logic, the `finally` cleanup, and the error region
   are untouched, so the already-shipped Member path (which never passes
   `personId`) has zero behavioral change (props default to `undefined`).
3. **Route Handler shape mirrors `app/api/availability/blocks/` 1:1**:
   `app/api/admin/people/[id]/availability/route.ts` (GET + POST) and
   `app/api/admin/people/[id]/availability/[date]/route.ts` (DELETE). GET is
   not called by the admin page itself (the Server Component reads via
   `getBlockedDates()` directly, mirroring STORY-26 Design decision 2 — same
   as `PersonSkillsPage` → `qualifiedRolesForPerson()`), but is trivial to
   add and gives symmetric 401/403/AC6 coverage across all three verbs,
   matching how STORY-25's own AC6/AC7 tests exercise GET+POST+DELETE
   together. This is an explicit architectural-parity choice, not
   speculative scope.
4. **Error codes match AC6's literal text**: `invalid_id` (400, malformed
   UUID) and `person_not_found` (404, well-formed UUID but missing or
   soft-deleted row). This deliberately does **not** reuse the older
   `app/api/admin/people/[id]/route.ts`'s free-text `'Invalid id'`
   (pre-existing STORY-07-era debt, untouched by this story) nor the skills
   route's `invalid_person_id` literal (a different route that shipped
   before this AC's wording existed) — AC6 pins the exact code, so match the
   AC, not either sibling route.
5. **Validation order** (mirrors the skills route precedent — cheap
   format/shape checks before any DB round-trip): `requireAdmin` → `await params`
   → UUID-format check on `id` (400 `invalid_id`) → [POST only] JSON parse
   (400 `invalid_json`) → `parseBlockedDate` (400 `invalid_date`) →
   `isSunday` (400 `not_sunday`) → person lookup `is_active = true` (404
   `person_not_found`) → write/read. `[date]`'s DELETE skips the JSON/Sunday
   steps (mirrors STORY-25's unblock route: an already-non-Sunday date can
   never have a row, so a no-op delete is already correct).
6. **No parallel storage — AC4 is true by construction.** The admin routes
   and the STORY-25/26 member routes write/read the identical
   `blocked_dates` table scoped only by `person_id`. There is no
   admin-specific column, table, or cache; "one shared source of truth" is
   guaranteed by construction, not by an extra reconciliation step.
7. **AC5 is fully automatable in CI**, unlike the STORY-18 precedent (whose
   `e2e/person-skills.spec.ts` header says the Member-403 case "requires a
   real Member session, which this environment cannot provide" and falls
   back to a manual-verification step). STORY-26 already added
   `memberRequest`/`memberPage` fixtures with a real seeded Member session
   to `e2e-integration/fixtures.ts`; this story reuses them directly — no
   new test infra, no manual-verification fallback needed for AC5.

### 1. Route Handlers (NEW)

**`app/api/admin/people/[id]/availability/route.ts`**
- `GET` (AC1 data source; AC5/AC6 coverage): `requireAdmin` → `await params`
  → validate `id` (400 `invalid_id`) → person lookup
  (`.from('people').select('id').eq('id', id).eq('is_active', true).maybeSingle()`;
  `error` truthy → 500 `internal`; no row → 404 `person_not_found`) →
  `getBlockedDates(serviceClient, { personIds: [id] })` → on `error`, log +
  500 `internal`; else `{ dates: (data ?? []).map(r => r.blocked_date) }`.
- `POST` (AC2, AC3, AC5, AC6): `requireAdmin` → `await params` → validate
  `id` (400 `invalid_id`) → parse JSON (400 `invalid_json`) →
  `parseBlockedDate(body.date)` (400 `invalid_date`) → `isSunday` (400
  `not_sunday`) → person lookup (404 `person_not_found`) →
  `serviceClient.from('blocked_dates').upsert({ person_id: id, blocked_date: date }, { onConflict: 'person_id,blocked_date', ignoreDuplicates: true })`
  (identical idempotency to STORY-25 AC2) → on `error`, log + 500 `internal`;
  else `{ ok: true }`.

**`app/api/admin/people/[id]/availability/[date]/route.ts`**
- `DELETE` (AC2, AC5, AC6): `requireAdmin` → `await params` → validate `id`
  (400 `invalid_id`) → `parseBlockedDate(date)` (400 `invalid_date`) →
  person lookup (404 `person_not_found`) →
  `.delete().eq('person_id', id).eq('blocked_date', date)` → on `error`, log
  + 500 `internal`; else `{ ok: true }` regardless of matched-row count
  (idempotent unblock, identical to STORY-25 AC3).

All three: explicit object-literal writes only (mass-assignment guard, never
spread `body`); destructure `{ data, error }` and check `error` truthy
**before** touching `data`, per CLAUDE.md's Supabase error-field rule; outer
try/catch with `catch (err)` + `console.error('[ROUTE] ...', err)` → 500
`internal`.

### 2. Admin page (NEW) — `app/[locale]/(app)/admin/people/[id]/availability/page.tsx`
Mirrors `app/[locale]/(app)/admin/people/[id]/skills/page.tsx` structure
exactly:
- `getSessionUser()` → `redirect('/${routing.defaultLocale}/login')` if null.
- `getUserRole(user.id)` → `redirect('/${routing.defaultLocale}/?denied=1')`
  if `!== 'admin'` (AC5's page-redirect half; per-page admin guard
  convention, CLAUDE.md).
- `await params` → `UUID_RE.test(id)` → `notFound()` if malformed.
- `createServiceClient()` → person lookup (`id, name`, `is_active = true`) →
  `notFound()` if missing (page-level symmetry with the API's 404; AC6 text
  is API-scoped but the same guard costs nothing extra here and matches the
  skills-page precedent).
- `const sundays = getUpcomingSundays(12)` — reuses STORY-26's exact
  constant; AC1 says "same horizon as STORY-26," so no new configurable
  horizon.
- `getBlockedDates(serviceClient, { personIds: [id], dateFrom: sundays[0], dateTo: sundays.at(-1) })`
  → map to `initialBlockedDates` (log + degrade to `[]` on error, same
  graceful-degradation precedent as STORY-26's page).
- Render
  `<AvailabilityToggleList sundays={sundays} initialBlockedDates={initialBlockedDates} personId={id} personName={person.name} />`
  inside `<main className="container mx-auto px-4 py-8">`.
- No `getTranslations` call here — all rendered text lives in the Client
  Component (lazy-load rule), matching `PersonSkillsPage`.

### 3. `components/AvailabilityToggleList.tsx` (EDIT)
- Props: `{ sundays: string[]; initialBlockedDates: string[]; personId?: string; personName?: string }`.
- `const isAdminMode = personId !== undefined`.
- `const blockUrl = isAdminMode ? \`/api/admin/people/${personId}/availability\` : '/api/availability/blocks'`.
- `const unblockUrl = (date: string) => isAdminMode ? \`/api/admin/people/${personId}/availability/${date}\` : \`/api/availability/blocks/${date}\``.
- `handleToggle` uses `blockUrl` / `unblockUrl(date)` instead of the
  hardcoded member-only paths; every other line in the function (optimistic
  flip, `pendingDates` add/remove, revert-on-failure, `finally` cleanup) is
  untouched.
- Title: `isAdminMode ? t('adminTitle', { name: personName }) : t('title')`.
- New back-link block, rendered only when `isAdminMode`, placed after the
  `<ul>`, mirroring `PersonSkillsEditor`'s `backToTeam` link exactly (same
  classes, `data-testid="availability-back-link"`,
  `<Link href="/admin/people">{t('backToTeam')}</Link>`).
- `instructions`/`stateAvailable`/`stateBlocked`/`errorGeneric` keys and
  markup are reused verbatim (Design decision 2 above) — the existing pt-PT
  wording has no "tu/você" pronoun, so it reads correctly for an admin
  editing someone else's dates too.

### 4. `components/PeopleTable.tsx` (EDIT)
Add a new `<Link>` action in the view-mode actions `<div>`
(`flex flex-wrap justify-end gap-2 sm:flex-nowrap`), immediately after the
existing "Competências" link and before "Editar", using the same
`min-h-[44px]` / `blockedByOtherConfirm` disable pattern as its neighbor:
```tsx
<Link
  href={`/admin/people/${person.id}/availability`}
  data-testid={`pm-availability-${person.id}`}
  aria-disabled={blockedByOtherConfirm}
  tabIndex={blockedByOtherConfirm ? -1 : undefined}
  onClick={(e) => { if (blockedByOtherConfirm) e.preventDefault() }}
  className={`flex min-h-[44px] items-center rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${blockedByOtherConfirm ? 'pointer-events-none opacity-50' : ''}`}
>
  {t('availabilityButton')}
</Link>
```

### 5. i18n — `messages/pt-PT.json` / `messages/en.json` (EDIT, both files)
- `PeopleManagement.availabilityButton`: pt-PT `"Disponibilidade"`, en
  `"Availability"` (new key; same word as the existing `Nav.availability`
  key, but a distinct key in a distinct namespace/component — no
  cross-namespace key reuse).
- `Availability.adminTitle`: pt-PT `"Disponibilidade de {name}"`, en
  `"{name}'s availability"`.
- `Availability.backToTeam`: pt-PT `"Voltar à equipa"`, en `"Back to team"`
  (same string as `SkillManagement.backToTeam`, but its own key in its own
  namespace).
- AO90 spelling confirmed ("disponibilidade" is already used elsewhere in
  the codebase; no AO90-affected forms in this vocabulary).
- No other new keys — `title`, `instructions`, `stateAvailable`,
  `stateBlocked`, `errorGeneric`, `loadError`, `noLinkedPerson*` are all
  reused verbatim from the existing `Availability` namespace (i18n key
  hygiene rule: don't add a key unless newly-written code actually consumes
  it).

### 6. Test plan (mapped to ACs)

**Primary suite: `e2e-integration/admin-availability.spec.ts` (NEW)** — real
local Supabase + the existing `adminPage`/`adminRequest`/`memberRequest`/
`memberPage` fixtures (`e2e-integration/fixtures.ts`), same pattern as
`e2e-integration/availability.spec.ts`. Fixture lifecycle: worker-isolated
`people` rows created via `serviceClient()` per test (STORY-14/STORY-25
pattern), hard-deleted in `afterEach` (cascades `blocked_dates` rows via
`ON DELETE CASCADE`).

- **AC1**: seed a fixture person (no link) with 2 pre-existing blocks via a
  service-role insert **before** navigation (BUGFIX-03 seed-then-navigate) →
  `adminPage.goto('/pt-PT/admin/people/<id>/availability')` → assert 12
  buttons render, 7 days apart, pt-PT-formatted (reuse STORY-26 AC1's
  `Intl.DateTimeFormat` cross-check) → assert exactly the 2 seeded dates show
  `aria-pressed="true"`/`stateBlocked`, the rest `aria-pressed="false"`.
- **AC2**: `adminPage` on a fresh no-blocks fixture person → click the first
  button → assert `aria-pressed="true"` + a service-role read-back confirms
  a row scoped to that fixture's `person_id` → click again → assert
  unblocked + row gone (idempotency, mirrors STORY-26 AC2 exactly, just
  against the admin route and a target person id, not the caller's own).
- **AC3**: create a fixture person with `linked_user_id: null` explicitly →
  `adminPage.goto(...)` on that person's availability → assert the page
  renders normally (not `notFound()`, no error state) and a toggle click
  persists a row for that `person_id` (service-role read-back) — proves "no
  linked account" doesn't block admin editing.
- **AC4**: create a fixture person linked to `MEMBER_ID` →
  `memberRequest.post('/api/availability/blocks', { data: { date: <sunday> } })`
  (Member creates a block via the STORY-25/26 self-service API) →
  `adminPage.goto('/pt-PT/admin/people/<id>/availability')` → assert that
  same date renders blocked in the admin view (shared-storage proof) → admin
  clicks it to unblock → `memberRequest.get('/api/availability/blocks')` →
  assert the date is no longer present (admin edit visible to the Member on
  next load).
- **AC5**: `memberRequest.get/post('/api/admin/people/<fixtureId>/availability')`
  and `memberRequest.delete('/api/admin/people/<fixtureId>/availability/<sunday>')`
  → each asserted `403`; separately,
  `memberPage.goto('/pt-PT/admin/people/<fixtureId>/availability')` → assert
  the final URL matches `/\/pt-PT\/\?denied=1$/` (right-anchored regex per
  CLAUDE.md's `toHaveURL` note) and the existing `showDeniedBanner` mechanism
  renders the denial banner on `/`.
- **AC6**: `adminRequest` — a malformed id string (`'not-a-uuid'`) on
  GET/POST/DELETE → 400 `invalid_id`; a well-formed-but-nonexistent UUID →
  404 `person_not_found` on all three; loop-assert none of these cases ever
  return 500. Also: `adminPage.goto` a nonexistent-UUID's availability URL →
  assert Next's not-found rendering (no 500).
- **AC7**: `page.setViewportSize({ width: 375, height: 812 })` before
  `adminPage.goto(...)` on a fixture person's availability page → assert
  `document.documentElement.scrollWidth <= 375` and each button's
  `boundingBox()` height `>= 44` (identical assertions to STORY-26 AC6,
  reused verbatim against the new page).

**Secondary/regression coverage:**
- `e2e/admin-availability.spec.ts` (NEW, CI-safe, no real session) —
  unauthenticated 401 on all 3 admin availability routes (GET/POST/DELETE)
  and unauthenticated page → redirect-to-login, mirroring
  `e2e/person-skills.spec.ts`'s `AC7-api-*`/`AC7-page-guard` tests. Kept as a
  cheap duplicate so this coverage survives even if the `integration-test`
  CI job is ever skipped (STORY-25's established rationale).
- `e2e/people-table-alignment.spec.ts` (EDIT, **required**, not optional):
  this file already asserts actions-row overflow/wrapping at 375px/1280px
  using `[data-testid^="pm-skills-"]` as an anchor. Adding a 4th/5th action
  (`pm-availability-${id}`) changes the row's total button count — exactly
  what this spec's `sm:flex-nowrap` assertions exist to catch regressions in
  (CLAUDE.md's Breakpoint-gated flex-wrap note, BUGFIX-02). Re-run this spec
  and update any hardcoded action-count assertions.
- `e2e/i18n-key-parity.spec.ts` — no code change, but must pass (new keys
  land in both locale files in the same commit, DoD item 6).
- Re-run `e2e-integration/availability.spec.ts` (STORY-26's unmodified
  Member suite) as a regression gate after the `AvailabilityToggleList.tsx`
  edit — a clean pass proves the member path (which never sets `personId`)
  is unaffected.

### Risks and rollback
- **Risk**: `PeopleTable.tsx`'s actions row grows from 3-4 buttons to 4-5 in
  view mode. Mitigated by re-running `e2e/people-table-alignment.spec.ts`
  (existing regression coverage for exactly this class of bug, BUGFIX-02)
  before merge, called out explicitly in the test plan above.
- **Risk**: `AvailabilityToggleList.tsx` is shared between the already-live
  Member flow (STORY-26) and this story's Admin flow — a wiring mistake in
  the `isAdminMode` branch could theoretically leak into the Member path.
  Mitigated by: (a) the gate is a single boolean touching only URL
  construction and title/back-link rendering, not the shared state machine;
  (b) re-running STORY-26's `e2e-integration/availability.spec.ts` unmodified
  as an explicit regression gate (see Test plan).
- **Risk**: narrow TOCTOU between the person-exists check and the write (the
  person could be soft-deleted mid-request) — same accepted-risk class as
  STORY-18's documented TOCTOU note (admin-only surface, narrow race, low
  severity: a write to a since-soft-deleted person's `blocked_dates` row is
  harmless dead data, invisible to any UI). Documented here, not engineered
  away.
- **Rollback**: fully additive — 2 new Route Handler files, 1 new page, 3 new
  i18n keys, and small edits to 2 existing files (`AvailabilityToggleList.tsx`'s
  new props default to member-mode behavior when omitted — zero change for
  existing STORY-26 callers; `PeopleTable.tsx` gets one new `<Link>`).
  Reverting this story's commits removes the feature cleanly; no migration to
  undo (no schema changes — reuses `blocked_dates` as-is).

### Complexity tag: **standard**
Touches an auth guard (`requireAdmin`, reused not modified — CLAUDE.md's
"auth" reasoning-risk signal), introduces an elevated-privilege write path
(admin writing another user's data on their behalf, same signal class as
STORY-18's admin skill-assignment routes), and spans three or more
interacting modules (2 new Route Handlers, a shared Client Component whose
regression surface includes an already-shipped Member-facing feature, and a
shared admin table component edit) — any one of these floors the story at
`standard` per CLAUDE.md's classification table. Not `complex`: no new
migration, no new concurrency/locking design beyond the already-precedented
upsert/idempotent-delete pattern (copied verbatim from STORY-25), and the
authorization model has zero conditional logic (any admin may edit any
active person's availability — no per-person ACL to get wrong).
