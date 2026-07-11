# STORY-25: Persist blocked dates — data model and self-service API
Epic: EPIC-03
Status: draft

## User story
As a Member, I want the Sundays I block to be stored reliably and scoped to me,
so that the schedule generator can never assign me on a date I'm away.

## Context
EPIC-03 makes date blocking a hard constraint for the generator (PRD §6, FR5–6:
"Volunteers can block specific Sundays. Default state is available. Blocked
dates are a hard constraint."). This story lays the foundation: the
`blocked_dates` table, row ownership via the person record (people are the
schedulable unit — see EPIC-02 / STORY-11 claim flow), and a Route Handler API
that a Member can call to block/unblock their **own** dates. The Member UI
(STORY-26) and Admin on-behalf editing (STORY-27) build on this API. The
generator (EPIC-04) reads blocks via the query helper delivered here.

## Acceptance criteria
1. Given the migration has run, when the schema is inspected, then a
   `public.blocked_dates` table exists with `person_id` (FK → `people`,
   `ON DELETE CASCADE`), a `DATE` column, a uniqueness guarantee per
   (person, date), RLS enabled, and GRANTs for both `authenticated` and
   `service_role` **in the same migration**.
2. Given an authenticated Member whose account is linked to a person, when they
   POST a valid upcoming Sunday to the block endpoint, then a block row is
   created for **their linked person** and the API returns success; POSTing the
   same date again is idempotent (no duplicate row, no 500).
3. Given an authenticated Member with a block on a date, when they DELETE that
   date via the unblock endpoint, then the row is removed and the API returns
   success; unblocking an already-unblocked date is idempotent.
4. Given an authenticated Member, when they GET their availability, then the
   response lists exactly their own blocked dates (dates not present = available
   by default).
5. Given a request with a malformed or missing date, or a date that is not a
   Sunday, when it hits the block endpoint, then the API returns 400 with a
   stable machine-readable error code (e.g. `invalid_date`, `not_sunday`).
6. Given an authenticated Member whose account has **no** linked person, when
   they call any of these endpoints, then the API returns a stable error code
   (e.g. 409 `no_linked_person`) and writes nothing.
7. Given an unauthenticated request, when it hits any of these endpoints, then
   the API returns 401 and writes nothing.
8. Given blocks exist for several people and dates, when the generator-facing
   query helper (`lib/availability/*`) is called with a person set / date range,
   then it returns the matching blocks queryable **by date and by person**.

## Out of scope
- Any UI (STORY-26 renders the Member view; STORY-27 the Admin view).
- Admin editing another person's blocks (STORY-27).
- Recurring availability patterns (Phase 2, per epic).
- Consuming blocks during generation (EPIC-04).
- Blocking past dates cleanup / retention policy.

## Technical notes
- Migration: `supabase/migrations/*_blocked_dates.sql` — unique index on
  `(person_id, blocked_date)`; follow the GRANT-before-RLS rule from CLAUDE.md
  (both `authenticated` and `service_role` grants in the same migration as the
  Route Handler PR).
- Route Handlers under `app/api/availability/` using the `requireAuth(request)`
  guard pattern (`lib/auth/guard.ts`), reading cookies from `request.cookies`.
  Resolve the caller's person via `people.linked_user_id = user.id`, then write
  with the service-role client scoped to that resolved person id.
- Idempotency: upsert / `ON CONFLICT DO NOTHING` for block; delete-if-exists for
  unblock (a hard delete — no soft-delete needed for blocks).
- Sunday validation: treat the payload as a plain `YYYY-MM-DD` calendar date
  (validate with a regex + day-of-week math on the date string parsed as UTC);
  avoid timezone conversions that could shift the weekday.
- Stable error codes per CLAUDE.md Route Handler conventions (400 malformed,
  401 unauthenticated, 409 state conflict).
- Query helper in `lib/availability/` (server-only) so EPIC-04 has a single
  source of truth; cover it via the API-level e2e tests (auth-gated pattern
  `test.skip(!process.env.E2E_WITH_AUTH, ...)` where a session is required).

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **backend** (Route Handlers, `lib/` helpers) — primary area.
- **data** (new migration: table, unique index, RLS, GRANTs).
- No **frontend**/**ux** work — this story is API-only (STORY-26/27 build the UI).
- No new UI strings — DoD item 6 (i18n key parity) is not applicable to this
  story; all responses are machine-readable JSON error codes, not user-facing
  text.

### Design decisions (made here, not left ambiguous for the implementer)
1. **RLS policy shape**: follow the `people`/`roles`/`person_role_skills`
   precedent exactly — a single `blocked_dates_admin_all` policy
   (`USING/WITH CHECK public.get_my_role() = 'admin'`) for defense-in-depth
   anon-key access, and **no** member-self RLS policy. Member self-service
   reads/writes go through the **service-role client** with authorization
   enforced in application code via explicit `.eq('person_id', ...)` filters
   — this is the established pattern for member self-service routes
   (`app/api/people/claim/route.ts`, `app/api/settings/display-name/route.ts`),
   not a new one invented for this story.
2. **No "must be an upcoming date" validation at the API layer.** AC5
   exhaustively lists exactly two 400 error codes (`invalid_date`,
   `not_sunday`); the epic's out-of-scope list explicitly excludes "blocking
   past dates cleanup / retention policy." Rejecting past Sundays would
   require picking a server-side definition of "today" (timezone) that no AC
   specifies, and a past block is harmless (it can never affect a future
   generator run). STORY-26's UI will only ever render upcoming Sundays as
   tappable, so this is a belt-only (not belt-and-suspenders) surface;
   documented here as an explicit, narrow acceptance-of-scope decision, same
   pattern as STORY-18's TOCTOU note.
3. **Route shape**: collection route handles list+create (mirrors
   `app/api/admin/roles/route.ts` GET+POST), a `[date]` dynamic segment
   handles delete-by-date (mirrors the `[id]/route.ts` item-route
   convention). The date string itself (already validated `YYYY-MM-DD`) is a
   stable, natural path segment — no synthetic row id needed for the
   client-facing API.
4. **Person lookup filters `is_active = true`** on the `people` row (in
   addition to `linked_user_id = user.id`), consistent with the
   active-row-only checks in `app/api/admin/people/[id]/skills/[roleId]/route.ts`.
   A soft-deleted person with a stale link is treated the same as "no linked
   person" (409 `no_linked_person`).

### 1. Migration — `supabase/migrations/20260711000001_create_blocked_dates.sql`
```sql
-- STORY-25: Create public.blocked_dates table — a Member's self-reported
-- unavailable Sundays. Hard delete (row absence = available), no soft-delete
-- column, matching person_role_skills' precedent for join/fact tables where
-- "not present" already has clean semantics.

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    UUID        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  blocked_date DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AC1: uniqueness per (person, date) — table-level, not partial, since this
-- table has no soft-delete / is_active column (unlike roles/people).
CREATE UNIQUE INDEX IF NOT EXISTS blocked_dates_person_date_unique_idx
  ON public.blocked_dates (person_id, blocked_date);

-- AC8: reverse-lookup index for "who is blocked on date X" queries
-- (the generator's primary access pattern). The unique index above already
-- covers "blocks for person X" queries left-to-right.
CREATE INDEX IF NOT EXISTS blocked_dates_date_idx
  ON public.blocked_dates (blocked_date);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocked_dates_admin_all" ON public.blocked_dates;
CREATE POLICY "blocked_dates_admin_all" ON public.blocked_dates
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Both grants in this migration (do not repeat the STORY-03/STORY-14 gap).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_dates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_dates TO service_role;
```
Rollback: `DROP TABLE IF EXISTS public.blocked_dates;` (cascades indexes/policy).

### 2. Validation helper — `lib/validation/availability.ts`
- `parseBlockedDate(raw: unknown): string | null` — regex `^\d{4}-\d{2}-\d{2}$`,
  then reconstruct via `Date.UTC(y, m-1, d)` and verify
  `getUTCFullYear/getUTCMonth/getUTCDate` round-trip (rejects rollover dates
  like `2026-02-30`). Returns the normalized string or `null`.
- `isSunday(dateStr: string): boolean` — parses the already-validated string
  as UTC and checks `getUTCDay() === 0`. Kept separate from `parseBlockedDate`
  so the route handler can emit distinct `invalid_date` vs `not_sunday` codes
  (AC5).
- Both operate purely on the string components (UTC construction), never
  `new Date(dateStr)` directly or any local-timezone path, per the Technical
  Notes' "avoid timezone conversions that could shift the weekday" guidance.

### 3. Person resolution helper — `lib/people/resolve-self.ts`
- `resolveSelfPersonId(client: SupabaseClient, userId: string): Promise<string | null>`
  — `SELECT id FROM people WHERE linked_user_id = :userId AND is_active = true`
  via `.maybeSingle()`. Returns the person id or `null` (caller maps `null` →
  409 `no_linked_person`). Server-only (`import 'server-only'`), shared by all
  three Route Handlers below so the lookup + is_active filter can't drift
  between them.

### 4. Query helper for the generator — `lib/availability/blocked-dates.ts`
- Server-only module, single exported function satisfying AC8's "queryable
  by date and by person":
  ```ts
  export interface BlockedDateRow {
    person_id: string
    blocked_date: string // YYYY-MM-DD
  }

  export async function getBlockedDates(
    client: SupabaseClient,
    opts: { personIds?: string[]; dateFrom?: string; dateTo?: string } = {}
  ): Promise<{ data: BlockedDateRow[] | null; error: unknown }>
  ```
  Applies `.in('person_id', opts.personIds)` when provided, `.gte`/`.lte` on
  `blocked_date` when provided, mirrors the non-throwing `{ data, error }`
  convention (`qualifiedRolesForPerson`). This is the single seam EPIC-04 will
  import; the Member-facing GET route (below) also calls this helper with
  `{ personIds: [personId] }` rather than duplicating the query.
- Client-facing response type `types/availability.ts` exporting
  `{ dates: string[] }` for the GET route's JSON shape (STORY-26 will import
  this into its Client Component, same pattern as `types/skills.ts`).

### 5. Route Handlers — `app/api/availability/blocks/`
**`app/api/availability/blocks/route.ts`**
- `GET` (AC4, AC6, AC7): `requireAuth` → resolve person (409
  `no_linked_person` if none) → `const { data, error } = await getBlockedDates(serviceClient, { personIds: [personId] })`
  → **check `error` first**: if truthy, `console.error('[listBlockedDates] DB error:', error)` and
  return `NextResponse.json({ error: 'internal' }, { status: 500 })`; only
  when `error` is falsy read `data` — `NextResponse.json({ dates: (data ?? []).map(r => r.blocked_date) })`.
  Never call `.map` on `data` before the error check (a DB error can return
  `data: null`, which would throw a TypeError instead of the intended 500).
- `POST` (AC2, AC5, AC6, AC7): `requireAuth` → parse JSON (400 `invalid_json`)
  → `parseBlockedDate(body.date)` (400 `invalid_date`) → `isSunday` (400
  `not_sunday`) → resolve person (409 `no_linked_person`) → insert with
  `const { error } = await serviceClient.from('blocked_dates').upsert({ person_id, blocked_date }, { onConflict: 'person_id,blocked_date', ignoreDuplicates: true })`
  → **check `error`**: if truthy, `console.error('[blockDate] DB error:', error)`
  and return `NextResponse.json({ error: 'internal' }, { status: 500 })`; only
  return `NextResponse.json({ ok: true })` when `error` is falsy.
  `ignoreDuplicates: true` is what gives AC2's idempotency (no error, no
  duplicate row) — but this must be confirmed empirically (see the new test
  assertion in section 7) rather than assumed, since the error-check above
  would otherwise turn a wrong assumption about the upsert's return shape
  into a false 500 on the idempotent-repeat path.

**`app/api/availability/blocks/[date]/route.ts`**
- `DELETE` (AC3, AC5, AC6, AC7): `requireAuth` called before `await params`
  (CLAUDE.md ordering convention) → `await params` → `parseBlockedDate(date)`
  (400 `invalid_date`; note `not_sunday` is *not* re-validated here — an
  already-non-Sunday date can never have a row, so `.delete()` matching zero
  rows is already a correct no-op; re-validating would just be redundant, not
  a correctness gap) → resolve person (409 `no_linked_person`) →
  `const { error } = await serviceClient.from('blocked_dates').delete().eq('person_id', personId).eq('blocked_date', date)`
  → **check `error`**: if truthy, `console.error('[unblockDate] DB error:', error)`
  and return `NextResponse.json({ error: 'internal' }, { status: 500 })`;
  only when `error` is falsy return `NextResponse.json({ ok: true })`
  regardless of whether a row was actually deleted (AC3's "unblocking an
  already-unblocked date is idempotent" — no 404 on a no-op delete that
  matched zero rows without erroring, unlike the skills DELETE route's 404,
  because here the starting state legitimately has no row 99% of the time
  and that's not an error; but a genuine DB error — connection failure,
  permission error — must still 500, not be swallowed into `{ ok: true }`).
- Mass-assignment guard applies throughout: every write uses an explicit
  object literal from validated locals, never a spread of the parsed body.
- Every one of the three routes above follows the same shape:
  destructure `{ data, error }` (or `{ error }` for writes that don't need
  the returned rows), check `error` truthy → log + 500, **before** touching
  `data` or returning a success response. This matches
  `app/api/admin/people/[id]/skills/route.ts` lines 48-52 and CLAUDE.md's
  Supabase client error-field rule; do not use a bare try/catch as a
  substitute — the Supabase client does not throw on query errors.

### 6. Idempotency summary (AC2, AC3)
- Block: `upsert(..., { ignoreDuplicates: true })` on the unique
  `(person_id, blocked_date)` index — second POST is a silent no-op, 200.
- Unblock: `.delete().eq(...)` with no existence check — deleting zero rows
  is not an error; both first and second DELETE return the same 200 `{ ok: true }`.

### 7. Test plan (mapped to ACs)
Two suites per CLAUDE.md's established split:
- **`e2e-integration/blocked-dates.spec.ts`** (real local Supabase, runs on
  every PR via the `integration-test` CI job) — this is the primary suite for
  this story, since every AC requires real authenticated writes/reads. Uses
  the `adminRequest`/`memberRequest` fixtures (`e2e-integration/fixtures.ts`).
  The seeded `MEMBER_ID` has no `people` row by default, so each test creates
  its own worker-isolated `people` fixture linked to `MEMBER_ID` via a
  service-role client in `beforeEach`, and deletes it (which cascades any
  block rows via `ON DELETE CASCADE`) in `afterEach` — same fixture-isolation
  discipline as `e2e/claim.spec.ts`.
  - **AC1**: assert-by-consequence — a fixture insert with a duplicate
    `(person_id, blocked_date)` pair via the service-role client (bypassing
    the API) must fail with `23505`; confirms the unique index exists without
    needing raw SQL introspection.
  - **AC2**: `memberRequest.post('/api/availability/blocks', { data: { date: <upcoming Sunday> } })`
    → 200; re-POST same date → **explicitly assert the response status is
    200, not 500** (this is the idempotency-shape assertion added per
    challenger feedback: it empirically confirms `.upsert({ ..., ignoreDuplicates: true })`
    on a conflicting row returns a falsy `error` — i.e. `{ data: [], error: null }`
    or equivalent — so the new mandatory `{ data, error }` check in section 5
    does not itself turn the idempotent-repeat path into a false 500); and a
    service-role read-back confirms exactly one row exists (not two).
  - **AC3**: block then `memberRequest.delete('/api/availability/blocks/<date>')`
    → 200, row gone (service-role read-back); delete again → 200 (idempotent,
    no 404/500).
  - **AC4**: seed two distinct blocked dates for the fixture person (and,
    separately, one for a second throwaway person) → GET returns exactly the
    two dates belonging to the caller, not the other person's.
  - **AC5**: table-driven cases against POST — malformed string, missing
    `date` key, non-existent calendar date (`2026-02-30`) → 400
    `invalid_date`; a real Monday date → 400 `not_sunday`.
  - **AC6**: use `adminRequest` (the seeded admin has no linked `people` row)
    for POST/DELETE/GET → 409 `no_linked_person` on all three, and a
    service-role read confirms no row was written for the malformed POST case.
  - **AC7**: unauthenticated `request.post/delete/get` (no cookie) on all
    three routes → 401, no row written (service-role read-back after the
    401 POST attempt).
  - **AC8**: direct test of `getBlockedDates()` (imported from
    `lib/availability/blocked-dates.ts`) against seeded fixture rows for two
    different people and dates spanning a range — assert `personIds` filter
    and `dateFrom`/`dateTo` filters each narrow the result set correctly.
- **`e2e/availability-blocks.spec.ts`** (CI-safe smoke suite, placeholder
  credentials) — regression-only coverage that doesn't require a real
  session: unauthenticated 401 on all three routes (cheap duplicate of the
  integration AC7 case, kept here too since this file always runs, even if
  the integration job is ever skipped), and invalid-JSON/malformed-date 400
  cases gated behind `E2E_WITH_AUTH` per the existing `claim.spec.ts` pattern
  (kept as a secondary path — the integration suite above is authoritative
  for auth-required cases; `E2E_WITH_AUTH` requires a real linked person on
  the developer's own account, which cannot be assumed, so those tests are
  best-effort/manual-fallback, not the primary AC5/AC6 coverage).

### 8. Risks and rollback
- **Risk**: RLS omission for members means a future anon-key-only surface
  (e.g. a client-side Supabase call bypassing the Route Handler) would 403 on
  blocked_dates — acceptable, since STORY-26/27 are expected to go through
  these Route Handlers, same as every other member self-service feature.
- **Risk**: `ignoreDuplicates: true` on `.upsert()` is assumed to return no
  row and a falsy `error` on conflict — this assumption is now load-bearing
  for the mandatory `{ data, error }` check in section 5 (a wrong assumption
  would turn every idempotent repeat-POST into a false 500). Confirmed via
  the explicit AC2 integration test assertion in section 7 (re-POST same
  date → assert 200, not 500) before this ships.
- **Rollback**: the migration is additive (new table only); a straight
  `DROP TABLE public.blocked_dates` reverts cleanly with no data-loss risk to
  any other table (nothing else references it). Route Handlers can be
  reverted independently of the migration since STORY-26/27 don't exist yet
  and nothing else calls these paths.

### Complexity tag: **standard**
Touches an auth guard (`requireAuth`, reused not modified) and introduces a
new table with a uniqueness invariant + idempotent writes — both are
CLAUDE.md reasoning-risk signals ("auth," "data integrity") that floor this
at `standard` regardless of the line count, which is otherwise small and
closely mirrors three prior, already-reviewed patterns (STORY-11 claim,
STORY-17 roles, STORY-18 skills). Not `complex`: no auth-guard *logic*
changes, no genuine concurrency/lock design (the unique index + upsert
pattern is a direct, precedented copy), and only two new modules'
(Route Handlers + one small query helper) worth of interaction, not three or
more independently-owned systems.
