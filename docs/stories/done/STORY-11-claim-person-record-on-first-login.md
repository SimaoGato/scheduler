# STORY-11: Claim existing person record on first login
Epic: EPIC-02
Status: done ✅
PR: 33

## User story
As a team member logging in with Google for the first time, I want to be able
to identify myself as someone the Admin already added to the team list, so
that my account is linked to my person record and the Admin's prior work is
not duplicated.

## Context
An Admin can add people to the "Equipa" list without requiring them to have
an account (STORY-07). When that person later logs in for the first time,
there is no automatic link between their Google account and their person
record — they appear as an unlinked user in "Utilizadores" while a separate
entry for their name already exists in "Equipa". This story closes that gap.
See PRD §6 FR3 (CRUD for people) and EPIC-02 scope ("Link a person record to
a logged-in user account").

The data model already supports the link: `public.people.linked_user_id` is a
nullable FK to `public.users.id` (STORY-07, AC4).

## Acceptance criteria
1. Given a user who logs in for the first time AND there are unlinked person
   records in `public.people`, when the auth callback completes, then they are
   redirected to a "claim" page listing those unlinked person records by name.
2. Given the user on the claim page, when they select a name and confirm,
   then `people.linked_user_id` is set to their user id and they are
   redirected to the home page.
3. Given the user on the claim page, when they click "skip" (or "that's not
   me"), then no person record is linked and they are redirected to the home
   page as a normal member.
4. Given a user who logs in and there are NO unlinked person records, when
   the auth callback completes, then they are NOT shown the claim page and go
   directly to home (no friction for users who don't need it).
5. Given a user who already has a linked person record (returning login), when
   the auth callback completes, then they are NOT shown the claim page.
6. Given two users simultaneously claiming the same person record, when both
   submit, then only the first claim succeeds (second gets a conflict error
   and is prompted to try another name or skip).
7. Given a user on the claim page, when the page renders, then the list shows
   only people whose `linked_user_id IS NULL` and `is_active = true`.

## Out of scope
- Admin-initiated linking (Admin can see and set the link from the Utilizadores
  or Equipa admin screens — that is a separate story).
- Fuzzy name matching or search; a plain list is sufficient.
- Email-based auto-matching (person records have no email field yet).
- Changing the claim after the fact from the member's own settings.

## Technical notes
- **Auth callback change** (`app/auth/callback/route.ts`): after `provisionUser`
  succeeds and the user is new (i.e., the `count === 0` branch was NOT taken
  AND `existing === null`), check if any unlinked+active people rows exist. If
  yes, redirect to `/${defaultLocale}/claim` instead of home.
- **New page** `app/[locale]/claim/page.tsx`: Server Component, fetches
  unlinked people via service-role client. If none → redirect to home. If the
  calling user already has a linked record → redirect to home (AC5).
- **New API route** `app/api/people/claim/route.ts` (POST): authenticated
  (anon-key, not service-role), user supplies `{ person_id: UUID }`. Must
  verify: (a) the person row exists and is active, (b) `linked_user_id IS NULL`
  (prevent concurrent double-claim), (c) the calling user has no other linked
  record. Sets `linked_user_id = user.id` atomically. Use an UPDATE with
  WHERE `linked_user_id IS NULL` and check rows-affected = 1 to handle AC6.
- **New client component** `components/ClaimPersonForm.tsx` — list of names,
  single selection, confirm + skip buttons.
- The claim route does NOT require `requireAdmin`; it is a member-self-service
  action. Auth guard: `requireAuth` (any logged-in user).
- The claim page should use the minimal login-style shell (no nav) or the
  standard locale layout without nav items being distracting — TBD at
  implementation time.
- Add i18n keys under a new `Claim` namespace in `messages/pt-PT.json`.

## Definition of Done
See CLAUDE.md.

## Implementation plan

### Affected areas (for Challenge/Review persona gating)
- **Backend / auth**: `app/auth/callback/route.ts` (refactor `provisionUser`
  return signature + new post-provision redirect logic — this is the
  highest-blast-radius file in the app, since every login goes through it).
- **Backend / API**: new `app/api/people/claim/route.ts` (Route Handler, POST).
- **Data / infra**: new Supabase migration (partial unique index on
  `public.people.linked_user_id`).
- **Frontend**: new `app/[locale]/claim/page.tsx`, new
  `app/[locale]/claim/layout.tsx`, new `components/ClaimPersonForm.tsx`.
- **i18n**: new `Claim` namespace in both `messages/pt-PT.json` and
  `messages/en.json` (key parity enforced by `e2e/i18n-key-parity.spec.ts`).
- **Tests**: new `e2e/claim.spec.ts`; regression check on existing
  `e2e/provision.spec.ts` and `e2e/settings-display-name.spec.ts` (both touch
  auth-adjacent flows and must keep passing unmodified).

### Complexity classification: **complex**
Per CLAUDE.md's rubric, `complex` covers "auth, data integrity, concurrency,
security, or three or more interacting systems." This story hits three of
those explicitly and simultaneously:
- **Auth**: modifies `app/auth/callback/route.ts`, the single highest-risk
  file in the codebase — every user's login passes through it, so a
  regression here can lock out the whole team, not just this feature.
- **Data integrity**: introduces a new migration (partial unique index) that
  encodes a new schema invariant ("one active person-link per user").
- **Concurrency**: AC6 requires a genuinely atomic double-claim guard (DB-level
  `WHERE linked_user_id IS NULL` + unique index), not just app-level checks.

Combined with 3+ interacting systems (auth callback, new Route Handler, new
page/component, new migration, i18n), this is well past `standard`. Classify
as `complex`.

### Key design decisions (resolving the story's open TBDs)

1. **Claim route uses the service-role client + `requireAuth`, NOT an
   anon-key client**, which deviates from the technical notes' suggestion
   ("authenticated (anon-key, not service-role)"). Rationale: the
   established codebase precedent for member self-service writes is
   `app/api/settings/display-name/route.ts` (STORY-21) — `requireAuth` guard
   for authentication, `createServiceClient()` for the write (bypasses RLS),
   and explicit `.eq('id', <caller-scoped-value>)` filters done in
   application code for authorization. `public.people`'s only current RLS
   policy (`people_admin_all`) is admin-only; using an anon-key client here
   would require a brand-new self-claim RLS policy plus a column-level GRANT
   restricting `authenticated` to only the `linked_user_id` column (to stop a
   crafted PostgREST request from writing other columns) — a bigger,
   RLS-touching change for no security benefit, since the Route Handler is
   already the trust boundary everywhere else in this project. No new GRANT
   is needed: `service_role` already has full `SELECT, INSERT, UPDATE,
   DELETE` on `public.people` (migration `20260701000002`).

2. **Claim page layout: no nav, login-style shell** (resolves the "TBD" in
   the technical notes). New `app/[locale]/claim/layout.tsx` copies
   `app/[locale]/login/layout.tsx`'s centering wrapper (`flex min-h-screen
   flex-col items-center justify-center`, no `AppHeader`), and the page lives
   at `app/[locale]/claim/` — a sibling of `login/`, outside the `(app)/`
   route group (whose own doc comment scopes it to "authenticated app
   pages"). Rationale: `/claim` is a one-time, forced onboarding interstitial
   immediately after first login — structurally the same kind of full-screen
   decision gate as `/login`, not a page users navigate to/from via nav.
   This also removes the "admin nav item distraction" concern the story
   raised, since `AppNav` would show role-based links irrelevant to the claim
   decision.

3. **"New user" signal for AC1/AC4/AC5**: refactor `provisionUser` to return
   `Promise<{ isNewUser: boolean }>` instead of `Promise<void>` —
   `{ isNewUser: false }` from the existing-row branch (before its early
   `return`), `{ isNewUser: true }` after a successful `INSERT` in the
   new-row branch. The callback only runs the unlinked-people check and
   redirects to `/claim` when `isNewUser === true`. This is the concrete
   meaning behind the story's technical note's somewhat garbled phrasing
   ("the user is new i.e. ... existing === null") — the `count === 0`
   bootstrap-admin branch is orthogonal to newness (it only picks the role,
   admin vs member) and needs no special-casing; a bootstrap admin's first
   login will still naturally skip `/claim` whenever `public.people` has zero
   unlinked rows (the expected common case at bootstrap time), via the
   existing AC4 check. This design also guarantees AC5 holds even for a
   *skipped* claim: a user who skips is not "new" on their next login, so
   they are never routed to `/claim` again regardless of unlinked-people
   state (consistent with the "Out of scope: changing the claim after the
   fact" note).

4. **AC6 concurrency — two layers**:
   - New migration:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_people_linked_user_id_unique
       ON public.people (linked_user_id)
       WHERE linked_user_id IS NOT NULL;
     ```
     Enforces "at most one active person record per user" as a DB-level
     invariant (defense against double-submit / two tabs claiming two
     different people), and gives the route handler a `23505` to catch.
     Pre-deploy check (documented as a manual step, not code): confirm
     `SELECT linked_user_id, count(*) FROM people WHERE linked_user_id IS NOT
     NULL GROUP BY linked_user_id HAVING count(*) > 1` returns zero rows
     before applying, in case manual Table Editor test data already violates
     it.
   - The claim itself is the atomic conflict check for "two users claim the
     same person": `UPDATE people SET linked_user_id = :callerId WHERE id =
     :personId AND linked_user_id IS NULL AND is_active = true RETURNING id`.
     Zero rows affected (already claimed by someone else, deactivated, or bad
     id — all collapse to the same UX per AC6) → `409 { error:
     'already_claimed' }`. A `23505` from the new unique index (caller
     already linked to a *different* person, e.g. a race between two tabs) →
     `409 { error: 'already_linked' }`. Both map to the same UI treatment:
     show an error and let the user pick another name or skip.

### Step-by-step plan (test-first where practical)

The auth callback cannot be exercised end-to-end in CI (placeholder Supabase
credentials always fail `exchangeCodeForSession` before reaching
`provisionUser` — same limitation documented in `e2e/provision.spec.ts` and
`e2e/settings-display-name.spec.ts`). Practical test-first loop: write the
CI-safe guard/validation tests first, implement, then add
`E2E_WITH_AUTH`-gated tests plus a manual verification runbook for the parts
that need a live OAuth login.

1. **Migration** — add
   `supabase/migrations/<timestamp>_people_linked_user_unique.sql` with the
   partial unique index above. No GRANT changes needed (decision 1). Include
   a rollback note in the migration comment (`DROP INDEX IF EXISTS
   idx_people_linked_user_id_unique;`).
2. **`provisionUser` refactor** in `app/auth/callback/route.ts`: change
   return type to `Promise<{ isNewUser: boolean }>`; update both return
   points and the JSDoc comment.
3. **Callback route change — explicit control-flow restructure.** The
   current code creates `serviceClient` *inside* the try block wrapping
   `provisionUser`, and that try/catch's only job today is "log and move on."
   Step 3 needs `serviceClient` and the resulting `isNewUser` value visible
   *after* that block, so the following restructure is required (not just an
   addition inside the existing try):
   - Hoist `const serviceClient = createServiceClient();` to *before* the
     try block (constructing the client is a synchronous, non-throwing
     factory call per `lib/supabase/service.ts` — safe to hoist).
   - Hoist `let isNewUser = false;` to before the try block as well.
   - Inside the existing try: `isNewUser = (await provisionUser(serviceClient,
     user)).isNewUser;` (the catch block is unchanged — still just logs and
     falls through; `isNewUser` simply stays `false` on a provisioning
     failure, which correctly degrades to "no claim page, straight home").
   - **After** the try/catch (not inside it), when `isNewUser === true`, run
     the unlinked-people existence check in its own try/catch using the
     same hoisted `serviceClient`:
     `.from('people').select('id').is('linked_user_id', null).eq('is_active',
     true).limit(1)`. Destructure `{ data, error }`; log `error` and fall
     through to home on any DB error (never block login — same "degraded
     mode" principle already used for `provisionUser` failures).
   - Compute the final redirect target (`/${defaultLocale}/claim` if a row
     was returned, else `/${defaultLocale}/`) into a single local variable
     *before* the return statement.
   - **CRITICAL — do not skip:** the file's own doc comment states every
     return/redirect path in this handler must go through
     `clearSignoutMarker(...)` to avoid reintroducing the STORY-15 sign-out
     race (a user who just signed out and immediately re-authenticates would
     otherwise be bounced back to `/login` by proxy.ts's `signingOut` check
     if the marker cookie is left live). The new `/claim` redirect is a
     **6th return path** alongside the existing 5, and must be wrapped
     identically: `return clearSignoutMarker(NextResponse.redirect(new
     URL(redirectTarget, request.url)));` — whether `redirectTarget` is
     `/claim` or `/` (home), the same single `clearSignoutMarker(...)` call
     wraps whichever URL was computed above. Do not add a second, unwrapped
     redirect branch for the `/claim` case.
4. **New page** `app/[locale]/claim/page.tsx` (Server Component):
   - `getSessionUser()` → redirect to `/login` if null (belt-and-suspenders,
     matches the `/settings` page convention).
   - Query service client for the caller's own linked-people row
     (`linked_user_id = user.id AND is_active = true`); if found → redirect
     home (AC5 defense-in-depth against direct navigation to `/claim`).
   - Query service client for all unlinked+active people (`linked_user_id IS
     NULL AND is_active = true`, ordered by name); if empty → redirect home
     (AC4 defense-in-depth, AC7 filter).
   - Render `<ClaimPersonForm people={...} />` inside the new layout.
5. **New layout** `app/[locale]/claim/layout.tsx`: copy of
   `login/layout.tsx`'s shell, `data-testid="claim-centering-root"`.
6. **New API route** `app/api/people/claim/route.ts` (POST):
   - `requireAuth(request)` guard first.
   - Parse JSON body in its own try/catch (400 `invalid_json`).
   - Validate `person_id` against the project's inline `UUID_RE` convention
     (400 `invalid_id`) — matches `app/api/admin/people/[id]/route.ts` /
     `app/api/admin/roles/[id]/route.ts`; no new shared validation module
     needed since this is a regex literal, not parsing logic (STORY-17's
     shared-helper precedent was for real parsing logic).
   - `createServiceClient()`; run the atomic `UPDATE ... WHERE
     linked_user_id IS NULL AND is_active = true .select('id')`.
   - DB error: `23505` → 409 `already_linked`; else log + 500 `internal`.
   - Zero rows affected → 409 `already_claimed`.
   - Success → 200 `{ ok: true }`.
   - "Skip" needs no API call — client-only navigation home.
7. **New client component** `components/ClaimPersonForm.tsx`:
   - `'use client'`; a list of native radio inputs (one per person, each with
     a proper `<label htmlFor>` pairing — WCAG SC 1.3.1) + Confirm + Skip
     buttons, `min-h-[44px]` tap targets.
   - **Group the radio inputs so assistive tech announces them as one
     question, not a flat list of unrelated labeled inputs**: wrap the radio
     list in `<fieldset><legend>{t('instructions')}</legend>...</fieldset>`
     (preferred, matches native HTML semantics with zero extra ARIA), or
     equivalently a `<div role="radiogroup" aria-labelledby="claim-legend-id">`
     if a non-`<fieldset>` layout is needed for styling reasons. Do not
     render the radio inputs as bare siblings with only individual
     `<label>`s and no grouping container.
   - Confirm disabled until a selection is made; on submit, `fetch`s the
     claim route; on success, `useRouter()` from `@/i18n/navigation` →
     `router.push('/')` (matches `UserWidgetMenu`/`DisplayNameForm`
     precedent); on 409, map the error code to an i18n message via an
     `ERROR_CODE_KEYS`-style map (mirrors `RoleTable.tsx`) so the user can
     pick another name or skip; other errors → generic message.
   - Error region: `aria-live="polite"` + `data-testid` (avoids the
     `__next-route-announcer__` `role="alert"` collision per CLAUDE.md).
   - Skip: `router.push('/')` directly, no fetch call.
8. **i18n**: add a `Claim` namespace to both `messages/pt-PT.json` and
   `messages/en.json` in the same commit. Draft keys (trim any that end up
   unused once the component is built, per CLAUDE.md's i18n key hygiene
   note): `title`, `instructions`, `confirmButton`, `skipButton`,
   `errorAlreadyClaimed`, `errorAlreadyLinked`, `errorGeneric`. pt-PT copy
   must follow AO90 spelling.

### Test plan (mapped to acceptance criteria)

| AC | Test | Mechanism |
|----|------|-----------|
| AC1 (redirect to /claim on first login + unlinked people exist) | See "Manual verification steps" below (Step 1) | Manual — same CI limitation as `e2e/provision.spec.ts` (placeholder creds never reach a successful `exchangeCodeForSession`) |
| AC2 (select + confirm links the record, redirects home) | `E2E_WITH_AUTH`-gated Playwright test: create an unlinked fixture person, select it on `/claim`, confirm, assert redirect to `/pt-PT/` and that a follow-up authenticated GET/verification shows `linked_user_id` set | `E2E_WITH_AUTH` |
| AC3 (skip → no link, redirect home as member) | `E2E_WITH_AUTH`-gated test: click Skip, assert redirect to `/pt-PT/` without any fetch to the claim API (assert via `page.route`/network spy or absence of side effects) | `E2E_WITH_AUTH` |
| AC4 (no unlinked people → no claim page) | See "Manual verification steps" below (Step 2, callback half) + page-level defense-in-depth: `E2E_WITH_AUTH`-gated direct-navigation test to `/pt-PT/claim` when no unlinked people exist, asserting redirect home | `E2E_WITH_AUTH` (page-level half) + manual (callback half) |
| AC5 (returning/already-linked user never sees claim page) | See "Manual verification steps" below (Step 3, callback half) + `E2E_WITH_AUTH`-gated direct-navigation test to `/pt-PT/claim` as an already-linked user, asserting redirect home (page-level defense-in-depth half) | `E2E_WITH_AUTH` + manual |
| AC6 (concurrent double-claim) | `E2E_WITH_AUTH`-gated test: two sequential `page.request.post('/api/people/claim')` calls against the same `person_id` — first succeeds (200), second returns 409 `already_claimed`. (A true concurrent race is not reliably reproducible in Playwright; the sequential case is the practical proxy for the atomic `WHERE linked_user_id IS NULL` guard, which is atomic at the DB layer regardless of request timing — call this out explicitly in the spec's header comment.) | `E2E_WITH_AUTH` |
| AC7 (list shows only unlinked + active people) | `E2E_WITH_AUTH`-gated test: seed one unlinked-active fixture, one already-linked fixture, one inactive fixture; assert only the unlinked-active one renders in the list (worker-isolated fixture names + `afterEach` cleanup, per STORY-14 convention) | `E2E_WITH_AUTH` |
| Regression: unauthenticated `POST /api/people/claim` → 401 | CI-safe Playwright test (mirrors `settings-display-name.spec.ts`'s AC4 401 pattern) | CI-safe |
| Regression: existing `e2e/provision.spec.ts` and `e2e/settings-display-name.spec.ts` still pass unmodified | Full `npm run test:e2e` run | CI-safe |
| Regression: `e2e/i18n-key-parity.spec.ts` still passes with new `Claim` keys | Automatic (existing filesystem-based test covers any new namespace) | CI-safe |

### Manual verification steps (AC1, AC4, AC5 — auth callback halves)

Per DoD item 5 (CLAUDE.md) and STORY-03's precedent
(`docs/stories/STORY-03-provision-member-on-first-login.md`), these steps
must also be copied into `e2e/claim.spec.ts`'s header comment block when the
spec file is written, not left only here — but they are written out in full
now so the plan itself satisfies "at least ... a documented manual
verification step in the story file" without depending on a future file.
Requires a real Supabase project with Google OAuth configured and
`.env.local` filled in (same prerequisite as STORY-03/STORY-21's manual
steps).

1. **AC1 — first login with unlinked people present → redirected to `/claim`:**
   1. In Supabase Table Editor, ensure at least one `public.people` row has
      `linked_user_id IS NULL` and `is_active = true` (add one via the
      "Equipa" admin screen if needed, e.g. name "Claim Test Person").
   2. Ensure the Google account you are about to log in with has no existing
      row in `public.users` (delete it first if it does, e.g.
      `DELETE FROM public.users WHERE email = '...';`).
   3. Log in with that Google account.
   4. Confirm the browser lands on `/pt-PT/claim` (not `/pt-PT/`), and the
      unlinked person name(s) from step 1 appear in the list.

2. **AC4 — first login with NO unlinked people → straight to home:**
   1. In Table Editor, confirm no `public.people` rows have `linked_user_id
      IS NULL AND is_active = true` (either link or deactivate all of them
      for this check).
   2. Ensure the test Google account has no existing row in `public.users`
      (delete it first if it does).
   3. Log in with that Google account.
   4. Confirm the browser lands directly on `/pt-PT/` — `/claim` is never
      shown.

3. **AC5 — returning login never shows the claim page:**
   1. Log in once with a fresh Google account (this creates its
      `public.users` row — per AC1/AC4 above it may or may not see `/claim`
      depending on unlinked-people state; either skip or claim to finish the
      first login).
   2. Ensure at least one unlinked+active `public.people` row still exists
      (add a new one if the first login consumed the only one, so this step
      actually exercises the "unlinked people still exist" condition).
   3. Log out, then log in again with the **same** Google account.
   4. Confirm the browser lands directly on `/pt-PT/` — `/claim` is NOT
      shown on this second (returning) login, even though unlinked people
      still exist.

### Risks and rollback
- **Highest risk**: regression in `app/auth/callback/route.ts` blocking all
  logins. Mitigation: `provisionUser`'s existing-user path and error-handling
  contract are unchanged (only the return type gains a boolean); the new
  unlinked-people check is wrapped in the same non-blocking
  destructure-and-log pattern already used for `provisionUser` failures, so a
  DB error here degrades to "no claim page, straight to home" rather than
  blocking login. Existing `e2e/provision.spec.ts` must keep passing
  unmodified as a regression gate.
- **Migration risk**: the partial unique index could fail to apply if
  pre-existing test/manual data already has duplicate `linked_user_id`
  values. Mitigation: pre-deploy check documented above; the index is
  additive and reversible (`DROP INDEX IF EXISTS ...`).
- **Data integrity risk**: none beyond the new invariant itself, which is the
  intended behavior (AC6 / technical note (c)).
- **Migration must land before the callback/route code deploys** (matches
  STORY-03's precedent): if `app/api/people/claim/route.ts` deploys before
  `idx_people_linked_user_id_unique` exists, the 409 `already_linked` path
  (which depends on catching a `23505` from that index) is simply never hit —
  a double-link could silently succeed for the same user against two
  different people rows until the migration is applied. This is a narrower
  gap than STORY-03's (login itself does not fail, only one edge-case guard
  is temporarily absent), but the same operational rule applies: apply the
  migration first, then deploy the callback/route changes.
- **Rollback**: revert the migration (drop the index), revert the callback
  change (or feature-flag the redirect if a faster rollback than a full
  revert is needed), remove the new route/page/component — all additive,
  no destructive schema changes, so rollback is low-risk.

### Open questions
None blocking. Two deviations from the story's technical notes are called
out explicitly above (service-role vs anon-key client choice; adding a new
migration) with rationale grounded in existing codebase precedent — flagging
here for reviewer visibility in case there was a reason for the
originally-suggested approach that isn't reflected in the codebase today.

### Non-blocking notes (acknowledged, no plan change needed)
- A user who clicks "Skip" is not prevented from manually navigating to
  `/pt-PT/claim` afterward — the page-level check only redirects home when
  the caller already *has* a linked record (AC5) or there are no unlinked
  people left (AC4); skipping sets neither. This means a skip is not
  "sticky" against a manual revisit within the same login session. Arguably
  fine (matches "Out of scope: changing the claim after the fact" — the user
  can still choose to claim later in the same session if they change their
  mind before navigating away), and no ACs require otherwise; flagging for
  awareness rather than proposing a fix.
- AC6's automated test is a sequential-request proxy for true concurrency
  (already disclosed in the Test plan table above) — Playwright cannot
  reliably fire two truly simultaneous requests, but the atomic `WHERE
  linked_user_id IS NULL` guard is what actually matters and holds
  regardless of request timing.
- `CREATE UNIQUE INDEX` without `CONCURRENTLY` briefly locks `public.people`
  for writes while it builds. Negligible at this project's scale (a handful
  of rows), so not worth the added complexity of a `CONCURRENTLY` migration
  (which also cannot run inside a transaction block, complicating the
  migration runner).
