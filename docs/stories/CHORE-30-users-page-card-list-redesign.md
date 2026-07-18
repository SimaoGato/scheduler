# CHORE-30: Redesign Users page as avatar card-list rows with badges
Epic: maintenance
Priority: standard — part of the pre-EPIC-04 UI push
Status: draft
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: CHORE-21 (Team page redesign — same row idiom), CHORE-29 (Roles
page redesign — same row idiom), updated mockup in
`App design refinement/Escala Dashboard.dc.html` (`isUsers` block,
`userRows`), STORY-05 (user management), STORY-08 (self-demotion guard)

## Task
As an Admin on the Utilizadores page (`/admin/users`), I want each account
shown as a card-style row with an initials avatar, name, email, and a role
badge, so the page matches the new design language and reads cleanly on a
phone.

## Context
The updated mockup renders each user as a bordered card row: a circular
initials avatar (mono font), name (display font, bold) with the email in
mono underneath, and pill badges on the right — in the mockup: a teams
badge, an ADMIN/Member role badge (admin = solid navy fill, member =
outline), and an Active/Invited status badge.

Two mockup elements do **not** map to this app's model and are excluded:
- **Teams badge** — multi-team is out of MVP scope (PRD §8).
- **"Invited" status / "Invite user" button** — there is no invite flow;
  accounts self-provision on first Google login (STORY-03) and link via
  the claim flow (STORY-11). Every listed account is definitionally
  active. Do not invent a status column.

What remains: avatar + name/email + role badge, plus the existing
promote/demote action restyled as a pill control.

## Acceptance criteria
1. Given the Utilizadores page, when rendered, then each user appears as a
   card-style row with: circular initials avatar (initials derived from
   display name, mono font), display name (display font), email (mono
   font), and a role badge — admin rendered as a solid filled pill,
   member as an outline pill, matching the mockup's visual hierarchy.
2. Given the existing promote/demote flow (including the STORY-08
   self-demotion block and the last-admin 409 guard), when used in the new
   layout, then behavior, API calls, error messages, and all existing
   `data-testid`s in `UserTable.tsx` are unchanged so STORY-05/08 e2e
   tests pass unmodified.
3. Given a 375px/390px viewport with long names/emails, when rendered,
   then no horizontal page overflow and no visually broken row (name and
   badges stay visually associated — BUGFIX-06's coherence standard, not
   just a scrollWidth pass).
4. Given all interactive controls, when measured, then ≥44px tap targets.
5. Given light and dark theme, when rendered, then all text/background
   pairs — including the solid role badge fill — meet WCAG AA 4.5:1 using
   existing verified tokens; if the navy header token (CHORE-28) is used
   for the admin badge fill per the mockup, verify that pairing
   explicitly.
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Invite flow, "Invited" status, or any accounts-model change.
- Teams badge / multi-team anything (PRD §8).
- Roles and Team pages — CHORE-29/CHORE-21.
- Changing who can be promoted/demoted — presentation only.

## Technical notes
- Primary files: `components/UserTable.tsx`,
  `app/[locale]/(app)/admin/users/page.tsx`.
- Initials helper: mockup uses first letters of first two name words,
  uppercased — handle empty display names with the existing user-display
  fallback convention (CLAUDE.md), never render an empty avatar.
- Note the known pre-existing bug in `admin/users/page.tsx` (destructures
  `{ data }` without `error` — CLAUDE.md flags "fix it in the next story
  that touches that file"): if this chore touches that query, fix the
  destructuring per the documented pattern.
- Role badge needs no new tokens if it reuses verified pairs; measure any
  new combination.
- Visually render (dev server) both themes at 375px and 1280px before
  marking done.

## Definition of Done
See CLAUDE.md.
