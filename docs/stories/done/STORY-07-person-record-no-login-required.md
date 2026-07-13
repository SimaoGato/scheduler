# STORY-07: Admin creates person records by name (no login required)
Epic: EPIC-02
Status: done ✅
PR: 17

## User story
As an Admin, I want to add team members by name without requiring them to have
an account, so that I can fully manage the schedule even when the rest of the
team never uses the app.

## Context
This story establishes the key data-model invariant for EPIC-02: a **Person**
record (name, skills, availability) exists independently of an auth **User**
account. The link between the two is optional and can be made later (when/if a
team member does log in). See PRD §6 FR3 (CRUD for people) and EPIC-02 scope.
This is the foundation on which manage-roles and manage-skills stories build.

## Acceptance criteria
1. Given an Admin, when they create a new person by entering just a **name**,
   then a person record is saved and appears in the team list with no auth
   account linked.
2. Given an existing person with no linked account, when the Admin edits the
   person's name, then the change is saved and reflected everywhere the name
   appears.
3. Given an existing person, when the Admin removes them, then the record is
   deleted (or flagged as inactive) and the person no longer appears in
   scheduling.
4. Given the database schema, when a person record is inspected, then the link
   to a user/auth account is **nullable** — a person without a login is a fully
   valid state, not an error.
5. Given two people with the same name, when the Admin saves the second one,
   then both records exist independently (no uniqueness collision on name alone).

## Out of scope
- Assigning skill levels to the person (separate story in EPIC-02).
- Linking a person to a Google login (separate story in EPIC-02).
- Availability/blocking (EPIC-03).

## Technical notes
- `people` table with: id, name, linked_user_id (nullable FK to users table),
  created_at, and a soft-delete / active flag.
- Admin UI: simple form — name field → save. List with edit/remove actions.
- No email required at create time.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Affected areas
- **data** — new `public.people` table migration (Supabase SQL)
- **backend** — 4 new API Route Handlers (`/api/admin/people`, `/api/admin/people/[id]`)
- **frontend** — new admin page (`app/[locale]/admin/people/page.tsx`), new client component (`components/PeopleTable.tsx`), nav update (`components/AppNav.tsx`)
- **ux** — inline add/edit form within PeopleTable
- **i18n** — new `PeopleManagement` namespace + `Nav.people` key in `messages/pt-PT.json`

---

### Step-by-step approach

#### Step 1 — Database migration (test-first: migration is the schema test)
Create `supabase/migrations/20260701000001_create_people_table.sql`.

```sql
CREATE TABLE IF NOT EXISTS public.people (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  linked_user_id UUID        NULL
                             REFERENCES public.users(id) ON DELETE SET NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No UNIQUE constraint on name (AC5: duplicates allowed)

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- Admins can read/write all people rows (defense-in-depth; service-role
-- client bypasses RLS for all admin operations, but we keep the policy for
-- future anon-key access patterns).
DROP POLICY IF EXISTS "people_admin_all" ON public.people;
CREATE POLICY "people_admin_all" ON public.people
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Table-level grants so RLS policies can be evaluated at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
```

Key schema decisions:
- `linked_user_id` is nullable FK to `public.users(id)` with `ON DELETE SET NULL` — satisfies AC4.
- No `UNIQUE` on `name` — satisfies AC5.
- `is_active` boolean for soft-delete — satisfies AC3.
- Reuses existing `public.get_my_role()` SECURITY DEFINER function from migration `20260628000002`.

#### Step 2 — Shared types
Create `types/people.ts` (no server-only imports; follows the `types/user-management.ts` pattern):

```ts
export interface PersonRow {
  id: string
  name: string
  linked_user_id: string | null  // AC4: nullable
  is_active: boolean
}
```

#### Step 3 — API Route Handlers

**`app/api/admin/people/route.ts`** (GET + POST)

- `GET`: `requireAdmin` guard → service-role client → `SELECT id, name, linked_user_id, is_active FROM people WHERE is_active = true ORDER BY name ASC`.
- `POST`: `requireAdmin` guard → parse body `{ name: string }` → validate non-empty → service-role INSERT → return created row. Empty name → 400.

**`app/api/admin/people/[id]/route.ts`** (PATCH + DELETE)

- `PATCH`: `requireAdmin` → `await params` → parse `{ name }` → validate non-empty → service-role UPDATE `name` WHERE `id = :id AND is_active = true` → 404 if no row updated.
- `DELETE`: `requireAdmin` → `await params` → service-role UPDATE `SET is_active = false` WHERE `id = :id` → 404 if no row updated. (Soft-delete, satisfies AC3.)

Auth guard ordering follows the CLAUDE.md convention: `requireAdmin(request)` is called *before* `await params`.

#### Step 4 — Client Component `components/PeopleTable.tsx`

`'use client'` component (same pattern as `UserTable.tsx`).

State: `rows: PersonRow[]`, `editingId: string | null`, `editName: string`, `addName: string`, `loadingId: string | null`, `errorMessage: string | null`.

Sections:
1. **Add-person form** at top: text input bound to `addName` + "Guardar" button. On submit: `POST /api/admin/people`. On success: prepend new row to `rows`, reset `addName`. Validate: name must not be blank before sending.
2. **People list**: table with columns Name and Actions. Empty-state message when no rows.
3. **Inline edit**: clicking "Editar" on a row sets `editingId` and populates input in that row. "Guardar" → `PATCH`, update row in state. "Cancelar" → clears edit state.
4. **Remove**: clicking "Remover" → `DELETE`, removes row from local state on success.

