# STORY-17: Manage roles (create / rename / remove) with default slots per Sunday
Epic: EPIC-02
Status: done ✅
PR: 31

## User story
As an Admin, I want to create, rename, and remove configurable roles and set
how many slots each role needs on a normal Sunday, so that the schedule
reflects our actual ministry structure (Sound, Multimedia, …) instead of a
hardcoded list.

## Context
Roles are the second piece of master data the generator consumes (people being
the first — STORY-07). PRD §6 FR1 requires roles to be **configurable, not
hardcoded**, and FR2 requires each role to carry a **default number of slots
per Sunday** (e.g. Sound = 1). The ad-hoc per-week "training seat" is explicitly
a generation concern (EPIC-04, PRD Decision 2) and is out of scope here — the
only slot concept in this story is the per-role default.

Default slots is folded into this story rather than split out because a role
with no slot count is not independently usable by the generator; shipping roles
without slots would create an intermediate state that adds ceremony (a second
migration on the same table, a second UI) without delivering separable value.

This story mirrors the people-CRUD pattern established in STORY-07 (service-role
client, `requireAdmin` guard, per-page admin redirect, RLS + grants, inline
add/edit table). See EPIC-02 scope and PRD §6 FR1–FR2.

## Acceptance criteria
1. Given an Admin on the roles admin screen, when they create a role by
   entering a **name** and a **default slots-per-Sunday** value, then a role
   record is saved and appears in the roles list showing both the name and the
   slot count.
2. Given an Admin creates a role without specifying a slot count, when the role
   is saved, then it defaults to **1** slot per Sunday.
3. Given an Admin, when they submit a slot count that is not a positive integer
   (0, negative, blank, or non-numeric), then the create/edit is rejected with
   a clear validation message and no record is written/changed (server returns
   400, not 500).
4. Given an existing role, when the Admin edits its name and/or slot count,
   then the change is saved and reflected in the roles list.
5. Given an existing role, when the Admin removes it **and it is not in use**
   (no skill assignments reference it — see STORY-19 for the in-use guard),
   then the role no longer appears in the list.
6. Given the roles admin screen, when a non-admin (Member) or unauthenticated
   user attempts to reach the page or any roles API route, then they are
   redirected/blocked exactly as the people screen is (page → redirect to
   login/`?denied=1`; API → 401/403).
7. Given two roles are created with the same name, then the request is rejected
   with a clear "role name already exists" validation message (roles, unlike
   people, are referenced by name in the UI and should be unambiguous —
   enforce a case-insensitive uniqueness constraint).

## Out of scope
- Ad-hoc / per-Sunday extra "training" slots — that is generation (EPIC-04).
- Assigning people or skill levels to roles (STORY-18).
- Guarding deletion of a role that is already in use (STORY-19) — this story
  only needs the plain delete for not-in-use roles; the guard is layered on
  top in STORY-19.
- Reordering roles or per-role display customization.

## Technical notes
- New migration `supabase/migrations/<ts>_create_roles_table.sql`:
  - `public.roles`: `id UUID PK default gen_random_uuid()`, `name TEXT NOT NULL`,
    `default_slots INT NOT NULL DEFAULT 1 CHECK (default_slots >= 1)`,
    `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at TIMESTAMPTZ`.
  - Case-insensitive uniqueness on active names, e.g.
    `CREATE UNIQUE INDEX ... ON public.roles (lower(name)) WHERE is_active` (AC7).
  - Enable RLS; reuse `public.get_my_role()`; policy `roles_admin_all`.
  - **Grants to BOTH `authenticated` AND `service_role`** per CLAUDE.md
    (STORY-07's migration only granted `authenticated`; the service-role client
    used by Route Handlers needs its own explicit GRANT or it hits `42501`).
- `types/roles.ts` — `RoleRow { id, name, default_slots, is_active }` (no
  server-only imports; mirrors `types/people.ts`).
- API routes `app/api/admin/roles/route.ts` (GET+POST) and
  `app/api/admin/roles/[id]/route.ts` (PATCH+DELETE), following the people
  handlers: `requireAdmin` first, then validate body (invalid JSON → 400,
  invalid slot count → 400), service-role queries, 404 on missing row.
- Page `app/[locale]/admin/roles/page.tsx` + client `components/RoleTable.tsx`
  (inline add/edit, `min-h-[44px]` tap targets, `data-testid="rm-error"` with
  `aria-live="polite"`).
