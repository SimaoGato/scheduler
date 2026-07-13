# STORY-19: Guard deletion of roles and people that are in use
Epic: EPIC-02
Status: done ✅
PR: #37

## User story
As an Admin, I want removing a role or a person that is still referenced by
other data to be handled safely, so that I never silently create orphaned
references or lose data I didn't mean to.

## Context
EPIC-02's acceptance signal requires: "Removing a role/person is handled safely
(no orphaned schedule references — or clearly guarded)." People deletion is
already a soft-delete (`is_active = false`, STORY-07). What is missing is the
**in-use** handling once roles (STORY-17) and skill assignments (STORY-18)
exist:

- Removing a **role** that has skill assignments would orphan those rows (the
  `ON DELETE CASCADE` in STORY-18 would silently delete a person's recorded
  expertise — data the Admin may not intend to lose).
- Removing a **person** who has skill assignments should not silently destroy
  their skill history either.

Because scheduling references arrive in EPIC-04, this story handles the
references that exist **now** (skill assignments) and establishes the
warn-before-destroy pattern that EPIC-04 will extend to schedule references.

## Acceptance criteria
1. Given a role that has **no** skill assignments, when the Admin removes it,
   then it is removed without any extra prompt (unchanged from STORY-17
   behavior).
2. Given a role that **has** one or more skill assignments, when the Admin
   attempts to remove it, then they are shown a clear warning stating how many
   people/assignments reference it and the deletion does **not** proceed
   unless the Admin explicitly confirms.
3. Given the Admin confirms removal of an in-use role, when the deletion
   proceeds, then the role and its dependent skill assignments are handled in a
   defined, documented way (either cascade-remove the assignments **or** block
   and require the Admin to unassign first — pick one and make it explicit; no
   silent partial state).
4. Given a person who **has** skill assignments, when the Admin removes them,
   then the person is soft-deleted (existing behavior) and their skill rows are
   handled consistently with the chosen role policy (documented, not silent).
5. Given any deletion attempt, when the referenced-count is computed, then it is
   computed server-side (the client cannot bypass the guard by calling the API
   directly) — an unconfirmed in-use delete via the API returns a 409 (or a
   documented equivalent) rather than proceeding.
6. Given the warning text, when it renders, then all strings come from
   `messages/pt-PT.json` (AO90), including a count-aware message.

## Out of scope
- Schedule/assignment references from EPIC-04 (that epic extends this guard to
  its own tables using the same pattern).
- Availability references (EPIC-03).
- Undo/restore of soft-deleted people or roles (possible later enhancement).
- Bulk deletion flows.

## Technical notes
- Decide and document the deletion policy up front (Refine should pin this):
  **Recommended** — *block-with-confirm*: the API refuses an in-use delete
  without an explicit `?confirm=1` (or body flag); with confirmation it removes
  the role/person and cascades the dependent `person_role_skills` rows (the
  `ON DELETE CASCADE` from STORY-18 already makes cascade the DB default, so the
  guard lives in the Route Handler, not the schema).
- Role DELETE handler (`app/api/admin/roles/[id]`): before deleting, `SELECT
  count(*) FROM person_role_skills WHERE role_id = :id`. If `> 0` and not
  confirmed → return 409 with the count; if confirmed → proceed.
- Person DELETE handler (`app/api/admin/people/[id]`): same count check against
  `person_role_skills WHERE person_id = :id`.
- Client (`RoleTable.tsx` / `PeopleTable.tsx`): on a 409, show a confirm dialog
  with the returned count, then retry the DELETE with the confirm flag.
- Uses only existing infrastructure (service-role client, `requireAdmin`); no
  new tables.
- Depends on STORY-17 (roles) and STORY-18 (skill assignments) being in place.
- Complexity: **standard** — data-integrity flavored but localized to two
  DELETE handlers and their client callers.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Correction to Technical notes (verified against existing code)

The Technical notes' premise — *"with confirmation it removes the role/person
and cascades the dependent `person_role_skills` rows (the `ON DELETE CASCADE`
from STORY-18 already makes cascade the DB default...)"* — is **not**
consistent with the current implementation and must not be taken at face
value:

- `app/api/admin/roles/[id]/route.ts` DELETE and
  `app/api/admin/people/[id]/route.ts` DELETE both perform a **soft-delete**
  (`UPDATE ... SET is_active = false`), not a hard `DELETE FROM`.
