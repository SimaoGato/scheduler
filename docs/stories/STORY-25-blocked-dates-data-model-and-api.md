# STORY-25: Persist blocked dates — data model and self-service API
Epic: EPIC-03
Status: draft

## User story
As a Member, I want the Sundays I block to be stored reliably and scoped to me,
so that the schedule generator can never assign me on a date I'm away.

## Context
EPIC-03 makes date blocking a hard constraint for the generator (PRD §6, FR5–6:
"Volunteers can block specific Sundays. Default state is available. Blocked
dates are a hard constraint."). This story lays the foundation: the
`blocked_dates` table, row ownership via the person record (people are the
schedulable unit — see EPIC-02 / STORY-11 claim flow), and a Route Handler API
that a Member can call to block/unblock their **own** dates. The Member UI
(STORY-26) and Admin on-behalf editing (STORY-27) build on this API. The
generator (EPIC-04) reads blocks via the query helper delivered here.

## Acceptance criteria
1. Given the migration has run, when the schema is inspected, then a
   `public.blocked_dates` table exists with `person_id` (FK → `people`,
   `ON DELETE CASCADE`), a `DATE` column, a uniqueness guarantee per
   (person, date), RLS enabled, and GRANTs for both `authenticated` and
   `service_role` **in the same migration**.
2. Given an authenticated Member whose account is linked to a person, when they
   POST a valid upcoming Sunday to the block endpoint, then a block row is
   created for **their linked person** and the API returns success; POSTing the
   same date again is idempotent (no duplicate row, no 500).
3. Given an authenticated Member with a block on a date, when they DELETE that
   date via the unblock endpoint, then the row is removed and the API returns
   success; unblocking an already-unblocked date is idempotent.
4. Given an authenticated Member, when they GET their availability, then the
   response lists exactly their own blocked dates (dates not present = available
   by default).
5. Given a request with a malformed or missing date, or a date that is not a
   Sunday, when it hits the block endpoint, then the API returns 400 with a
   stable machine-readable error code (e.g. `invalid_date`, `not_sunday`).
6. Given an authenticated Member whose account has **no** linked person, when
   they call any of these endpoints, then the API returns a stable error code
   (e.g. 409 `no_linked_person`) and writes nothing.
7. Given an unauthenticated request, when it hits any of these endpoints, then
   the API returns 401 and writes nothing.
8. Given blocks exist for several people and dates, when the generator-facing
   query helper (`lib/availability/*`) is called with a person set / date range,
   then it returns the matching blocks queryable **by date and by person**.

## Out of scope
- Any UI (STORY-26 renders the Member view; STORY-27 the Admin view).
- Admin editing another person's blocks (STORY-27).
- Recurring availability patterns (Phase 2, per epic).
- Consuming blocks during generation (EPIC-04).
- Blocking past dates cleanup / retention policy.

## Technical notes
- Migration: `supabase/migrations/*_blocked_dates.sql` — unique index on
  `(person_id, blocked_date)`; follow the GRANT-before-RLS rule from CLAUDE.md
  (both `authenticated` and `service_role` grants in the same migration as the
  Route Handler PR).
- Route Handlers under `app/api/availability/` using the `requireAuth(request)`
  guard pattern (`lib/auth/guard.ts`), reading cookies from `request.cookies`.
  Resolve the caller's person via `people.linked_user_id = user.id`, then write
  with the service-role client scoped to that resolved person id.
- Idempotency: upsert / `ON CONFLICT DO NOTHING` for block; delete-if-exists for
  unblock (a hard delete — no soft-delete needed for blocks).
- Sunday validation: treat the payload as a plain `YYYY-MM-DD` calendar date
  (validate with a regex + day-of-week math on the date string parsed as UTC);
  avoid timezone conversions that could shift the weekday.
- Stable error codes per CLAUDE.md Route Handler conventions (400 malformed,
  401 unauthenticated, 409 state conflict).
- Query helper in `lib/availability/` (server-only) so EPIC-04 has a single
  source of truth; cover it via the API-level e2e tests (auth-gated pattern
  `test.skip(!process.env.E2E_WITH_AUTH, ...)` where a session is required).

## Definition of Done
See CLAUDE.md.