All user-facing strings from `useTranslations('PeopleManagement')`. Buttons use `min-h-[44px]` for WCAG tap targets. Error state uses `data-testid="pm-error"` with `aria-live="polite"` (avoids `role="alert"` collision).

#### Step 5 — Admin page `app/[locale]/admin/people/page.tsx`

Server Component, same auth guard pattern as `admin/users/page.tsx`:

1. Lazy `getTranslations('PeopleManagement')` after early-return branches.
2. `getSessionUser()` → redirect to login if null.
3. `getUserRole(user.id)` → redirect to `/?denied=1` if not admin.
4. `createServiceClient()` → SELECT active people ordered by name.
5. Pass `initialPeople: PersonRow[]` to `<PeopleTable />`.

#### Step 6 — Nav update `components/AppNav.tsx`

Add a second admin-only nav entry below "Utilizadores":

```tsx
{role === 'admin' && (
  <li>
    <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
      <Link href="/admin/people">{t('people')}</Link>
    </Button>
  </li>
)}
```

#### Step 7 — i18n `messages/pt-PT.json`

Add `Nav.people` key:
```json
"people": "Equipa"
```

Add `PeopleManagement` namespace:
```json
"PeopleManagement": {
  "title": "Equipa",
  "columnName": "Nome",
  "addPersonLabel": "Adicionar pessoa",
  "namePlaceholder": "Nome",
  "saveButton": "Guardar",
  "cancelButton": "Cancelar",
  "editButton": "Editar",
  "removeButton": "Remover",
  "emptyList": "Sem pessoas na equipa.",
  "errorNameRequired": "O nome é obrigatório.",
  "errorGeneric": "Ocorreu um erro. Tente novamente.",
  "actionLoading": "A processar..."
}
```

All strings follow AO90 spelling.

#### Step 8 — E2E tests `e2e/people-management.spec.ts`

CI-safe automated tests (no real Supabase session required):

```
POST /api/admin/people unauthenticated → 401      (covers AC1 auth gate)
PATCH /api/admin/people/any-id unauthenticated → 401  (covers AC2 auth gate)
DELETE /api/admin/people/any-id unauthenticated → 401 (covers AC3 auth gate)
GET /pt-PT/admin/people unauthenticated → redirect to /login (covers page guard)
GET /api/admin/people unauthenticated → 401           (list auth gate)
```

Manual verification steps for ACs 1–5 (requires real Supabase + admin session):

- **AC1**: Log in as Admin. Navigate to `/pt-PT/admin/people`. Submit form with a name. Confirm new row appears in list with no linked account column shown.
- **AC2**: Click "Editar" on a row. Change the name. Click "Guardar". Confirm the updated name appears in the row.
- **AC3**: Click "Remover" on a row. Confirm the row disappears from the list. Confirm the record is still in the `people` table with `is_active = false` (inspect via Supabase Table Editor).
- **AC4**: Inspect the `people` table schema. Confirm `linked_user_id` column is nullable and a new person row has `linked_user_id = NULL`.
- **AC5**: Submit two people with the exact same name. Confirm both rows appear independently in the list.

---

### Test plan mapped to acceptance criteria

| AC | Automated test | Manual step |
|----|---------------|-------------|
| AC1 — create with name only, no account linked | `POST /api/admin/people unauthed → 401` (auth gate) | Manual: submit form, confirm row appears with null linked_user_id |
| AC2 — edit name saves and reflects | `PATCH /api/admin/people/:id unauthed → 401` (auth gate) | Manual: inline edit → save → confirm name updated |
| AC3 — remove soft-deletes, disappears from list | `DELETE /api/admin/people/:id unauthed → 401` (auth gate) | Manual: remove row → confirm gone from UI, is_active=false in DB |
| AC4 — linked_user_id nullable in schema | TypeScript compile: `PersonRow.linked_user_id: string \| null` | Manual: inspect DB row after create |
| AC5 — duplicate names allowed | No unique constraint in migration (structural) | Manual: add two people with same name, both appear |

---

### Risks and rollback notes

- **FK chain**: `people.linked_user_id → public.users.id → auth.users.id`. The `ON DELETE SET NULL` is safe: when a user is hard-deleted from auth.users, the cascade deletes from public.users first, then the DB triggers `SET NULL` on people rows. The two cascades are independent and correct.
- **`get_my_role()` dependency**: The RLS policy on `public.people` calls `get_my_role()`, which was created in migration `20260628000002`. If that migration was never applied, this migration will fail. Mitigation: CI applies migrations in order; the dependency is always satisfied.
- **Rollback**: If the migration needs to be rolled back, `DROP TABLE IF EXISTS public.people CASCADE` removes the table and its dependent policies. No other tables reference `public.people` yet.
- **Soft-delete vs hard-delete**: The story says "deleted or flagged as inactive". Soft-delete is chosen to preserve data integrity for future schedule references (EPIC-04). If hard-delete becomes needed, the DELETE endpoint can be changed to `DELETE FROM people WHERE id = :id` without schema changes.

---

### Complexity tag

**standard** — touches four layers (database migration, three API routes, a Server Component page, a Client Component, nav update, i18n) and requires understanding of the existing Supabase RLS/service-role pattern, the admin guard convention, and the CLAUDE.md i18n/component rules. No auth changes, concurrency, or money flows, but spans multiple interacting modules.