- PostgreSQL's `ON DELETE CASCADE` only fires when the referenced row is
  actually deleted (`DELETE FROM roles/people WHERE id = ...`). An `UPDATE`
  never triggers it, no matter what the row's other columns are set to.
- The STORY-18 migration itself already documents this precisely: *"ON
  DELETE CASCADE on both FKs is defensive only; soft-delete is the actual
  deletion path for people/roles today"*
  (`supabase/migrations/20260705000002_create_person_role_skills.sql`, line
  14). `lib/skills/qualified-roles.ts`'s doc comment independently confirms
  the same thing from the read side: *"orphaned rows on role soft-delete are
  expected, not a bug"* — today, the app tolerates orphaned
  `person_role_skills` rows and simply filters them out at query time via
  `roles!inner(is_active)`.

**Conclusion**: the DB-level FK cascade will never fire for this story's
delete paths. If AC3/AC4 are to actually **remove** the dependent
`person_role_skills` rows (rather than continue leaving them as
permanently-orphaned, invisible rows), the Route Handler must issue an
**explicit hard `DELETE FROM person_role_skills WHERE role_id = :id`** (or
`person_id = :id`) itself, as its own statement, before soft-deleting the
parent. This plan adopts that explicit-cascade approach — it's the only way
to honor "handled in a defined, documented way... no silent partial state"
(AC3) without silently growing an ever-larger set of dead rows that nothing
ever cleans up.

### Affected areas
- **Backend** — `app/api/admin/roles/[id]/route.ts` DELETE,
  `app/api/admin/people/[id]/route.ts` DELETE (in-use count check, explicit
  cascade delete, confirm-flag handling).
- **Frontend** — `components/RoleTable.tsx`, `components/PeopleTable.tsx`
  (inline confirm-prompt UI, replacing the Edit/Remove button pair with
  Confirm/Cancel for the row being removed, mirroring the existing
  `editingId` inline-mode pattern already in both files).
- **i18n** — `messages/pt-PT.json` and `messages/en.json` (new count-aware
  ICU-plural keys in both `RoleManagement` and `PeopleManagement`
  namespaces).
- **UX / design tokens** — `app/globals.css` gains a `--warning`/
  `--warning-foreground` semantic token pair (mirroring the existing
  `--destructive`/`--destructive-foreground` pattern), so the new
  confirm-prompt banner in both tables uses a themed token instead of raw
  Tailwind palette classes with hand-added `dark:` overrides (see Locked
  decision 7 and Risks below — this project has two prior dark-mode-contrast
  incidents, CHORE-11/CHORE-13, so this is treated as a real risk, not a
  formality).
- **Data integrity** — no schema change (no new migration; reuses the
  existing `person_role_skills` table/FKs from STORY-18), but the delete
  path gains a genuine two-statement write (delete children, then
  soft-delete parent) that needs explicit ordering/accepted-risk reasoning
  (see Risks below).
- **Tests** — new e2e spec file; verified no regression risk to existing
  `role-management.spec.ts` / `people-management.spec.ts` /
  `person-skills.spec.ts` fixture cleanup (see Risks below).

### Locked decisions (pinned so implementation is mechanical)

1. **Confirm-flag mechanism**: query parameter `?confirm=1` on the `DELETE`
   request, read via `request.nextUrl.searchParams.get('confirm') === '1'`.
   This is an established pattern in this codebase
   (`app/auth/callback/route.ts` already reads `request.nextUrl.searchParams`)
   and requires no change to how `DELETE` requests are sent from the client
   today (bodyless `fetch(url, { method: 'DELETE' })`) — the confirmed retry
   is simply `fetch(\`${url}?confirm=1\`, { method: 'DELETE' })`. A body flag
   was considered and rejected: it would require adding JSON-body parsing to
   a `DELETE` handler that has none today, for no benefit.
2. **In-use count query** (server-side, authoritative — AC5):
   - Role handler: `serviceClient.from('person_role_skills').select('*', {
     count: 'exact', head: true }).eq('role_id', id)`.
   - Person handler: same shape with `.eq('person_id', id)`.
   - This exact `{ count: 'exact', head: true }` pattern already has two
     precedents in this codebase (`app/auth/callback/route.ts:85`,
     `app/api/admin/users/[id]/route.ts:40`), so it's not a new idiom.
   - Because `person_role_skills` has a composite `PRIMARY KEY (person_id,
     role_id)`, this count is exactly "how many distinct people/roles
     reference it" — no double-counting risk, satisfies AC2's "how many
     people/assignments" wording as a single number.
