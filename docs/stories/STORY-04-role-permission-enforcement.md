# STORY-04: Server-side role permission enforcement
Epic: EPIC-01
Status: draft

## User story
As the coordinator, I want Admin-only actions to be blocked for Members on the
server, so that permissions are actually secure and not just hidden in the UI.

## Context
Fourth slice of EPIC-01. Turns the role field (STORY-03) into enforced
authorization. See PRD §6 (FR19) and Epic acceptance signal: "permission checks
block Members from Admin-only actions (server-enforced, not just UI)".

## Acceptance criteria
1. Given a Member's authenticated session, when they call an Admin-only endpoint
   /action, then the server rejects it with an authorization error (e.g. 403)
   and performs no change.
2. Given an Admin's authenticated session, when they call the same Admin-only
   endpoint, then the action is permitted.
3. Given an unauthenticated request, when it hits any protected endpoint, then
   it is rejected with an authentication error (e.g. 401) before any role check.
4. Given the data layer, when a Member attempts to read or write data they are
   not authorized for, then it is denied at the database/row-security level
   (defense in depth), not only in application code.
5. Given a reusable authorization guard, when applied to an endpoint, then it
   centralizes the Admin/Member check so future endpoints can adopt it
   consistently.

## Out of scope
- The specific Admin screens/actions (STORY-05 and later epics).
- UI gating / "no access" experience (STORY-06).

## Technical notes
- Reusable server-side guard/middleware reading the user's role.
- Supabase Row Level Security policies for defense-in-depth at the DB layer.
- Provide at least one representative Admin-only endpoint to test against
  (can be a stub if no real Admin action exists yet).

## Definition of Done
See CLAUDE.md.
