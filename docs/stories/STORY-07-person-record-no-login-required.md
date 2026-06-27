# STORY-07: Admin creates person records by name (no login required)
Epic: EPIC-02
Status: draft

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
