# STORY-31: Publish-gated member schedule view
Epic: EPIC-05
Status: draft — parked until EPIC-04/05 story drafting; captured now so the
mockup's design direction and the PRD requirement aren't lost
Priority: normal (but sequenced after schedule generation exists)

## User story
As a Member, I want to see the published schedule for my team in the app —
with my own assignments highlighted — and to see nothing until my
coordinator publishes it, so I always know when I'm serving next without
waiting for the WhatsApp image.

## Context
PRD #19 explicitly gives Members the right to "view the published schedule
for their team", and the updated design mockup
(`App design refinement/Escala Dashboard.dc.html`) now specifies the full
UI for it, none of which is covered by any existing epic's candidate-story
list (EPIC-05's candidates are all admin-facing; EPIC-06 is image/sharing):

- **Schedule page** (`isSchedule` block): one card per Sunday listing each
  role slot as a pill chip ("ROLE Person"); the signed-in member's own
  rows get an accent border + "YOU'RE ON" badge and their chips get the
  accent-soft fill.
- **Publish gating**: members see a dashed-border empty state ("No
  schedule published yet … you'll see your assignments here once it's
  out") until the Admin publishes; Admins always see the draft plus a
  Publish/Unpublish control (mockup shows it on both the Dashboard status
  card and the Schedule page header).
- **Dashboard "Next up" card** (member home): dark navy card with brand
  offset-shadow showing the member's next assignment date + role(s), with
  a "Full schedule →" link; falls back to "not scheduled in the next N
  Sundays" / "Schedule not published yet".

This story exists to anchor those three surfaces to EPIC-05's
publish/confirm concept ("Confirm & save schedule version" is the same
state machine the member gate reads). When EPIC-04/05 stories are drafted
properly, the refiner should split or re-scope this story as needed — the
AC below describe the end state, not necessarily one PR.

## Acceptance criteria
1. Given a generated schedule that is not yet published, when a Member
   opens the schedule view, then they see the not-published empty state
   (dashed card, i18n'd copy) and no assignment data is present in the
   response (server-side gating, not CSS hiding).
2. Given a published schedule, when a Member opens the schedule view, then
   each covered Sunday renders with its role/person slots, in pt-PT date
   formatting, and every Sunday where the Member is assigned is visually
   highlighted (accent border + badge + own-chip treatment per the
   mockup).
3. Given a published schedule, when the Member views their Dashboard, then
   the "Next up" card shows their next assignment's date and role(s), or
   the appropriate fallback message when they have no upcoming assignment
   or nothing is published.
4. Given an Admin, when they toggle publish/unpublish, then Member
   visibility flips accordingly on next load, and Admins themselves always
   see the current draft regardless of publish state.
5. Given the neutral-copy rule (STORY-30 / CLAUDE.md), when the
   not-published and no-assignment states render, then the copy is
   factual/neutral in both locales (no warning-toned framing), covered by
   the `i18n-neutral-copy` static check.

## Out of scope
- Schedule generation itself, editing, locks, regeneration (EPIC-04/05
  admin stories).
- Image export / sharing (EPIC-06).
- Email/push notification on publish — PRD non-goal; separate product
  decision.
- Multi-team switching (PRD §8).

## Technical notes
- Depends on EPIC-04's schedule/assignment data model including a
  publish/confirmed state — whoever drafts that model story should read
  this one first so the state supports "draft visible to admins, published
  visible to members" from day one.
- Member identity for highlighting comes from the `people.linked_user_id`
  link (STORY-11/20) — an unlinked member sees the schedule but no
  highlights.
- The mockup's chip/badge/empty-state styles all compose from
  already-landed foundations (CHORE-23 tokens/fonts, CHORE-24 pills,
  CHORE-17 Card, CHORE-25 hero-shadow treatment) — no new tokens expected
  beyond the accent-soft pair, which must be contrast-verified if
  introduced.
- Nav: the Schedule entry appears in the mockup's nav for all roles —
  adding it belongs to whichever story ships the page (update
  `AppNav`/bottom bar + `e2e/app-nav.spec.ts` counts per the STORY-17
  checklist).

## Definition of Done
See CLAUDE.md.
