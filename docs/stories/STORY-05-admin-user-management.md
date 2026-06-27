# STORY-05: Admin user management — list & promote/demote
Epic: EPIC-01
Status: draft

## User story
As an Admin, I want to see all users and promote or demote them between Admin
and Member, so that I can control who can manage the schedule.

## Context
Fifth slice of EPIC-01. The Admin-facing UI on top of the role model (STORY-03)
and enforcement (STORY-04). See PRD §6 (FR19: "Can promote other users to
Admin"; multiple admins allowed) and Epic acceptance signal about the user list
+ last-admin safeguard.

## Acceptance criteria
1. Given an Admin, when they open the user-management screen, then they see a
   list of all users with name, email, and current role.
2. Given a Member in the list, when the Admin promotes them, then their role
   becomes Admin and the change persists across reloads.
3. Given an Admin in the list, when another Admin demotes them, then their role
   becomes Member and the change persists.
4. Given there is exactly **one** remaining Admin, when an Admin tries to demote
   that last Admin, then the action is blocked with a clear pt-PT message and the
   system retains at least one Admin.
5. Given a Member, when they navigate to the user-management screen or call its
   endpoints, then access is denied (reusing STORY-04 enforcement).

## Out of scope
- Inviting/creating users manually (users appear after first Google login).
- Deleting users.
- Linking users to team "people" records (EPIC-02).

## Technical notes
- Admin-gated route + list UI (pt-PT) reading the users table.
- Promote/demote endpoints behind the STORY-04 authorization guard.
- Last-admin safeguard enforced server-side (count of admins > 1 before demote).

## Definition of Done
See CLAUDE.md.
