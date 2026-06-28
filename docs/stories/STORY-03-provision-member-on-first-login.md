# STORY-03: Provision user as Member on first login
Epic: EPIC-01
Status: draft

## User story
As the system, I want to create an application user record set to **Member** the
first time someone logs in, so that every authenticated person has a known
identity and a safe default permission level.

## Context
Third slice of EPIC-01. Bridges the auth identity (STORY-02) to an application
user with a role. See PRD §6 (FR19–20: Admin/Member roles; new users are Members
by default). Authorization enforcement is STORY-04.

## Acceptance criteria
1. Given a Google identity that has never logged in before, when login
   completes, then a user record is created with role = **Member** and linked to
   the Google identity (email + display name stored).
2. Given a user who already has a record, when they log in again, then no
   duplicate record is created and their existing role is preserved.
3. Given the **first ever** user to log in to an empty system, when their record
   is created, then they are assigned role = **Admin** (bootstrap, so the system
   always has at least one Admin). _(If a different bootstrap is preferred, this
   criterion can be adjusted in Refine.)_
4. Given a created user record, when inspected, then it stores at minimum: a
   stable id, email, display name, role, and created timestamp.

## Out of scope
- Permission enforcement based on role (STORY-04).
- Admin UI to view/change roles (STORY-05).
- Linking the user to a "person"/team record (EPIC-02).

## Technical notes
- A `users` (or `profiles`) table keyed to the auth provider's user id.
- **Implementation approach — use the Next.js `/auth/callback` route handler,
  NOT a Supabase database trigger on `auth.users` INSERT.** A trigger fires
  only when a new auth account is created; any user who logged in before
  STORY-03 was deployed (e.g. the developer during STORY-02 testing) already
  has an `auth.users` row and would be silently skipped. The callback handler
  runs on every login and does an upsert into the app `users` table, which is
  always safe and handles pre-existing auth accounts correctly.
- Bootstrap-first-admin guard: count rows in the app `users` table (not
  `auth.users`). If count == 0, assign Admin; otherwise assign Member.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Complexity

`complex` — Modifies the only post-login code path (auth callback), introduces a
new DB table with data-integrity constraints (idempotent upsert, bootstrap-first-admin
guard), adds a service-role Supabase client that bypasses RLS, and requires the
migration to be applied before the code is deployed.

### Affected areas

- **backend**: `app/auth/callback/route.ts` (Route Handler provisioning logic),
  `lib/supabase/service.ts` (new service-role client factory)
- **data**: `supabase/migrations/20260628000001_create_users_table.sql` (new table + RLS)
- **infra**: `.env.example` (new env var)

### Files to create or modify

#### 1. CREATE `supabase/migrations/20260628000001_create_users_table.sql`

Define `public.users`:

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  display_name TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('admin', 'member')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own record (used by STORY-04).
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (auth.uid() = id);
```

There is no Supabase CLI config yet (`supabase/config.toml` does not exist).
Apply the migration by pasting it into the Supabase dashboard **SQL Editor** and
clicking Run. Document this step in the PR description. The Supabase CLI can be
wired up in a later CHORE if desired.

#### 2. CREATE `lib/supabase/service.ts`

Exports `createServiceClient()` using `createClient` from `@supabase/supabase-js`
(not `@supabase/ssr` — no cookie management needed for server-only writes).

```typescript
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

The service client bypasses Row Level Security entirely. It must never be used in
browser code or imported from Client Components.

#### 3. MODIFY `app/auth/callback/route.ts`

After a successful `exchangeCodeForSession`, call `provisionUser` before
redirecting to home. The entire provisioning block is wrapped in try/catch so
that a DB error (missing table, bad key, network failure) never blocks the user
from reaching the home page.

Provisioning logic (`provisionUser(serviceClient, user)`):

1. Check if a row already exists in `public.users` for `user.id` (SELECT by PK).
2. **Existing user** — UPDATE `email` and `display_name` only; leave `role`
   unchanged (AC2).
3. **New user** — count all rows in `public.users` (with `{ count: 'exact',
   head: true }`). If count === 0, assign `role = 'admin'` (AC3, bootstrap).
   Otherwise assign `role = 'member'` (AC1). INSERT the new row.

`display_name` derivation (in order of preference):
```
user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
```

