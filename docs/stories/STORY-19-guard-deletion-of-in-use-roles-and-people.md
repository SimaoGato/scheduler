# STORY-19: Guard deletion of roles and people that are in use
Epic: EPIC-02
Status: draft

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
