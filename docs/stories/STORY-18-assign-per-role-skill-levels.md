# STORY-18: Assign per-role skill levels (1–3) to a person
Epic: EPIC-02
Status: draft

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
