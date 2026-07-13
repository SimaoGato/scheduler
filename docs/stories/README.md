# docs/stories/ — story and chore tracking

This directory holds all STORY-*, CHORE-*, and BUGFIX-* files for this
project, split by lifecycle status:

- **`docs/stories/`** (this directory, top level) — only *open* work: any file
  whose `Status:` line is `draft`, `in-progress`, or otherwise not yet
  finished. This is what `/status-glance`, `/stories`, `/triage`, and `/fix`
  scan first when picking the next available STORY-<NN>/CHORE-<NN>/BUGFIX-<NN>
  number and when reporting "what's open."
- **`docs/stories/done/`** — archived history: any file whose `Status:` line
  starts with `done`, `won't-do`, or `superseded`. Moved here via `git mv` so
  file history/blame is preserved. Still scanned by `/status-glance` and by
  the numbering logic in `/stories`, `/triage`, and `/fix` — archiving only
  declutters the top-level listing, it never drops history or risks a
  numbering collision.

## When to archive

Move a file into `done/` **as soon as its `Status:` line is set to
`done ✅`, `won't-do ❌`, or `superseded by ...`** — normally during
`/deliver`'s Codify stage, right after the status line is updated, in the
same commit (`~/.claude/commands/deliver.md` Stage 7 does this). If a status
change happens outside `/deliver` (e.g. manually marking a chore `won't-do`),
move the file in that same commit too. `/fix` creates `BUGFIX-*` files with
`Status: done ✅` from the moment they're created, at the top level of
`docs/stories/` like any other file — they follow this same archive-on-done
convention in a later pass, not a special fast-track.

This is a manual convention, not an automated one (see CHORE-20 Out of
scope) — do not let finished files accumulate at the top level between
archiving passes. The whole point of the split is that `docs/stories/`
always reflects only what's left to do.

Note: this README.md file itself stays at the top level of `docs/stories/`
permanently — it documents the split rather than tracking a story/chore, so
it is an intentional exception to any "only open items" expectation (see
CHORE-20 Key design decision #6).
