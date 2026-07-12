# STORY-29: Give unlinked Members clear guidance when there's nothing to claim
Epic: EPIC-02

## User story
As a Member with no linked person record, I want to be told clearly what to
do when there's nothing for me to claim, so that I'm not silently bounced
back to the home page with no explanation of why I can't set my
availability.

## Context
STORY-11 built the self-claim flow: on first login, if unclaimed person
records exist, the user sees `/claim` and can pick themselves from the list
or skip. If **no** unclaimed person records exist at first-login time,
STORY-11's AC4 intentionally sends the user straight home with "no friction"
— a reasonable choice for the *first-login callback redirect decision*, since
most such users simply don't need the claim flow at all.

STORY-26 (EPIC-03) has since added a **second, later** entry point into
`/claim`: the Availability page's "no linked person" branch (AC7) links to
`/claim` for any Member who still isn't linked, whenever they visit
Availability — not just at first login. But `/claim`'s own page-level guard
(`app/[locale]/claim/page.tsx`) redirects home **silently, with no message**
whenever there are zero unlinked+active person records — the exact same
"nothing to claim" condition, but reached from a completely different
context where the user just clicked a link that promised "a path to the
claim flow" (STORY-26 AC7's wording).

The result, confirmed during triage: a Member who was never added to the
team list (`public.people`) yet, or whose only matching person record has
already been claimed by someone else, hits a confusing loop — Availability
page says "click here to claim your record" → `/claim` bounces them straight
back home with zero explanation → home page (STORY-28) says to check
Disponibilidade → back to Availability's same message. There is no point in
this loop where the Member is told the actual fix: **ask an Admin to add you
to the team list (Equipa), or link your account if a record already exists
for you** (Admin-side capability already shipped in STORY-07 and STORY-20).

This is a messaging/UX gap, not a permissions bug — the underlying
capability to resolve it already exists.

## Acceptance criteria
1. Given a logged-in Member with no linked person, when they navigate to
   `/claim` and unclaimed+active person records **do** exist, then the
   existing STORY-11 list/select/confirm/skip flow renders unchanged
   (regression check — this story does not touch the happy path).
2. Given a logged-in Member with no linked person, when they navigate to
   `/claim` and **no** unclaimed+active person records exist, then — instead
   of a silent redirect to home — they see an explanatory message stating
   there is nothing to claim yet and instructing them to contact an Admin to
   be added to the team.
3. Given a logged-in Member who **already has** a linked person record, when
   they navigate to `/claim`, then they are still redirected home unchanged
   (STORY-11 AC5 preserved — this story only changes the "nothing to claim"
   branch, not the "already linked" branch).
4. Given the auth callback's first-login redirect decision (STORY-11 AC4:
   skip `/claim` entirely when nothing exists to claim), when a brand-new
   user logs in with nothing to claim, then that behavior is **unchanged** —
   this story only changes what `/claim` renders on **direct/later
   navigation** to the page, not the callback's redirect target.
5. Given the new "nothing to claim" message, when it renders, then strings
   come from `messages/pt-PT.json` / `messages/en.json` (key parity, AO90
   spelling) and the message is announced accessibly (reuse this codebase's
   `aria-live="polite"` convention, not `role="alert"`).

## Out of scope
- Any change to STORY-11's auth-callback redirect logic (AC4/AC5 of
  STORY-11 stay exactly as they are).
- A self-service "request to be added" feature (e.g. notifying an Admin
  automatically) — out of scope for this story; the fix here is clear
  messaging only, not a new notification mechanism.
- Any change to `app/[locale]/(app)/availability/page.tsx`'s own copy
  (STORY-26 AC7) beyond what's needed to stay consistent with this story's
  new `/claim` messaging — no new logic there.
- STORY-28 (the Member home-page "no access yet" copy) — separate, unrelated
  fix, tracked independently.

## Technical notes
- File: `app/[locale]/claim/page.tsx` — the branch at the end
  (`if (people.length === 0) redirect(...)`) changes from an unconditional
  redirect to rendering an explanatory state instead, reusing the existing
  layout shell (`app/[locale]/claim/layout.tsx`).
- The "already linked" branch (`if (existingLink) redirect(...)`) is
  untouched — only the "nothing to claim" branch changes.
- New i18n keys under the existing `Claim` namespace (both locale files),
  e.g. `noRecordsTitle` / `noRecordsDescription` — check for and remove any
  keys this story makes truly unreachable (i18n key hygiene).
