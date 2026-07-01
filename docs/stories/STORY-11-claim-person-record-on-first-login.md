# STORY-11: Claim existing person record on first login
Epic: EPIC-02
Status: draft

## User story
As a team member logging in with Google for the first time, I want to be able
to identify myself as someone the Admin already added to the team list, so
that my account is linked to my person record and the Admin's prior work is
not duplicated.

## Context
An Admin can add people to the "Equipa" list without requiring them to have
an account (STORY-07). When that person later logs in for the first time,
there is no automatic link between their Google account and their person
record — they appear as an unlinked user in "Utilizadores" while a separate
entry for their name already exists in "Equipa". This story closes that gap.
See PRD §6 FR3 (CRUD for people) and EPIC-02 scope ("Link a person record to
a logged-in user account").

The data model already supports the link: `public.people.linked_user_id` is a
nullable FK to `public.users.id` (STORY-07, AC4).

## Acceptance criteria
1. Given a user who logs in for the first time AND there are unlinked person
   records in `public.people`, when the auth callback completes, then they are
   redirected to a "claim" page listing those unlinked person records by name.
2. Given the user on the claim page, when they select a name and confirm,
   then `people.linked_user_id` is set to their user id and they are
   redirected to the home page.
3. Given the user on the claim page, when they click "skip" (or "that's not
   me"), then no person record is linked and they are redirected to the home
   page as a normal member.
4. Given a user who logs in and there are NO unlinked person records, when
   the auth callback completes, then they are NOT shown the claim page and go
   directly to home (no friction for users who don't need it).
5. Given a user who already has a linked person record (returning login), when
   the auth callback completes, then they are NOT shown the claim page.
6. Given two users simultaneously claiming the same person record, when both
   submit, then only the first claim succeeds (second gets a conflict error
   and is prompted to try another name or skip).
7. Given a user on the claim page, when the page renders, then the list shows
   only people whose `linked_user_id IS NULL` and `is_active = true`.

## Out of scope
- Admin-initiated linking (Admin can see and set the link from the Utilizadores
  or Equipa admin screens — that is a separate story).
- Fuzzy name matching or search; a plain list is sufficient.
- Email-based auto-matching (person records have no email field yet).
- Changing the claim after the fact from the member's own settings.

## Technical notes
- **Auth callback change** (`app/auth/callback/route.ts`): after `provisionUser`
  succeeds and the user is new (i.e., the `count === 0` branch was NOT taken
  AND `existing === null`), check if any unlinked+active people rows exist. If
  yes, redirect to `/${defaultLocale}/claim` instead of home.
- **New page** `app/[locale]/claim/page.tsx`: Server Component, fetches
  unlinked people via service-role client. If none → redirect to home. If the
  calling user already has a linked record → redirect to home (AC5).
- **New API route** `app/api/people/claim/route.ts` (POST): authenticated
  (anon-key, not service-role), user supplies `{ person_id: UUID }`. Must
  verify: (a) the person row exists and is active, (b) `linked_user_id IS NULL`
  (prevent concurrent double-claim), (c) the calling user has no other linked
  record. Sets `linked_user_id = user.id` atomically. Use an UPDATE with
  WHERE `linked_user_id IS NULL` and check rows-affected = 1 to handle AC6.
- **New client component** `components/ClaimPersonForm.tsx` — list of names,
  single selection, confirm + skip buttons.
- The claim route does NOT require `requireAdmin`; it is a member-self-service
  action. Auth guard: `requireAuth` (any logged-in user).
- The claim page should use the minimal login-style shell (no nav) or the
  standard locale layout without nav items being distracting — TBD at
  implementation time.
- Add i18n keys under a new `Claim` namespace in `messages/pt-PT.json`.

## Definition of Done
See CLAUDE.md.
