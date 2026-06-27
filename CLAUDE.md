@AGENTS.md

# CLAUDE.md

## Definition of Done

A story is done when ALL of the following are true:

1. **Lint clean** — `npm run lint` exits 0 (Next.js ESLint config).
2. **Type-safe** — `npx tsc --noEmit` exits 0.
3. **Build succeeds** — `npm run build` exits 0.
4. **Tests pass** — `npm run test:e2e` exits 0 (smoke + story-specific tests).
5. **AC coverage** — every acceptance criterion has at least one automated test
   or a documented manual verification step in the story file.
6. **No hardcoded UI strings** — all user-facing text comes from
   `messages/pt-PT.json`; no raw Portuguese (or any language) string literals
   in component JSX.
7. **No regressions** — previously passing tests still pass.

## Quality gates (CI enforces these)

- `npm run lint`
- `npm run build`
- `npm run test:e2e` (Playwright smoke suite)

## Retry budget

Implementation agents have **2 fix cycles** after first review before the issue
is escalated to a human.

## Model routing

| Task                           | Model             |
|--------------------------------|-------------------|
| Story refiner                  | claude-sonnet-4-6 |
| Implementer (standard/complex) | claude-sonnet-4-6 |
| Implementer (trivial only)     | claude-haiku      |

## Complexity classification

- **trivial** — mechanical change, single file, no reasoning risk.
- **standard** — multi-file, requires understanding of at least two modules; default.
- **complex** — auth, data integrity, concurrency, security, or three or more interacting systems.

When in doubt, classify as `standard`.