- Consider whether a link back home (or to `/`) is still useful from this
  new state, even though there's no functional dead-end anymore (the Member
  can navigate via the header nav regardless).
- Tests: this is the same auth-callback-adjacent testing constraint STORY-11
  documented (placeholder Supabase creds in CI cannot reach a real OAuth
  session) — the callback-unchanged assertion (AC4) may need to stay a
  documented manual-verification step per CLAUDE.md's DoD #5, while the
  page-level "nothing to claim" rendering (AC2/AC3/AC5) should be reachable
  via the existing `E2E_WITH_AUTH`-gated pattern already used in
  `e2e/claim.spec.ts`, or the newer real-browser-fixture pattern STORY-26
  introduced in `e2e-integration/` if that proves simpler to seed (a fixture
  member with zero unlinked people in the pool).

## Definition of Done
See CLAUDE.md.

## Implementation Plan

### Affected areas
- **frontend** (Server Component render branch, `app/[locale]/claim/page.tsx`)
- **ux / accessibility** (new explanatory state, `aria-live="polite"` region,
  link-back-home affordance for a layout with no nav)
- **data (i18n)** (`messages/pt-PT.json` + `messages/en.json`, `Claim`
  namespace — key parity + AO90 spelling)
- **test infra** (new CI-automated `e2e-integration/` coverage; one existing
  `e2e/claim.spec.ts` test's assertions are now stale and must be updated in
  this story, not left broken)

No backend/API/DB changes — `app/api/people/claim/route.ts` and the
`blocked_dates`/`people` schema are untouched. No auth-guard or middleware
changes.

### Design decisions (resolved from codebase conventions, not blocking)

1. **`/claim` has no header/nav to fall back on.** `app/[locale]/claim/layout.tsx`
   is deliberately outside the `(app)/` route group and renders no
   `AppHeader`/`AppNav` (see its own doc comment: "a one-time... interstitial,
   not a page users navigate to/from via nav"). The Technical notes' aside
   ("the Member can navigate via the header nav regardless") does not hold
   for this specific page — if the "nothing to claim" branch renders in place
   with zero exit affordance, it becomes a genuine dead end (browser Back is
   the only escape). **Decision: the new state must include an explicit link
   back to `/`**, mirroring `app/[locale]/(app)/availability/page.tsx`'s
   `noLinkedPersonCta` `Link` pattern (STORY-26). This resolves the "consider
   whether a link back home is still useful" open question in the Technical
   notes — yes, it is required here, not optional.
2. **New i18n keys** (both locale files, `Claim` namespace):
   - `noRecordsTitle` — pt-PT: "Ainda não há nada para associares" / en: "There's nothing to claim yet"
   - `noRecordsDescription` — pt-PT: "Ainda não existe um registo de equipa para ti. Fala com um administrador para te adicionar à equipa (Equipa) ou associar a tua conta a um registo existente." / en: "There isn't a team record for you yet. Ask an Admin to add you to the team (Equipa) or link your account to an existing record."
   - `noRecordsCta` — pt-PT: "Voltar ao início" / en: "Back to home"
   (Exact copy is a suggestion for the implementer to carry over verbatim or
   adjust minimally — the wording tone should match `Home.Member.noAccessTitle`/
   `noAccessDescription`'s "fala com um administrador" phrasing already
   established in STORY-06/STORY-28 for consistency across the app.)
   No existing `Claim` key becomes unreachable — the happy-path keys
   (`title`, `instructions`, `confirmButton`, `skipButton`, `errorAlreadyClaimed`,
   `errorAlreadyLinked`, `errorGeneric`, `confirming`) are all still used by
   the unchanged AC1 branch. **i18n hygiene: no key removal needed.**
3. **Single `getTranslations('Claim')` call.** Both the happy-path branch and
   the new "no records" branch use the same `Claim` namespace, so hoist the
   existing `const t = await getTranslations('Claim');` (currently declared
   after the `people.length === 0` check) to just above that check, and reuse
   it in both branches — no namespace-loading waste (CLAUDE.md's lazy-load
   rule is about avoiding *unused* namespaces on early-return paths; here
   both paths use the same one, so a single hoisted call is simpler and
   correct).
4. **Render server-side, no new Client Component.** The new state is fully
   static (no interactivity), so it renders directly in the Server Component,
   mirroring `AvailabilityPage`'s `noLinkedPerson` branch (STORY-26 Design
   decision 7 precedent: "no client interactivity needed... mirroring
   app/[locale]/claim/page.tsx's all-server-side branch handling" — this
   story keeps that mirroring true in both directions).
