# BUGFIX-01: English locale missing STORY-17 role keys
Status: done ✅
PR: 32
Related story: STORY-17 (PR #31)

## Bug
`/en/admin/roles` (and the nav on every `/en/*` page) rendered raw i18n key
names — "RoleManagement.title", "Nav.roles", "RoleManagement.saveButton" —
instead of English text, seen live on the production deployment.

## Cause
STORY-17 added its 19 new keys (`Nav.roles` + the `RoleManagement` namespace)
only to `messages/pt-PT.json`. The `en` locale introduced in CHORE-06 was
missed; next-intl silently falls back to the key name when a locale file lacks
a key, so nothing failed at build or test time.

## Fix
- English translations for all 19 missing keys added to `messages/en.json`.
- New CI-safe regression test `e2e/i18n-key-parity.spec.ts` asserting full key
  parity between `messages/pt-PT.json` and `messages/en.json` in both
  directions, so any future story that adds keys to only one locale file fails
  CI immediately.

## Spec gap
The original story's technical notes and the Definition of Done (CLAUDE.md
item 6) referenced only `messages/pt-PT.json`, so no pipeline stage checked
`en.json`. The DoD should require key parity across all locale files.
