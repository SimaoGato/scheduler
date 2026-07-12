# STORY-28: Fix stale "no access yet" copy on the Member home page
Epic: EPIC-03
Status: superseded by STORY-30 — do not implement separately; STORY-30's
personal quick-overview fully replaces this page's Member branch.

## User story
As a Member, I want the home page to accurately describe what I can do, so
that I'm not told I "have no access to any feature yet" when I actually do
(Disponibilidade / availability).

## Context
`app/[locale]/(app)/page.tsx`'s Member branch (`role === 'member'`) always
renders `Member.noAccessTitle` / `Member.noAccessDescription`
("Bem-vindo ao Escala! A tua conta está ativa, mas ainda não tens acesso a
nenhuma funcionalidade. Fala com um administrador para obteres permissões.")
for **every** Member, unconditionally — this copy predates STORY-26.

STORY-06 (EPIC-01), which introduced this message, explicitly scoped it as a
**placeholder**: its Out of scope section says "Member availability features
(EPIC-03) — only the placeholder/empty state here." STORY-26 has since
shipped the Member-facing Availability page and nav entry (EPIC-03), so every
Member now has a real destination and this placeholder is stale — it
actively misleads Members into thinking they have zero access and should
"talk to an admin for permissions," when the real next step (if any) is
narrower and different (see STORY-29 for the "no linked person" case
specifically).

This was flagged as an explicit, acknowledged non-blocking gap in STORY-26's
Implementation Plan ("Design decision 8: Home page copy is out of scope...
becomes stale once a Member has a real nav destination... flagged separately
as a follow-up question, not blocking this plan") and confirmed by a user
report during triage.

## Acceptance criteria
1. Given a logged-in Member (regardless of whether they have a linked person
   record), when they land on the home page, then the copy does not claim
   they have "no access to any feature yet."
2. Given a logged-in Member, when they land on the home page, then the copy
   points them toward the Disponibilidade (availability) nav destination as
   their next step, without duplicating or re-deriving the linked-person
   check that `app/[locale]/(app)/availability/page.tsx` already performs
   (that page already has the correct AC7 "no linked person" branch from
   STORY-26 — this story does not need to know or display linked-person
   state on the home page itself).
3. Given a Member whose account has a database provisioning failure
   (`role === null`, the pre-existing `noRoleError` branch), when they land
   on home, then that branch is unchanged — this story only touches the
   `role === 'member'` branch.
4. Given the `?denied=1` access-denied banner (STORY-06/STORY-16), when it
   renders alongside the updated Member copy, then it is unaffected by this
   change (still shown/suppressed per the existing `showDeniedBanner` logic).

## Out of scope
- Changing the "no role" (provisioning failure) branch's copy.
- Any change to `app/[locale]/(app)/availability/page.tsx`'s own "no linked
  person" messaging (STORY-26 AC7) — that page's copy is correct and
  unaffected.
- The `/claim` page's dead-end behavior when there is nothing to claim — see
  STORY-29, a separate, more involved fix.
- Admin/no-role home page branches.

## Technical notes
- File: `app/[locale]/(app)/page.tsx`, the `role === 'member'` branch
  (currently lines ~53-79).
- i18n: update `Member.noAccessTitle` / `Member.noAccessDescription` (or add
  new keys, retiring the old ones if fully replaced — check for orphans) in
  **both** `messages/pt-PT.json` and `messages/en.json`; AO90 spelling for
  pt-PT.
- Likely the simplest correct fix: replace the message with a generic
  welcome + a pointer to check "Disponibilidade" in the nav (a `<Link
  href="/availability">` is reasonable, matching this codebase's existing
  `Link` import pattern from `@/i18n/navigation`), rather than trying to
  duplicate STORY-26's linked-person branch logic here.
- Existing tests likely assert on `data-testid="member-no-access-title"` /
  `member-no-access-description` and/or the exact pt-PT strings (check
  `e2e/` for any spec asserting the old copy, e.g. anything touching
  STORY-06's home-page behavior) — update those assertions in the same
  story per CLAUDE.md's "doc comments / test assertions drift silently"
  rule.

## Definition of Done
See CLAUDE.md.
