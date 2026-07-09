# STORY-20: Admin links a person record to a user account
Epic: EPIC-02
Status: done ✅
PR: #38
Priority: confirmed needed (was "low, reconfirm at Refine" — see note below)

## User story
As an Admin, I want to link (and unlink) a person record to a logged-in user
account from the admin screens, so that I can fix up mappings when a member
skipped the self-claim flow or was added to the team after they had already
logged in.

## Context
STORY-11 lets a member **self-claim** their person record on first login, and
explicitly deferred Admin-initiated linking to "a separate story" (STORY-11,
Out of scope). This story is that follow-up. It closes the gaps self-claim
cannot: a member who clicked "skip", a person added *after* the member's first
login (so the claim page never offered them), or a mistaken claim that needs
correcting. See EPIC-02 scope ("Link a person record to a logged-in user
account") and PRD §6 FR3.

**Priority update (2026-07-06, from triage):** the "reconfirm once real usage
shows a gap" condition above has now happened. The Admin (Simão) logged in
before any matching person record existed in Equipa, so STORY-11's claim page
never offered a match, and there is no other discoverable way (no nav link, no
admin control) to link a person created afterward to that account — the only
workaround is manually navigating to the unlinked `/claim` URL, which isn't
exposed anywhere in the UI. This confirms the gap is real, not hypothetical;
do not drop this story.

**Original uncertainty flag (superseded above, kept for history).** STORY-11
already satisfies the epic's "a logged-in Member is associated with their
person record" acceptance signal for the common path. This story is a
robustness/admin-override backstop; it may be deprioritized until real usage
shows the self-claim flow leaves gaps. Sizing and even necessity should be
reconfirmed at Refine — if self-claim proves sufficient in practice, this can
be dropped.

## Acceptance criteria
1. Given an Admin viewing a person with `linked_user_id IS NULL`, when they
   pick an unlinked user account and confirm, then `people.linked_user_id` is
   set to that user's id and the link is reflected in the admin UI.
2. Given an Admin viewing a linked person, when they unlink, then
   `people.linked_user_id` is set back to NULL and the person shows as unlinked.
3. Given an Admin attempts to link a user who is **already** linked to a
   different person, then the action is rejected with a clear message (a user
   maps to at most one person) — enforced server-side.
4. Given an Admin attempts to link a person who is **already** linked, then
   they must unlink first (or the action replaces the link only via an explicit
   confirm) — no silent overwrite.
5. Given the link/unlink API, when a non-admin or unauthenticated user calls it,
   then it is blocked (401/403); this is an Admin-only action, unlike the
   member self-claim route in STORY-11.
6. Given all link/unlink UI text, when it renders, then strings come from
   `messages/pt-PT.json` (AO90).

## Out of scope
- The member self-claim flow (STORY-11) — this is the Admin-side counterpart,
  reusing the same `people.linked_user_id` column.
- Email-based auto-matching (person records have no email field).
- Bulk linking.

## Technical notes
- No schema change — reuses `public.people.linked_user_id` (nullable FK,
  STORY-07 AC4).
- New Admin-only API (e.g. `app/api/admin/people/[id]/link` PUT/DELETE, or a
  field on the existing PATCH): `requireAdmin` first; validate the target
  `user_id` is a UUID and currently unlinked (AC3); use an UPDATE guarded on the
  current link state to avoid races (AC4).
- Surfaces in either the Equipa (people) or Utilizadores (users) admin screen —
  likely a "link account" control per person row plus a picker of unlinked
  users. Decide placement at Refine.
- Consider showing the linked account (name/email) on the people list so the
  Admin can see current mappings at a glance.
- Complexity: **standard**, small — one guarded UPDATE plus a picker UI.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Affected areas (for Challenge/Review persona gating)
- **backend** — two new Route Handlers: `app/api/admin/people/[id]/link/route.ts`
  (PUT + DELETE).
- **frontend** — `components/PeopleTable.tsx` (new "Conta" column + link/unlink
  row actions), `app/[locale]/(app)/admin/people/page.tsx` (extra data fetch:
  all users + the full taken-user-id set).
- **data** — no schema change; reuses `public.people.linked_user_id` and the
  existing partial unique index `idx_people_linked_user_id_unique`
  (`supabase/migrations/20260705000001_people_linked_user_unique.sql`,
  STORY-11). No migration in this story.
- **i18n** — new keys in the existing `PeopleManagement` namespace, both
  `messages/pt-PT.json` and `messages/en.json`.
- **Tests** — new `e2e/admin-link-person.spec.ts`.

### Complexity classification: **standard**
One guarded UPDATE (reusing an existing, already-proven unique-index pattern
from STORY-11) plus a picker UI on an existing table component. No new
migration, no new auth pattern (mirrors `requireAdmin` + service-role client
used throughout EPIC-02's admin routes), no money/concurrency-heavy logic
beyond a single WHERE-guarded UPDATE that is structurally identical to
`app/api/people/claim/route.ts`. Touches three files meaningfully (route
handler, page, table component) plus i18n and tests — squarely "standard,
small" per the story's own sizing note, not `trivial` (auth-adjacent write,
race-guard reasoning) and not `complex` (no new migration, no genuinely novel
concurrency mechanism — reuses STORY-11's).

### Key design decisions (resolving the story's "Decide at Refine" items)

1. **Placement: Equipa (people) admin screen, not Utilizadores.**
   `PeopleTable.tsx` already lists `linked_user_id` in its `PersonRow` data
   (currently unused in the UI) and already has an established per-row
   actions-column pattern with multiple mutually-exclusive modes (view /
   editing / confirming-remove — see `confirmingRemoveId`,
   `blockedByOtherConfirm`). The person is the "primary" entity a link is
   attached to from the Admin's mental model ("does this Equipa member have
   an account yet"), and reusing the existing table avoids a second parallel
   surface. `UserTable.tsx` (Utilizadores) is not touched.

2. **UI shape: inline per-row picker, not a dedicated subpage.** Unlike
   skills (STORY-18, which needed a matrix of role × level and got its own
   `/admin/people/[id]/skills` page), linking is a single `<select>` + one
   confirm action — small enough to fit as a fourth mode in the existing
   actions cell, alongside `isEditing` / `isConfirmingRemove`. Add:
   - A new "Conta" column (between Nome and the actions column) showing the
     linked account's `display_name ?? email`, or a "Sem conta" placeholder
     when unlinked. This satisfies the technical note ("show the linked
     account so the Admin can see mappings at a glance") and requires no
     extra network round trip (uses a `usersById` lookup map built from a
     new `allUsers` prop, populated once at page load).
   - In the actions cell, when unlinked: a "Ligar conta" button that opens a
     fourth row-mode (`isLinking`) rendering a `<select>` of currently
     unlinked users + Confirmar/Cancelar buttons (mirrors the `isEditing`
     swap-in-place pattern, using the same `blockedByOtherConfirm`-style
     gate so other rows' actions are disabled while a picker or remove
     confirm is open anywhere in the table).
   - When linked: a "Desligar conta" button that unlinks directly on click
     (no extra confirm step — AC2 doesn't require one, and unlinking is
     reversible/re-linkable, unlike role/person removal which has
     dependent-row consequences).

3. **API shape: new `PUT`/`DELETE app/api/admin/people/[id]/link`, not a
   field on the existing name-`PATCH`.** Mirrors the existing
   `app/api/admin/people/[id]/skills/[roleId]/route.ts` convention (a
   sub-resource route with its own guarded read-then-write flow) rather than
   overloading `app/api/admin/people/[id]/route.ts`'s `PATCH` (which handles
   name edits and has its own, unrelated 404/400 semantics). Keeping link/
   unlink as its own route also keeps the "clear message" requirements of
   AC3/AC4 from being tangled into name-edit validation error codes.

4. **Race-guard / no-silent-overwrite (AC3, AC4): explicit pre-check reads,
   then a WHERE-guarded UPDATE, mirroring `app/api/people/claim/route.ts`
   (STORY-11) almost exactly — that route is the closest existing precedent
   for this exact `people.linked_user_id` write.**
   - **AC4 (person already linked → reject, don't overwrite):** pre-check
     `SELECT id, is_active, linked_user_id FROM people WHERE id = :id` —
     404 `person_not_found` if missing/inactive, 409
     `person_already_linked` if `linked_user_id IS NOT NULL`. The write
     itself is *also* `WHERE linked_user_id IS NULL` (not just relying on
     the pre-check), so a race between the pre-check and the write (two
     admins linking the same person in different tabs) still can't produce
     a silent overwrite — zero rows affected on the UPDATE falls back to the
     same 409 `person_already_linked`.
   - **AC3 (user already linked to a *different* person → reject, clear
     message):** rely on the existing partial unique index
     `idx_people_linked_user_id_unique` exactly as the claim route does —
     no separate pre-check `SELECT` for "is this user already linked"
     (matches the claim route's precedent of relying solely on the DB
     constraint for this case, avoiding a redundant query and a
     check-then-act gap). Catch `error.code === '23505'` → 409
     `user_already_linked`.
   - Chosen the simpler option per the story's own "pick the simpler one"
     guidance: **reject re-linking an already-linked person; no
     replace-with-confirm UI.** The Admin must click "Desligar conta" first,
     then "Ligar conta" to a new user. This avoids a second confirm-dialog
     variant and matches AC4's literal wording ("must unlink first").

5. **Stale-link edge case (soft-deleted people): the "unlinked users" pool
   offered in the picker must exclude users linked to *any* person row,
   including soft-deleted (`is_active = false`) ones — not just the active
   rows shown in the table.** The partial unique index
   `idx_people_linked_user_id_unique` has no `is_active` filter (confirmed by
   reading the STORY-11 migration), so a user linked to a person who was
   later soft-deleted (STORY-19) still occupies that user's "one link" slot
   at the DB level. If the picker only excluded users linked to *visible*
   (active) rows, the Admin could pick a user that looks free but gets
   rejected with a confusing 409 `user_already_linked` with no visible
   reason (the person holding the old link isn't shown anywhere). Fix:
   `AdminPeoplePage` runs a second, unfiltered query —
   `SELECT linked_user_id FROM people WHERE linked_user_id IS NOT NULL`
   (no `is_active` filter) — to compute the true "taken" id set, and passes
   it down as `initiallyLinkedUserIds: string[]` alongside a new `allUsers:
   UserRow[]` prop (all users, unfiltered — reused for the "Conta" column's
   display-name lookup). `PeopleTable` keeps `takenUserIds` as its own
   `Set<string>` client state seeded from the prop, and updates it locally
   (add on successful link, delete on successful unlink) — no refetch
   needed, since only the two rows visible in this table can change link
   state during an admin session; already-soft-deleted people are not
   editable from this screen. This is called out explicitly because it is
   the one place this story's design deviates from "just filter the props
   we already have" — worth flagging at review since it's easy to regress by
   later "simplifying" the unlinked-users derivation back to `rows`-only.

### Step-by-step approach (test-first where practical)

1. **Route Handler** `app/api/admin/people/[id]/link/route.ts`:
   - `PUT` (link):
     1. `requireAdmin(request)` first (before `await params`, per convention).
     2. `await params` → validate `id` against the project's inline
        `UUID_RE` → 400 `invalid_person_id`.
     3. Parse JSON body in its own try/catch → 400 `invalid_json`.
     4. Validate `body.user_id` is a UUID string → 400 `invalid_user_id`.
     5. `serviceClient.from('people').select('id, is_active,
        linked_user_id').eq('id', id).maybeSingle()` — DB error → 500
        `internal`; not found or `!is_active` → 404 `person_not_found`;
        `linked_user_id !== null` → 409 `person_already_linked` (AC4).
     6. `serviceClient.from('users').select('id').eq('id',
        user_id).maybeSingle()` — DB error → 500 `internal`; not found →
        404 `user_not_found`.
     7. `serviceClient.from('people').update({ linked_user_id: user_id
        }).eq('id', id).is('linked_user_id', null).eq('is_active',
        true).select('id, linked_user_id')`:
        - `error.code === '23505'` → 409 `user_already_linked` (AC3).
        - other error → log + 500 `internal`.
        - zero rows → 409 `person_already_linked` (race fallback, AC4).
     8. Success → 200 `{ id, linked_user_id: user_id }`.
   - `DELETE` (unlink):
     1. `requireAdmin(request)` first.
     2. `await params` → validate `id` → 400 `invalid_person_id`.
     3. `serviceClient.from('people').select('id,
        is_active').eq('id', id).maybeSingle()` — DB error → 500
        `internal`; not found/inactive → 404 `person_not_found`.
     4. `serviceClient.from('people').update({ linked_user_id:
        null }).eq('id', id).eq('is_active', true).select('id')` — DB
        error → 500 `internal`. Treat "already unlinked" as an idempotent
        success (200), not an error — no AC requires erroring on a repeat
        unlink, and this matches the existing skills-route precedent of a
        raced double-tap collapsing to a benign outcome.
     5. Success → 200 `{ id, linked_user_id: null }`.

2. **Page** `app/[locale]/(app)/admin/people/page.tsx`: add two supplementary
   service-role queries after the existing active-people fetch:
   - `SELECT id, email, display_name, role FROM users ORDER BY
     display_name` → `allUsers: UserRow[]` (reuse the existing
     `types/user-management.ts` type — no new type file needed).
   - `SELECT linked_user_id FROM people WHERE linked_user_id IS NOT NULL`
     (no `is_active` filter — see Design decision 5) → `initiallyLinkedUserIds:
     string[]`.
   Both wrapped in the same try/catch + `{ data, error }` destructure
   pattern already used for the people fetch; empty array on error (degrade
   gracefully — the table still renders with the linking feature effectively
   disabled if this fetch fails, rather than crashing the whole page).
   Pass both new props to `<PeopleTable />`.

3. **Component** `components/PeopleTable.tsx`:
   - New props: `allUsers: UserRow[]`, `initiallyLinkedUserIds: string[]`.
   - New state: `takenUserIds` (seeded `Set<string>` from
     `initiallyLinkedUserIds`), `linkingId: string | null`, `selectedUserId:
     string` (empty string = none selected).
   - `usersById = new Map(allUsers.map(u => [u.id, u]))` (recomputed each
     render — table sizes are small, no memoization needed, consistent with
     the project's existing style in this file).
   - `unlinkedUsers = allUsers.filter(u => !takenUserIds.has(u.id))`.
   - Extend `blockedByOtherConfirm` to also account for `linkingId`:
     `(confirmingRemoveId !== null && confirmingRemoveId !== person.id) ||
     (linkingId !== null && linkingId !== person.id)`.
   - New "Conta" `<th>`/`<td>` column (between Nome and the actions column):
     `linkedUser = person.linked_user_id ? usersById.get(person.linked_user_id)
     : null`; render `linkedUser ? (linkedUser.display_name ?? linkedUser.email)
     : t('unlinkedLabel')`.
   - `startLinking(personId)` → sets `linkingId`, resets `selectedUserId`,
     clears `errorMessage`. `cancelLinking()` → clears both.
   - `handleLink(personId)`: guards on `selectedUserId` non-empty; `fetch`
     `PUT /api/admin/people/${personId}/link` with `{ user_id:
     selectedUserId }`; on success, update `rows` (set `linked_user_id`),
     add to `takenUserIds`, clear linking state; on error, map the response
     `error` code via a small `LINK_ERROR_KEYS` record (mirrors
     `RoleTable.tsx`'s existing error-map convention) — `person_already_linked`
     → `errorPersonAlreadyLinked`, `user_already_linked` →
     `errorUserAlreadyLinked`, anything else → `errorGeneric`.
   - `handleUnlink(personId)`: `fetch DELETE
     /api/admin/people/${personId}/link`; on success, update `rows` (null
     out `linked_user_id`), remove that user id from `takenUserIds`, clear
     `errorMessage`; on error → `errorGeneric`.
   - Actions cell, new `isLinking` mode (added alongside the existing
     `isEditing` / `isConfirmingRemove` branches): a `<select
     data-testid="pm-link-select-{id}" aria-label={t('linkPickerLabel')}>`
     populated from `unlinkedUsers` (value = user id, label =
     `display_name ?? email`) + an empty/placeholder first option, plus
     `data-testid="pm-link-confirm-{id}"` (disabled until `selectedUserId`
     non-empty) and `data-testid="pm-link-cancel-{id}"` buttons.
   - View mode: when `person.linked_user_id === null`, render
     `data-testid="pm-link-{id}"` "Ligar conta" button (opens `isLinking`);
     when linked, render `data-testid="pm-unlink-{id}"` "Desligar conta"
     button (calls `handleUnlink` directly), both gated by `isLoading ||
     loadingId !== null || blockedByOtherConfirm`, `min-h-[44px]` tap
     targets per CLAUDE.md.
   - Error/confirm banners reuse the existing `data-testid="pm-error"` /
     `aria-live="polite"` region — no new banner element needed.

4. **i18n** — add to the existing `PeopleManagement` namespace in both
   `messages/pt-PT.json` and `messages/en.json` (same commit, key parity
   enforced by `e2e/i18n-key-parity.spec.ts`):
   - `columnAccount`: pt "Conta" / en "Account"
   - `unlinkedLabel`: pt "Sem conta" / en "No account"
   - `linkAccountButton`: pt "Ligar conta" / en "Link account"
   - `unlinkButton`: pt "Desligar conta" / en "Unlink account"
   - `linkPickerLabel` (select `aria-label`): pt "Escolher conta a ligar" /
     en "Choose account to link"
   - `linkPickerPlaceholder` (disabled first `<option>`): pt "Selecionar
     utilizador" / en "Select a user"
   - `confirmLinkButton`: pt "Confirmar" / en "Confirm"
   - `errorPersonAlreadyLinked`: pt "Esta pessoa já tem uma conta associada.
     Desligue primeiro." / en "This person already has a linked account.
     Unlink it first."
   - `errorUserAlreadyLinked`: pt "Esta conta já está associada a outra
     pessoa." / en "This account is already linked to another person."
   - Reuse existing `cancelButton`, `errorGeneric`, `actionLoading` keys —
     no duplication.
   - `person_not_found` / `user_not_found` map to the existing
     `errorGeneric` key (edge cases not reachable through normal picker use
     — the picker only ever offers currently-valid ids — so no dedicated
     copy is warranted per the i18n key-hygiene rule of only adding keys
     that are meaningfully distinct and reachable).

5. **Tests** `e2e/admin-link-person.spec.ts` (new file), modeled directly on
   `e2e/person-skills.spec.ts` / `e2e/deletion-guard.spec.ts`'s structure
   (CI-safe auth-gate tests unconditionally; `E2E_WITH_AUTH`-gated
   happy-path/validation tests skipped in CI):
   - CI-safe: `PUT /api/admin/people/some-id/link` unauthenticated → 401;
     `DELETE /api/admin/people/some-id/link` unauthenticated → 401 (AC5).
   - `E2E_WITH_AUTH`-gated, with worker-indexed fixture person(s) + a fixture
     user row (see note below) created in `beforeEach` and cleaned up in
     `afterEach`:
     - AC1: PUT with a valid unlinked `user_id` → 200; follow-up GET
       `/api/admin/people` shows `linked_user_id` set; UI: click "Ligar
       conta", select the fixture user, confirm, assert the "Conta" column
       updates without a page reload.
     - AC2: on a fixture person pre-linked via API, click "Desligar conta"
       in the UI → "Conta" column reverts to `unlinkedLabel`; follow-up GET
       confirms `linked_user_id: null`.
     - AC3: link fixture user A to person 1 (200); attempt to link the same
       user A to person 2 → 409 `user_already_linked`; follow-up GET
       confirms person 2's `linked_user_id` is still `null` (no silent
       overwrite) and person 1's is still user A (unchanged).
     - AC4: link a person once (200); attempt to link the same person to a
       *different* user → 409 `person_already_linked`; follow-up GET
       confirms the original link is unchanged (no silent overwrite).
     - AC5: covered by the CI-safe 401 tests above; a Member-role 403 case
       is documented as a manual verification step (same limitation as
       `person-skills.spec.ts` AC7 — this environment cannot provision a
       real non-admin session).
     - AC6: covered structurally by `e2e/i18n-key-parity.spec.ts` (existing,
       automatic) plus a spot-check that `pm-link-{id}` / `pm-unlink-{id}`
       button text matches the exact `messages/pt-PT.json` strings (per
       CLAUDE.md's button-text-extraction discipline).
   - **Fixture user for auth-gated tests**: these tests need at least one
     `public.users` row that is *not* the admin's own account, to link/
     unlink without disturbing the admin session used to drive Playwright.
     Reuse the existing convention from `e2e/claim.spec.ts` /
     `e2e/user-management.spec.ts` for creating/locating a non-admin fixture
     user row via direct service-role DB access in the test file (see
     `deletion-guard.spec.ts`'s `createClient(...,
     process.env.SUPABASE_SERVICE_ROLE_KEY!)` pattern) — there is no public
     "create user" API (users are provisioned only via real OAuth login), so
     the test must either seed a `public.users` row directly via the
     service-role test client, or `test.skip` with a manual-verification
     fallback if no second real account is available in the test Supabase
     project. Document whichever is chosen in the spec's header comment,
     matching the "why is this gated / what does manual verification cover"
     convention from `person-skills.spec.ts`.

### Test plan (mapped to acceptance criteria)

| AC | Test | Mechanism |
|----|------|-----------|
| AC1 (link unlinked person to unlinked user) | `E2E_WITH_AUTH` test: PUT link, assert 200 + `linked_user_id` set via follow-up GET; UI test clicking through the picker | `E2E_WITH_AUTH` |
| AC2 (unlink sets NULL, UI reflects) | `E2E_WITH_AUTH` test: pre-link via API, click "Desligar conta", assert UI + follow-up GET show `linked_user_id: null` | `E2E_WITH_AUTH` |
| AC3 (reject linking a user already linked elsewhere) | `E2E_WITH_AUTH` test: link user A to person 1, attempt link to person 2 → 409 `user_already_linked`; verify no overwrite on either row | `E2E_WITH_AUTH` |
| AC4 (reject re-linking an already-linked person; no silent overwrite) | `E2E_WITH_AUTH` test: link person once, attempt second link to a different user → 409 `person_already_linked`; verify original link unchanged | `E2E_WITH_AUTH` |
| AC5 (non-admin/unauthenticated blocked) | CI-safe: `PUT`/`DELETE .../link` unauthenticated → 401 | CI-safe + manual (Member 403) |
| AC6 (strings from pt-PT.json, AO90) | `e2e/i18n-key-parity.spec.ts` (automatic) + button-text spot check | CI-safe |
| Regression: existing `e2e/people-management.spec.ts`, `e2e/deletion-guard.spec.ts`, `e2e/person-skills.spec.ts` still pass unmodified | Full `npm run test:e2e` run | CI-safe |

### Risks and rollback
- **No new migration** — this story is purely additive at the API/UI layer,
  reusing STORY-11's existing partial unique index. Rollback is trivial:
  revert the route handler, page, and component changes; no schema state to
  unwind.
- **Stale-link edge case (Design decision 5)** is the main subtlety — if
  skipped or later "simplified away," the picker can silently offer users
  that will always 409, which is a confusing (not data-integrity-breaking)
  regression. Called out explicitly for reviewer attention.
- **TOCTOU between pre-check reads and the guarded UPDATE**: narrow, but
  fully closed by the UPDATE's own `WHERE linked_user_id IS NULL` clause
  (AC4) and the unique index (AC3) — the pre-checks are a UX nicety for
  clearer error codes, not the actual correctness mechanism, exactly
  mirroring the claim route's documented reasoning.
- **Fixture-user availability for auth-gated tests**: this story's
  auth-gated tests need a second real `public.users` row distinct from the
  admin driving Playwright, which prior stories haven't needed. If the test
  Supabase project has only one real user, some auth-gated tests may need to
  fall back to a documented manual-verification step (see Step 5 above) —
  flagged so Implementation doesn't stall on this if seeding turns out to be
  awkward.

### Open questions
None blocking. All three "Decide at Refine" items from the story's Technical
notes are resolved above with rationale grounded in existing codebase
precedent (STORY-11's claim route for the race-guard shape, STORY-18/19's
PeopleTable row-mode pattern for the picker UI).
