# STORY-06: Member "no access yet" state & role-gated navigation
Epic: EPIC-01
Status: draft

## User story
As a brand-new Member, I want a clear, friendly view that matches my permissions,
so that I understand I'm logged in and what I can (and can't) do yet.

## Context
Final slice of EPIC-01. The member-facing UX layer on top of roles (STORY-03)
and enforcement (STORY-04). See PRD §7 and Epic scope: "a 'no access yet' state
for brand-new Members" and a member-appropriate view. Distinct from STORY-04
(server enforcement) — this is the navigation/UX.

## Acceptance criteria
1. Given a logged-in Member with no assignments/availability features yet
   available, when they land in the app, then they see a clear pt-PT
   "welcome / no access yet" view rather than an error or a blank/Admin screen.
2. Given a logged-in Member, when the navigation renders, then Admin-only
   destinations (e.g. user management) are **not shown**.
3. Given a logged-in Admin, when the navigation renders, then Admin
   destinations are shown.
4. Given a Member who manually navigates to an Admin route URL, when the page
   loads, then they are redirected/shown an unauthorized view (UI mirrors the
   STORY-04 server denial) rather than the Admin content.
5. Given any logged-in user, when the shell renders, then their identity (name
   and role) is visible and a sign-out control is available.

## Out of scope
- Server-side permission enforcement itself (STORY-04).
- Member availability features (EPIC-03) — only the placeholder/empty state here.

## Technical notes
- Role-aware navigation component; conditional menu items.
- Client route guard that reflects the server authorization, with graceful
  redirect/unauthorized view.
- Reuse i18n catalog (STORY-01) for all copy.

## Definition of Done
See CLAUDE.md.
