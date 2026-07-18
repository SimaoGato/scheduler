# EPIC-07 — Multi-Team Support

Status: deferred (post-MVP / phase 2) — drafted 2026-07-18 so the concept
has a home and earlier epics can account for it in schema decisions. Do not
draft stories for this epic until there is a concrete second team ready to
use the app (same trigger as STORY-22).

## Goal
Let one Escala deployment serve multiple ministry teams (e.g. Sound &
Multimedia and the Worship Band): each team has its own people, roles,
availability context, and schedules; users can belong to several teams and
switch between them; admins manage per-team while user accounts remain
global.

## Why it matters
The PRD (§ Users, § Constraints) explicitly anticipates this: "the same
structure could later serve other teams (e.g. the worship band)" and
"design shouldn't preclude multiple teams later." The updated design
mockup (`App design refinement/Escala Dashboard.dc.html`) already encodes
the target UX: a team-switcher pill in the header, per-team dashboards/
schedules/rosters, a per-user "My teams" list in Settings, and team badges
on the Users page. The user has confirmed this is a wanted future
direction ("nice to have — we should account for it").

## Scope (in, when activated)
- A `teams` table; `people`, `roles` (and by extension skills,
  availability context, schedules) scoped to a team.
- Users ↔ teams membership (a user can belong to multiple teams; per-team
  member/admin standing is an open design question — see below).
- Header team-switcher (mockup's `teamPillStyle`/`cycleTeam`), with the
  active team scoping every page's data.
- "My teams" row on Settings; team badges on the admin Users page
  (mockup's `user.teams`).
- Migration path: existing single-team data becomes team #1 with zero
  data loss.

## Out of scope
- Cross-team scheduling constraints (e.g. "don't schedule the same person
  in two teams on one Sunday") — a later refinement, but worth keeping in
  mind when the assignment model is designed.
- Public sign-up, billing, or full multi-tenant org management.
- Building any of this before a real second team exists.

## Dependencies
- EPIC-01–03 (existing model), EPIC-04/05 (schedule model — see the
  forward-compat note added to EPIC-04).
- STORY-22 (super-admin) shares the same activation trigger and becomes
  more relevant once multiple teams/admins exist.

## Forward-compat guidance for earlier epics (actionable NOW)
The one thing MVP work must do today: **don't preclude team scoping.**
Concretely, when EPIC-04's schedule/assignment data model is drafted:
- Prefer schema seams that make adding a `team_id` column + backfill a
  mechanical migration (e.g. don't build uniqueness constraints or RLS
  policies that semantically assume "there is exactly one global roster").
- Do NOT add speculative `team_id` columns now — YAGNI; a well-shaped
  single-team schema migrates cleanly (this codebase's existing
  `people`/`roles` tables already have no team assumptions baked into
  their constraints beyond global name-uniqueness, which is exactly the
  kind of constraint that would gain a `team_id` prefix later).
- Keep "the team" out of hardcoded copy where feasible (i18n keys already
  handle this).

## Open questions (decide when activated, not now)
- Is admin/member standing global (current `users.role`) or per-team
  membership? The mockup's Users page shows one global role badge plus
  team badges, suggesting global role + team membership — but this must be
  a real decision, not an inference from a mockup.
- Does role/skill qualification carry across teams or is it per-team?
  (Mockup shows per-team rosters with per-team roles → per-team.)

## Acceptance signals (when activated)
- Two teams operate independently: separate rosters, roles, availability,
  and schedules, with no cross-team data leakage (RLS-verified).
- A user in both teams can switch context and sees only the active team's
  data; their availability blocks apply wherever relevant per the chosen
  design.
- Existing pre-migration data is fully intact as team #1.

## Candidate stories (sketch only — draft properly when activated)
- Teams table + membership model + migration of existing data
- Team switcher in header + per-request team context
- Scope people/roles/skills queries and RLS by team
- Scope availability and schedules by team
- Settings "My teams" + Users page team badges