- Nav: add an admin-only "Funções" (or "Papéis") entry in `components/AppNav.tsx`.
- i18n: new `RoleManagement` namespace + `Nav.roles` key in `messages/pt-PT.json`,
  AO90 spelling, no orphaned draft keys.
- E2E: CI-safe auth-gate specs (401/redirect) like `people-management.spec.ts`,
  plus auth-gated (`E2E_WITH_AUTH`) happy-path/validation specs for ACs 1–5, 7.
- Complexity: **standard** (same layer count as STORY-07 plus numeric
  validation and a uniqueness constraint).

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Affected areas
- **data** — new `public.roles` table migration (Supabase SQL)
- **backend** — 4 new API Route Handlers (`/api/admin/roles`, `/api/admin/roles/[id]`)
- **frontend** — new admin page (`app/[locale]/(app)/admin/roles/page.tsx`), new client
  component (`components/RoleTable.tsx`), nav update (`components/AppNav.tsx`)
- **ux** — inline add/edit table with two fields (name + slots) per row
- **i18n** — new `RoleManagement` namespace + `Nav.roles` key in `messages/pt-PT.json`

This mirrors STORY-07's layer count exactly, plus one extra field (`default_slots`)
and a uniqueness constraint, which is why the complexity tag is `standard`, not `trivial`.

---

### Files to create / modify

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260704000001_create_roles_table.sql` | create | `public.roles` table, partial unique index, RLS policy, grants to **both** `authenticated` and `service_role` in one migration (avoids the STORY-07 follow-up-fix-up-migration gap) |
| `types/roles.ts` | create | `RoleRow` shared type (no server-only imports) |
| `app/api/admin/roles/route.ts` | create | `GET` (list active roles) + `POST` (create) |
| `app/api/admin/roles/[id]/route.ts` | create | `PATCH` (rename/reslot) + `DELETE` (soft-delete) |
| `app/[locale]/(app)/admin/roles/page.tsx` | create | Server Component page, mirrors `admin/people/page.tsx` |
| `components/RoleTable.tsx` | create | Client Component, mirrors `PeopleTable.tsx` + slots field |
| `components/AppNav.tsx` | modify | add admin-only "Funções" nav entry after "Equipa" |
| `messages/pt-PT.json` | modify | add `Nav.roles` key + `RoleManagement` namespace |
| `e2e/role-management.spec.ts` | create | CI-safe auth-gate tests + `E2E_WITH_AUTH`-gated happy-path/validation tests |
| `e2e/app-nav.spec.ts` | modify | **regression fix (STORY-16 AC3)**: update the admin-nav link-count assertion from 2 to 3 and assert the new "Funções" link, in the same step that adds the nav entry — see Step 7 |

---

### Step-by-step approach (test-first where possible)

#### Step 1 — Database migration
`supabase/migrations/20260704000001_create_roles_table.sql`:

```sql
-- STORY-17: Create public.roles table for configurable roles + default
-- slots per Sunday.
--
-- Key design decisions:
--   - default_slots INT NOT NULL DEFAULT 1 CHECK (default_slots >= 1) — AC2, AC3
--   - Case-insensitive uniqueness on active role names via partial unique
--     index (soft-deleted roles do not block reuse of their name) — AC7
--   - is_active boolean for soft-delete, consistent with public.people — AC5
--   - Reuses public.get_my_role() from migration 20260628000002
--   - Grants to BOTH authenticated AND service_role in THIS migration
--     (STORY-07's people migration initially only granted `authenticated`
--     and needed a follow-up fix-up migration 20260701000002 once the
--     service-role client hit 42501; avoid repeating that gap here)

CREATE TABLE IF NOT EXISTS public.roles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  default_slots  INT         NOT NULL DEFAULT 1 CHECK (default_slots >= 1),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS roles_active_name_lower_idx;
CREATE UNIQUE INDEX roles_active_name_lower_idx
  ON public.roles (lower(name))
  WHERE is_active;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_admin_all" ON public.roles;
