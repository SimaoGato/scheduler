# EPIC-02 — Team, Roles & Skill Levels

## Goal
Let an Admin model the real team: define configurable **roles** (Sound,
Multimedia, …), set how many **slots** each role needs per Sunday, add the
**people**, and record each person's **skill level (1 Beginner / 2 Intermediate
/ 3 Expert) per role**. This is the master data the generator consumes.

## Why it matters
The whole value proposition — balanced, rule-aware scheduling — depends on
knowing who can do what, and how well. Making roles configurable (not
hardcoded) is what lets the tool grow to the worship band later without a
rebuild.

## Scope (in)
- CRUD for **roles** (create, rename, remove); roles are configurable.
- Per-role **default slots per Sunday** (e.g. Sound = 1).
- CRUD for **people** (add/edit/remove).
- Per-person, per-role **skill level 1–3**; a person with no level for a role
  cannot be scheduled for it.
- Link a person record to a logged-in user account (so Members map to people).

## Out of scope
- Ad-hoc per-Sunday training slots (lives with generation — EPIC-04).
- Availability/blocking (EPIC-03).
- The scheduling algorithm itself (EPIC-04).

## Dependencies
- EPIC-01 (auth, Admin role, data layer).

## Acceptance signals
- An Admin can create roles and set default slot counts.
- An Admin can add people and assign skill levels per role.
- A person without a skill level for a role is not selectable for that role.
- Removing a role/person is handled safely (no orphaned schedule references —
  or clearly guarded).
- A logged-in Member is associated with their person record.

## Candidate stories
- Manage roles (create / rename / remove)
- Set default slots-per-Sunday per role
- Manage people (add / edit / remove)
- Assign per-role skill levels (1–3) to a person
- Link user accounts to person records
- Guard deletion of roles/people in use
