# STORY-26: Member views upcoming Sundays and blocks/unblocks with one tap
Epic: EPIC-03
Status: draft

## User story
As a Member, I want to see the upcoming Sundays and block or unblock any of
them with one tap on my phone, so that I'm never scheduled on a date I can't
serve — in under a minute, with no manual.

## Context
This is the only feature most Members ever touch (EPIC-03 "Why it matters";
PRD §5 step 2, §7 usability: "a volunteer can block a date in < 1 minute").
It consumes the STORY-25 API. Default state is **available**; blocking is the
explicit action. Mobile-first: the epic calls for fast, obvious, low-friction
UX at phone sizes. Note: this is the first Member-facing navigation item —
`AppNav` currently returns `null` for non-admins (STORY-16).

## Acceptance criteria
1. Given a logged-in Member linked to a person, when they open the
   availability page, then they see a list of upcoming Sundays (default
   horizon: next 12 Sundays) with pt-PT-formatted dates, each showing an
   unambiguous available/blocked state, and unmarked dates read as available.
2. Given the availability page, when the Member taps an available Sunday, then
   it is persisted as blocked via the STORY-25 API and the UI reflects the
   blocked state; tapping a blocked Sunday unblocks it the same way.
3. Given a person with pre-existing blocked dates (seeded via API **before**
   `page.goto()`), when the page first loads, then those dates already render
   as blocked (server-rendered initial state, not only optimistic client
   state).
4. Given a toggle request in flight for one date, when the Member interacts,
   then that date's control is disabled until the request resolves, while
   other dates remain independently tappable (keyed in-flight state).
5. Given the API returns an error for a toggle, when it fails, then the date
   visually reverts to its previous state and an error message is announced
   via `aria-live="polite"` (no `role="alert"`).
6. Given a 375px viewport, when the page renders, then there is no horizontal
   overflow (`document.documentElement.scrollWidth`) and each date control has
   a ≥ 44px tap target (`min-h-[44px]`).
7. Given a logged-in Member whose account has no linked person, when they open
   the availability page, then they see an explanatory message (with a path to
   the claim flow) instead of the date list.
8. Given both roles, when a Member or an Admin is logged in, then the
   availability nav entry is visible and routes to the page (Members see it;
   this story must update `e2e/app-nav.spec.ts` count assertions and doc
   comments per CLAUDE.md).

## Out of scope
- Admin editing another person's blocked dates (STORY-27).
- Recurring availability patterns (Phase 2).
- Notifications/reminders to fill availability.
- Calendar-grid month view — a simple list of Sundays is sufficient for MVP.
- Blocking non-Sunday dates.

## Technical notes
- Page at `app/[locale]/(app)/availability/page.tsx` (Server Component fetches
  Sundays + current blocks; passes to a `'use client'` toggle list).
- Generate the upcoming-Sunday list server-side; horizon (12 Sundays ≈ 3
  months) is negotiable at Refine.
- Keyed in-flight state: `Set<string>` of dates, per the STORY-18 pattern in
  `components/PersonSkillsEditor.tsx`.
- Nav: extend `AppNav.tsx` beyond admin-only; component currently returns
  `null` for members — keep returning `null` only when there are zero items
  (empty-landmark rule).
- i18n keys in **both** `messages/pt-PT.json` and `messages/en.json` (key
  parity is enforced); AO90 spelling; pt-PT weekday/date formatting via
  next-intl.
- Tests: auth-gated e2e (`E2E_WITH_AUTH`) for the toggle flow with fixture
  cleanup (worker-isolated, `afterEach` unblock); AC3 must seed via
  `page.request` before `goto` per the BUGFIX-03 lesson.

## Definition of Done
See CLAUDE.md.