5. **`aria-live="polite"` on the new region**, per AC5's explicit instruction,
   with `data-testid="claim-no-records"` on the container (naming convention
   matches `claim-error`, `claim-person-list`) and a `data-testid` on the
   back-home `Link` (e.g. `claim-no-records-home-link`, matching
   `availability-back-link`'s naming precedent). Do not use `role="alert"`
   (route-announcer collision precedent, CLAUDE.md).

### Step-by-step approach (test-first where practical)

1. **Update `app/[locale]/claim/page.tsx`:**
   - Import `Link` from `@/i18n/navigation`.
   - Hoist `const t = await getTranslations('Claim');` to immediately above
     `if (people.length === 0)`.
   - Replace `redirect(...)` in that branch with a render of the new
     "no records" state (see Design decision 4/5 above), using the same
     `<main className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">`
     shell as the happy path, so the layout stays visually consistent.
   - Update the file's top doc comment (currently lines 12–21, "Belt-and-
     suspenders guards") — item 4 currently says "if there are no
     unlinked+active person records, redirect home — nothing to claim,"
     which is no longer accurate; update it to describe the new render
     branch and reference this story.
   - Leave the "already linked" branch (`existingLink` check, lines 32–51)
     and the unauthenticated/login redirect completely untouched.
2. **Add i18n keys** to both `messages/pt-PT.json` and `messages/en.json`
   under `Claim` (see Design decision 2). Run
   `npx playwright test e2e/i18n-key-parity.spec.ts` locally to confirm
   parity (this is also enforced by CI).
3. **Add new CI-automated coverage** in a new file,
   `e2e-integration/claim-no-records.spec.ts`, using the `adminPage` fixture
   (STORY-26 precedent: `ADMIN_ID` has no linked person by default — see
   `e2e-integration/availability.spec.ts`'s "AC7 no linked person" describe
   block for the exact same reuse rationale) plus the snapshot/deactivate/
   restore pattern for "zero unlinked+active people" already established in
   `e2e/claim.spec.ts`'s (soon-to-be-renamed) AC4 test:
   - **AC2/AC5 test**: snapshot all currently unlinked+active `people` rows,
     deactivate them for the test's duration, `try`/`finally`-restore them
     afterward. Navigate `adminPage` to `/pt-PT/claim`. Assert: URL stays
     at `/pt-PT/claim` (no redirect — use a right-anchored regex per
     STORY-16's `toHaveURL` guidance, e.g. `/\/pt-PT\/claim\/?$/`); the
     `claim-no-records` region is visible; it has `aria-live="polite"` and
     does **not** have `role="alert"`; the title/description text match the
     new i18n strings; the `claim-no-records-home-link` is visible and has
     `href="/pt-PT/"` (or the resolved locale-prefixed home href — verify
     exact resolved `href` value against `@/i18n/navigation`'s actual output
     the same way `e2e-integration/availability.spec.ts`'s AC7 test asserts
     `claimLink`'s `href`).
   - **AC1 regression test**: create one throwaway unlinked+active `people`
     fixture (worker-isolated name, cleaned up in `finally`), navigate
     `adminPage` to `/pt-PT/claim`, assert `claim-person-list` is visible
     and contains the fixture name, and `claim-no-records` is **not**
     rendered (`toHaveCount(0)`) — proves the happy-path branch still wins
     when unclaimed people exist, unaffected by this story's change.
   - **AC3 regression test**: create an unlinked fixture person, link it to
     `adminPage`'s account via `POST /api/people/claim` (mirrors
     `e2e/claim.spec.ts`'s existing AC5 pattern), then navigate to
     `/pt-PT/claim` directly and assert the URL redirects home
     (`/\/pt-PT\/?$/`) — proves the "already linked" branch is genuinely
     unchanged, not just untouched in source. Clean up the fixture person in
     `finally` (deleting it also un-links the account, consistent with the
     `e2e/claim.spec.ts` precedent).
4. **Fix the now-stale test in `e2e/claim.spec.ts`.** The existing test
   `'AC4: direct navigation to /claim redirects home when no unlinked people
   exist'` (lines ~430–466) asserts the *old* behavior (redirect to `/`) that
   this story deliberately removes — if left as-is it will fail for any
   developer running `E2E_WITH_AUTH=1` locally, which is a real regression
   per CLAUDE.md's DoD #7. Update it (do not delete) to assert the new
   behavior: URL stays on `/pt-PT/claim`, `claim-no-records` renders. Update
   its inline comment and the file's header doc-comment bullet (~lines 33–34,
   76–83) to match. Add a one-line cross-reference to STORY-29 in the updated
   comment so future readers understand why the assertion changed.
5. **Manual verification step for AC4** (auth-callback-unchanged): this
   stays a documented manual step, per the Technical notes' explicit
   allowance — reuse `e2e/claim.spec.ts`'s existing manual verification
   item 2 ("AC4 — first login with NO unlinked people -> straight to home"),
   which already fully covers this exact scenario end-to-end via a real
   Google OAuth login. No change needed to that manual step's *content*
   (STORY-11's callback logic is untouched), only confirm it's still
   accurate/re-run once before marking this story done. Note precisely
   *why* automation can't cover this: `e2e-integration/fixtures.ts`'s
   `memberPage`/`adminPage` sign in via `signInWithPassword` + captured
   cookies, which never invokes `app/auth/callback/route.ts` — so even
   the real-Supabase `e2e-integration/` suite cannot exercise the callback's
   redirect-target decision, only `E2E_WITH_AUTH` + real Google OAuth can.
6. Run `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run
   test:e2e`, and `npm run test:integration` (or the equivalent local
   `supabase start` + `npm run test:integration` flow) before marking done.

### Test plan (mapped to acceptance criteria)

| AC | Coverage |
|----|----------|
| AC1 (happy path unchanged) | New `e2e-integration/claim-no-records.spec.ts` regression test (automated, CI-safe) + existing `e2e/claim.spec.ts` `'AC7: claim page lists only unlinked, active people'` (E2E_WITH_AUTH-gated, unchanged, re-run once locally to confirm still green) |
| AC2 (no-records message renders) | New `e2e-integration/claim-no-records.spec.ts` test (automated, CI-safe, real local Supabase — no OAuth needed since it uses email/password sign-in) |
| AC3 (already-linked branch unchanged) | New `e2e-integration/claim-no-records.spec.ts` regression test (automated, CI-safe) + existing `e2e/claim.spec.ts` `'AC5: an already-linked user...'` (E2E_WITH_AUTH-gated, unchanged) |
| AC4 (auth-callback decision unchanged) | Documented manual verification step (existing item 2 in `e2e/claim.spec.ts`'s header comment) — cannot be automated even via `e2e-integration/` because that suite's auth fixtures bypass `app/auth/callback/route.ts` entirely |
| AC5 (i18n + a11y convention) | Same `e2e-integration/claim-no-records.spec.ts` AC2 test asserts `aria-live="polite"`, absence of `role="alert"`, and exact i18n string text; `e2e/i18n-key-parity.spec.ts` (existing, CI-enforced) covers key parity across both locale files automatically once the new keys are added to both files |

### Risks and rollback

- **Risk: stale test left asserting old behavior.** Directly addressed in
  step 4 above — this is the main correctness risk of this story (an
  otherwise-small change that silently breaks an existing E2E_WITH_AUTH-gated
  test if the branch swap isn't paired with a test update).
- **Risk: dead-end page with no nav.** Addressed by Design decision 1 (explicit
  back-home link). If this is somehow missed, a Member reaching this state
  would have no way to leave except browser Back — verify visually (per the
  project's "QA must visually render UI stories" convention) that the link
  renders and is reachable by keyboard.
- **Risk: `existingLink`/unauthenticated branches accidentally touched.** Low
  risk — the diff should be scoped to only the `people.length === 0` branch,
  the new import, and the hoisted `t` declaration. Code review should confirm
  the diff doesn't touch lines 26–51 of the original file.
- **Rollback:** trivial — this is a single Server Component branch plus two
  JSON files and two test files; revert the page.tsx branch back to
  `redirect(...)`, revert the i18n key additions (orphaned keys are inert,
  no schema/data impact), and revert the two test-file edits. No migration,
  no data backfill, no feature flag needed.

### Complexity tag: **standard**

Justification: single Server Component branch + i18n + accessibility
convention change with no new auth/DB/API logic (not `trivial` — it requires
understanding the auth-guard-adjacent page's existing branches well enough to
touch only one of three, reasoning about a layout-without-nav accessibility
gap that isn't explicit in the AC text, and updating a pre-existing test
whose assertions become incorrect as a side effect of the change). Not
`complex` — no auth/security/concurrency/money logic changes, and it touches
essentially one module (`app/[locale]/claim/page.tsx`) plus its immediate
test/i18n surface, not three-or-more interacting systems.