CREATE POLICY "roles_admin_all" ON public.roles
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO service_role;
```

#### Step 2 — Shared type `types/roles.ts`

```ts
export interface RoleRow {
  id: string
  name: string
  default_slots: number
  is_active: boolean
}
```

#### Step 3 — Validation helper (co-located in the route file, no new module needed)

A single parsing function decides AC2 vs AC3 by distinguishing **omission** from
an **explicitly blank/invalid value** — this is the one non-obvious decision in
this story and must be implemented exactly as follows:

```ts
// Returns the validated slot count, or null if the value is invalid.
// `undefined` (key omitted from the request body) is NOT invalid — it means
// "not specified" and defaults to 1 (AC2). An explicit blank string, zero,
// negative, or non-numeric value IS invalid (AC3) and must return null so the
// caller can 400.
function parseDefaultSlots(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 1 // AC2: not specified → default 1
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 1 ? raw : null
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '' || !/^\d+$/.test(trimmed)) return null // blank/non-numeric/negative/decimal
    const n = Number(trimmed)
    return Number.isInteger(n) && n >= 1 ? n : null
  }
  return null
}
```

#### Step 4 — API Route Handlers

**`app/api/admin/roles/route.ts`** (GET + POST), following the people handlers exactly:

- `GET`: `requireAdmin` → service-role client → `SELECT id, name, default_slots, is_active FROM roles WHERE is_active = true ORDER BY name ASC`.
- `POST`: `requireAdmin` → parse JSON in its own try/catch (malformed → `400 { error: 'invalid_json' }`) → validate `name` (trim, non-empty; else `400 { error: 'name_required' }`) → `parseDefaultSlots(body.default_slots)` (invalid → `400 { error: 'invalid_slots' }`) → `INSERT` via service client → on Supabase `error`, check `error.code === '23505'` and return `409 { error: 'duplicate_name' }`; any other DB error → `500 { error: 'internal' }` (log via `console.error`) → success → `201` with the created `RoleRow`.

**`app/api/admin/roles/[id]/route.ts`** (PATCH + DELETE):

- `PATCH`: `requireAdmin` first, **then** `await params` (CLAUDE.md ordering convention) → validate `id` against the UUID regex (`400 { error: 'invalid_id' }`) → parse JSON (`400 { error: 'invalid_json' }`) → validate `name` and `default_slots` same as POST → `UPDATE roles SET name = ?, default_slots = ? WHERE id = ? AND is_active = true` → on `error.code === '23505'` → `409 { error: 'duplicate_name' }` → no row updated → `404 { error: 'not_found' }` → success → `200 { ok: true }`.
- `DELETE`: `requireAdmin` first, then `await params` → validate UUID → `UPDATE roles SET is_active = false WHERE id = ? AND is_active = true` (soft-delete, same pattern as people) → no row updated → `404 { error: 'not_found' }` → success → `200 { ok: true }`.

Error bodies use **stable machine-readable codes** (`name_required`, `invalid_slots`,
`duplicate_name`, `not_found`, `invalid_id`, `invalid_json`) rather than free-text
English sentences (departing slightly from `people/route.ts`'s `{ error: 'Name is
required' }` style). This follows the `{ error: 'last_admin' }` precedent already
used in `app/api/admin/users/[id]/route.ts`, and is *necessary* here (not just
stylistic) because the client must map specific codes to specific pt-PT messages
per AC3/AC7 ("a clear validation message"), unlike `PeopleTable`, which only ever
shows one generic error string.

409 (not 400) is used for the duplicate-name conflict, consistent with the
existing `last_admin` 409 precedent for a state-conflict class of error, while
400 is reserved for malformed-input class errors (JSON, id format, field values).

**Mass-assignment guard:** both `POST` and `PATCH` must construct the
`INSERT`/`UPDATE` payload as an explicit object literal built from the
validated `name` and `default_slots` local variables only —
`.insert({ name, default_slots })` / `.update({ name, default_slots })` —
never `.insert(body)` or any spread of the raw parsed JSON. This is what
actually prevents a caller from smuggling `is_active`, `id`, or `created_at`
into the write; the client-side discipline noted in Step 5 is defense in
depth only, not the enforcement point.

#### Step 5 — Client Component `components/RoleTable.tsx`

`'use client'` component, structurally mirrors `PeopleTable.tsx` with a second
field:

- State: `rows: RoleRow[]`, `addName`, `addSlots` (string, pre-filled `'1'`),
  `editingId`, `editName`, `editSlots`, `loadingId`, `errorMessage`.
- Add form: name input (`data-testid="rm-add-input"`, `aria-label={t('namePlaceholder')}`)
  + slots input (`data-testid="rm-add-slots-input"`, `type="text"` pre-filled
  `"1"` — kept as text, not `type="number"`, so a deliberately-cleared field
  submits an empty string that the server can reject per AC3, rather than the
  browser silently coercing it — `aria-label={t('slotsPlaceholder')}`) +
  submit button (`data-testid="rm-add-submit"`).
- **Accessible labels (WCAG SC 1.3.1 — flagged in Challenge review):** each row
  has TWO inputs (name + slots), so each needs its own distinct `aria-label`
  in BOTH add and edit modes — reusing a single label for both is
  non-compliant. In edit mode (mirroring `PeopleTable.tsx`'s
  `aria-label={t('namePlaceholder')}` pattern on its single edit input): the
  name input gets `aria-label={t('namePlaceholder')}` and the slots input
  gets `aria-label={t('slotsPlaceholder')}`. This applies to all four inputs
  in the component (add-name, add-slots, edit-name, edit-slots) — no input
  may fall back to placeholder-only labelling.
- Client-side pre-validation before `fetch` (UX only; server is the source of
  truth): blank name → `errorNameRequired`; slots that fail the same shape
  check as `parseDefaultSlots` (blank/non-numeric/≤0) → `errorInvalidSlots`.
  Do **not** skip the request on omission vs blank distinction client-side —
  since the input is pre-filled with `'1'`, an empty value only occurs when the
  user deliberately clears it, which correctly maps to the AC3 "blank" case.
- On successful POST: prepend response `RoleRow` to `rows`, **re-sort** by
  `name.localeCompare(b.name, 'pt')` (same as `PeopleTable`).
- On successful PATCH (edit): update the row in place in `rows` **and
  re-sort** — this is a deliberate improvement over `PeopleTable.handleEdit`,
  which does not currently re-sort after a name edit (a latent gap noted in
  CLAUDE.md's "Client-side sort order" rule but out of scope to fix in
  `PeopleTable` itself here).
- On successful DELETE: filter the row out of `rows` (no re-sort needed).
- Error mapping: a small `Record<string, string>` maps API error codes
  (`name_required`, `invalid_slots`, `duplicate_name`, `not_found`) to
  `t('errorNameRequired')` / `t('errorInvalidSlots')` / `t('errorDuplicateName')`
  / `t('errorGeneric')`, falling back to `t('errorGeneric')` for unmapped codes.
- Error banner: `data-testid="rm-error"`, `aria-live="polite"` (per story tech
  notes and the `role="alert"` route-announcer collision rule).
- Table columns: Name, Slots (`default_slots`), Actions. Actions column keeps
  the `w-[1%] whitespace-nowrap text-right` shrink-to-fit pattern; inline edit
  uses the same `form={editFormId}` attribute-association trick as
  `PeopleTable` (both the name and slots inputs get the `form` attribute,
  pointing at a `<form>` that lives in the actions `<td>` wrapping Save/Cancel).
- All interactive elements `min-h-[44px]` (WCAG tap-target floor).
- `data-testid` convention: `rm-add-input`, `rm-add-slots-input`,
  `rm-add-submit`, `rm-edit-{id}`, `rm-save-{id}`, `rm-cancel-{id}`,
  `rm-remove-{id}`.
- **Mass-assignment guard (defense in depth, also applies server-side — see
  Step 4):** both the client's `fetch` bodies and the API route's `INSERT`/
  `UPDATE` calls must build their payload from validated local variables as
  explicit `{ name, default_slots }` object literals — **never** spread the
  raw request/form body (e.g. never `insert(body)` or `insert({ ...body })`).
  This preempts a caller (or a future refactor) smuggling `is_active` or `id`
  into the write payload.

#### Step 6 — Admin page `app/[locale]/(app)/admin/roles/page.tsx`

Server Component, identical guard/fetch pattern to `admin/people/page.tsx`:
1. `getSessionUser()` → redirect to `/${routing.defaultLocale}/login` if null.
2. `getUserRole(user.id)` → redirect to `/${routing.defaultLocale}/?denied=1` if not admin.
3. `getTranslations('RoleManagement')` only after both guards (lazy-load rule).
4. `createServiceClient()` → `SELECT id, name, default_slots, is_active FROM roles WHERE is_active = true ORDER BY name ASC`, destructuring `{ data, error }` and logging `error`.
5. Render `<RoleTable initialRoles={roles} />`.

#### Step 7 — Nav update `components/AppNav.tsx` (+ regression fix in `e2e/app-nav.spec.ts`)

Add a third admin-only `<li>` after "Equipa":

```tsx
<li>
  <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
    <Link href="/admin/roles">{t('roles')}</Link>
  </Button>
</li>
```

**Regression fix (CRITICAL — flagged in Challenge review):** `e2e/app-nav.spec.ts`
(STORY-16 AC3) currently asserts the admin nav renders **exactly 2** links
("Utilizadores", "Equipa") via `toHaveCount(2)`. Adding a third link without
updating this test would fail it under `E2E_WITH_AUTH`. In this same step,
update `e2e/app-nav.spec.ts`'s `'AC3: Admin nav shows exactly Utilizadores and
Equipa'` test:
- change `await expect(links).toHaveCount(2)` to `await expect(links).toHaveCount(3)`
- add `await expect(nav.getByRole('link', { name: 'Funções' })).toBeVisible()`
  alongside the existing "Utilizadores"/"Equipa" assertions
- update the test title and the AC3 manual-verification bullet in the file's
  header comment to say "exactly three links: Utilizadores, Equipa, and
  Funções" so the doc comment doesn't silently drift from the assertion.

#### Step 8 — i18n `messages/pt-PT.json`

Add to the `Nav` namespace:
```json
"roles": "Funções"
```
(Chosen over "Papéis" — "Funções" is the more natural pt-PT term for
ministry/team roles and avoids the STORY-17 tech-note's ambiguity; this is a
one-time naming decision, not left open for the implementer to re-litigate.)

Add a new `RoleManagement` namespace (placed after `PeopleManagement`, AO90 spelling, only keys actually consumed by `RoleTable.tsx`):
```json
"RoleManagement": {
  "title": "Funções",
  "columnName": "Nome",
  "columnSlots": "Vagas por domingo",
  "addRoleLabel": "Adicionar função",
  "namePlaceholder": "Nome",
  "slotsPlaceholder": "Vagas",
  "saveButton": "Guardar",
  "cancelButton": "Cancelar",
  "editButton": "Editar",
  "removeButton": "Remover",
  "emptyList": "Sem funções configuradas.",
  "errorNameRequired": "O nome é obrigatório.",
  "errorInvalidSlots": "O número de vagas deve ser um número inteiro positivo.",
  "errorDuplicateName": "Já existe uma função com este nome.",
  "errorGeneric": "Ocorreu um erro. Tente novamente.",
  "actionLoading": "A processar..."
}
```

#### Step 9 — E2E tests `e2e/role-management.spec.ts`

CI-safe (no real Supabase session), mirroring `people-management.spec.ts`:
- `POST /api/admin/roles` unauthenticated → 401
- `PATCH /api/admin/roles/some-id` unauthenticated → 401
- `DELETE /api/admin/roles/some-id` unauthenticated → 401
- `GET /api/admin/roles` unauthenticated → 401
- `GET /pt-PT/admin/roles` unauthenticated → redirected to `/login`

`E2E_WITH_AUTH`-gated (skip via `test.skip(!process.env.E2E_WITH_AUTH, ...)`),
mirroring the fixture-lifecycle pattern in `people-table-alignment.spec.ts`
(unique-per-worker fixture name via `testInfo.workerIndex`, `afterEach` cleanup):
- AC1: create a role with name + slots via the UI; row appears showing both.
- AC2: create a role leaving the slots field at its pre-filled `'1'`
  (structural proxy for "not specifying" since the UI always sends a value);
  additionally issue a direct authenticated `POST` via `page.request` with
  `default_slots` omitted from the JSON body entirely, asserting the created
  row's `default_slots === 1` — this is the test that actually exercises the
  omission branch of `parseDefaultSlots`, which the UI alone cannot trigger.
- AC3 (create sub-case): submit `0`, `-1`, blank, and `"abc"` as slot values
  (both via UI clearing the pre-filled field, and via a direct
  `page.request.post` with each value) → expect UI error banner / `400` JSON
  response in each case. **No-write assertion (explicit, not just the status
  code):** after each 400, re-`GET /api/admin/roles` (or re-query the visible
  row count in the UI) and assert the role list is unchanged from before the
  attempt — i.e. no new row was created despite the 400.
- AC3 (edit/PATCH sub-case — added per Challenge review; AC3 says
  "create/edit is rejected", so create-only coverage was incomplete): create
  one role fixture, then issue `PATCH /api/admin/roles/:id` with each of `0`,
  `-1`, blank, and `"abc"` as `default_slots` (both via the UI's inline-edit
  slots field and via a direct `page.request.patch`) → expect `400` in each
  case. **No-write assertion:** after each 400, re-`GET` the role (or
  re-inspect the row in the UI) and assert its `name`/`default_slots` are
  identical to the pre-PATCH values — the edit did not partially apply.
- AC4: edit an existing role's name and/or slot count via inline edit → confirm updated values render in the row.
- AC5: remove a role not in use → row disappears from the list.
- AC6: is NOT re-tested here beyond the CI-safe 401/redirect checks above —
  the Member-role 403 case requires a real Member session, which this
  environment cannot provide; document as a **manual verification step**
  (mirrors `role-enforcement.spec.ts`'s AC1 manual step): log in as a Member,
  `fetch('/api/admin/roles')` from DevTools console, confirm `403`.
- AC7: create a role named e.g. `"Som"`, then attempt to create a second role
  named `"SOM"` (case-insensitive collision) → expect `409` and the
  `errorDuplicateName` message in the UI; only one row exists after.

---

### Test plan mapped to acceptance criteria

| AC | Automated test | Type |
|----|---|---|
| AC1 — create with name + slots, appears in list | `role-management.spec.ts` "AC1" | E2E_WITH_AUTH |
| AC2 — omitted slot count defaults to 1 | `role-management.spec.ts` "AC2" (direct `page.request.post` with `default_slots` omitted) | E2E_WITH_AUTH |
| AC3 — non-positive-integer slot count rejected on **create**, 400, no row written (explicit re-GET assertion) | `role-management.spec.ts` "AC3 (create)" (0, -1, blank, "abc") | E2E_WITH_AUTH |
| AC3 — non-positive-integer slot count rejected on **edit**, 400, row unchanged (explicit re-GET assertion) | `role-management.spec.ts` "AC3 (edit/PATCH)" (0, -1, blank, "abc") | E2E_WITH_AUTH |
| AC4 — edit name/slots saved and reflected | `role-management.spec.ts` "AC4" | E2E_WITH_AUTH |
| AC5 — remove not-in-use role disappears from list | `role-management.spec.ts` "AC5" | E2E_WITH_AUTH |
| AC6 — non-admin/unauthenticated blocked (page + API) | `role-management.spec.ts` unauthenticated 401 (POST/PATCH/DELETE/GET) + redirect (page) | CI-safe |
| AC6 — Member → 403 | Manual verification step (documented in spec file header, mirrors `role-enforcement.spec.ts`) | Manual |
| AC7 — case-insensitive duplicate name rejected, 409 | `role-management.spec.ts` "AC7" | E2E_WITH_AUTH |

---

### Risks and rollback notes

- **Service-role GRANT gap (STORY-07 repeat risk)**: the migration in Step 1
  grants `service_role` in the *same* migration as table creation, closing the
  exact gap STORY-07 needed a follow-up migration for. Verify in Review that
  both `GRANT ... TO authenticated` and `GRANT ... TO service_role` are present
  before merge.
- **23505 mapping correctness**: if the Supabase JS client's error shape ever
  changes (unlikely, but the codebase has no prior 23505-handling code to
  copy from), the duplicate-name path could silently fall through to the
  generic 500 branch. Mitigation: the AC7 e2e test asserts the exact 409
  status and error code, so a regression here fails CI (when run with
  `E2E_WITH_AUTH`) rather than surfacing only in production.
- **`default_slots` omission-vs-blank distinction**: this is the single most
  error-prone part of the story (Step 3). Mitigation: the helper is a pure,
  independently reasoned function with an explicit comment, and AC2/AC3 each
  have a dedicated test targeting exactly this branch.
- **Rollback**: `DROP TABLE IF EXISTS public.roles CASCADE` removes the table,
  index, and policy. No other table references `public.roles` yet (STORY-18/19
  will add the skill-assignment FK later); safe to roll back in isolation.
- **No regression risk to `public.people`**: this story only adds new files
  and a new table; `PeopleTable.tsx`, `people/route.ts`, and the people
  migrations are untouched.

---

### Complexity tag

**standard** — matches STORY-07's layer count (migration, 2 API route files, a
Server Component page, a Client Component, nav update, i18n) plus two
additional reasoning-risk surfaces: numeric validation with an
omission-vs-invalid distinction (AC2 vs AC3) and a Postgres-uniqueness-violation
→ HTTP-error mapping (AC7) that has no existing precedent in this codebase to
copy verbatim. Not `complex`: no auth changes, no concurrency, no money, and it
touches the same two modules (Route Handlers + a single admin table) as
STORY-07 did.
