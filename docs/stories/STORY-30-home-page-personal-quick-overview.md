# STORY-30: Home page becomes a personal availability quick-overview
Epic: EPIC-03

## User story
As a logged-in user (Member or Admin), I want the home page to show me
something genuinely useful about my own situation the moment I land, instead
of a static welcome message and a single (often disabled) button, so that the
app feels like a real dashboard rather than a dead end.

## Context
Raised during triage: the current home page (`app/[locale]/(app)/page.tsx`)
is, for every role, essentially a static message plus at most one button —
for Admins, a permanently-disabled "Ver escala" placeholder (see CHORE-16,
filed separately, for the interim "why is this disabled" context fix); for
Members, a generic "no access yet" message that's already stale since
STORY-26 shipped the Availability feature (see STORY-28).

Rather than layering more static copy on top of both, the human confirmed
(via triage discussion) that the actual desired direction is a lightweight,
**personal** quick-overview: something deliverable **now**, without waiting
on schedule generation (EPIC-04/05/06, not yet started), reusing data that
already exists from EPIC-02 (people/roles) and EPIC-03 (blocked dates,
STORY-25/26).

This story **supersedes** STORY-28 (fix stale Member home copy) and CHORE-16
(admin home placeholder context) — both are narrower fixes to the same page
that this story fully replaces with real content. Mark both as superseded by
this story rather than delivering them separately.

**Depends on STORY-26** (Member block/unblock Sundays) being merged — this
story reuses its `lib/availability/upcoming-sundays.ts` and
`lib/availability/blocked-dates.ts` helpers directly rather than duplicating
date-horizon or query logic.

## Acceptance criteria
1. Given a logged-in Member with a linked person record, when they land on
   the home page, then they see a summary of their own availability within
   the same 12-Sunday horizon as the Availability page (STORY-26): count of
   available vs. blocked Sundays, and the date of their next upcoming
   blocked Sunday (if any), plus a link to the full Availability page to
   manage it.
