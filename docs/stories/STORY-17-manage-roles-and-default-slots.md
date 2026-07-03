# STORY-17: Manage roles (create / rename / remove) with default slots per Sunday
Epic: EPIC-02
Status: draft

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
