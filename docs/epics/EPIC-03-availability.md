# EPIC-03 — Availability (Date Blocking)

## Goal
Let each **Member block specific Sundays** they cannot serve (default state:
available), and let an **Admin block on anyone's behalf**. These blocks become
a hard constraint the generator must respect.

## Why it matters
A schedule that ignores who's away is useless and erodes trust. This is also
the only feature most Members ever touch, so it must be fast and obvious on a
phone (block a date in under a minute).

## Scope (in)
- Member view of upcoming Sundays with a one-tap **block / unblock** per date.
- **Default available** unless explicitly blocked.
- Admin can view and edit **anyone's** blocked dates.
- Store blocks so the generator (EPIC-04) can read them as hard constraints.
- Mobile-first, low-friction UX.

## Out of scope
- Recurring availability patterns (Phase 2 — e.g. "only twice a month").
- Using the blocks during generation (consumed in EPIC-04).
- Notifications/reminders to fill availability.

## Dependencies
- EPIC-01 (auth/roles), EPIC-02 (people exist to own availability).

## Acceptance signals
- A Member can block and unblock specific upcoming Sundays from their phone in
  under a minute.
- Unmarked dates count as available.
- An Admin can see and edit any member's blocked dates.
- Blocked dates are persisted and queryable by date and person.

## Candidate stories
- Member: view upcoming Sundays
- Member: block / unblock a specific Sunday
- Admin: view & edit any member's blocked dates
- Persist availability for generator consumption