The route handler signature stays the same; no new response shape is introduced.

#### 4. MODIFY `.env.example`

Add below the existing Supabase vars:

```
# Service-role key — server-side only; NEVER expose to the browser.
# Find it in: Supabase dashboard → Project Settings → API → service_role key.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

#### 5. CREATE `e2e/provision.spec.ts`

Automated regression tests (work with placeholder creds in CI):

- `GET /auth/callback` with no params → redirects to `/pt-PT/login`
- `GET /auth/callback?error=access_denied` → redirects to `/pt-PT/login?error=access_denied`
- `GET /auth/callback?code=badcode` → redirects to `/pt-PT/login?error=exchange_failed`
  (Supabase with placeholder creds rejects any code; provisioning is never reached)

Manual verification steps for AC1–AC4 follow the same pattern used in
`e2e/auth.spec.ts` (steps documented in the spec comment block, not automated).

### TDD sequence

1. **Write `e2e/provision.spec.ts`** with the three automated callback tests and the
   manual verification comment block. Run `npm run test:e2e` — these tests pass
   immediately because they exercise the *existing* callback redirect behavior; no
   new code is needed to make them green.

2. **Apply `supabase/migrations/20260628000001_create_users_table.sql`** to the
   real Supabase project via the SQL Editor. Verify `public.users` appears in
   Table Editor with the correct columns.

3. **Create `lib/supabase/service.ts`**. Run `npx tsc --noEmit` — should pass
   (no callers yet).

4. **Modify `app/auth/callback/route.ts`** with the provisioning logic and import
   of `createServiceClient`. Run `npx tsc --noEmit` again — should pass. Run
   `npm run lint`. Run `npm run build`.

5. **Modify `.env.example`** to document the new env var.

6. **Perform manual verification** (steps below, also documented in the spec file).

7. **Run full gate**: `npm run lint && npx tsc --noEmit && npm run build && npm run test:e2e`.

### Test plan mapped to acceptance criteria

| AC | Type | How verified |
|----|------|-------------|
| AC1 — New Google identity → Member record | Manual | Fresh login with a Google account that has no existing row in `public.users`. Check Supabase Table Editor: 1 row, `role = 'member'`, `email` and `display_name` populated, `created_at` set. |
| AC2 — Existing user logs in again → no duplicate, role preserved | Manual | Log in a second time with the same account. Confirm Table Editor still shows exactly 1 row. Manually set `role = 'admin'` in Table Editor, log in again, confirm `role` remains `'admin'`. |
| AC3 — First-ever user → Admin (bootstrap) | Manual | Truncate `public.users` via SQL Editor (`TRUNCATE public.users;`), then log in. Confirm the newly created row has `role = 'admin'`. |
| AC4 — Record stores id, email, display_name, role, created_at | Manual + Migration SQL | Migration SQL defines all required columns. After any login, Table Editor shows all five fields populated with non-null values for the logged-in user's row. |

Automated Playwright tests in `e2e/provision.spec.ts` verify the callback route's
redirect behaviour (regression) and are the only gate that runs in CI.

### Risks and rollback notes

- **Service key exposure**: `SUPABASE_SERVICE_ROLE_KEY` must remain a server-only
  env var (no `NEXT_PUBLIC_` prefix). Confirm `.gitignore` excludes `.env.local`
  before committing (already confirmed: `.env*` pattern covers it).

- **Provisioning failure does not block login**: The try/catch around the
  provisioning block means a DB error (table not yet applied, bad service key,
  network timeout) logs a warning but the user is still redirected to home with
  an active session. This is the correct degraded-mode behaviour.

- **Bootstrap race condition**: Two simultaneous first-logins to an empty system
  could both see count = 0 and both receive `role = 'admin'`. Acceptable for this
  small-church MVP; no serialisation mechanism is specified in the AC.

- **Migration must precede deployment**: If the code is deployed before the SQL
  migration is applied, provisioning fails silently (try/catch) and users log in
  without a `users` row. Apply the migration first, then deploy the callback change.

- **Rollback**: Revert `app/auth/callback/route.ts` to the STORY-02 version
  (`git revert` or restore from the previous commit). The `public.users` table
  can remain in place — it will be empty and harmless. No data loss risk.
