# STORY-30: Home page becomes a personal availability quick-overview
Epic: EPIC-03

## User story
As a logged-in user (Member or Admin), I want the home page to show me
something genuinely useful about my own situation the moment I land, instead
of a static welcome message and a single (often disabled) button, so that the
app feels like a real dashboard rather than a dead end.

## Context
Raised during triage: the current home page (`app/[locale]/(app)/page.tsx`)
is, for every role, essentially a static message plus at most one button —
for Admins, a permanently-disabled "Ver escala" placeholder (see CHORE-16,
filed separately, for the interim "why is this disabled" context fix); for
Members, a generic "no access yet" message that's already stale since
STORY-26 shipped the Availability feature (see STORY-28).

Rather than layering more static copy on top of both, the human confirmed
(via triage discussion) that the actual desired direction is a lightweight,
**personal** quick-overview: something deliverable **now**, without waiting
on schedule generation (EPIC-04/05/06, not yet started), reusing data that
already exists from EPIC-02 (people/roles) and EPIC-03 (blocked dates,
STORY-25/26).

This story **supersedes** STORY-28 (fix stale Member home copy) and CHORE-16
(admin home placeholder context) — both are narrower fixes to the same page
that this story fully replaces with real content. Mark both as superseded by
this story rather than delivering them separately.

**Depends on STORY-26** (Member block/unblock Sundays) being merged — this
story reuses its `lib/availability/upcoming-sundays.ts` and
`lib/availability/blocked-dates.ts` helpers directly rather than duplicating
date-horizon or query logic.

## Acceptance criteria
1. Given a logged-in Member with a linked person record, when they land on
   the home page, then they see a summary of their own availability within
   the same 12-Sunday horizon as the Availability page (STORY-26): count of
   available vs. blocked Sundays, and the date of their next upcoming
   blocked Sunday (if any), plus a link to the full Availability page to
   manage it.
2. Given a logged-in Member with **no** linked person record, when they land
   on the home page, then they see the existing "no linked person" guidance
   (consistent with STORY-26 AC7 / STORY-29's `/claim` messaging) instead of
   an availability summary — no attempt to compute a summary for a
   non-existent person.
3. Given a logged-in Admin, when they land on the home page, then they see a
   lightweight team-composition summary (e.g. number of active people,
   number of active roles) plus quick links to the admin screens that
   already work (Equipa, Funções, Utilizadores) — reusing the same
   destinations as `AppNav.tsx`.
4. Given the data model's "default available unless explicitly blocked"
   design (STORY-25), when any summary is shown, then it must not imply
   that having zero recorded blocks is a problem or an incomplete state for
   a person — that is the normal, fully-available case, not a warning
   condition (see Technical notes — this rules out a naive "N people haven't
   set their availability" warning metric, which doesn't map onto this data
   model; Refine must choose an admin metric that doesn't misrepresent the
   default-available design, e.g. a neutral count of "N pessoas com
   bloqueios nos próximos 30 dias" if any per-person signal is wanted at
   all, or omit a per-person signal entirely in favor of simple team
   counts).
5. Given a 375px viewport, when the redesigned home page renders for either
   role, then there is no horizontal overflow and all interactive elements
   keep ≥ 44px tap targets (project-standard mobile check).
6. Given all new copy, when it renders, then strings come from
   `messages/pt-PT.json` / `messages/en.json` (key parity, AO90 spelling).

## Out of scope
- Anything requiring generated schedules (EPIC-04/05/06 — not built).
- Notifications, reminders, or any push/email mechanism.
- A full analytics/reporting dashboard (e.g. historical serving trends) —
  the PRD's own "3-month rolling dashboard of who served how" is explicitly
  Phase 2 (§9 of the PRD), not this story.
- Redesigning the "no role" (provisioning-failure) branch.
- The `?denied=1` access-denied banner behavior (STORY-06/16) — unchanged,
  just needs to keep rendering correctly above the new summary content.
- Any change to `app/[locale]/(app)/availability/page.tsx` itself (STORY-26)
  — this story only adds a summary view on the home page, reusing that
  page's existing data helpers, not modifying it.

## Technical notes
- File: `app/[locale]/(app)/page.tsx` — both the `role === 'member'` and
  admin/fallback branches change; the `role === null` (no-role-error) branch
  does not.
- Reuse `lib/availability/upcoming-sundays.ts` (`getUpcomingSundays`) and
  `lib/availability/blocked-dates.ts` (`getBlockedDates`) from STORY-26 for
  the Member summary — do not duplicate horizon/date logic.
- Reuse `lib/people/resolve-self.ts` (`resolveSelfPersonId`, STORY-26) for
  the linked-person check (AC2).
- **Data-model caveat (see AC4):** `blocked_dates` rows only exist for
  Sundays a person has explicitly blocked; absence of rows means "fully
  available," not "hasn't engaged with the feature." Any Admin-facing
  metric must be phrased to avoid implying the opposite. This is the single
  most important design decision Refine needs to get right — flagged
  explicitly so it isn't glossed over as "just add a count."
- Admin summary counts: reuse existing active-people / active-roles queries
  already used by `app/[locale]/(app)/admin/people/page.tsx` and
  `app/[locale]/(app)/admin/roles/page.tsx` (or their underlying query
  helpers) rather than writing new ones, if such helpers already exist in a
  shareable form — check before adding new query functions.
- Quick links: reuse the same routes/labels as `components/AppNav.tsx`
  (`/admin/users`, `/admin/people`, `/admin/roles`) — avoid duplicating
  label strings; consider whether these should read from the same `Nav.*`
  i18n keys.
- This supersedes STORY-28 and CHORE-16 — update both files' `Status` line
  to note they are superseded by STORY-30 when this story is picked up, so
  a future `/deliver` run doesn't duplicate work on the same page.

## Definition of Done
See CLAUDE.md.
