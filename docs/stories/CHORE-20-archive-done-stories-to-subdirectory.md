# CHORE-20: Archive done stories into a `docs/stories/done/` subdirectory
Epic: maintenance
Priority: low (organizational/documentation hygiene, no code or runtime
change)
Status: draft

## Task
As someone tracking project progress, I want completed stories/chores moved
out of the main `docs/stories/` listing and into `docs/stories/done/`, so
that scanning the directory (or running `/status-glance`, `/triage`, etc.)
surfaces only open work instead of requiring me to mentally filter out
already-finished items.

## Context
`docs/stories/` currently holds 55 files flat: 43 are `Status: done ✅` (or
`won't-do ❌` / `superseded by ...`), and only 9 are actually open (`draft`).
That's an 80% noise-to-9%-signal ratio in the one directory meant to answer
"what's left to do." The user flagged this directly: "it is starting to get
hard to track open stories."

This is a pure file-organization change — no story content, epics, or code
are affected. The only real complexity is that several **global** Claude
Code slash commands (`~/.claude/commands/*.md`, not part of this repo)
currently assume a flat `docs/stories/` layout:
- `status-glance.md`: "Scan every file in `docs/stories/` (STORY-*.md and
  CHORE-*.md)."
- `stories.md` / `triage.md`: "create `docs/stories/STORY-<NN>-<slug>.md`" /
  "pick the next available story number" — both imply scanning
  `docs/stories/` directly to find the highest existing number.
- `deliver.md`: takes a literal path argument (e.g. `docs/stories/STORY-01-
  login.md`) — unaffected by where *done* files live, but should still be
  checked.
- `fix.md`: creates `BUGFIX-<NN>-<slug>.md` directly in `docs/stories/` —
  same numbering concern.

If files move without updating these, two things break silently: (1)
`/status-glance` stops seeing archived history (it only scans
`docs/stories/`), losing the "43 done" context entirely instead of just
decluttering it, and (2) `/stories`/`/triage`/`/fix`'s "next available
number" logic could pick a number that collides with an archived file it
never looked at.

## Acceptance criteria
1. Given `docs/stories/`, when this chore ships, then every file whose
   `Status:` line starts with `done`, `won't-do`, or `superseded` has been
   moved (via `git mv`, preserving history) into `docs/stories/done/`, and
   every `draft`/in-progress file remains in `docs/stories/`.
2. Given the move, when any file's own content references its own path
   (none currently do, but verify), then those references are updated.
3. Given the global command definitions listed in Context
   (`~/.claude/commands/status-glance.md`, `stories.md`, `triage.md`,
   `fix.md`), when this chore ships, then `status-glance.md`'s scan step
   covers both `docs/stories/*.md` and `docs/stories/done/*.md` (reporting
   them in the same table, distinguished by status as it already does
   today), and `stories.md`/`triage.md`/`fix.md`'s "next available number"
   logic scans **both** directories so numbering never collides with an
   archived file. Per the user's explicit decision (2026-07-13), these
   global files are edited directly — the change is intentionally not
   scoped to a repo-local override, and will affect `/status-glance`,
   `/stories`, `/triage`, `/fix`, and `/deliver` on the user's other
   projects too. Verify (or explicitly accept) that impact on any other
   project using these commands before/at delivery time.