3. **409 response shape** (stable machine-readable codes, per CLAUDE.md's
   Route Handler convention):
   - Role: `{ error: 'role_in_use', count: <number> }`, HTTP 409.
   - Person: `{ error: 'person_in_use', count: <number> }`, HTTP 409.
   - (Note: `app/api/admin/people/[id]/route.ts` currently uses free-text
     error strings like `'Person not found'` for its *existing* errors —
     this is pre-existing debt from STORY-07, not introduced by this story.
     Do **not** rewrite the existing free-text errors as part of this story
     — out of scope. Only the **new** `person_in_use` code follows the
     machine-readable convention.)
   - **New 500 branch in the person handler** (the hard-delete-of-children
     step failing, see Locked decision 4): use the file's own existing
     free-text style, `{ error: 'Internal server error' }`, matching the
     other 500 branches immediately adjacent to it in the same function —
     not the role handler's `{ error: 'internal' }` code style. Rationale:
     internal consistency within a single function/file outweighs
     cross-file consistency with the role handler here, and this is
     unobservable to the client either way — `PeopleTable.tsx` only special-cases
     the `person_in_use` 409; every other non-ok status (including this new
     500) falls into the same blanket `t('errorGeneric')` fallback regardless
     of the exact string returned (see Step 7 below).
4. **Cascade + soft-delete ordering** (confirmed path, `count > 0 &&
   confirmed`): delete the `person_role_skills` rows **first** (hard
   `DELETE FROM person_role_skills WHERE role_id = :id` / `WHERE person_id =
   :id`), **then** soft-delete the parent (`UPDATE ... SET is_active =
   false`). See Risks below for why this order, not the reverse.
5. **Unchanged when not in use**: if the count is `0`, skip the cascade
   delete entirely (nothing to delete) and soft-delete the parent directly —
   byte-for-byte the same behavior as today (AC1, no regression).
