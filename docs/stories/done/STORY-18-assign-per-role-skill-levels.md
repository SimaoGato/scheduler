# STORY-18: Assign per-role skill levels (1–3) to a person
Epic: EPIC-02
Status: done ✅
PR: #34

## User story
As an Admin, I want to record each person's skill level (1 Beginner /
2 Intermediate / 3 Expert) for the roles they can serve, so that the generator
knows who is qualified for what and how strongly to weight them.

## Context
This is the master-data payload the whole scheduling value proposition depends
on (PRD §6 FR4). A person **qualifies** for a role only if they have a skill
level for it; a person with no level for a role **cannot be scheduled** for it
(EPIC-02 acceptance signal, PRD FR4). The 1–3 levels also feed the fairness
weighting (PRD Decision 1, the 3:2:1 expertise weighting) consumed later in
EPIC-04.

Depends on people (STORY-07, done) and roles (STORY-17). It cannot be started
before roles exist because a skill level is meaningless without a role to
attach it to — this is a real data dependency, not a sibling coupling.

## Acceptance criteria
1. Given an Admin viewing a person, when they assign a role to that person with
   a level of **1, 2, or 3**, then the person↔role skill is saved and shown for
   that person.
2. Given an Admin, when they change an existing skill level for a person/role
   (e.g. 1 → 2), then the new level is saved and reflected.
3. Given an Admin, when they remove a role from a person (unassign), then that
   person no longer has a skill level for that role, and (per FR4) the person is
   no longer qualified/selectable for that role.
4. Given an Admin submits a level outside 1–3 (0, 4, blank, non-numeric), then
   the request is rejected with a clear validation message and nothing is
   written (server returns 400, not 500).
5. Given a person, when the same role would be assigned twice, then there is at
   most **one** skill level per (person, role) pair — re-assigning updates the
   existing level rather than creating a duplicate.
