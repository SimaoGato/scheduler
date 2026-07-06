# STORY-20: Admin links a person record to a user account
Epic: EPIC-02
Status: draft
Priority: confirmed needed (was "low, reconfirm at Refine" — see note below)

## User story
As an Admin, I want to link (and unlink) a person record to a logged-in user
account from the admin screens, so that I can fix up mappings when a member
skipped the self-claim flow or was added to the team after they had already
logged in.

## Context
STORY-11 lets a member **self-claim** their person record on first login, and
explicitly deferred Admin-initiated linking to "a separate story" (STORY-11,
Out of scope). This story is that follow-up. It closes the gaps self-claim
cannot: a member who clicked "skip", a person added *after* the member's first
login (so the claim page never offered them), or a mistaken claim that needs
correcting. See EPIC-02 scope ("Link a person record to a logged-in user
account") and PRD §6 FR3.

**Priority update (2026-07-06, from triage):** the "reconfirm once real usage
shows a gap" condition above has now happened. The Admin (Simão) logged in
before any matching person record existed in Equipa, so STORY-11's claim page
never offered a match, and there is no other discoverable way (no nav link, no
admin control) to link a person created afterward to that account — the only
workaround is manually navigating to the unlinked `/claim` URL, which isn't
exposed anywhere in the UI. This confirms the gap is real, not hypothetical;
do not drop this story.

**Original uncertainty flag (superseded above, kept for history).** STORY-11
already satisfies the epic's "a logged-in Member is associated with their
person record" acceptance signal for the common path. This story is a
robustness/admin-override backstop; it may be deprioritized until real usage
shows the self-claim flow leaves gaps. Sizing and even necessity should be
reconfirmed at Refine — if self-claim proves sufficient in practice, this can
be dropped.

## Acceptance criteria
1. Given an Admin viewing a person with `linked_user_id IS NULL`, when they
   pick an unlinked user account and confirm, then `people.linked_user_id` is
   set to that user's id and the link is reflected in the admin UI.
2. Given an Admin viewing a linked person, when they unlink, then
   `people.linked_user_id` is set back to NULL and the person shows as unlinked.
3. Given an Admin attempts to link a user who is **already** linked to a
   different person, then the action is rejected with a clear message (a user
   maps to at most one person) — enforced server-side.
4. Given an Admin attempts to link a person who is **already** linked, then
   they must unlink first (or the action replaces the link only via an explicit
   confirm) — no silent overwrite.
5. Given the link/unlink API, when a non-admin or unauthenticated user calls it,
   then it is blocked (401/403); this is an Admin-only action, unlike the
   member self-claim route in STORY-11.
6. Given all link/unlink UI text, when it renders, then strings come from
   `messages/pt-PT.json` (AO90).

## Out of scope
- The member self-claim flow (STORY-11) — this is the Admin-side counterpart,
  reusing the same `people.linked_user_id` column.
- Email-based auto-matching (person records have no email field).
- Bulk linking.

## Technical notes
- No schema change — reuses `public.people.linked_user_id` (nullable FK,
  STORY-07 AC4).
- New Admin-only API (e.g. `app/api/admin/people/[id]/link` PUT/DELETE, or a
  field on the existing PATCH): `requireAdmin` first; validate the target
  `user_id` is a UUID and currently unlinked (AC3); use an UPDATE guarded on the
  current link state to avoid races (AC4).
- Surfaces in either the Equipa (people) or Utilizadores (users) admin screen —
  likely a "link account" control per person row plus a picker of unlinked
  users. Decide placement at Refine.
- Consider showing the linked account (name/email) on the people list so the
  Admin can see current mappings at a glance.
- Complexity: **standard**, small — one guarded UPDATE plus a picker UI.

## Definition of Done
See CLAUDE.md.
