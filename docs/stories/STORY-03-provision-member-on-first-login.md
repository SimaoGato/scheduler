# STORY-03: Provision user as Member on first login
Epic: EPIC-01
Status: draft

## User story
As the system, I want to create an application user record set to **Member** the
first time someone logs in, so that every authenticated person has a known
identity and a safe default permission level.

## Context
Third slice of EPIC-01. Bridges the auth identity (STORY-02) to an application
user with a role. See PRD §6 (FR19–20: Admin/Member roles; new users are Members
by default). Authorization enforcement is STORY-04.

## Acceptance criteria
1. Given a Google identity that has never logged in before, when login
   completes, then a user record is created with role = **Member** and linked to
   the Google identity (email + display name stored).
2. Given a user who already has a record, when they log in again, then no
   duplicate record is created and their existing role is preserved.
3. Given the **first ever** user to log in to an empty system, when their record
   is created, then they are assigned role = **Admin** (bootstrap, so the system
   always has at least one Admin). _(If a different bootstrap is preferred, this
   criterion can be adjusted in Refine.)_
4. Given a created user record, when inspected, then it stores at minimum: a
   stable id, email, display name, role, and created timestamp.

## Out of scope
- Permission enforcement based on role (STORY-04).
- Admin UI to view/change roles (STORY-05).
- Linking the user to a "person"/team record (EPIC-02).

## Technical notes
- A `users` (or `profiles`) table keyed to the auth provider's user id.
- Provision via an auth callback / database trigger on first sign-in.
- Bootstrap-first-admin guard (count of existing users == 0).

## Definition of Done
See CLAUDE.md.