6. Given a person with no skill level for a given role, when their
   qualifications are queried, then that role is absent from their qualified set
   (this is the machine-readable invariant EPIC-04's generator will rely on).
7. Given the skills admin UI/API, when a non-admin or unauthenticated user
   attempts to read or modify skill assignments, then they are blocked exactly
   as other admin screens/routes (page redirect; API 401/403).
8. Given a person is shown with their skills, when the levels render, then each
   level displays a human-readable pt-PT label (Iniciante / Intermédio /
   Especialista), not a bare number, sourced from `messages/pt-PT.json`.
9. Given the coordinator is setting skills **on a phone** (the PRD's primary
   admin device, per §2), when they open a person's skill editor, then
   assigning/changing a level for one role is reachable in a small, fixed
   number of taps (no horizontal scrolling, no reliance on hover-only
   affordances, tap targets meet the existing 44×44px floor) — verified with a
   Playwright viewport check at 375px, same pattern as other admin screens.

## Out of scope
- The scheduling algorithm that consumes these levels (EPIC-04).
- Availability/blocking (EPIC-03).
- Guarding deletion of a role/person that has skill assignments (STORY-19).
- Bulk import of skills or a full role×person matrix editor — a per-person
  editor is sufficient for launch (a matrix view can be a later enhancement).

## Technical notes
- New migration `<ts>_create_person_role_skills.sql`:
  - `public.person_role_skills`: `person_id UUID NOT NULL REFERENCES
    public.people(id) ON DELETE CASCADE`, `role_id UUID NOT NULL REFERENCES
    public.roles(id) ON DELETE CASCADE`, `level INT NOT NULL CHECK (level
    BETWEEN 1 AND 3)`, `PRIMARY KEY (person_id, role_id)` (enforces AC5's
    one-level-per-pair invariant at the DB layer).
  - Enable RLS; reuse `public.get_my_role()`; `admin_all` policy.
  - GRANTs to **both** `authenticated` AND `service_role` (CLAUDE.md).
- Types: extend `types/people.ts` (or new `types/skills.ts`) with a
  `PersonSkill { role_id, role_name, level }` shape for rendering.
- API: likely `app/api/admin/people/[id]/skills` (GET+PUT/DELETE) — an
  upsert-style PUT keyed on (person_id, role_id) neatly implements AC1/AC2/AC5;
  DELETE for AC3. `requireAdmin` first; validate `role_id` is a UUID and
  `level ∈ {1,2,3}` before touching Supabase (400, not 500, on bad input).
- UI: this is the first EPIC-02 screen with a real interaction-design decision
  (a 2D person×role input, not a flat list) — **pin the pattern now, don't
  defer it to Refine**: a dedicated `components/PersonSkillsEditor.tsx` opened
  per-person (e.g. from a row action in `PeopleTable.tsx`), rendering the
  active roles as a vertical list, each with a 3-option level control (radio
  group / segmented buttons, not a `<select>`, so 1/2/3 is visible and
  one-tap on mobile) plus a "no level / remove" option. A cross-tab matrix
  (all people × all roles in one grid) is explicitly rejected for v1 — it
  doesn't survive a 375px viewport and is deferred per Out of scope. Role
  options come from the active roles list (STORY-17). Level labels via a new
  `SkillLevels`/`SkillManagement` i18n namespace (AO90).
- Consider a read helper (e.g. `qualifiedRolesForPerson(personId)`) so EPIC-04
  has a clean, tested seam for AC6's "qualified set" invariant.
- Complexity: **standard** (join-table data model + upsert semantics + nested
  UI), bordering complex because of the data-integrity invariants — Refine
  should confirm the classification.

## Definition of Done
See CLAUDE.md.

## Implementation plan

### Pre-flight (verified during Refine)
- STORY-07 (people) and STORY-17 (roles) are both `done` in
  `docs/stories/`; `public.people` and `public.roles` migrations exist
  (`20260701000001_create_people_table.sql`,
  `20260704000001_create_roles_table.sql`), both soft-delete
  (`is_active`), both grant `authenticated` + `service_role`. This story
  can proceed.

### Decisions pinned now (per Technical notes: "pin the pattern now")
These are engineering-pattern decisions within the story's discretion, not
open product questions — flagged here for visibility, not blocking:
1. **Dedicated sub-page, not a modal.** No `Dialog` primitive exists in
   `components/ui/` yet, and a full page sidesteps 375px-viewport modal
   sizing entirely. Route: `app/[locale]/(app)/admin/people/[id]/skills/page.tsx`
   (Server Component, same per-page admin guard as
   `admin/people/page.tsx` / `admin/roles/page.tsx`), rendering
   `components/PersonSkillsEditor.tsx` (Client Component). Reached via a new
   "Skills" row action in `PeopleTable.tsx` (a `Link`, not a mutation
   button).
2. **Auto-save per tap, no separate Save button.** Selecting a level (or
   "no level") for a role fires the PUT/DELETE immediately. This directly
   serves AC9 ("small, fixed number of taps") — one tap per role change,
   not two (select + confirm). **Double-tap/race guard**: the radio inputs
   for a given role are disabled while that role's own request is
   in-flight (`disabled={savingRoleId === role.id}`), so a second tap
   cannot fire a second overlapping request for the same role before the
   first resolves. See the `PersonSkillsEditor.tsx` section below for the
   full behavior, including how a raced DELETE 404 is handled.
3. **API is two nested Route Handler files**, mirroring the existing
   `roles/route.ts` + `roles/[id]/route.ts` split:
   - `app/api/admin/people/[id]/skills/route.ts` — `GET` (list this
     person's skills).
   - `app/api/admin/people/[id]/skills/[roleId]/route.ts` — `PUT` (upsert
     level for person+role), `DELETE` (unassign).
4. **Hard delete, not soft delete, for `person_role_skills` rows.** The
   `level` CHECK forces 1–3; "no level" can only be represented by row
   *absence*. This matches AC3's wording exactly.
5. **Orphaned skill rows on role soft-delete are expected, not a bug.**
   If a role is soft-deleted after a person was assigned a skill for it,
   the skill row is not touched (soft-delete ≠ `ON DELETE CASCADE`, which
   only fires on hard delete). The UI/API only ever surface **active**
   roles, so the stale row is simply invisible until STORY-19 addresses
   guarding/cleanup. Do not add cleanup logic here — out of scope.

### Files to create
- `supabase/migrations/<ts>_create_person_role_skills.sql`
- `types/skills.ts` — `PersonSkill { role_id: string; level: 1 | 2 | 3 }`
- `lib/validation/skills.ts` — `parseSkillLevel(raw: unknown): 1 | 2 | 3 | null`
- `lib/skills/qualified-roles.ts` — `qualifiedRolesForPerson(client, personId)`
- `app/api/admin/people/[id]/skills/route.ts` — `GET`
- `app/api/admin/people/[id]/skills/[roleId]/route.ts` — `PUT`, `DELETE`
- `app/[locale]/(app)/admin/people/[id]/skills/page.tsx`
- `components/PersonSkillsEditor.tsx`
- `e2e/person-skills.spec.ts`

### Files to modify
- `components/PeopleTable.tsx` — add a "Skills" row action (Link to the
  new sub-page), rendered only in view mode (hidden while that row is
  mid-inline-edit, matching the existing Editar/Remover visibility rule).
- `messages/pt-PT.json` and `messages/en.json` — new `SkillManagement`
  namespace (both files, same story, per CLAUDE.md key-parity rule) plus
  one new key in `PeopleManagement` for the row-action button label.
- `e2e/i18n-key-parity.spec.ts` — no code change needed (it's generic),
  but re-run it after adding keys to both files.

### Migration SQL sketch
```sql
-- <ts>_create_person_role_skills.sql
CREATE TABLE IF NOT EXISTS public.person_role_skills (
  person_id  UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.roles(id)   ON DELETE CASCADE,
  level      INT  NOT NULL CHECK (level BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, role_id)
);

-- Reverse-lookup index for EPIC-04 ("who is qualified for role X"); cheap,
-- low-risk to add now even though this story only needs the person_id
-- direction (PK already covers that).
CREATE INDEX IF NOT EXISTS person_role_skills_role_id_idx
  ON public.person_role_skills (role_id);

ALTER TABLE public.person_role_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_role_skills_admin_all" ON public.person_role_skills;
CREATE POLICY "person_role_skills_admin_all" ON public.person_role_skills
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Both grants in this migration (STORY-03/STORY-14 gap — do not split
-- into a follow-up fix-up migration).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_role_skills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_role_skills TO service_role;
```

### `lib/validation/skills.ts`
```ts
// undefined/null/blank/non-integer/0/4/decimal/negative → null (400 invalid_level).
// Unlike parseDefaultSlots, there is NO default — level is always required
// on PUT, so "not specified" is also invalid here.
export function parseSkillLevel(raw: unknown): 1 | 2 | 3 | null {
  let n: number
  if (typeof raw === 'number') {
    n = raw
  } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    n = Number(raw.trim())
  } else {
    return null
  }
  return Number.isInteger(n) && (n === 1 || n === 2 || n === 3) ? (n as 1 | 2 | 3) : null
}
```

### `lib/skills/qualified-roles.ts`
```ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PersonSkill } from '@/types/skills'

// Mirrors Supabase's non-throwing {data, error} convention (CLAUDE.md) so
// every caller destructures and logs consistently. This is the seam
// EPIC-04 will import directly.
//
// STORY-18 review fix: the `roles!inner(is_active)` embed forces an inner
// join against `public.roles`, and `.eq('roles.is_active', true)` filters
// on that joined column server-side. This makes "only active-role skills
// are qualifying" an explicit part of the query itself — not a comment
// telling every future caller to separately fetch an active-roles list and
// remember to merge/filter against it. A caller cannot forget the filter
// because it's baked into the one query this helper exposes.
export async function qualifiedRolesForPerson(
  client: SupabaseClient,
  personId: string
): Promise<{ data: PersonSkill[] | null; error: unknown }> {
  const { data, error } = await client
    .from('person_role_skills')
    .select('role_id, level, roles!inner(is_active)')
    .eq('person_id', personId)
    .eq('roles.is_active', true)

  if (error) return { data: null, error }

  const skills: PersonSkill[] = (data ?? []).map((row) => ({
    role_id: row.role_id as string,
    level: row.level as 1 | 2 | 3,
  }))
  return { data: skills, error: null }
}
```
This is now the single source of truth for "qualified roles" (AC6): a
skill row for a soft-deleted role is excluded by the query itself, not by
an out-of-band merge step the caller has to remember. The GET route and
the skills page both call this helper directly and get correct results
with zero extra query cost or caller-side bookkeeping. (Decision 5 above —
orphaned rows on role soft-delete are expected and invisible — still
holds; it's just enforced here instead of at each call site.)

### API route validation logic
Both new route files: `requireAdmin(request)` first, `await params`
second (CLAUDE.md convention). Reuse the existing `UUID_RE` literal
per-file (matches existing precedent in `people/[id]/route.ts` and
`roles/[id]/route.ts` — not extracted to a shared module in this
codebase).

`GET /api/admin/people/[id]/skills`:
1. `id` not UUID → 400 `invalid_id`.
2. Person not found / `is_active = false` → 404 `not_found`.
3. `qualifiedRolesForPerson` → log+500 on error; else `200` with
   `PersonSkill[]`.

`PUT /api/admin/people/[id]/skills/[roleId]` (body `{ level }`):
1. `id` not UUID → 400 `invalid_person_id`.
2. `roleId` not UUID → 400 `invalid_role_id`.
3. Malformed JSON body → 400 `invalid_json` (own try/catch, before the
   outer try, per CLAUDE.md).
4. `parseSkillLevel(body.level) === null` → 400 `invalid_level` (covers
   AC4: 0, 4, blank, non-numeric, decimal, negative).
5. Person not found/inactive → 404 `person_not_found`.
6. Role not found/inactive → 404 `role_not_found` (defensive: prevents
   assigning skills against a soft-deleted role via direct API call, even
   though the UI only ever offers active roles).
7. `serviceClient.from('person_role_skills').upsert({ person_id: id, role_id: roleId, level }, { onConflict: 'person_id,role_id' }).select('role_id, level').single()`
   — the composite-PK upsert is what gives AC1/AC2/AC5 (one row per pair,
   re-assign updates in place) at the DB layer, not just app logic.
8. Explicit object literal from validated locals only (mass-assignment
   guard, same rule as roles/people routes) — never `upsert(body)`.
9. On Supabase `error` → log + 500 (no realistic 409 path here since
   upsert absorbs the conflict; if `error.code === '23505'` still occurs
   for some other reason, log and 500 rather than silently swallowing).
10. Success → `200` with `{ role_id, level }`.

`DELETE /api/admin/people/[id]/skills/[roleId]`:
1. Same UUID validation as PUT (both ids).
2. `.from('person_role_skills').delete().eq('person_id', id).eq('role_id', roleId).select('person_id')`.
3. No row deleted → 404 `not_found` (mirrors existing DELETE routes'
   404-on-no-match convention, consistent with roles/people DELETE). The
   route itself always returns 404 here regardless of caller — that's the
   correct, honest API contract. It's the *client* (PersonSkillsEditor,
   see above) that chooses to treat this specific 404 as a benign no-op
   in the UI rather than an error, because a raced double-tap unassign is
   an expected occurrence given the auto-save-per-tap design, not a real
   failure.
4. Success → `200` with `{ ok: true }`.

### Types
`types/skills.ts`:
```ts
export interface PersonSkill {
  role_id: string
  level: 1 | 2 | 3
}
```
No server-only imports (used by both the Server Component page and the
Client Component editor, per CLAUDE.md's shared-types rule).

### UI: `app/[locale]/(app)/admin/people/[id]/skills/page.tsx`
- Same auth-guard shape as `admin/people/page.tsx`: `getSessionUser` →
  redirect to login if null → `getUserRole` → redirect `?denied=1` if not
  admin → *then* `getTranslations('SkillManagement')` (lazy-load rule).
- Validate `id` is a UUID; fetch the person (`id, name`, `is_active =
  true`); if missing, invalid UUID, or inactive → `notFound()` (matches
  the `notFound()` precedent in `app/[locale]/layout.tsx`; no other
  dynamic-`[id]` page exists yet in this codebase to precedent-match
  against, so this is the new pattern for future person/role detail
  pages).
- Fetch all active roles the same way `admin/roles/page.tsx` does
  (`select id, name, default_slots, is_active … eq is_active, order by
  name`).
- Fetch this person's skills via `qualifiedRolesForPerson`.
- Render `<PersonSkillsEditor personId personName roles initialSkills />`.

### UI: `components/PersonSkillsEditor.tsx`
- `'use client'`. Props: `{ personId: string; personName: string; roles:
  RoleRow[]; initialSkills: PersonSkill[] }`.
- Local state: `Record<roleId, 1|2|3|undefined>` seeded from
  `initialSkills`; `savingRoleId: string | null`; `errorMessage: string |
  null`.
- For each role (already sorted by name from the server): a `<fieldset>`
  with `<legend>{role.name}</legend>` (mirrors `ClaimPersonForm.tsx`'s
  fieldset/legend radio-group pattern for WCAG SC 1.3.1 grouping) and 4
  radio options in a horizontal segmented-button row: "Sem nível", "1",
  "2", "3" — each a `<label>` with **`min-h-[44px] min-w-[44px]`** (both
  dimensions, not height alone) wrapping a radio input. This mirrors the
  existing `min-h-[44px] min-w-[44px]` precedent in
  `components/ThemeToggle.tsx:66`: a bare single-character label like "1"
  or "2" is plausibly narrower than 44px with typical inline padding, so
  the width floor is applied explicitly, not assumed from height +
  padding. Each option also gets a **distinct** `aria-label` combining
  role + level (e.g. `aria-label={t('levelOptionAria', { role: role.name,
  level: 1 })}` — needed because multiple roles repeat the same visible
  "1"/"2"/"3" text, and CLAUDE.md's multi-input-row rule requires distinct
  labels, not reused ones).
- **Double-tap/race guard**: every radio input for a given role has
  `disabled={savingRoleId === role.id}`. `onChange` sets
  `savingRoleId = role.id` synchronously before the `fetch` call and
  clears it (`setSavingRoleId(null)`) in a `finally` block after the
  request settles, so a second tap on the same role's options cannot fire
  before the in-flight request resolves. (Taps on a *different* role's
  options are unaffected — `savingRoleId` gates one role at a time, not
  the whole form.)
- `onChange` fires immediately (decision 2): level 1/2/3 → `PUT
  /api/admin/people/{personId}/skills/{roleId}` with `{ level }`; "Sem
  nível" → `DELETE` the same URL. Optimistic UI update on `response.ok`.
  On failure, revert the radio selection and show `errorMessage` (mapped
  via an `ERROR_CODE_KEYS`-style map, mirroring `RoleTable.tsx`) — **with
  one explicit exception**: a `404` response from the `DELETE` call is
  treated as a benign no-op (state already reflects "no level"; no
  `errorMessage` is set, nothing reverted), not surfaced as an error. This
  covers a raced double-tap where a PUT and DELETE for the same role
  interleave (e.g. the guard above already prevents the common case, but
  a slow network response for a request fired just before a role's roles
  list re-renders could still land after the row is gone) — a 404 here
  means "already removed," which is exactly the end state the user
  wanted, so it should not read as a failure.
- **Status feedback elements use `aria-live="polite"`** (CLAUDE.md
  convention — avoids the `role="alert"` / `__next-route-announcer__`
  collision documented in the Playwright section): the error indicator is
  `<div data-testid="skills-error" aria-live="polite">{errorMessage}</div>`
  (rendered only when `errorMessage` is non-null), and the saving
  indicator is `<span aria-live="polite">{savingRoleId ===
  role.id ? t('savingIndicator') : null}</span>` rendered per-role next to
  that role's options (not a single global saving indicator, so it's
  clear *which* role is mid-save when multiple roles are on screen).
- `data-testid`s: `skills-role-{roleId}-none`, `skills-role-{roleId}-1`,
  `skills-role-{roleId}-2`, `skills-role-{roleId}-3`,
  `skills-error`, `skills-back-link`.
- Empty-roles state: if `roles.length === 0`, show `t('emptyRoles')`
  (points the admin at Manage Roles first).
- A `t('backToTeam')` `Link` (from `@/i18n/navigation`) back to
  `/admin/people`.

### `components/PeopleTable.tsx` change
- New action, view-mode only (alongside Editar/Remover, hidden during
  inline-edit of that row): `<Link href={`/admin/people/${person.id}/skills`}
  data-testid={`pm-skills-${person.id}`} className="min-h-[44px] … "
  >{t('skillsButton')}</Link>` — a `Link`, not a `<button>`, since it's
  pure navigation (no fetch call), consistent with
  CLAUDE.md's `Link` cross-Server/Client note.
- No skills summary/badge is added to the row itself — out of scope
  (Out-of-scope explicitly rejects a matrix view; a per-row badge is a
  reasonable future enhancement but adds an extra query to the people
  list page for no AC-required behavior).

### i18n keys (add to BOTH `messages/pt-PT.json` and `messages/en.json`)
`PeopleManagement`: add `"skillsButton": "Competências"` / `"Skills"`.

New `SkillManagement` namespace (AO90 spelling):
```json
"SkillManagement": {
  "title": "Competências de {name}",
  "backToTeam": "Voltar à equipa",
  "level1": "Iniciante",
  "level2": "Intermédio",
  "level3": "Especialista",
  "noLevelOption": "Sem nível",
  "levelOptionAria": "{role} — nível {level}",
  "noLevelOptionAria": "{role} — sem nível",
  "savingIndicator": "A guardar...",
  "emptyRoles": "Não existem funções configuradas. Crie uma função primeiro.",
  "errorInvalidLevel": "Nível inválido.",
  "errorGeneric": "Ocorreu um erro. Tente novamente."
}
```
(en.json mirrors with English strings, e.g. `"level1": "Beginner"`,
`"level2": "Intermediate"`, `"level3": "Expert"`.) Only add keys actually
consumed by the component (i18n key hygiene rule) — do not pre-add
speculative keys.

### Test plan — mapped to acceptance criteria
All API-level tests are CI-safe (unauthenticated 401 checks need no real
session). Full-flow tests (actual admin session) are `E2E_WITH_AUTH`-gated
in `e2e/person-skills.spec.ts`, following the `role-management.spec.ts` /
`people-table-alignment.spec.ts` fixture-hygiene pattern: worker-indexed
unique fixture names, `beforeEach` fixture setup, `afterEach` unconditional
cleanup (delete the skill row, then the fixture person, then the fixture
role — order doesn't matter since these are soft-deletes, not hard
deletes, so no CASCADE is triggered by cleanup itself).

- **AC1** (assign level 1/2/3, saved+shown): `E2E_WITH_AUTH` test —
  create fixture person + fixture role via API, open the skills page,
  select level "2" for that role, assert the radio reflects "2" after
  the PUT resolves (re-fetch or check DOM state), and assert
  `GET .../skills` returns `[{ role_id, level: 2 }]`.
- **AC2** (change 1 → 2): same fixture; PUT level 1, then PUT level 2 for
  the same pair; assert `GET` returns exactly one row with `level: 2`
  (not two rows).
- **AC3** (unassign): PUT level 1, then select "Sem nível" (DELETE);
  assert `GET .../skills` no longer contains that `role_id`.
- **AC4** (reject out-of-range levels, 400 not 500, nothing written):
  CI-unsafe-fixture-needed but validation itself doesn't require a real
  person/role to exist yet if we test with a syntactically-valid-but-
  fake UUID and expect 400 before the DB lookup — actually the route
  checks `parseSkillLevel` **before** the person/role existence checks
  (per the numbered order above), so this can be a **CI-safe** test with
  a random-but-valid-format UUID and no auth even: for level values
  `[0, 4, '', 'abc', -1, 1.5]` against
  `PUT /api/admin/people/<random-uuid>/skills/<random-uuid>` while
  unauthenticated, expect 401 first (auth guard fires before body
  validation) — so this specific 400-vs-500 assertion **requires** a
  real admin session (auth must pass to reach validation). Mark as
  `E2E_WITH_AUTH`-gated: for each bad value, PUT against the fixture
  pair, expect 400 `invalid_level`, then re-`GET` and confirm no row was
  written/changed for that pair.
- **AC5** (at most one row per pair / re-assign updates not duplicates):
  covered by AC2's re-`GET` row-count assertion (exactly one entry for
  the pair after two PUTs with different levels) — this is the
  DB-composite-PK invariant, and the test should assert count, not just
  final value, to catch a hypothetical future regression to
  `insert`-without-upsert.
- **AC6** (no level → absent from qualified set): after AC3's unassign,
  assert the `GET .../skills` response array does not contain an entry
  for that `role_id` (absence, not a `level: null` entry) — this is the
  literal shape EPIC-04 will rely on.
- **AC7** (non-admin/unauthenticated blocked): CI-safe, unconditional
  (no `E2E_WITH_AUTH` skip) — mirrors `role-management.spec.ts`'s AC6
  block exactly:
  - `GET /api/admin/people/some-id/skills` unauthenticated → 401.
  - `PUT /api/admin/people/some-id/skills/some-role-id` unauthenticated → 401.
  - `DELETE /api/admin/people/some-id/skills/some-role-id` unauthenticated → 401.
  - `GET /pt-PT/admin/people/some-id/skills` unauthenticated → redirected
    to `/login`.
  - Member-role 403 case: same limitation as `role-management.spec.ts`
    AC6 — document as a manual verification step (no real Member session
    available in this environment).
- **AC8** (human-readable pt-PT labels, not bare numbers): CI-safe —
  extend `e2e/i18n-key-parity.spec.ts` coverage implicitly (parity check
  already generic); add a targeted assertion in `person-skills.spec.ts`
  (`E2E_WITH_AUTH`-gated, since it needs a real rendered page) that the
  DOM text for a selected level shows "Intermédio" (not "2"), read from
  `messages/pt-PT.json`'s `SkillManagement.level2` value at test-write
  time (per CLAUDE.md's button-text-extraction discipline — do not
  fabricate the string).
- **AC9** (mobile: 375px, no horizontal scroll, 44px tap targets, small
  fixed tap count): `E2E_WITH_AUTH`-gated, `page.setViewportSize({width:
  375, height: 812})` on the skills page; assert
  `document.documentElement.scrollWidth <= 375`; assert (per the
  `boundingBox()` guard convention — `toBeVisible()` first) each radio
  `<label>` boundingBox **height `>= 44` AND width `>= 44`** (both
  dimensions asserted, not height alone — this is the regression test for
  the single-character "1"/"2"/"3" labels, which need the explicit
  `min-w-[44px]` floor and would otherwise silently ship narrower than
  44px); assert selecting a level is a single `.click()` (no secondary
  Save-button click) — i.e. the test itself only performs one click per
  level change, which structurally proves the "fixed number of taps"
  claim rather than asserting a tap *count* number.

### RLS + GRANT checklist (data-integrity-sensitive — verify explicitly)
- [ ] `ALTER TABLE public.person_role_skills ENABLE ROW LEVEL SECURITY;`
- [ ] `admin_all` policy reusing `public.get_my_role()`.
- [ ] `GRANT … TO authenticated` **and** `GRANT … TO service_role` in the
      **same** migration file (not a follow-up fix-up — this project has
      hit the missing-`service_role`-grant gap twice: STORY-03
      `public.users`, STORY-14 `public.people`).
- [ ] Composite PK `(person_id, role_id)` — confirms AC5 at the DB layer,
      not just app-layer upsert logic.
- [ ] `ON DELETE CASCADE` on both FKs — defensive only; soft-delete is the
      actual deletion path today (decision 5), CASCADE only matters for a
      hypothetical future hard-delete.
- [ ] `CHECK (level BETWEEN 1 AND 3)` — confirms AC4 at the DB layer as a
      last line of defense even if app-layer validation is ever bypassed.
- [ ] Manually verify via an authenticated `fetch()` call (not Table
      Editor/SQL Editor, which bypass RLS per CLAUDE.md) that a Member
      session gets `42501`/403, not a silent empty result.

### Risks and rollback
- **Risk**: forgetting the `service_role` GRANT (hit twice before) →
  Route Handlers would get `42501` in a fresh-provisioned project even
  though dev/prod Supabase projects with manual grants mask the bug.
  Mitigation: the checklist above + review gate explicitly calling this
  out (CLAUDE.md's stated enforcement mechanism).
- **Risk**: upsert `onConflict` string mismatching the actual composite
  PK column order/name causes a runtime Postgres error surfaced as a
  generic 500 instead of the intended upsert behavior. Mitigation:
  explicit AC2/AC5 tests asserting exactly one row after two PUTs.
- **Risk**: orphaned `person_role_skills` rows after a role/person is
  soft-deleted are silently invisible (by design, decision 5) — if a
  future story hard-deletes instead of soft-deleting, CASCADE handles it
  correctly; if STORY-19 introduces a different soft-delete-aware cleanup
  contract, this table needs to be included in that story's scope.
- **Rollback**: the migration is purely additive (new table, no changes
  to `people`/`roles`); reverting is a straightforward down-migration
  (`DROP TABLE public.person_role_skills;`) with no data-loss risk to
  other tables. The API routes and UI are also purely additive (new
  files, one new action button in `PeopleTable.tsx`) — reverting the PR
  cleanly removes the feature with no shared-file merge risk.

### Complexity classification: **standard**
Justification: this is a conventional CRUD-on-a-join-table story that
closely mirrors two already-shipped patterns in this codebase (STORY-07
people, STORY-17 roles) for the DB/RLS/GRANT/API layers, plus one new
(but low-risk, well-precedented) UI pattern — a per-role radio group
matching `ClaimPersonForm.tsx`'s existing fieldset/legend convention. It
touches multiple modules (migration, 2 API route files, a new page, a new
component, an existing component edit, 2 locale files) and has real
data-integrity invariants (composite PK, CHECK constraint, RLS+GRANT), so
per CLAUDE.md it is **not** `trivial` — but it introduces no new
authentication/authorization mechanism, no concurrency, and no novel
security surface beyond the existing `requireAdmin` guard reused
verbatim, so it does not cross into `complex`. Confirmed as `standard`,
matching the story author's own note ("standard, bordering complex" —
resolved here in favor of standard because every risky primitive
[composite PK, RLS, dual GRANT, service-role upsert] already has a
working precedent elsewhere in this codebase to copy exactly, rather than
being designed from scratch).
