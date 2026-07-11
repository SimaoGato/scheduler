# STORY-27: Admin views and edits anyone's blocked dates
Epic: EPIC-03
Status: draft

## User story
As an Admin, I want to see and edit any person's blocked Sundays on their
behalf, so that availability stays accurate even for people who don't use the
app themselves (e.g. told me on WhatsApp, or have no login).

## Context
PRD §6 FR5: "Volunteers **and the coordinator on their behalf** can block
specific Sundays." Many people records have no linked account (EPIC-02 /
STORY-07 allows person-without-login), so availability editing must be
**person-centric**, not account-centric. Builds on STORY-25 (data model) and
reuses the STORY-26 toggle UX where practical.

## Acceptance criteria
1. Given a logged-in Admin on the people management area, when they choose a
   person's availability action, then they see that person's upcoming Sundays
   with current blocked/available states (same horizon as STORY-26).
2. Given the Admin availability view for a person, when the Admin taps an
   available Sunday, then it is persisted as blocked **for that person**;
   tapping a blocked date unblocks it — identical toggle semantics and
   idempotency as the Member flow.
3. Given a person with **no linked user account**, when the Admin opens their
   availability, then viewing and editing work exactly the same
   (person-centric storage).
4. Given a Member's own blocks created via STORY-26, when an Admin views that
   person, then the same blocks appear (one shared source of truth); edits by
   the Admin are visible to the Member on next load.
5. Given a logged-in non-admin Member, when they call the admin availability
   endpoint or open the admin page for any person, then the API returns 403
   and the page redirects with the access-denied pattern
   (`/?denied=1`, banner guarded by `role !== 'admin'`).
6. Given an invalid person id (malformed UUID or nonexistent), when the Admin
   endpoint is called, then it returns 400 (`invalid_id`) or 404 with stable
   error codes — never 500.
7. Given a 375px viewport, when the Admin availability view renders, then
   there is no horizontal overflow and controls keep ≥ 44px tap targets.

## Out of scope
- Bulk operations (block a date for several people at once).
- Recurring availability patterns (Phase 2).
- Notifications to the affected member about admin edits.
- Availability summary/matrix across the whole team (useful for EPIC-05, not
  here).

## Technical notes
- Admin Route Handler at `app/api/admin/people/[id]/availability/` following
  the `requireAdmin(request)` guard-first-then-`await params` convention and
  UUID validation from CLAUDE.md.
- Page/section under `app/[locale]/admin/people/` — likely an availability
  subpage or expandable panel per person row; Refine decides the entry point.
  Per-page admin role-guard redirect applies.
- Reuse the STORY-26 client toggle component with a person-id-aware endpoint
  prop rather than duplicating it (same keyed in-flight state, error
  handling, and tap-target classes).
- Same `blocked_dates` table and query helper as STORY-25 — no parallel
  storage.
- i18n keys in both locale files; AO90 spelling.
- Tests: auth-gated e2e for the admin toggle flow with worker-isolated fixture
  people and unconditional cleanup (STORY-14 pattern); a 403 regression test
  for the member-calling-admin-endpoint case.

## Definition of Done
See CLAUDE.md.
