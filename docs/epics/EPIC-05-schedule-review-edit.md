# EPIC-05 — Schedule Review & Editing

## Goal
Show the generated draft as an editable table (Sundays × roles) and let the
Admin adjust it before sharing: reassign, swap, or clear any slot, lock slots,
and regenerate while preserving locks — with clear warnings when an edit breaks
a rule.

## Why it matters
The Admin wants automation **and** control. No generator is perfect; the ability
to tweak the draft (and trust warnings about what a tweak breaks) is what makes
the tool usable in the real world rather than a black box.

## Scope (in)
- Display the draft as an **editable table** (Sundays × roles/slots).
- **Reassign, swap, or clear** any slot manually.
- **Hard-rule violations** on manual edits are flagged with clear warnings;
  soft-rule warnings can be overridden by the Admin.
- **Lock** individual slots so they survive a regenerate.
- **Regenerate** the unlocked portion, keeping locked slots.
- Confirm/save the schedule as the version of record.

## Out of scope
- The generation algorithm itself (EPIC-04).
- Image export and sharing (EPIC-06).
- Editing by Members (Admin-only).

## Dependencies
- EPIC-04 (a generated draft to edit).

## Acceptance signals
- The Admin sees the draft as a clear Sundays × roles table.
- The Admin can reassign/swap/clear any slot, with hard-rule edits clearly
  warned (and blocked or flagged per design).
- Locked slots are untouched by a regenerate; unlocked ones are recomputed.
- A confirmed schedule is persisted as the current version.

## Candidate stories
- Render generated draft as an editable table
- Reassign / swap / clear a slot
- Real-time rule warnings on manual edits
- Lock / unlock individual slots
- Regenerate preserving locked slots
- Confirm & save schedule version
