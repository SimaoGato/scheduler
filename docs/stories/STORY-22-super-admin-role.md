# STORY-22: Introduce a Super Admin role (protected owner account)
Epic: EPIC-01
Status: draft
Priority: low

## User story
As the app's owner, I want a role above Admin that no other Admin can demote
or remove, so that if this tool is ever used by other churches/teams with
their own Admins, there's always one account (mine) that can't be locked out
by someone else's mistake or malicious action.

## Context
Not needed today — explicitly deferred by the user ("maybe not for right now,
but eventually if this app comes to be useful to others"). Captured now so
the eventual need doesn't get lost, and because a few current design
decisions are relevant to *when* to schedule it:

- The role model is currently a hard two-value `CHECK (role IN ('admin',
  'member'))` constraint on `public.users` (migration `20260628000001`), plus
  a `'admin' | 'member'` TypeScript union baked into `lib/auth/guard.ts`
  (`AuthUser.role`) and the ternary-cast pattern in ADR-006/ADR-007. Adding a
  third value touches the DB constraint, the guard types, and every place
  that does `role !== 'admin'` (currently just a handful of per-page guards —
  cheap today, more files to touch the longer it's deferred).
- **STORY-08** (draft, block admin self-demotion) only blocks a user from
  demoting *themselves*; it explicitly leaves "blocking an admin from
  demoting **another** admin" out of scope. Today, with 2 admins, **any**
  Admin can already demote **any other** Admin, including this app's owner.
  A Super Admin role is really asking for the owner account to be exempt
  from that — i.e. it's the natural extension of STORY-08's safeguard, not
  an unrelated feature.

## Acceptance criteria
1. Given `public.users.role`, when the schema is inspected, then it accepts a
   third value (e.g. `'super_admin'`) alongside `'admin'`/`'member'`.
2. Given a user with `role = 'super_admin'`, when any other Admin (or Member)
   attempts to demote or delete that account via the user-management screen
   or its API, then the request is rejected (403/409) regardless of admin
   count — this protection is **not** conditional on "last admin remaining"
   the way the existing safeguard is.
3. Given a Super Admin, when they view the user-management screen, then they
   have at least all the same permissions as an Admin (full superset — this
   story does not need to invent new capabilities beyond protection, just the
   protected status).
4. Given there is more than one Super Admin is explicitly **not** required for
   v1 — a single, manually-designated owner account is sufficient. Promoting
   a user to `super_admin` via the UI is out of scope (see below); it is set
   directly in the database by whoever operates the deployment.
5. Given a non-super-admin (Admin or Member), when they view the
   user-management list, then a Super Admin's row is visually distinguishable
   (e.g. a distinct role label) but its "demote/remove" action is absent,
   consistent with AC2.

## Out of scope
- **Self-service promotion to Super Admin** — this is a manually-set,
  break-glass role (direct DB update), not something grantable through the
  app UI. If a UI for granting it is ever wanted, that's a separate story.
- Any capability that goes beyond "protected Admin" (e.g. billing, multi-tenant
  org management) — those only make sense once/if the app actually serves
  multiple independent teams, which is explicitly out of scope for the
  current PRD (see PRD §8, "multiple teams/band" — confirmed out of scope for
  MVP).
- Building this now. **This story should stay in `draft` until there is a
  concrete second team/org using the app**, per the user's own framing
  ("eventually if this becomes useful to others"). Do not schedule into a
  sprint without re-confirming it's still wanted at that time.

## Technical notes
- Migration: `ALTER TABLE public.users DROP CONSTRAINT ...; ALTER TABLE
  public.users ADD CONSTRAINT ... CHECK (role IN ('admin', 'member',
  'super_admin'));`. Also update `public.get_my_role()` (SECURITY DEFINER
  function used by RLS policies, see ADR references) if it does any
  role-value branching, not just pass-through.
- `lib/auth/guard.ts`: extend `AuthUser.role` union to `'admin' | 'member' |
  'super_admin'`; update the ternary-cast pattern (ADR-006) to a proper
  three-way match, not a binary ternary — the current
  `row.role === 'admin' ? 'admin' : 'member'` pattern silently collapses any
  unrecognized value to `'member'` and must be rewritten.
- `requireAdmin()` should treat `super_admin` as satisfying "admin or higher"
  everywhere an admin check currently exists (super_admin ⊇ admin
  permissions) — audit all `role !== 'admin'` call sites (grep, per
  ADR-007's own audit convention) since a naive equality check would
  incorrectly reject a Super Admin.
- Demotion/removal guard: extend the STORY-08 self-demotion check and the
  existing last-admin 409 check in `app/api/admin/users/[id]/route.ts` with
  an unconditional `if (targetUser.role === 'super_admin') return 403`.
- **Open question for whoever schedules this**: should Super Admin be
  singular-only (enforced by a partial unique index) or can there be
  multiple? Recommend singular for v1 given the "protected owner" framing,
  but flag for a real decision when this is picked up — don't assume.
- Complexity: **standard**, bordering **complex** given it touches the CHECK
  constraint, a security-relevant type used across many guard call sites, and
  RLS-adjacent functions — Refine should re-classify when this is actually
  scheduled.

## Definition of Done
See CLAUDE.md.