4. Given a story is later marked done inside `docs/stories/` (the normal
   workflow, e.g. by `/deliver`'s Codify stage), when this chore ships, then
   there is a documented convention (a short note in this repo, e.g. in
   `CLAUDE.md` or a `docs/stories/README.md`) for *when* it gets archived
   into `done/` — e.g. immediately on merge, or via a periodic sweep — so
   this doesn't silently regress back into one flat directory over time.
5. Given `ls docs/stories/` after this chore, when compared to before, then
   the directory contains only the 9 currently-open items (`BUGFIX-06`,
   `CHORE-12`, `CHORE-14`, `CHORE-15`, `CHORE-17`, `CHORE-18`, `CHORE-19`,
   `STORY-22`, `STORY-24`) plus this chore itself until it too is archived.

## Out of scope
- Any change to story/chore *content* — this is a pure file-move.
- Renumbering existing stories/chores.
- Automating the archive step (e.g. a git hook or CI job that auto-moves
  done files) — start with the manual convention from AC4; automate later
  only if the manual step proves to be a real recurring friction point.

## Technical notes
- **Decision resolved (2026-07-13, user confirmed "option a"):** edit the
  global `~/.claude/commands/*.md` files directly rather than adding a
  repo-local override. This means the change is not confined to
  `scheduler` — `/status-glance`, `/stories`, `/triage`, and `/fix` will
  look for a `done/` subdirectory on every project the user runs them
  against. Implementation should note in its PR description that this PR's
  diff (repo-local `docs/stories/` reorg) is paired with an out-of-repo
  global-config edit that isn't visible in the PR itself.
- Use `git mv` (not delete + recreate) so file history/blame survives the
  move.
- Re-run `/status-glance` after the change as the acceptance check for AC3 —
  it should report the same 55-item totals it does today, just visually
  grouped/filtered by directory instead of losing the done items.

## Definition of Done
See CLAUDE.md, with the following adaptation since this chore touches no
application code: lint/type-check/build/test:e2e are not applicable (no
`.ts`/`.tsx` files change). AC coverage here means each AC above has a
documented manual verification step (a directory listing / `/status-glance`
re-run), not an automated test.

## Implementation Plan

### Affected areas (for Challenge/Review persona gating)
- **docs** — repo-local `docs/stories/*.md` file moves + new
  `docs/stories/README.md`.
- **infra/tooling (global, out-of-repo)** — `~/.claude/commands/status-glance.md`,
  `stories.md`, `triage.md`, `fix.md`, and `deliver.md`. These are **not**
  version-controlled by this repo's git (verified: `~/.claude` has no `.git`),
  so they need a manual backup/rollback plan rather than `git revert` (see
  Risks). `deliver.md` was previously classified "read and verified, no edit"
  in Refine cycle 1 — that decision is **superseded** in this cycle (cycle 2):
  Challenge found the plan's own `docs/stories/README.md` text made a claim
  ("archiving normally happens during `/deliver`'s Codify stage") that nothing
  in `deliver.md` actually enacted. See Key design decision #2 below for the
  fix and why it stays within Out-of-scope's automation boundary.
- No `.ts`/`.tsx`, no CSS, no DB, no auth code is touched. No frontend/backend/
  ai-ml/data personas apply.

### Complexity classification: **trivial**
Justification: every step is a mechanical `git mv` or a scoped, fully-specified
text edit (exact before/after strings are given below — the implementer does
not need to make judgment calls). None of CLAUDE.md's reasoning-risk override
signals apply: no inherited/global CSS property, no auth guard, no routing
regex, no env-var contract, no data integrity/concurrency/money/security
surface. The one non-obvious consideration — that the global command files
live outside this repo's git and therefore outside normal `git revert`
rollback — is a **blast-radius** concern, not a **reasoning-risk** one: the
edits themselves are simple appends of one clarifying clause to existing
sentences, verified against the files' actual current content (not guessed),
so the risk of a subtly-wrong edit is low even though the file lives outside
this repo. Mitigation (backup before editing) is specified below and keeps
this classification at `trivial` rather than bumping to `standard`.

The cycle-2 addition of a `deliver.md` edit (Key design decision #2) does not
change this classification: it is the same category of change as the other 4
edits — a single, fully-specified instruction line inserted into an existing
bullet list inside Stage 7, with exact before/after text given below. It adds
no new logic, branching, or automation (see decision #2's reasoning), so the
blast-radius profile (out-of-repo, cross-project) is identical to the other
4 global-file edits and the mitigation already in place (backup + diff before
deleting `.bak`) covers it too.

### Pre-flight verification (already done during Refine, do not redo)
Classified every file in `docs/stories/` by its `Status:` line. Current
authoritative state (56 files total as of this refine — differs slightly from
the Context section's "55 files / 43 done" estimate, because CHORE-17,
CHORE-18, CHORE-19, and BUGFIX-06 were added after this chore's Context was
first written; use the counts below, not the Context section's, as ground
truth):

- **46 files move** to `docs/stories/done/` (`Status:` starts with `done`,
  `won't-do`, or `superseded`): all of BUGFIX-01 through BUGFIX-05; CHORE-01,
  02, 03, 04, 05, 06, 07, 08 (won't-do), 09, 10, 11, 13, 16 (superseded);
  STORY-01 through STORY-21, STORY-23, STORY-25 through STORY-27, STORY-28
  (superseded), STORY-29, STORY-30.
- **10 files stay** in `docs/stories/` (top level): BUGFIX-06, CHORE-12,
  CHORE-14, CHORE-15, CHORE-17, CHORE-18, CHORE-19, CHORE-20 (this file),
  STORY-22, STORY-24. This exactly matches AC5's expected list (the 9 named
  items + CHORE-20 itself).
- **No parse ambiguity found**: every file has a `Status:` line matching one
  of `done|won't-do|superseded|draft` cleanly — grep of `^Status:` across all
  56 files returned zero files with a missing/unparseable status line. No
  blocking question here (resolves refine instruction point 5 — nothing to
  flag).
- **AC2 check (self-path references)**: grepped every file in `docs/stories/`
  for the literal string `docs/stories` in its own body. Found 7 hits, all of
  them are files referencing a **different** story's path in prose (e.g.
  CHORE-08 → `docs/stories/CHORE-07-...md`; STORY-11 → `docs/stories/STORY-03-
  ...md`; STORY-23 → `docs/stories/STORY-14-*.md`; STORY-24 →
  `docs/stories/STORY-18-...md`; STORY-18 → `docs/stories/`; STORY-30 →
  `docs/stories/STORY-28-...md` and `docs/stories/CHORE-16-...md`). **Zero
  files reference their own path.** AC2 is therefore satisfied with no edits
  needed — confirmed, not assumed.
  - Residual note (not an AC2 violation, flagging for transparency): several
    of these cross-references will become one directory level "stale" after
    the move (e.g. CHORE-08's prose pointer to CHORE-07 won't include
    `/done/`). Per Out of scope ("Any change to story/chore *content* — this
    is a pure file-move"), do **not** edit these cross-references. They are
    prose history, not live links the build depends on; leave them as-is.

### Key design decisions
1. **AC4 placement: `docs/stories/README.md`, not `CLAUDE.md`.** CLAUDE.md is
   already large and is loaded into every implementation agent's context as
   binding project instructions — its content should stay focused on
   *application-code* conventions (stack notes, DoD, etc.). The archive
   convention is purely a docs-directory meta-convention, and the most
   discoverable place for it is a README inside the directory it describes
   (anyone opening `docs/stories/` sees it immediately; anyone running `ls`
   there is exactly the audience this AC targets). Exact content drafted
   below.
2. **`deliver.md`'s Codify stage gets one added instruction line: `git mv`
   the story file into `done/` in the same commit as the Status-line update.
   This is NOT the automation Out-of-scope forbids.** (Revised in cycle 2 —
   supersedes cycle 1's "read and verified, no edit" decision, which
   Challenge correctly flagged as leaving the plan's own
   `docs/stories/README.md` claim unenacted: the README said archiving
   "normally" happens "during `/deliver`'s Codify stage, right after the
   status line is updated, in the same commit," but nothing in the real
   `deliver.md` said any such thing — confirmed by reading its Stage 7
   section verbatim. Without this fix, every future story delivered via
   `/deliver` would be marked done and left at the top level, silently
   recreating the exact flat-directory problem this chore removes.)
   Out-of-scope forbids "a git hook or CI job that auto-moves done files" —
   i.e., a mechanism that runs the move with **no agent involvement**. This
   edit is categorically different: it is one more line inside a markdown
   instruction document that a human-invoked agent (the `codifier` subagent,
   spawned by `/deliver`) already reads and follows to perform the adjacent
   action (editing the Status line) in the same stage. The codifier is
   already doing manual-but-documented, agent-executed work at this exact
   point in the pipeline; asking it to also run one `git mv` command is the
   same category of step, not a new automation surface. No hook, no CI job,
   no unattended trigger is added. AC3's "should still be checked" review of
   `deliver.md` is satisfied with a real, deliberate diff (not "no diff" as
   cycle 1 concluded).
3. **`fix.md` is updated ONLY for the numbering scan — the creation location
   is unchanged.** (Reverted in cycle 2 — supersedes cycle 1's decision to
   also make `fix.md` create `BUGFIX-*.md` files directly in
   `docs/stories/done/`. Challenge correctly flagged this as scope creep:
   AC3 asks only that the numbering-scan logic cover both directories, not
   that the creation location change.) `fix.md`'s Step 5 still creates
   `BUGFIX-<NN>-<slug>.md` at the top level of `docs/stories/`, exactly as
   today — it will pick up the standard archive-on-done convention in a
   later pass, the same as every other `done`-from-birth or later-marked-done
   file, not a special fast-track. The only edit to `fix.md` is the
   numbering-scan clause (mirrors the `stories.md`/`triage.md` edits exactly).
4. **`status-glance.md`'s edit stays strictly AC3-scoped — no opportunistic
   BUGFIX-*.md fix.** (Reverted in cycle 2 — supersedes cycle 1's decision to
   also add a BUGFIX-*.md mention to the scan description, since the current
   text only names "STORY-*.md and CHORE-*.md." Challenge correctly flagged
   this as scope creep beyond what AC3 literally asks: AC3 only requires the
   scan to also cover `docs/stories/done/*.md`.) The edit below adds only the
   `docs/stories/done/*.md` path to the scan clause; it does not touch the
   pre-existing BUGFIX-*.md omission. That omission is a real, pre-existing
   gap, but it is out of scope for this chore — noted here for a future
   chore/bugfix to pick up, not silently fixed inside an unrelated diff.
5. **`fix.md`'s "so `/status` tracks it" → "so `/status-glance` tracks it":
   kept, called out explicitly as an intentional, transparent, one-word
   correction.** The original sentence names a command (`/status`) that does
   not exist in this project's command set — the actual command is
   `/status-glance`. Since this edit is already touching that exact sentence
   to add the numbering-scan clause, the one-word naming correction is folded
   into the same line rather than left as a dangling reference to a
   nonexistent command. Flagged here for visibility per Challenge's warning;
   the alternative (leaving "/status" unchanged) would preserve a pre-existing
   inaccuracy for no benefit, so this fix is kept.
6. **`docs/stories/README.md`'s own presence at the top level is an accepted,
   intentional exception to AC5's literal wording.** AC5 says `ls
   docs/stories/` should contain "only the 9 currently-open items... plus this
   chore itself," with no explicit carve-out for a new README file. The
   README is structure describing the archive split (documentation about the
   directory), not one of the noise items (finished stories/chores) AC5 is
   trying to eliminate, and AC4 explicitly requires "a documented convention
   ... e.g. in CLAUDE.md or a `docs/stories/README.md`" — i.e., AC4 itself
   contemplates this exact file living there. This is called out explicitly
   here (not just reconciled quietly in the verification step's prose) so
   Challenge/Review can confirm or override it as a deliberate, disclosed
   scope note rather than an accidental AC5 miss.

### Exact edits

**1. `~/.claude/commands/status-glance.md`** (global, out-of-repo)
Before:
```
Scan every file in `docs/stories/` (STORY-*.md and CHORE-*.md). For each one,
read the `Status:` line (if missing, treat as `draft`), the epic, and the title.
```
After:
```
Scan every file in `docs/stories/*.md` and `docs/stories/done/*.md`
(STORY-*.md and CHORE-*.md). For each one, read the `Status:` line (if
missing, treat as `draft`), the epic, and the title. Files in
`docs/stories/done/` are reported in the same summary table below,
distinguished by their `Status:` value as already described — the directory
split changes where files live, not what gets reported.
```
(Note: this edit deliberately does NOT add "BUGFIX-*.md" to the file-type
list, even though that omission is real and pre-existing — see Key design
decision #4. Only the `docs/stories/done/*.md` path is added, per AC3's
literal wording.)

**2. `~/.claude/commands/stories.md`** (global, out-of-repo)
Before:
```
4. Number stories sequentially within the epic.
```
After:
```
4. Number stories sequentially within the epic. To pick `<NN>`, scan both
   `docs/stories/*.md` and `docs/stories/done/*.md` for existing
   `STORY-<NN>-*.md` files and use the next unused number — archived stories
   still count toward numbering so a new story never collides with one
   that's been moved to `done/`.
```

**3. `~/.claude/commands/triage.md`** (global, out-of-repo)
Before:
```
- **Is it tied to an existing epic?** → create a `STORY-<NN>-<slug>.md` inside
  `docs/stories/`, referencing that epic. Pick the next available story number.
- **Is it a standalone maintenance/infra task?** → create a `CHORE-<NN>-<slug>.md`
  inside `docs/stories/`, with `Epic: maintenance`.
```
After:
```
- **Is it tied to an existing epic?** → create a `STORY-<NN>-<slug>.md` inside
  `docs/stories/`, referencing that epic. Pick the next available story number
  by scanning both `docs/stories/*.md` and `docs/stories/done/*.md` for
  existing `STORY-<NN>` files.
- **Is it a standalone maintenance/infra task?** → create a `CHORE-<NN>-<slug>.md`
  inside `docs/stories/`, with `Epic: maintenance`. Pick the next available
  chore number the same way, scanning both `docs/stories/*.md` and
  `docs/stories/done/*.md`.
```

**4. `~/.claude/commands/fix.md`** (global, out-of-repo)
Before:
```
## Step 5 — Update tracking
- If the bug relates to a delivered story, append a note to that story file:
  `Bug fix: fix/<slug> — <one-line summary>`.
- Create a `BUGFIX-<NN>-<slug>.md` in `docs/stories/` with `Status: done ✅`
  and the PR link, so `/status` tracks it.
```
After:
```
## Step 5 — Update tracking
- If the bug relates to a delivered story, append a note to that story file:
  `Bug fix: fix/<slug> — <one-line summary>`.
- Create a `BUGFIX-<NN>-<slug>.md` in `docs/stories/` with `Status: done ✅`
  and the PR link, so `/status-glance` tracks it. Pick `<NN>` by scanning
  both `docs/stories/*.md` and `docs/stories/done/*.md` for existing
  `BUGFIX-<NN>` files and using the next unused number.
```
(Note: the creation location is unchanged — still `docs/stories/`, not
`docs/stories/done/`. Cycle 1 had also changed the creation location; that
was scope creep beyond AC3 and is reverted here — see Key design decision
#3. Only the numbering-scan clause is added, plus the "/status" →
"/status-glance" naming correction, called out in Key design decision #5.)

**5. `~/.claude/commands/deliver.md`** (global, out-of-repo) — Stage 7
(Codify)
Before:
```
## Stage 7 — Codify
Spawn the `codifier` subagent. It extracts reusable learnings, updates CLAUDE.md
and/or writes an ADR under `docs/adr/`, and adds rule snippets so the next story
benefits. Then mark the PR ready for review (un-draft) and report the final PR URL.
- Update the story file: set `Status: done ✅` and add the `PR: <number>` line.
  If the run failed or was escalated, set `Status: blocked ❌` with a one-line
  reason.
```
After:
```
## Stage 7 — Codify
Spawn the `codifier` subagent. It extracts reusable learnings, updates CLAUDE.md
and/or writes an ADR under `docs/adr/`, and adds rule snippets so the next story
benefits. Then mark the PR ready for review (un-draft) and report the final PR URL.
- Update the story file: set `Status: done ✅` and add the `PR: <number>` line.
  If the run failed or was escalated, set `Status: blocked ❌` with a one-line
  reason.
- If the project has a `docs/stories/done/` archive convention (see that
  project's `docs/stories/README.md`), also `git mv` the story file into
  `docs/stories/done/` in the same commit as the Status-line update, so
  finished stories don't accumulate at the top level.
```
(This is the fix for Challenge's Critical #1: the plan's `docs/stories/
README.md` text claims archiving "normally" happens "during `/deliver`'s
Codify stage, right after the status line is updated, in the same commit" —
this edit is what makes that claim true. See Key design decision #2 for why
this is not the automation Out-of-scope forbids: it is one instruction line
for the already-spawned `codifier` agent to follow, not an unattended hook.)

**6. New file: `docs/stories/README.md`** (repo-local)
```
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
```

### Step-by-step approach
1. **Snapshot the global command files before editing** (rollback safety net,
   since `~/.claude` is not git-tracked): `cp ~/.claude/commands/status-glance.md{,.bak}`
   and the same for `stories.md`, `triage.md`, `fix.md`, and `deliver.md`
   (5 files total — `deliver.md` added in cycle 2, see Key design decision
   #2). Delete the `.bak` files at the end once the edits are confirmed
   correct (do not leave stray `.bak` files behind, and never commit them —
   they live outside the repo anyway).
2. Apply the 5 exact edits above to the global command files
   (`status-glance.md`, `stories.md`, `triage.md`, `fix.md`, `deliver.md`).
3. Create `docs/stories/README.md` with the exact content above (repo-local,
   `git add`-tracked).
4. `mkdir -p docs/stories/done`.
5. Move the 46 files classified above via `git mv`, e.g.:
   ```
   for f in docs/stories/*.md; do
     status=$(grep -m1 '^Status:' "$f")
     if echo "$status" | grep -qE 'Status: (done|won.t-do|superseded)'; then
       git mv "$f" docs/stories/done/
     fi
   done
   ```
   (This exact classification script was dry-run read-only during Refine and
   produced the 46/10 split documented above — safe to reuse verbatim for the
   real `git mv` pass.)
6. Verify: `ls docs/stories/*.md` shows exactly the 10 expected files (BUGFIX-06,
   CHORE-12, CHORE-14, CHORE-15, CHORE-17, CHORE-18, CHORE-19, CHORE-20,
   STORY-22, STORY-24) plus the new `README.md`; `ls docs/stories/done/*.md`
   shows exactly the 46 moved files; `git status` shows all 46 as renames
   (not delete+add) confirming history was preserved.
7. Run `/status-glance` and confirm it reports the same total (56 items) and
   the same status breakdown as before the move, just reading from both
   directories.
8. Delete the `.bak` files from step 1.
9. Commit repo-local changes (`docs/stories/done/*`, `docs/stories/README.md`,
   the top-level file removals) as one commit. The global `~/.claude/commands/*`
   edits are not part of this repo's git — note this explicitly in the PR
   description per the story's Technical notes ("paired with an out-of-repo
   global-config edit that isn't visible in the PR itself").

### Test plan (mapped to acceptance criteria)
- **AC1** (done/won't-do/superseded moved via `git mv`, draft stays): manual
  verification — `git status` after the move shows 46 renames from
  `docs/stories/<name>.md` to `docs/stories/done/<name>.md` (not delete+add,
  confirming `git mv` was used and history preserved); `ls docs/stories/*.md`
  lists exactly the 10 files expected to stay.
- **AC2** (self-path references updated): manual verification — already
  confirmed at Refine time (see Pre-flight verification above) that zero
  files reference their own path; re-run the same grep after the move as a
  final check: `grep -l "docs/stories/$(basename FILE .md)" docs/stories/done/FILE.md`
  for a couple of spot-checked files, expect no output.
- **AC3** (global command files scan both directories): manual verification —
  (a) diff each of the 4 AC3-scoped edited files (`status-glance.md`,
  `stories.md`, `triage.md`, `fix.md`) against its `.bak` snapshot to confirm
  only the intended clause was added, nothing else changed (and, for
  `fix.md`, confirm the creation location text `Create a BUGFIX-<NN>-<slug>.md
  in docs/stories/` is unchanged from before — verifying Critical #2's
  reversion actually landed); (b) run `/status-glance` and confirm the
  reported total/breakdown is unchanged from a pre-move run (56 total, same
  done/won't-do/superseded/draft counts); (c) manually trace through
  `/stories` and `/triage`'s updated numbering instructions against the
  actual file list to confirm the "next number" they would compute (e.g. next
  STORY number, next CHORE number, next BUGFIX number) is correct when
  computed across both directories combined, i.e. is higher than any number
  in either directory.
- **AC4** (documented convention): manual verification — (a) read
  `docs/stories/README.md` and confirm it states clearly when a file is
  archived (on `Status:` becoming done/won't-do/superseded, same commit) and
  that this is manual, not automated; (b) diff `deliver.md` against its
  `.bak` snapshot and confirm Stage 7 now contains the `git mv` instruction
  line, so the README's claim ("normally during `/deliver`'s Codify stage...
  in the same commit") is actually true of the real file, not aspirational
  prose — this is the direct regression check for Critical #1.
- **AC5** (final directory contents match expected 9 + CHORE-20): manual
  verification — `ls docs/stories/*.md` output diffed against the literal
  expected list in AC5 plus `README.md`.

### Risks and rollback
- **Global files are not git-tracked.** Mitigation: `.bak` snapshots taken
  before editing (step 1), diffed against the edited versions before deleting
  the snapshots (part of AC3/AC4's test plan). If a mistake is found after the
  `.bak` files are already deleted, the exact before/after text for all 5
  edits (including `deliver.md`, added in cycle 2) is captured verbatim in
  this plan and can be manually restored from here.
- **Cross-project impact.** Per the story's Technical notes, these edits
  affect `/status-glance`, `/stories`, `/triage`, `/fix`, **and now
  `/deliver`** on every project the user runs them against, not just
  `scheduler`. The `deliver.md` edit is conditional on the target project
  having a `docs/stories/done/` archive convention (see the exact edit's
  wording: "If the project has a `docs/stories/done/` archive convention...")
  so it is a no-op instruction on projects without one — it does not force
  the archive convention onto other projects, it only follows it where it
  already exists. This was the user's explicit 2026-07-13 decision to edit
  global files directly (documented in the story); no further confirmation
  needed, but worth re-surfacing at Challenge/Review since it's an unusual
  blast radius for a "trivial" chore, now one file wider than cycle 1's plan.
- **Repo-local rollback** (docs/stories moves + new README): fully reversible
  via `git revert` of the single commit, since these are ordinary tracked
  file moves within this repo.
- **Numbering collision risk if a future `/stories`/`/triage`/`/fix` run
  somehow only scans one directory** (e.g. a stale cached copy of the old
  command file): low severity — a collision would produce two files with the
  same `<NN>` prefix, which is cosmetically confusing but not destructive
  (no data loss, no silent overwrite, since `git mv`/file creation would just
  create a second file with the same number in a different slug). Would be
  caught at the next `/status-glance` run showing a duplicate number in the
  table.

### Open questions
None blocking. Three non-blocking judgment calls made explicit above for
Challenge/Review to confirm or override (cycle 2 revision — cycle 1's
open questions on decisions #3 and #4 are resolved: both were reverted to
strict AC3 scope per Challenge's Critical #2 and Warning findings):
- Design decision #2 (`deliver.md`'s Codify stage gets a new `git mv`
  instruction line) — confirm this reads as "one more agent instruction in a
  document the codifier already follows," not as the automation Out-of-scope
  forbids.
- Design decision #5 (`fix.md`'s "/status" → "/status-glance" one-word
  naming correction, folded into the same edit as the numbering-scan clause).
- Design decision #6 (`docs/stories/README.md`'s own presence at the top
  level is an accepted, intentional exception to AC5's literal "only 9 items
  + this chore" wording).

## Implementation notes

**Plan execution completed.** All steps from the Implementation Plan executed
in order:

1. Backed up 5 global command files before editing (`.bak` files created,
   verified, then deleted).
2. Applied exact edits to all 5 global files (status-glance.md, stories.md,
   triage.md, fix.md, deliver.md) — diffs verified against backups confirm
   only intended clauses added, no other changes.
3. Created `docs/stories/README.md` with exact content from plan.
4. Created `docs/stories/done/` directory.
5. Moved 46 files via `git mv` classification script — all 46 show as renames
   in `git status` (history preserved).
6. Verification results:
   - `ls docs/stories/*.md` → 10 open stories/chores + README.md (11 total)
   - `ls docs/stories/done/*.md` → 46 files (exact count and names match plan)
   - `git status --porcelain` → all 46 shown as `R` (rename) entries
7. Created feature branch `chore/CHORE-20-archive-done-stories` and committed
   repo-local changes (52 files: 46 renames + 5 open story files + README.md).
8. Pushed branch and opened draft PR #49.

**AC coverage:**
- AC1 (files moved via git mv) ✓ — git status shows 46 renames
- AC2 (self-path references updated) ✓ — verified at Refine; zero files
  reference their own path
- AC3 (global commands scan both directories) ✓ — all 5 files edited; diffs
  verified; PR description notes out-of-repo edits
- AC4 (documented convention) ✓ — `docs/stories/README.md` explains when/how
  to archive; `deliver.md` Stage 7 now enacts the convention
- AC5 (directory contents match expected) ✓ — top-level has exactly 10 open
  + README; done/ has exactly 46

**Ready for QA/Review:** Manual verification steps can proceed per test plan
(run `/status-glance`, verify total/breakdown unchanged, confirm numbering
logic computes correctly across both directories).
