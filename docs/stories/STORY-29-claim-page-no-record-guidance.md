# STORY-29: Give unlinked Members clear guidance when there's nothing to claim
Epic: EPIC-02

## User story
As a Member with no linked person record, I want to be told clearly what to
do when there's nothing for me to claim, so that I'm not silently bounced
back to the home page with no explanation of why I can't set my
availability.

## Context
STORY-11 built the self-claim flow: on first login, if unclaimed person
records exist, the user sees `/claim` and can pick themselves from the list
or skip. If **no** unclaimed person records exist at first-login time,
STORY-11's AC4 intentionally sends the user straight home with "no friction"
— a reasonable choice for the *first-login callback redirect decision*, since
most such users simply don't need the claim flow at all.

STORY-26 (EPIC-03) has since added a **second, later** entry point into
`/claim`: the Availability page's "no linked person" branch (AC7) links to
`/claim` for any Member who still isn't linked, whenever they visit
Availability — not just at first login. But `/claim`'s own page-level guard
(`app/[locale]/claim/page.tsx`) redirects home **silently, with no message**
whenever there are zero unlinked+active person records — the exact same
"nothing to claim" condition, but reached from a completely different
context where the user just clicked a link that promised "a path to the
claim flow" (STORY-26 AC7's wording).

The result, confirmed during triage: a Member who was never added to the
team list (`public.people`) yet, or whose only matching person record has
already been claimed by someone else, hits a confusing loop — Availability
page says "click here to claim your record" → `/claim` bounces them straight
back home with zero explanation → home page (STORY-28) says to check
Disponibilidade → back to Availability's same message. There is no point in
this loop where the Member is told the actual fix: **ask an Admin to add you
to the team list (Equipa), or link your account if a record already exists
for you** (Admin-side capability already shipped in STORY-07 and STORY-20).

This is a messaging/UX gap, not a permissions bug — the underlying
capability to resolve it already exists.

## Acceptance criteria
1. Given a logged-in Member with no linked person, when they navigate to
   `/claim` and unclaimed+active person records **do** exist, then the
   existing STORY-11 list/select/confirm/skip flow renders unchanged
   (regression check — this story does not touch the happy path).
2. Given a logged-in Member with no linked person, when they navigate to
   `/claim` and **no** unclaimed+active person records exist, then — instead
   of a silent redirect to home — they see an explanatory message stating
   there is nothing to claim yet and instructing them to contact an Admin to
   be added to the team.
3. Given a logged-in Member who **already has** a linked person record, when
   they navigate to `/claim`, then they are still redirected home unchanged
   (STORY-11 AC5 preserved — this story only changes the "nothing to claim"
   branch, not the "already linked" branch).
4. Given the auth callback's first-login redirect decision (STORY-11 AC4:
   skip `/claim` entirely when nothing exists to claim), when a brand-new
   user logs in with nothing to claim, then that behavior is **unchanged** —
   this story only changes what `/claim` renders on **direct/later
   navigation** to the page, not the callback's redirect target.
5. Given the new "nothing to claim" message, when it renders, then strings
   come from `messages/pt-PT.json` / `messages/en.json` (key parity, AO90
   spelling) and the message is announced accessibly (reuse this codebase's
   `aria-live="polite"` convention, not `role="alert"`).

## Out of scope
- Any change to STORY-11's auth-callback redirect logic (AC4/AC5 of
  STORY-11 stay exactly as they are).
- A self-service "request to be added" feature (e.g. notifying an Admin
  automatically) — out of scope for this story; the fix here is clear
  messaging only, not a new notification mechanism.
- Any change to `app/[locale]/(app)/availability/page.tsx`'s own copy
  (STORY-26 AC7) beyond what's needed to stay consistent with this story's
  new `/claim` messaging — no new logic there.
- STORY-28 (the Member home-page "no access yet" copy) — separate, unrelated
  fix, tracked independently.

## Technical notes
- File: `app/[locale]/claim/page.tsx` — the branch at the end
  (`if (people.length === 0) redirect(...)`) changes from an unconditional
  redirect to rendering an explanatory state instead, reusing the existing
  layout shell (`app/[locale]/claim/layout.tsx`).
- The "already linked" branch (`if (existingLink) redirect(...)`) is
  untouched — only the "nothing to claim" branch changes.
- New i18n keys under the existing `Claim` namespace (both locale files),
  e.g. `noRecordsTitle` / `noRecordsDescription` — check for and remove any
  keys this story makes truly unreachable (i18n key hygiene).
- Consider whether a link back home (or to `/`) is still useful from this
  new state, even though there's no functional dead-end anymore (the Member
  can navigate via the header nav regardless).
- Tests: this is the same auth-callback-adjacent testing constraint STORY-11
  documented (placeholder Supabase creds in CI cannot reach a real OAuth
  session) — the callback-unchanged assertion (AC4) may need to stay a
  documented manual-verification step per CLAUDE.md's DoD #5, while the
  page-level "nothing to claim" rendering (AC2/AC3/AC5) should be reachable
  via the existing `E2E_WITH_AUTH`-gated pattern already used in
  `e2e/claim.spec.ts`, or the newer real-browser-fixture pattern STORY-26
  introduced in `e2e-integration/` if that proves simpler to seed (a fixture
  member with zero unlinked people in the pool).

## Definition of Done
See CLAUDE.md.