6. **Symmetric confirm UX for role and person deletion** (interpretation of
   AC4): AC4's literal wording only requires that the person's skill rows be
   "handled consistently with the chosen role policy (documented, not
   silent)" — it does not, on its own, mandate that the person-delete flow
   show the *same warn-then-confirm UI* that AC2 explicitly mandates for
   roles. This plan interprets AC4 to require the identical warn+confirm UX
   (banner + Confirm/Cancel, not just consistent server-side handling),
   because: (a) "documented, not silent" is most naturally read as "the
   Admin is told before it happens," which for roles (AC2) is explicitly a
   pre-delete warning, not a post-hoc log entry — treating people
   differently would mean an Admin can silently destroy a person's skill
   history with one click while the identical action on a role requires
   confirmation, which is an inconsistent (and worse) UX for the more
   destructive of the two entities (a person's full skill profile vs. a
   single role's assignee list); (b) STORY-19's own Context section states
   the goal is to "establish the warn-before-destroy pattern that EPIC-04
   will extend," implying a general warn-before-destroy pattern, not a
   role-only one. If this interpretation is wrong, it is a scope
   disagreement to flag to the story owner before implementation, not
   something to silently resolve differently between the two tables.
7. **Warning banner styling**: add a `--warning`/`--warning-foreground` HSL
   token pair to `app/globals.css` (`:root` and `.dark` blocks, plus the
   `@theme inline` mapping), following the exact structure already used for
   `--destructive`/`--destructive-foreground`. Use `bg-warning/10
   text-warning` for the confirm-prompt banner (mirrors the existing
   `bg-destructive/10 text-destructive` pattern used for `errorMessage`) —
   **not** raw Tailwind palette classes (`bg-amber-500/10 text-amber-900`)
   with hand-added `dark:` overrides. This is the more idiomatic fix given
   this project's existing token-based theming architecture, and structurally
   prevents the two dark-mode-contrast classes of bug already seen in
   CHORE-11/CHORE-13 (a utility that's only correct in one color scheme)
   because the token itself carries per-scheme values, the same way
   `--destructive` already does. Suggested starting values (verify actual
   rendered contrast before finalizing — do not assume the numbers below are
   final without checking, per the Risks section):
   - `:root`: `--warning: 32 95% 44%;` `--warning-foreground: 0 0% 100%;`
   - `.dark`: `--warning: 38 92% 60%;` `--warning-foreground: 240 10% 3.9%;`
     (lighter amber + dark text in dark mode, the inverse relationship of
     `--destructive`'s dark-mode values, chosen deliberately for legibility
     against the near-black `--background` — see Risks below for why this
     needs an explicit visual check, not just copying `--destructive`'s
     lighten/darken direction blindly).

### Step-by-step (test-first where practical)

1. Write `e2e/deletion-guard.spec.ts` first (CI-safe unauthenticated/401
   tests + structure for the E2E_WITH_AUTH-gated tests below), matching the
   current AC wording, before touching any Route Handler or component.
2. `app/api/admin/roles/[id]/route.ts` DELETE:
   - Read `confirmed` from `request.nextUrl.searchParams` (after the
     existing `requireAdmin` + UUID guards, before the DB work).
   - Add the count query described above.
   - If `count > 0 && !confirmed` → return 409 `role_in_use` with `count`.
   - If `count > 0 && confirmed` → delete `person_role_skills` rows for
     `role_id = id` first; on error, `console.error` and return 500
     `internal` **without** proceeding to the soft-delete.
   - Then perform the existing soft-delete UPDATE (unchanged).
3. `app/api/admin/people/[id]/route.ts` DELETE: mirror step 2 with
   `person_id`/`person_in_use`, preserving the file's existing free-text
   error strings for pre-existing branches (see Locked decision 3).
4. Add new i18n keys (both `messages/pt-PT.json` and `messages/en.json`,
   same PR — key parity is enforced by `e2e/i18n-key-parity.spec.ts`):
   - `RoleManagement.confirmRemoveInUse` (ICU plural, pt-PT, AO90):
     `"Esta função está associada a {count, plural, one {# pessoa} other {# pessoas}}. Remover mesmo assim?"`
     — en: `"This role is associated with {count, plural, one {# person} other {# people}}. Remove anyway?"`
   - `RoleManagement.confirmRemoveButton`: pt-PT `"Remover mesmo assim"` /
     en `"Remove anyway"`.
   - `PeopleManagement.confirmRemoveInUse` (ICU plural, pt-PT, AO90):
     `"Esta pessoa tem {count, plural, one {# competência associada} other {# competências associadas}}. Remover mesmo assim?"`
     — en: `"This person has {count, plural, one {# associated skill} other {# associated skills}}. Remove anyway?"`
   - `PeopleManagement.confirmRemoveButton`: pt-PT `"Remover mesmo assim"` /
     en `"Remove anyway"`.
   - Reuse the existing `cancelButton` key in both namespaces for the
     confirm-prompt's Cancel action — no new key needed.
   - This is the first use of ICU plural syntax in this codebase (verified
     via grep — no `{count, plural` precedent exists yet). next-intl v4 is
     built on `intl-messageformat` and supports this natively via
     `useTranslations()` + `t('key', { count })`; no extra config needed, but
     explicitly test both `count === 1` (singular) and `count > 1` (plural)
     rendering in pt-PT, since this is a new pattern for the team.
5. `app/globals.css`: add the `--warning`/`--warning-foreground` token pair
   per Locked decision 7, in both `:root` and `.dark` blocks, plus the
   corresponding `--color-warning`/`--color-warning-foreground` entries in
   the `@theme inline` block. Do this **before** step 6/7 below so the
   banner components can reference `bg-warning/10 text-warning` directly.
   Verify actual contrast in both themes (compiled CSS + a quick
   headless-Chromium or manual render check, mirroring the verification
   technique CLAUDE.md documents for BUGFIX-03) before moving on — do not
   assume the starting HSL values are correct without checking.
6. `components/RoleTable.tsx`:
   - Add `confirmingRemoveId: string | null` and `confirmMessage: string |
     null` state (mirrors the existing `editingId` inline-mode pattern).
   - `handleRemove(roleId, confirm = false)`: call
     `DELETE /api/admin/roles/${roleId}${confirm ? '?confirm=1' : ''}`.
     - `response.ok` → remove the row, clear `confirmingRemoveId`/`confirmMessage`.
     - `409` with `error === 'role_in_use'` → set `confirmingRemoveId =
       roleId`, `confirmMessage = t('confirmRemoveInUse', { count:
       body.count ?? 0 })`. Do **not** route this into the top
       `errorMessage` banner — it's an actionable prompt, not a terminal
       error.
     - Any other non-ok status → existing `mapErrorCode` path (add
       `role_in_use` is deliberately **not** added to `ERROR_CODE_KEYS`,
       since it's handled specially above and should never reach the
       generic mapper).
   - Add `cancelRemoveConfirm()`: clears both state fields.
   - Render: when `confirmingRemoveId === role.id`, swap the Edit/Remove
     buttons in the actions `<td>` for Confirm (`data-testid
     rm-remove-confirm-${role.id}`, calls `handleRemove(role.id, true)`) and
     Cancel (`data-testid rm-remove-cancel-${role.id}`, calls
     `cancelRemoveConfirm`) buttons — same shrink-to-fit actions column,
     same `min-h-[44px]` tap-target convention. Render `confirmMessage` in a
     banner above the table (reuse the existing `aria-live="polite"` +
     `data-testid` pattern used for `errorMessage`, but with a distinct
     `data-testid="rm-confirm-banner"` and non-destructive styling —
     `bg-warning/10 text-warning` (the new semantic token from step 5), so it
     reads as a warning/prompt, not a failure, in both light and dark theme).
   - Disable Edit/Remove on *other* rows while a confirm prompt is open
     (`disabled={isLoading || loadingId !== null || (confirmingRemoveId !==
     null && confirmingRemoveId !== role.id)}`), consistent with the
     existing "block concurrent row actions" convention already in this
     file.
7. `components/PeopleTable.tsx`: mirror step 6 exactly and **symmetrically**
   (per Locked decision 6 — this is not an optional/lesser version of the
   role UX):
   - Same `confirmingRemoveId`/`confirmMessage` state shape.
   - Same `pm-remove-confirm-${id}` / `pm-remove-cancel-${id}` testids and
     `pm-confirm-banner` (`bg-warning/10 text-warning`) styling.
   - Same `person_in_use` 409 detection and `t('confirmRemoveInUse', {
     count })` message.
   - Same per-row disabling of Edit/Remove/Competências on other rows while
     a confirm prompt is open on any row.
   - Note PeopleTable currently has **no** `ERROR_CODE_KEYS`/`mapErrorCode`
     structure at all (unlike RoleTable) — do not add one for unrelated
     errors; only add the minimal `if (response.status === 409 &&
     errorBody.error === 'person_in_use')` branch, leaving the existing
     blanket `t('errorGeneric')` fallback for every other failure mode
     (including the new person-handler 500 branch from Locked decision 3)
     untouched — avoid unrelated scope creep into STORY-07's error handling.
8. Run the full gate: `npm run lint`, `npx tsc --noEmit`, `npm run build`,
   `npm run test:e2e`.

### Test plan (AC → test)

| AC | Automated test | Notes |
|----|-----------------|-------|
| AC1 — no assignments → removed without prompt | `e2e/deletion-guard.spec.ts` "AC1" (role) — direct `DELETE` with no confirm on a freshly-created role with zero skill rows → 200, no `count` in body; extends STORY-17's existing AC5 coverage with an explicit "not a 409" assertion | Auth-gated |
| AC2 — in-use role: warning shown, deletion blocked without confirm | `e2e/deletion-guard.spec.ts` "AC2" — API: create role + person + skill assignment, unconfirmed `DELETE` → 409 `role_in_use`, `count: 1`, role still present on re-`GET`. UI: click Remover, assert `rm-confirm-banner` visible with the exact count-aware pt-PT text, row NOT removed | Auth-gated; exact banner text extracted from `messages/pt-PT.json` at test-authoring time, not guessed (CHORE-10 convention) |
| AC3 — confirmed in-use role delete: role + skill rows both actually removed, no silent partial state | `e2e/deletion-guard.spec.ts` "AC3" — after `DELETE ...?confirm=1`, `GET /api/admin/roles` excludes it, **and** a direct service-role Supabase query (`createClient` with `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, mirroring the auth-gated pattern) confirms `person_role_skills` has zero rows for that `role_id` — proves the explicit hard-delete happened, not just the pre-existing soft-delete + query-time filter | Auth-gated; this is the one assertion that actually distinguishes "explicitly cascaded" from "silently orphaned but filtered," so it must query the raw table, not a filtered API endpoint |
| AC4 — in-use person: soft-deleted + skill rows handled consistently (cascade), **with the same warn+confirm UX as roles** (Locked decision 6) | `e2e/deletion-guard.spec.ts` "AC4" — API: create person + role + skill assignment, unconfirmed `DELETE` → 409 `person_in_use`, `count: 1`, person still present + still active on re-`GET`; confirmed `DELETE ...?confirm=1` → `is_active = false` **and** zero `person_role_skills` rows for that `person_id` (service-role query, same technique as AC3). **UI (new in this revision, was previously API-only):** click Remover on the in-use person, assert `pm-confirm-banner` is visible with the exact count-aware pt-PT text from `messages/pt-PT.json` for `count === 1`; repeat with a second skill assignment to assert `count === 2` renders the plural form correctly; assert `pm-remove-confirm-${id}`/`pm-remove-cancel-${id}` testids exist and behave (Cancel restores Editar/Remover without deleting; Confirm removes the row); assert Editar/Remover/Competências on *other* rows are disabled while the confirm prompt is open, then re-enabled after Cancel — i.e. full UI parity with AC2's role-side coverage, not just the API/DB assertions | Auth-gated; this closes the gap flagged in Refine revision 1 where the person-side ICU-plural string and confirm UI had zero test coverage |
| AC5 — server-side count is authoritative; API bypass still 409 | `e2e/deletion-guard.spec.ts` "AC5" — direct `page.request.delete` (no UI) on an in-use role/person without `?confirm=1` → 409 both times (retry doesn't silently pass); with `?confirm=1` → 200. Plus regression: unauthenticated `DELETE` on both endpoints still 401 before any count logic runs (existing pattern from `role-management.spec.ts`/`people-management.spec.ts`) | CI-safe for the 401 half; auth-gated for the 409/200 half |
| AC6 — all warning strings from `messages/pt-PT.json` (AO90), count-aware, **for both roles and people** | `e2e/i18n-key-parity.spec.ts` (existing, automatically covers the new keys in both namespaces once added to both locale files — no test change needed) + `e2e/deletion-guard.spec.ts` UI assertions in **both** AC2 (role, `RoleManagement.confirmRemoveInUse`) and AC4 (person, `PeopleManagement.confirmRemoveInUse`) reading the exact string via `readFileSync('messages/pt-PT.json')` and asserting `count === 1` and `count === 2` render with correct pt-PT plural grammar for **each** namespace independently — the two ICU strings are authored separately and must each be verified, not just one taken as a proxy for the other | CI-safe (key parity) + auth-gated (rendered text, both namespaces) |

### Risks and rollback

- **Risk — two-statement write is not atomic.** Supabase-js has no built-in
  multi-table transaction API without a Postgres RPC/stored procedure, which
  this story's complexity budget doesn't justify adding. Mitigation:
  deliberately order the two writes as **delete children, then soft-delete
  parent** (not the reverse). If the second write fails after the first
  succeeds, the role/person remains visibly unchanged in the list (still
  `is_active = true`) — the user sees an error and can retry; a retry will
  now see `count === 0` and complete immediately, self-healing. The reverse
  order (soft-delete parent first) would risk the opposite: the row
  disappearing from the list while orphaned skill rows survive underneath
  it invisibly — a genuine silent partial state, which AC3 explicitly
  forbids. Document this explicitly as an accepted-risk comment in both
  Route Handlers, following the existing TOCTOU-acceptance pattern
  documented in CLAUDE.md (STORY-18, `app/api/admin/people/[id]/skills/[roleId]/route.ts`
  lines 91-96).
- **Risk — second, distinct failure mode: hard-delete of children succeeds,
  then the subsequent soft-delete of the parent fails.** This is a genuinely
  different (and worse) case than the one above, and is called out
  separately rather than folded into the ordering rationale: if the admin
  does **not** retry after seeing the 500 (closes the tab, gets distracted),
  the role/person is left **active** in the list while its skill-assignment
  history is **already, unrecoverably gone** — a real inconsistent end state
  that persists indefinitely, not just a transient one healed by the next
  click. This is explicitly accepted as a risk for this story, not
  engineered away, for these reasons: (a) the admin has already explicitly
  confirmed via the count-aware warning prompt that they intend the skill
  rows to be deleted, immediately before this call — so the data loss
  itself is desired, only its decoupling from the parent's own removal (if
  the admin never retries) is a surprise; (b) both statements are simple,
  dependency-free Supabase calls issued back-to-back with no intervening
  logic, so the failure window requires a transient DB/network fault
  landing precisely between them — vanishingly unlikely in practice for an
  admin-only, low-concurrency surface; (c) a real fix requires wrapping both
  statements in one Postgres transaction via a `SECURITY DEFINER` RPC
  function (with the associated `REVOKE`/`GRANT` dance CLAUDE.md documents
  for that pattern) — disproportionate machinery for this story's
  complexity budget, and the same class of trade-off STORY-18 already made
  explicitly for its own TOCTOU window in the same subsystem. If this proves
  to actually bite in production, promote to an RPC in a follow-up story
  rather than retrofitting one under this story's scope. This acceptance
  must be written as an explicit code comment in both Route Handlers (not
  just this doc), immediately above the soft-delete UPDATE call, so a future
  reader hitting this exact failure mode understands it was a considered
  trade-off, not an oversight.
- **Risk — regression in existing e2e fixture cleanup.** Audited every
  existing `DELETE /api/admin/(roles|people)/...` call site in
  `e2e/person-skills.spec.ts`, `e2e/role-management.spec.ts`,
  `e2e/people-management.spec.ts`, `e2e/people-table-alignment.spec.ts`: all
  of them either never create a skill assignment for the fixture, or
  explicitly delete the skill row before deleting the person/role in
  `afterEach`. None will observe a new 409 from this change. Still, run the
  full `npm run test:e2e` gate (Definition of Done item 4/7) before calling
  this done, not just the new spec file.
- **Risk — first use of ICU plural syntax in this codebase, in two
  independently-authored strings.** No existing precedent to copy exactly,
  and (per the CRITICAL fix in this revision) `RoleManagement.confirmRemoveInUse`
  and `PeopleManagement.confirmRemoveInUse` are two separate strings that
  could each independently have a grammar/interpolation bug. Mitigation:
  explicit dual-count test for **each** namespace (AC2 for roles, AC4 for
  people) asserting both `count === 1` and `count > 1` render with correct
  pt-PT plural grammar, plus a local dev smoke check of both rendered banner
  texts before relying on the automated tests alone.
- **Risk — new `--warning` token pair could repeat the exact class of bug
  CHORE-11/CHORE-13 already fixed once** (a color that looks correct in one
  theme and low-contrast/illegible in the other). Mitigation: this plan
  deliberately does **not** just copy `--destructive`'s dark-mode
  lighten/darken direction — see Locked decision 7's suggested values and
  Step 5's requirement to verify actual rendered contrast (compiled CSS +
  visual check) in both themes before considering the token pair final, not
  after the fact.
- **Rollback**: pure code revert, no migration to undo (no schema change in
  this story — reuses the existing `person_role_skills` table/FKs from
  STORY-18 verbatim; `app/globals.css`'s new token pair is a plain CSS
  addition, not a migration). Revert the two Route Handler diffs, the two
  Client Component diffs, the i18n key additions (both locale files), the
  `app/globals.css` token addition, and the new e2e spec file.

### Complexity tag: standard

Justification: this touches data integrity (an explicit, previously-missing
hard-delete cascade, corrected against a factually-incorrect premise in the
story's own Technical notes about `ON DELETE CASCADE` firing on soft-delete)
across two Route Handlers and two Client Components, which per CLAUDE.md's
rubric is "at least standard." It stops short of `complex`: there is no
auth/security surface change (reuses `requireAdmin` verbatim), no real
concurrency/locking need (the accepted-risk ordering argument above is
sufficient, not a stopgap for a live production race — this is an
admin-only, low-traffic surface, same risk class as the existing
TOCTOU-acceptance precedent in STORY-18), and no money. Each individual
change (count-query, confirm-flag-via-query-param, inline-confirm UI
mirroring the existing `editingId` pattern, ICU plural i18n) is
well-precedented in the codebase or in next-intl's documented API once
pinned by this plan — the reasoning risk is concentrated entirely in getting
the write ordering and the CASCADE-doesn't-fire correction right, both of
which this plan now pins explicitly, leaving little open-ended judgment for
the implementer.