2. Given a logged-in Member with **no** linked person record, when they land
   on the home page, then they see the existing "no linked person" guidance
   (consistent with STORY-26 AC7 / STORY-29's `/claim` messaging) instead of
   an availability summary — no attempt to compute a summary for a
   non-existent person.
3. Given a logged-in Admin, when they land on the home page, then they see a
   lightweight team-composition summary (e.g. number of active people,
   number of active roles) plus quick links to the admin screens that
   already work (Equipa, Funções, Utilizadores) — reusing the same
   destinations as `AppNav.tsx`.
4. Given the data model's "default available unless explicitly blocked"
   design (STORY-25), when any summary is shown, then it must not imply
   that having zero recorded blocks is a problem or an incomplete state for
   a person — that is the normal, fully-available case, not a warning
   condition (see Technical notes — this rules out a naive "N people haven't
   set their availability" warning metric, which doesn't map onto this data
   model; Refine must choose an admin metric that doesn't misrepresent the
   default-available design, e.g. a neutral count of "N pessoas com
   bloqueios nos próximos 30 dias" if any per-person signal is wanted at
   all, or omit a per-person signal entirely in favor of simple team
   counts).
5. Given a 375px viewport, when the redesigned home page renders for either
   role, then there is no horizontal overflow and all interactive elements
   keep ≥ 44px tap targets (project-standard mobile check).
6. Given all new copy, when it renders, then strings come from
   `messages/pt-PT.json` / `messages/en.json` (key parity, AO90 spelling).

## Out of scope
- Anything requiring generated schedules (EPIC-04/05/06 — not built).
- Notifications, reminders, or any push/email mechanism.
- A full analytics/reporting dashboard (e.g. historical serving trends) —
  the PRD's own "3-month rolling dashboard of who served how" is explicitly
  Phase 2 (§9 of the PRD), not this story.
- Redesigning the "no role" (provisioning-failure) branch.
- The `?denied=1` access-denied banner behavior (STORY-06/16) — unchanged,
  just needs to keep rendering correctly above the new summary content.
- Any change to `app/[locale]/(app)/availability/page.tsx` itself (STORY-26)
  — this story only adds a summary view on the home page, reusing that
  page's existing data helpers, not modifying it.

## Technical notes
- File: `app/[locale]/(app)/page.tsx` — both the `role === 'member'` and
  admin/fallback branches change; the `role === null` (no-role-error) branch
  does not.
- Reuse `lib/availability/upcoming-sundays.ts` (`getUpcomingSundays`) and
  `lib/availability/blocked-dates.ts` (`getBlockedDates`) from STORY-26 for
  the Member summary — do not duplicate horizon/date logic.
- Reuse `lib/people/resolve-self.ts` (`resolveSelfPersonId`, STORY-26) for
  the linked-person check (AC2).
- **Data-model caveat (see AC4):** `blocked_dates` rows only exist for
  Sundays a person has explicitly blocked; absence of rows means "fully
  available," not "hasn't engaged with the feature." Any Admin-facing
  metric must be phrased to avoid implying the opposite. This is the single
  most important design decision Refine needs to get right — flagged
  explicitly so it isn't glossed over as "just add a count."
- Admin summary counts: reuse existing active-people / active-roles queries
  already used by `app/[locale]/(app)/admin/people/page.tsx` and
  `app/[locale]/(app)/admin/roles/page.tsx` (or their underlying query
  helpers) rather than writing new ones, if such helpers already exist in a
  shareable form — check before adding new query functions.
- Quick links: reuse the same routes/labels as `components/AppNav.tsx`
  (`/admin/users`, `/admin/people`, `/admin/roles`) — avoid duplicating
  label strings; consider whether these should read from the same `Nav.*`
  i18n keys.
- This supersedes STORY-28 and CHORE-16 — update both files' `Status` line
  to note they are superseded by STORY-30 when this story is picked up, so
  a future `/deliver` run doesn't duplicate work on the same page.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **Frontend / Server Component**: `app/[locale]/(app)/page.tsx` (`role === 'member'` and admin/fallback branches only; `role === null` branch untouched).
- **Backend / data**: new lightweight count/aggregate queries against existing tables (`people`, `roles`, `blocked_dates`) via the existing service-role client — no schema changes, no new tables, no RLS changes.
- **Shared lib**: no changes to `lib/availability/upcoming-sundays.ts`'s public surface — the home page calls the already-exported `getUpcomingSundays(count)` function with its own local `const SUNDAY_HORIZON = 12` literal, matching the horizon value `availability/page.tsx` uses without touching that file at all (explicitly out of scope).
- **i18n / ux copy**: new keys in `messages/pt-PT.json` and `messages/en.json` (`Home.*` namespace), removal of now-orphaned keys (`Home.welcome`, `Home.description`, `Home.cta`, `Member.noAccessTitle`, `Member.noAccessDescription`).
- **Test regression fallout**: two existing e2e specs reference UI this story removes (`e2e/button-cursor.spec.ts`'s two `E2E_WITH_AUTH`-gated tests tied to the static "Ver escala" disabled CTA; `e2e/member-gating.spec.ts`'s manual-verification doc comment for AC1). Both need updates in this story, not left broken.

This touches two role-branches of a shared page with real cross-module data-fetching (3 tables, 2 existing lib helpers used as-is, i18n across 2 locale files, and fallout in 2 other test files) — see Complexity tag below.

### Step-by-step approach (test-first where practical)

1. **Local horizon constant, zero touch to `availability/page.tsx`**: In `app/[locale]/(app)/page.tsx` only, declare a local `const SUNDAY_HORIZON = 12` (matching the value `availability/page.tsx` already uses internally) and call the existing exported `getUpcomingSundays(SUNDAY_HORIZON)`. Do **not** add any export to `lib/availability/upcoming-sundays.ts` and do **not** modify `availability/page.tsx` — that file is explicitly out of scope per the story. Run the existing `e2e-integration/availability.spec.ts` suite unmodified to confirm zero behavior change (regression check, not new coverage — nothing in that file changes, this is just a sanity re-run).

2. **Write `e2e-integration/home.spec.ts` first** (real local Supabase + real browser, following the `availability.spec.ts` / `claim-no-records.spec.ts` fixture conventions — worker-isolated fixture names, `finally`/`afterEach` cleanup, `memberPage`/`adminPage`/`serviceClient` fixtures). See Test Plan section below for the exact cases. Confirm they fail against the current page (red) before implementing.

3. **Implement the Member branch** (`role === 'member'`) in `page.tsx`:
   - Keep the existing `showDeniedBanner` logic and `Member` namespace load unchanged (still needed for `accessDenied`).
   - Call `resolveSelfPersonId(serviceClient, user.id)` (STORY-26 helper) — construct `serviceClient` once via `createServiceClient()` at the top of the branch (mirrors `availability/page.tsx`).
   - If `resolveError`: `console.error('[HomePage] resolveSelfPersonId error:', resolveError)` and treat as if `personId === null` is NOT correct — instead fall through to a load-error state reusing `Availability.loadError` (do not silently render an empty/misleading summary). Use a distinct `data-testid="home-availability-load-error"` wrapping the reused string.
   - **AC2** — `personId === null`: render a no-linked-person block reusing `Availability.noLinkedPersonTitle` / `Availability.noLinkedPersonDescription` / `Availability.noLinkedPersonCta` (load `getTranslations('Availability')` only on this branch) with a `Link href="/claim"`, `data-testid="home-no-linked-person"`. Do **not** invent new duplicate copy — this directly satisfies AC2's "consistent with STORY-26 AC7 / STORY-29's /claim messaging" requirement.
   - **AC1** — `personId` present: 
     - `const sundays = getUpcomingSundays(SUNDAY_HORIZON)`.
     - `const { data, error } = await getBlockedDates(serviceClient, { personIds: [personId], dateFrom: sundays[0], dateTo: sundays.at(-1) })`; on error, `console.error` and fall back to `data ?? []` (same soft-fail convention `availability/page.tsx` already uses — do not add new defensive UI beyond that precedent).
     - `const blockedSet = new Set((data ?? []).map(r => r.blocked_date))`.
     - `const blockedCount = blockedSet.size`, `const availableCount = SUNDAY_HORIZON - blockedCount`.
     - `const nextBlocked = sundays.find(s => blockedSet.has(s)) ?? null` (sundays is ascending, so `.find` gives the earliest).
     - Load `getFormatter()` from `next-intl/server` (Server Component equivalent of `AvailabilityToggleList`'s `useFormatter`) and format `nextBlocked` with the **exact same options** already used in `components/AvailabilityToggleList.tsx`'s `formatSunday` (`weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'`, constructed via `new Date(Date.UTC(year, month - 1, day))` — never a bare `new Date(dateStr)`).
     - Load `const h = await getTranslations('Home')` (lazy, this branch only) and render: intro line, available-count line, blocked-count line, next-blocked line (or the neutral "fully available" line when `nextBlocked === null` — **apply the same AC4 neutral-framing principle here**, even though AC4 is nominally about the Admin metric: zero blocks for a Member is good news, not an incomplete state), and a `Link href="/availability"` styled like `availability/page.tsx`'s existing `noLinkedPersonCta` link (`inline-flex min-h-[44px] items-center rounded-md border px-4 py-2 ...`). Wrap the whole block in `data-testid="member-availability-summary"`.

4. **Implement the Admin/fallback branch**:
   - Keep the existing `showDeniedBanner` block and the `getTranslations('Home')` lazy-load point (already lazy in current code — no change to that discipline).
   - Add independent read-only queries via `createServiceClient()` (sequential awaits with individual try/catch, matching the existing style in `admin/people/page.tsx` / `admin/roles/page.tsx` — do not introduce `Promise.all` unless it becomes a real perf problem; consistency with existing code style outweighs a marginal parallelism win here):
     - **Active people ids + count**: `const { data: activePeople, error: peopleError } = await serviceClient.from('people').select('id').eq('is_active', true)`. Active-people count is `activePeople?.length ?? null` — derived from this single query, not a separate `count`-only call, so the id list and the count can never disagree.
     - Active roles count: `serviceClient.from('roles').select('*', { count: 'exact', head: true }).eq('is_active', true)`.
     - **AC4 metric** — *active* people with a block recorded in the next 30 calendar days: compute `dateFrom`/`dateTo` via pure UTC math (`const now = new Date(); const dateFrom = now.toISOString().slice(0, 10); const dateTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30)).toISOString().slice(0, 10)`), then call `getBlockedDates(serviceClient, { personIds: (activePeople ?? []).map(p => p.id), dateFrom, dateTo })` — the `personIds` filter is mandatory here: without it, blocks belonging to soft-deleted (`is_active = false`) people would inflate the count, since soft-deleting a person never deletes their `blocked_dates` rows (CLAUDE.md's documented "soft-delete does NOT cascade" gap, STORY-19). If `activePeople` is empty/null (peopleError case), skip the blocked-dates query entirely and render `null` for this stat too — an empty `personIds` array would otherwise return zero misleadingly rather than "unknown." Compute `new Set((data ?? []).map(r => r.person_id)).size`.
     - Each query logs `console.error` on its own `error` field per the destructuring convention; on error, fall back to `null`/`0` and render nothing for that specific stat rather than crash the page (document this in a code comment; a single failed count query must not take down the whole home page for an Admin).
   - Load `const nav = await getTranslations('Nav')` and render three quick links reusing `nav('people')` / `nav('roles')` / `nav('userManagement')` as labels with hrefs `/admin/people`, `/admin/roles`, `/admin/users` (same as `AppNav.tsx` — **do not invent new label strings**), each as `<Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm"><Link href="...">...</Link></Button>` inside a `flex flex-wrap sm:flex-nowrap gap-2 min-w-0` container (STORY-23/BUGFIX-02 overflow convention, including the `sm:flex-nowrap` gate per CLAUDE.md's "Breakpoint-gated flex-wrap" refinement so the row doesn't wrap unconditionally at desktop widths). Wrap the whole quick-links list in `data-testid="admin-quick-links"`.
   - Render the counts under `data-testid="admin-team-summary"` (active people/roles) and a separate `data-testid="admin-blocks-next-30-days"` for the AC4 metric, using the `Home.adminActivePeopleCount` / `Home.adminActiveRolesCount` / `Home.adminBlocksNext30Days` ICU-plural keys (see i18n section) so the count itself drives correct pt-PT singular/plural grammar (CLAUDE.md ICU precedent, STORY-19).
   - Remove the old static `welcome` / `description` / disabled `cta` Button entirely (superseding CHORE-16's context fix, per the story's supersede note).

5. **i18n**: add all new `Home.*` keys to both `messages/pt-PT.json` and `messages/en.json` (AO90 spelling for pt-PT; see exact key list below), and delete the now-orphaned `Home.welcome` / `Home.description` / `Home.cta` / `Member.noAccessTitle` / `Member.noAccessDescription` keys from both files (CLAUDE.md i18n key hygiene — no dead keys). Run `e2e/i18n-key-parity.spec.ts` to confirm parity holds.

6. **Fix fallout in existing specs**:
   - `e2e/button-cursor.spec.ts`: remove the two `E2E_WITH_AUTH`-gated tests keyed to the now-removed static disabled "Ver escala" button (`'AC1: home page CTA button shows cursor: pointer'` and `'AC2: disabled button has pointer-events: none'`). Also update the file's top-level AC-coverage doc-comment block (lines 1-19), which explicitly lists "AC1 (home CTA)" and "AC2 (disabled button)" as covered — leaving that header unchanged after the tests are deleted would drift silently (the exact doc-comment-drift failure mode CLAUDE.md flags for STORY-17 nav-link counts). Add a short comment explaining the removal (superseded by STORY-30) and, to avoid silently losing CHORE-10's AC2 regression coverage for the `disabled:pointer-events-none` Tailwind class, add a CI-safe static-source check (BUGFIX-02 pattern: read `components/ui/button.tsx` via `fs.readFileSync` and regex-assert `disabled:pointer-events-none` is present in `buttonVariants`) so the underlying behavior still has *some* automated guard even without a live reachable disabled button.
   - `e2e/member-gating.spec.ts`: update the AC1 manual-verification doc comment (currently describing the old "Bem-vindo ao Escala!" / no-access copy) to describe the new expected content (availability summary or no-linked-person guidance, depending on link state).
   - Mark `docs/stories/STORY-28-...md` and `docs/stories/CHORE-16-...md` — **already done**, no action needed (confirmed their `Status` lines already say superseded).

7. Run full DoD gates: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` (CI-safe suite), then the real-Supabase `e2e-integration` suite locally (Node version + LD_LIBRARY_PATH workarounds per CLAUDE.md Playwright notes) to exercise `home.spec.ts` and the regression run of `availability.spec.ts`.

### AC4 admin metric — exact choice and justification

Per the story's Technical notes, a naive "N people haven't set their availability" metric is explicitly ruled out because `blocked_dates` absence means "fully available," not "hasn't engaged." Chosen metrics, in order of what's rendered:

1. **Active people count** (`Home.adminActivePeopleCount`) and **active roles count** (`Home.adminActiveRolesCount`) — simple team-composition counts with no per-person availability judgment at all (AC3's baseline requirement, zero risk of misrepresenting the data model).
2. **People with a block recorded in the next 30 days** (`Home.adminBlocksNext30Days`) — the story's own suggested example. This is phrased as a neutral factual count ("N pessoas com bloqueios registados nos próximos 30 dias" / "N people with blocks recorded in the next 30 days"), not a count of people *without* availability set, and not phrased as "N people are unavailable" (which would incorrectly suggest a fixed future state rather than "at least one Sunday blocked somewhere in the window"). A value of 0 reads as "nobody has recorded a block in this window," which is unambiguously good news, not an incomplete/warning state — satisfying AC4 for both the zero and nonzero cases.
3. Explicitly **not** rendering: any phrasing implying blocks are required, any "coverage %" or "readiness" framing, any warning icon/color (no `destructive`/`warning` token used for this metric — plain neutral text, same visual weight as the people/roles counts).

### New i18n keys

All new keys live under `Home.*`. Both files must add the same key set (AO90 spelling for pt-PT); `{count}` keys use ICU plural (`one`/`other`) per the STORY-19 precedent.

`messages/pt-PT.json` — add:
```
"Home": {
  "memberSummaryTitle": "Resumo da disponibilidade",
  "memberSummaryIntro": "Nos próximos {total} domingos:",
  "memberSummaryAvailableCount": "{count, plural, one {# domingo disponível} other {# domingos disponíveis}}",
  "memberSummaryBlockedCount": "{count, plural, one {# domingo bloqueado} other {# domingos bloqueados}}",
  "memberSummaryNextBlocked": "Próximo domingo indisponível: {date}",
  "memberSummaryNoUpcomingBlocks": "Estás disponível em todos os próximos {total} domingos.",
  "memberSummaryLink": "Gerir disponibilidade",
  "adminSummaryTitle": "Resumo da equipa",
  "adminActivePeopleCount": "{count, plural, one {# pessoa ativa} other {# pessoas ativas}}",
  "adminActiveRolesCount": "{count, plural, one {# função ativa} other {# funções ativas}}",
  "adminBlocksNext30Days": "{count, plural, one {# pessoa com bloqueios registados nos próximos 30 dias} other {# pessoas com bloqueios registados nos próximos 30 dias}}",
  "quickLinksTitle": "Acesso rápido"
}
```
Remove from `Home`: `welcome`, `description`, `cta`. Remove from `Member`: `noAccessTitle`, `noAccessDescription`.

`messages/en.json` — add the mirrored English set:
```
"Home": {
  "memberSummaryTitle": "Availability summary",
  "memberSummaryIntro": "In the next {total} Sundays:",
  "memberSummaryAvailableCount": "{count, plural, one {# available Sunday} other {# available Sundays}}",
  "memberSummaryBlockedCount": "{count, plural, one {# blocked Sunday} other {# blocked Sundays}}",
  "memberSummaryNextBlocked": "Next blocked Sunday: {date}",
  "memberSummaryNoUpcomingBlocks": "You're available for all of the next {total} Sundays.",
  "memberSummaryLink": "Manage availability",
  "adminSummaryTitle": "Team summary",
  "adminActivePeopleCount": "{count, plural, one {# active person} other {# active people}}",
  "adminActiveRolesCount": "{count, plural, one {# active role} other {# active roles}}",
  "adminBlocksNext30Days": "{count, plural, one {# person with blocks recorded in the next 30 days} other {# people with blocks recorded in the next 30 days}}",
  "quickLinksTitle": "Quick links"
}
```
Remove the same orphaned keys mirrored in English.

Note: `date` in `memberSummaryNextBlocked` is a pre-formatted string (built server-side via `getFormatter().dateTime(...)`), passed as a plain interpolated value — not a `{date, date, ...}` ICU date-skeleton, consistent with how `AvailabilityToggleList` formats dates outside of ICU (it calls `format.dateTime` directly and interpolates the resulting string into a plain `{name}`-style key, e.g. `Availability.adminTitle`).

### Mobile / tap-target / overflow considerations (AC5)

- Both branches keep the existing `<main className="flex-1 container mx-auto px-4 py-8">` wrapper — no new overflow-prone containers introduced.
- Member summary: plain stacked text (`<p>`/`<ul><li>`), no flex row that could squeeze at 375px; the only interactive element is the single `Link` styled identically to the existing `noLinkedPersonCta` link (`min-h-[44px]`, already verified at 375px in `availability.spec.ts`'s own AC6/AC7 tests via the same class).
- Admin quick links: 3 `Button`/`Link` pairs in a `flex flex-wrap sm:flex-nowrap gap-2 min-w-0` row (STORY-23/BUGFIX-02 pattern, with the `sm:flex-nowrap` gate) so they wrap to multiple rows at 375px rather than overflow, while not wrapping unconditionally at desktop widths; each already carries `min-h-[44px]` via the shared `Button` classes (same class string `AppNav.tsx` uses).
- No `justify-between` layout is used anywhere in this story's new markup, so the STORY-26 "insufficient gap" failure mode doesn't apply — but still verify visually (or via the `gap` measurement pattern from `availability.spec.ts`'s AC6 test) if a future edit adds a label/value flex row.
- Verify via `document.documentElement.scrollWidth <= 375` (project-standard `scrollWidth` check) for both the Member (linked, with at least one block, so the longest pt-PT next-blocked-date string is on screen) and Admin views.

### Test plan (mapped to ACs)

New file: `e2e-integration/home.spec.ts` (real local Supabase + real browser, `memberPage`/`adminPage`/`serviceClient` fixtures, worker-isolated fixture names, `afterEach`/`finally` cleanup — mirrors `availability.spec.ts` and `claim-no-records.spec.ts` conventions).

- **AC1** (Member, linked person, summary + link):
  - Create a fixture person linked to `MEMBER_ID` with zero blocks; navigate as `memberPage`; assert `member-availability-summary` shows `12` available / `0` blocked and the "fully available" (`memberSummaryNoUpcomingBlocks`) line, not a blocked-date line; assert a `Link` to `/availability` is present and visible.
  - Second case: seed 2 blocked dates within the 12-Sunday horizon for the same fixture person (via `POST /api/availability/blocks` as `memberRequest`, mirroring `availability.spec.ts`'s AC3 pre-seeding technique); navigate; assert `10` available / `2` blocked and that the next-blocked line shows the **earliest** of the two dates, pt-PT-formatted via the same `Intl.DateTimeFormat('pt-PT', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC'})` independent-check technique `availability.spec.ts`'s AC1 test uses.
- **AC2** (Member, no linked person): use the `memberPage` fixture **directly, with no fixture setup** — `MEMBER_ID` has no linked person by default (per the existing `availability.spec.ts` "FIXTURE COLLISION WARNING" comment, confirmed by that suite's own beforeEach/afterEach create-then-delete pattern). **Do not** substitute `adminPage` here the way `availability.spec.ts`'s AC7 test does — that substitution is only valid there because `AvailabilityPage` has no role branching, whereas the home page branches on role, so an Admin fixture would render the admin branch instead of the Member branch being tested. Assert `home-no-linked-person` renders with the reused `Availability.noLinkedPersonTitle`/`Description`/`Cta` strings and a link to `/claim`; assert `member-availability-summary` is absent (negative regression check). Place this test in its own `describe` block, matching the file's other describe blocks that assume "no linked person" as the default `MEMBER_ID` state, to avoid ordering interference from AC1's beforeEach/afterEach fixture lifecycle.
- **AC3** (Admin, team counts + quick links): as `adminPage`, snapshot baseline active-people/active-roles counts via `serviceClient` count queries, create one fixture active person (and, if convenient, one fixture active role) via `serviceClient`, navigate, assert `admin-team-summary` reflects baseline+1 for each (delta-based assertion — do not hardcode an absolute count against a shared/seeded DB), then assert `admin-quick-links` contains three links with `href`s `/admin/people`, `/admin/roles`, `/admin/users` and visible text matching `Nav.people`/`Nav.roles`/`Nav.userManagement` from `messages/pt-PT.json`. Clean up fixtures in `finally`.
- **AC4** (neutral admin metric):
  - e2e-integration (wiring correctness): create a fixture person with zero blocks, navigate, note baseline `admin-blocks-next-30-days` count; add one blocked date within the next 30 days for that person (via `serviceClient` insert or `POST /api/availability/blocks`), navigate again, assert the count increased by exactly 1; remove the block, assert it returns to baseline. This proves the metric reflects real DB state without needing to force a global zero baseline.
  - **Active-people scoping regression test** (added in revision cycle 1): create a fixture person, add a blocked date for them within the next 30 days, note the count increased by 1, then soft-delete the person (`is_active = false`) via `serviceClient`; navigate again and assert the count drops back by 1 — proving the metric excludes soft-deleted people's stale blocks rather than over-counting them.
  - CI-safe static string check (new `e2e/i18n-neutral-copy.spec.ts` or an addition to `i18n-key-parity.spec.ts`): read `messages/pt-PT.json`/`messages/en.json` directly and assert `Home.adminBlocksNext30Days` (and the Member `memberSummaryNoUpcomingBlocks`/`*BlockedCount` strings) do **not** contain forbidden warning-toned substrings (e.g. `aviso`, `atenção`, `pendente`, `falta`, `warning`, `pending`, `missing`) — a deterministic guard against future copy edits accidentally reintroducing the AC4 misrepresentation, independent of any live count value.
- **AC5** (375px, no overflow, ≥44px targets): in `home.spec.ts`, at `setViewportSize({width: 375, height: 812})`, for both a linked Member (with the longest-case next-blocked-date string rendered) and an Admin view: assert `document.documentElement.scrollWidth <= 375` and that every visible interactive element (`availability` link, all 3 admin quick-links) has `boundingBox().height >= 44` (guarded by `toBeVisible()` first, per project convention).
- **AC6** (i18n key parity, AO90): covered by the existing global `e2e/i18n-key-parity.spec.ts` once the new keys are added to both locale files — no new test needed, just correct key additions. Manually re-read both new key sets for AO90 spelling before landing (no "activa"/"acto"/"facto" forms).
- **Regression coverage**: re-run `e2e-integration/availability.spec.ts` unmodified (confirms the `SUNDAY_HORIZON` hoist didn't change behavior) and `e2e/member-gating.spec.ts` / `e2e/button-cursor.spec.ts` after their required updates (Step 6 above).

### Risks and rollback

- **AC4 misrepresentation risk** (highest risk in this story): mitigated by the explicit metric choice and justification above, plus the static forbidden-substring copy guard. If Challenge/Review still finds the phrasing ambiguous, prefer dropping the 30-day metric entirely (AC4 explicitly allows "omit a per-person signal entirely in favor of simple team counts") over reworking the wording repeatedly.
- **Orphaned-key removal risk**: removing `Home.welcome`/`description`/`cta` and `Member.noAccessTitle`/`noAccessDescription` breaks `e2e/button-cursor.spec.ts` unless Step 6 is done in the same PR — called out explicitly so it isn't discovered late in Review.
- **Shared serviceClient query failures**: each of the 3 admin count/aggregate queries is independent; a failure in one (e.g. `blocked_dates` query erroring) must not prevent the other two stats or the quick links from rendering — render `null`/omit only the failed stat, log via `console.error`, per the per-query try/catch approach in Step 4.
- **Rollback**: this is a pure Server Component + i18n content change with no schema/migration and no auth-guard change; reverting the PR fully restores prior behavior with no data cleanup required.

### Complexity tag: **standard**

Multi-file (`page.tsx` two branches, two locale files, two existing test files needing fallout fixes, one new integration test file), requires understanding of at least three modules (availability helpers, admin people/roles query conventions, i18n plural conventions), and the story's own Technical notes flag AC4 as "the single most important design decision" with real risk of a subtly wrong data-model representation if rushed. Not `complex`: no auth-guard changes, no schema/migration, no concurrency/money concerns, and every underlying helper (`getUpcomingSundays`, `getBlockedDates`, `resolveSelfPersonId`) already exists and is reused as-is with zero modification.

### Revision cycle 1 (post-Challenge)

Applied in response to the Challenge stage's `NEEDS REVISION` verdict:

- **CRITICAL — scope firewall**: dropped the plan to export `SUNDAY_HORIZON` from `lib/availability/upcoming-sundays.ts` and import it into `availability/page.tsx`. That file is explicitly out of scope. The home page now uses its own local `SUNDAY_HORIZON = 12` constant and calls the already-exported `getUpcomingSundays()` as-is — zero edits to `availability/page.tsx`.
- **CRITICAL — AC4 data integrity**: the "blocks in next 30 days" admin metric now derives its `personIds` filter from the active-people query result (`people.select('id').eq('is_active', true)`), instead of querying `blocked_dates` unfiltered. This prevents a soft-deleted person's stale blocked-date rows from inflating the count (same "soft-delete doesn't cascade" gap CLAUDE.md documents for STORY-19). The active-people *count* is also now derived from this same id-list query rather than a separate `count`-only call, so the two numbers can never disagree. Added a corresponding regression test (soft-delete a person with a recent block, assert the count drops back).
- **WARNING — test doc-comment drift**: Step 6 now explicitly calls out updating `e2e/button-cursor.spec.ts`'s top-level AC-coverage doc-comment block (lines 1-19), not just adding inline comments near the deleted tests.
- **WARNING — flex-wrap convention**: the admin quick-links container now uses `flex flex-wrap sm:flex-nowrap gap-2 min-w-0`, adding the `sm:flex-nowrap` gate per CLAUDE.md's BUGFIX-02 "Breakpoint-gated flex-wrap" convention (both in the implementation step and the mobile-considerations section).

No other steps changed. Re-submitting for Challenge.
