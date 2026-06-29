# STORY-08: Block admin self-demotion on user-management screen
Epic: EPIC-01
Status: draft

## User story
As an Admin, I want the "Rebaixar" button on my own row to be absent (or
disabled), so that I cannot accidentally revoke my own admin access from the
user-management screen.

## Context
Discovered during manual QA of STORY-05. The PATCH endpoint already enforces
the last-admin safeguard (409 when only one admin remains), so the truly
dangerous case is protected. However, when two or more admins exist, the current
implementation lets an admin demote themselves — the request succeeds, local
state updates, but on the next navigation the user is redirected away from
`/admin/users` as a Member. This is confusing UX. The PRD (FR19) and AC3 of
STORY-05 both frame role changes as an admin acting on *another* user
("Can promote **other** users"; "when **another** Admin demotes them"), implying
self-demotion is never the intended workflow.

## Acceptance criteria
1. Given a logged-in Admin viewing the user-management screen, when their own
   row is rendered, then the "Rebaixar"/"Promover" action button is **not
   shown** (or is hidden) for that row.
2. Given an Admin who sends a PATCH request to `/api/admin/users/:id` with
   their own `id` and `role: 'member'`, then the server returns 400 with a
   clear error (`self_demotion`), regardless of how many admins exist.
3. Given an Admin who sends a PATCH request to `/api/admin/users/:id` with
   their own `id` and `role: 'admin'` (no-op promote), then the request
   succeeds normally (200) — only demotion is blocked.

## Out of scope
- Blocking an admin from promoting another user to admin.
- Blocking any other self-modification (e.g. name/email changes).
- UI changes beyond hiding/disabling the action button on the logged-in user's
  own row.

## Technical notes
- `app/api/admin/users/[id]/route.ts`: after `requireAdmin`, compare `userId`
  (from params) to `result.user.id` (the authenticated user). If equal and
  `role === 'member'`, return 400 `{ error: 'self_demotion' }`.
- `components/UserTable.tsx`: the page already fetches the full user list via
  the service client. The Server Component `app/[locale]/admin/users/page.tsx`
  must pass the current user's `id` down as a prop so `UserTable` can suppress
  the action button on the matching row.
- Add `UserManagement.errorSelfDemotion` i18n key to `messages/pt-PT.json`
  (e.g. "Não pode remover os seus próprios privilégios de administrador.") for
  any client-side guard or fallback error display.
- The server-side check (AC2) is the authoritative safeguard; the UI change
  (AC1) is UX polish on top.

## Definition of Done
See CLAUDE.md.
