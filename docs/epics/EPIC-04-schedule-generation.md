# EPIC-04 — Schedule Generation Engine

## Goal
Given the team, skills, availability, and past assignments, generate a balanced
draft schedule for a chosen date range (**default: next 1 month of Sundays**)
that enforces the hard rules and optimizes the soft fairness preferences. This
is the heart of the product.

## Why it matters
This is the reason the app exists — it replaces slow, error-prone manual
scheduling with a fair, rule-respecting draft produced in seconds.

## Scope (in)
- Generate for a **chosen date range**; default next 1 month of Sundays.
- **Hard rules:**
  - never assign a person on a date they blocked;
  - never schedule a **lone Beginner (level 1)** — only allowed when an Admin
    has opted them into a training slot alongside a level 2+ person;
  - only assign people **qualified** (skill level) for the role.
- **Admin opt-in training slots:** add a 2nd "training" seat to a specific
  Sunday's role so a Beginner can be paired with an experienced person.
- **Soft rules** (best-effort, produce warnings when broken):
  - avoid **back-to-back weeks** for the same person;
  - **expertise-weighted workload** targeting **Expert:Intermediate:Beginner ≈
    3:2:1** over a rolling **3-month window**.
- Use stored **assignment history** so fairness and back-to-back work across
  generations, not just within one batch.
- **Infeasible handling:** produce a partial schedule, leave unfillable slots
  empty, and emit clear warnings.
- Performance target: generate one month in **< 3 seconds**.

## Out of scope
- The editable review UI and manual overrides (EPIC-05).
- Image/message output (EPIC-06).
- History seeding (none — fairness starts fresh).
- Multi-team support (EPIC-07, deferred) — **but the schedule/assignment
  data model story must read EPIC-07's "Forward-compat guidance" section
  before finalizing schema**: no speculative `team_id` columns now, but no
  constraints/RLS shapes that would make adding team scoping later more
  than a mechanical migration. Also read STORY-31 (publish-gated member
  schedule view) so the model carries a draft/published state from day one.

## Dependencies
- EPIC-02 (roles, slots, people, skills), EPIC-03 (availability).

## Acceptance signals
- Generating a 1-month range produces an assignment per slot where feasible.
- No generated assignment violates a hard rule.
- A Beginner is never scheduled alone; appears only in an Admin-added training
  slot with a level 2+ partner.
- Over repeated months, service counts trend toward the 3:2:1 weighting and
  back-to-back weeks are rare; violations are reported as warnings.
- Unfillable slots are left empty with explanatory warnings, not errors.
- Generation completes within the performance target on the expected team size.

## Candidate stories
- Define schedule + assignment data model and history
- Hard-rule constraint solver (blocked / qualified / no lone beginner)
- Admin opt-in training slot for a specific Sunday
- Soft rule: avoid back-to-back weeks
- Soft rule: 3:2:1 expertise-weighted fairness over 3-month window
- Partial schedule + warnings for infeasible cases
- Generate-for-date-range entry point (default 1 month)
