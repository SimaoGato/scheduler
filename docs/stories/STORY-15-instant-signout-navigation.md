# STORY-15: Make sign-out feel instant (navigate before backend cleanup completes)
Epic: EPIC-01
Status: done ✅
PR: 24

## User story
As a signed-in user, I want clicking "Sign out" to take me to the login page
immediately, so that I don't wait on a backend round trip I can't see or
influence.

## Context
`app/[locale]/login/actions.ts` exports `signOut()`, a Server Action wired to
the form in `components/UserWidgetMenu.tsx` (`<form action={signOutAction}>`).
Today it `await`s `supabase.auth.signOut()` — a network call from the Next.js
server to Supabase Auth — and only calls `redirect()` once that resolves (or
throws). The browser's form submission blocks on the full server-action
round trip (client → Next.js server → Supabase Auth → back) before any
navigation begins, which is the delay the user is noticing.

This is a real, fixable UX gap, not a backend correctness problem — the
session is already invalidated correctly (see ADR-006, STORY-12). The fix is
about *when* the browser navigates relative to *when* cleanup finishes, not
about changing what cleanup does.

## Acceptance criteria
1. Given a signed-in user clicks "Sign out" in the header widget, when the
   click is registered, then the browser begins navigating to the login page
   without waiting for a full Supabase Auth network round trip to complete
   first (verify via a Playwright test that throttles/delays the network and
   asserts navigation starts before the delayed response resolves, or via a
   documented manual timing comparison if throttling is impractical in this
   test setup).
2. Given the sign-out flow has run, when the user lands on the login page and
   then attempts to access a protected route (e.g. `/admin/people`) by
   URL, then they are redirected back to login (server-side session is fully
   invalidated — no regression from the current guard behavior).
3. Given `supabase.auth.signOut()` fails or is slow on the server, when the
   user has already been navigated to login client-side, then no error is
   shown to the user (matches today's swallow-and-log behavior in
   `actions.ts`), and the failure is still logged server-side via
   `console.error`.
4. Given this story ships, when existing auth/nav e2e specs run (e.g. any spec
   asserting on the sign-out button or `signOutAction`), then they still pass
   without modification to their assertions (only timing changes, not the
   sign-out button's testid/label/contract).

## Out of scope
- Sign-in flow latency (Google OAuth redirect timing).
- General loading-state/skeleton patterns elsewhere in the app.
- Changing what server-side cleanup does (still calls `supabase.auth.signOut()`).

## Technical notes
- Likely requires converting the sign-out control from a plain `<form
  action={signOutAction}>` (Server Action) to a `'use client'` handler that:
  (a) calls the *browser* Supabase client's `signOut()` (clears local
  session/cookies immediately, no server round trip needed for this part),
  then (b) navigates via `router.push`/`redirect` to login right away, while
  (c) the existing server-side `signOut()` action still runs (e.g. fired
  alongside, or the browser-side signOut is sufficient and the server action
  becomes redundant — needs investigation into whether Supabase SSR cookie
  invalidation still happens correctly if only the browser client's signOut
  is called).
- Affected files: `app/[locale]/login/actions.ts`, `components/UserWidgetMenu.tsx`,
  `components/UserWidget.tsx`, `lib/supabase/client.ts`.
- Needs an auth-gated e2e test per the established pattern:
  `test.skip(!process.env.E2E_WITH_AUTH, 'reason')`.
- Complexity: likely `standard` — touches the auth session lifecycle
  (server + client Supabase clients), not just UI.

## Definition of Done
See CLAUDE.md.

## Implementation Plan

**Revision note (cycle 2 of 2):** this section replaces the cycle-1 plan,
which Challenge returned as NEEDS REVISION. The cycle-1 design
(`Promise.race([supabase.auth.signOut(), timeout(300)])` before
`router.push('/login')`) was found to **not** close the race it was meant to
close: `GoTrueClient._signOut()` never clears the session cookie until
*after* the network revoke call resolves, so whenever that call is slower
than 300 ms (exactly the condition the cycle-1 AC1 test manufactured with a
3000 ms artificial delay), the timeout branch wins, navigation fires while
the session cookie is still valid, and `proxy.ts`'s reverse-guard bounces
`/login` back to `/`. This revision closes the race structurally instead of
narrowing its window: `proxy.ts` is now part of the design.

### Investigation findings

Re-read `app/[locale]/login/actions.ts`, `components/UserWidgetMenu.tsx`,
`components/UserWidget.tsx`, `lib/supabase/client.ts`, `lib/supabase/server.ts`,
`proxy.ts`, `app/auth/callback/route.ts`, and the installed
`@supabase/auth-js` source, specifically to find a design where AC1
("instant, regardless of network speed") and AC2 ("protected routes are
genuinely inaccessible after sign-out, no regression") both hold
**deterministically**, not just in the common/healthy-network case.

1. **No client-side timing trick can make the real cookie clear
   synchronously.** Confirmed again: `_removeSession()` only runs after the
   network revoke call resolves, and there is no in-memory session shortcut
   (`__loadSession()` always re-reads the storage adapter). Any design that
   makes `proxy.ts`'s guards depend on the *real* Supabase cookie being
   cleared in time is racing the network by construction and will fail under
   throttled conditions — which is precisely what the challenger flagged.
   The fix must not depend on how fast the real revoke call is.

2. **`proxy.ts`'s two guards both key off a single `user` value** (lines
   18/41–46 in the current file), computed once per request from
   `supabase.auth.getUser()`, then checked twice:
   - forward guard: `if (!user && !isLoginPath)` → redirect to `/login`
   - reverse guard: `if (user && isLoginPath)` → redirect to `/`

   Both guards are driven by the *same* `user` variable. This means a single
   change — forcing `user = null` for the duration of a short client-set
   marker, before either guard runs — makes **both** guards behave exactly
   as if sign-out had already fully completed server-side, regardless of
   whether the real Supabase revoke call has actually resolved yet:
   - on `/login`, `user` is null → reverse guard does not fire → login
     renders (fixes AC1/the bounce-back bug).
   - on any protected route, `user` is null → forward guard fires → redirect
     to `/login` (satisfies AC2, deterministically, not just when the real
     network call happens to be fast).

   This is chosen over "only skip the reverse-guard bounce" (the
   challenger's option 1 as literally stated) because skipping only the
   reverse guard would leave AC2 racing the network exactly as before: right
   after landing on `/login`, a request to a protected route would still see
   the real (still-valid) session cookie and would **not** redirect until the
   real revoke completed. Forcing `user = null` for both guards closes both
   gaps with one mechanism and is no more complex to implement.

3. **The marker only ever moves state in the stricter (logged-out)
   direction.** It cannot be used to gain access to anything — at worst, a
   forged or stale marker makes the guard *incorrectly treat a valid session
   as logged out* for a bounded time, which is a UX annoyance (has to
   reload/re-click), never a privilege escalation. This removes the need for
   any "acceptable small residual security risk" framing.

4. **Consequence: the client no longer needs to wait/race on anything before
   navigating.** Since the marker — not the real cookie state — is what
   `proxy.ts` consults immediately after sign-out, `router.push('/login')`
   can fire with **zero artificial wait**, immediately after setting the
   marker cookie (a synchronous `document.cookie` write, no network
   involved). The real `supabase.auth.signOut()` call still happens, but
   purely as background cleanup — its timing no longer gates navigation or
   correctness of the two guards. This is simpler than the cycle-1 design:
   no `Promise.race`, no tunable timeout constant to justify.

5. **The browser-side Supabase client call is no longer needed.** Cycle 1
   proposed adding a *second* signOut invocation via the browser client
   (`lib/supabase/client.ts`) alongside the existing server action, racing
   the former. Since nothing needs to be raced anymore, the existing
   server-side `signOutAction()` (already does the real revoke + clears the
   Supabase SSR cookies via `Set-Cookie`, already has the AC3 try/catch +
   `console.error`) is sufficient as the sole real-invalidation path, fired
   `void`-style (not awaited) from the click handler. Calling a Server
   Action reference without awaiting it still dispatches the underlying
   fetch to the Next.js server immediately; a same-page client-side
   `router.push` does not abort in-flight fetches (only a full page
   unload would), so the server-side signOut still runs to completion in
   the background. This means **`lib/supabase/client.ts` needs no change**
   and no new browser Supabase client call is introduced — smaller diff,
   one real-invalidation code path instead of two, nothing new to keep in
   sync.

6. **The marker must be cleared on successful (re-)login, not just left to
   expire.** If a user signs out and signs back in within the marker's
   lifetime, `proxy.ts` would otherwise keep treating their brand-new,
   valid session as logged-out until the marker expires — a real (if
   narrow) regression. `app/auth/callback/route.ts` is the single place all
   successful logins pass through (per ADR-004/STORY-03's "provisioning in
   callback route" convention), so it is the correct place to clear the
   marker on every response it returns.

7. **`redirect()` must still be removed from the server action**, for the
   same reason as cycle 1: once navigation is client-driven, leaving
   `redirect()` in `signOut()` risks a second, redundant navigation once the
   slow server-side round trip eventually resolves. The action's try/catch +
   `console.error` logging (AC3) is otherwise untouched.

### Design summary

- Client `onClick` handler (replacing `<form action={signOutAction}>`):
  1. Synchronously set a short-lived marker cookie,
     `app-signout-pending=1` (`path=/`, `max-age=15`, `SameSite=Lax`) via
     `document.cookie`. No network call, no `await` — this is what makes
     step 2 safe to do with zero wait.
  2. Immediately `router.push('/login')` (from `@/i18n/navigation`, the
     locale-aware router already used elsewhere in the app, e.g.
     `components/AppNav.tsx`'s `Link`).
  3. Fire `void signOutAction().catch(err => console.error(...))` —
     background, not awaited, not raced. This is the sole real-invalidation
     path (see finding 5).
- `proxy.ts`: read the marker cookie once per request; if present, skip the
  `getUser()` lookup entirely and treat `user` as `null` for that request,
  before either guard runs. No change to the guards' own logic.
- `app/auth/callback/route.ts`: clear the marker cookie (`max-age=0`) on
  every response it returns, so a fresh login is never shadowed by a stale
  marker from a previous sign-out.
- 15 s bounds the window in which a genuinely failed/hung real signOut()
  (e.g. total network outage — the scenario AC3 already describes as
  "fails or is slow") could leave the *real* session cookie valid again
  after the marker expires. This is a bounded edge case tied to actual
  signOut() failure, not to ordinary network slowness — the exact
  distinction the challenger asked to preserve. It is documented as a known
  residual risk below, not silently shipped.

### Files to change

- `app/[locale]/login/actions.ts` — remove the trailing `redirect()` call
  from `signOut()`. Keep the try/catch, `supabase.auth.signOut()` call, and
  `console.error` logging exactly as-is. Signature unchanged
  (`() => Promise<void>`), so `UserWidget.tsx` needs no change.
- `components/UserWidgetMenu.tsx` — replace `<form action={signOutAction}>`
  wrapping `<button type="submit">` with
  `<button type="button" onClick={handleSignOut} data-testid="sign-out-button">`
  (unchanged `data-testid`, label, styling — AC4). Add:
  ```ts
  const router = useRouter(); // from '@/i18n/navigation'

  function handleSignOut() {
    // Force proxy.ts to treat this browser as signed-out immediately, so the
    // reverse-guard doesn't bounce /login back to / while the real
    // supabase.auth.signOut() network call (fired below, not awaited) is
    // still in flight. See proxy.ts for the corresponding check, and
    // app/auth/callback/route.ts for where this marker gets cleared again on
    // the next successful login. Bounded to 15s so a hung/failed real
    // signOut() (AC3) can't leave the guard force-logged-out indefinitely.
    document.cookie = 'app-signout-pending=1; path=/; max-age=15; SameSite=Lax';
    router.push('/login');
    void signOutAction().catch((err) => {
      console.error('[UserWidgetMenu] signOutAction invocation error:', err);
    });
  }
  ```
  (`signOutAction` itself never rejects today — its own try/catch swallows
  errors — so this `.catch` is a defensive no-op for network-level fetch
  failures only, same as cycle 1's reasoning.)
- `proxy.ts` — **now changed** (cycle 1 incorrectly left this file alone).
  Add a marker check before the two guards:
  ```ts
  const SIGNOUT_MARKER_COOKIE = 'app-signout-pending';
  const signingOut = request.cookies.get(SIGNOUT_MARKER_COOKIE)?.value === '1';

  let supabaseResponse = NextResponse.next({ request });
  let user = null;

  if (!signingOut) {
    try {
      // ...existing createServerClient + getUser() block, unchanged...
    } catch {
      user = null;
    }
  }
  // else: marker present — skip the Supabase lookup and treat this request
  // as unauthenticated. This only ever forces the *stricter* branch of each
  // guard below (forward guard redirects protected routes to /login; reverse
  // guard does not fire on /login), so it cannot grant access — only cause
  // an already-logged-out treatment slightly early. See STORY-15.
  ```
  The two existing guard blocks are otherwise untouched.
- `app/auth/callback/route.ts` — clear the marker on every returned
  response. Add a small helper and route all four `NextResponse.redirect(...)`
  return points through it:
  ```ts
  function clearSignoutMarker(response: NextResponse): NextResponse {
    response.cookies.set('app-signout-pending', '', { path: '/', maxAge: 0 });
    return response;
  }
  ```
- `components/UserWidget.tsx` — no change (still passes
  `signOutAction={signOut}`).
- `lib/supabase/client.ts` — no change, and **not newly used** in this
  design (see finding 5) — narrower diff than cycle 1 anticipated.
- New test file: `e2e/signout-instant-nav.spec.ts` (see Test plan below).

### Step-by-step (test-first where possible)

1. Write `e2e/signout-instant-nav.spec.ts` (auth-gated, `E2E_WITH_AUTH`
   pattern) with the AC1–AC3 assertions below; confirm they fail against
   today's `<form action={signOutAction}>` implementation when run locally
   with real credentials.
2. Remove `redirect()` from `app/[locale]/login/actions.ts`.
3. Add the marker-check to `proxy.ts` as above.
4. Add `clearSignoutMarker` to `app/auth/callback/route.ts` and apply it to
   all four redirect return points.
5. Convert the sign-out control in `UserWidgetMenu.tsx` to the `onClick`
   handler above.
6. Run `npm run lint`, `npx tsc --noEmit`, `npm run build`.
7. Run `npm run test:e2e` (CI-safe subset); locally with `E2E_WITH_AUTH=1`
   and real credentials, run the new auth-gated spec plus the full existing
   auth/nav suite (`auth.spec.ts`, `login-redirect.spec.ts`,
   `header-identity-widget.spec.ts`, `user-widget-click-outside.spec.ts`) to
   confirm no regressions (AC4).
8. Manually verify against the dev server: log in, click "Sair", confirm
   immediate visual transition to the login page (no flash of the home
   page), then manually navigate to `/pt-PT/admin/people` and confirm
   redirect to login. Then log back in and confirm the app treats the new
   session as authenticated immediately (proves the callback-route marker
   clear works, not just its 15 s expiry).
9. Manually verify AC3's server-side logging: temporarily force
   `supabase.auth.signOut()` to reject/error in `actions.ts` (e.g. break
   `NEXT_PUBLIC_SUPABASE_URL` locally for one test run) and confirm (a) no
   error is shown in the UI and (b) `console.error('[signOut] ...')` appears
   in the server terminal output, then revert the temporary change.

### Test plan (mapped to acceptance criteria)

- **AC1 (automated, `e2e/signout-instant-nav.spec.ts`, auth-gated):**
  Click `sign-out-button` and assert two things: (a)
  `await expect(page).toHaveURL(/\/login/, { timeout: 500 })` — navigation
  completes almost immediately; (b) immediately after the click (before
  waiting on navigation), `context.cookies()` already contains
  `app-signout-pending=1`, proving the marker — and therefore the
  navigation it unblocks — was set synchronously, not after any network
  round trip.
  **Honest scope note, replacing the cycle-1 throttle approach:** the
  cycle-1 plan used `page.route('**/auth/v1/logout**', ...)` to artificially
  delay the network. Per the challenger's AC3 finding (confirmed here to
  also apply to AC1/AC2): the only real `supabase.auth.signOut()` call in
  this design is the server action's, which runs as a direct HTTP call from
  the Next.js **server** process, never as a request from the Playwright
  **browser** context — so `page.route()` cannot intercept or delay it, and
  a test that claims to do so would be misleading. Instead, AC1's "does not
  wait on the network" guarantee is evidenced by (i) the tight automated
  timeout above and (ii) a structural/code-review argument documented here:
  `router.push` is called and returns before `signOutAction()` is even
  invoked, and that invocation is never awaited — there is no code path in
  which navigation execution is gated on any network response. This is the
  "documented manual timing comparison" AC1 permits when browser-side
  throttling is impractical, applied to a code-structure argument instead of
  a wall-clock one.
- **AC2 (automated, two tests, `e2e/signout-instant-nav.spec.ts`,
  auth-gated):**
  - **Test A (direct guard test, network-independent):** while genuinely
    authenticated, use `context.addCookies([{ name: 'app-signout-pending',
    value: '1', url: baseURL, ... }])` to set the marker without going
    through the sign-out click at all, then `page.goto('/pt-PT/admin/people')`
    and assert redirect to `/pt-PT/login`. This is the test that would have
    caught the cycle-1 bug: it proves `proxy.ts`'s guard behavior
    deterministically, with no dependency on how fast or slow the real
    Supabase revoke call is — directly addressing the challenger's core
    finding.
  - **Test B (end-to-end, healthy network):** click `sign-out-button`, land
    on `/pt-PT/login`, then `page.goto('/pt-PT/admin/people')` and assert
    redirect back to `/pt-PT/login` — confirms no regression in the real,
    full click-driven flow (mirrors the existing manual step in
    `auth.spec.ts`'s header, now automated).
- **AC3 (manual, unchanged in scope from the honest re-labeling the
  challenger asked for):** the only real `supabase.auth.signOut()` call in
  this design executes server-side inside the Server Action, invisible to
  Playwright's browser-level network interception (`page.route()` cannot
  reach it) — so there is no meaningful automated way to force that specific
  call to fail from an e2e test in this codebase (no unit-test framework is
  installed to mock the Supabase server client directly; `package.json` has
  no `jest`/`vitest`). AC3 is verified via the manual step 9 above:
  temporarily break the server env, confirm no user-visible error and a
  `console.error` in the server log, then revert. This satisfies the
  Definition of Done's "documented manual verification step" escape hatch,
  same pattern as STORY-13/STORY-14. (What *is* automated: Test B above
  incidentally confirms that under a healthy network, sign-out produces no
  visible error and lands cleanly on `/login` — but this is AC1/AC2
  coverage, not a substitute for AC3's failure-path coverage, and is not
  claimed as such.)
- **AC4 (regression, no new test):** run the full existing e2e suite
  (`npm run test:e2e`, plus the auth-gated suite locally with
  `E2E_WITH_AUTH=1`) and confirm all previously-passing specs
  (`auth.spec.ts`, `login-redirect.spec.ts`, `header-identity-widget.spec.ts`,
  `user-widget-click-outside.spec.ts`) still pass unmodified — they select by
  `data-testid` (`sign-out-button`, `user-widget-trigger`, etc.), never by
  the removed `<form>`/`signOutAction` wiring, so no assertion changes are
  expected or needed.

### Risks and rollback

- **Risk: this now modifies `proxy.ts`, a shared, security-relevant file.**
  Mitigated by keeping the change additive and narrow: it only decides what
  `user` is set to *before* the two existing guard blocks run; the guard
  logic itself (`if (!user && !isLoginPath)` / `if (user && isLoginPath)`) is
  untouched. The marker can only force the stricter (logged-out) branch of
  either guard, never the reverse, so it is not a privilege-escalation
  vector even if an attacker could set arbitrary cookies on their own
  browser (which they always could anyway, for their own session).
- **Risk: stale marker outliving a legitimate new session.** Mitigated by
  (a) the 15 s bound and (b) explicit clearing in
  `app/auth/callback/route.ts` on every successful (or failed) callback
  response, so a sign-out-then-immediate-sign-in cycle is not shadowed.
  Manual verification step 8 explicitly checks this.
- **Residual risk (bounded, documented, not silently accepted):** if the
  real `supabase.auth.signOut()` call is not just slow but genuinely fails
  or hangs beyond 15 s (a true network outage, not ordinary latency), the
  marker expires before real invalidation completes, and the session cookie
  could still be valid — meaning a protected-route request issued *after*
  the marker's 15 s window could incorrectly succeed. This is scoped
  specifically to AC3's own failure/slowness scenario (not to the common
  "any" network delay the challenger required be closed for AC1/AC2), is
  several orders of magnitude narrower than the cycle-1 bug (which broke
  under *any* delay past 300 ms, not just outages past 15 s), and is
  consistent with the story's own framing that a failed signOut is a
  swallow-and-log case, not a hard guarantee of instant global revocation.
- **Risk: `Promise.race`/timeout complexity from cycle 1 is gone**, which is
  a net simplification, not a new risk — flagging only because a reviewer
  familiar with the cycle-1 plan should not expect to find it.
- **Rollback:** no DB/migration changes. A single-commit revert restores
  `<form action={signOutAction}>` + server-side `redirect()` in `actions.ts`,
  removes the marker-check in `proxy.ts`, and removes the
  `clearSignoutMarker` helper in `app/auth/callback/route.ts`. Four files,
  no schema impact.

### Affected areas

- **Frontend/UX:** `components/UserWidgetMenu.tsx` (client-side sign-out
  handler, navigation, marker cookie).
- **Backend/auth (session lifecycle + middleware):**
  `app/[locale]/login/actions.ts` (server action contract change),
  `proxy.ts` (auth guard now consults a client-set marker — security-adjacent
  change to a shared file), `app/auth/callback/route.ts` (marker clearing on
  login).
- **Tests:** new `e2e/signout-instant-nav.spec.ts`.

### Complexity tag: **complex**

Justification: unchanged from cycle 1, and if anything strengthened —
this revision now also modifies `proxy.ts`, the shared auth middleware used
by every route in the app, in addition to the server action and client
component. It requires reasoning about a genuine race condition between
client-side navigation timing and server-side session state, introduces a
new cross-cutting cookie-based coordination mechanism between three files
(`UserWidgetMenu.tsx` sets it, `proxy.ts` reads it, `auth/callback/route.ts`
clears it), and is security-adjacent (auth guard behavior, session
invalidation correctness). Per CLAUDE.md, auth + concurrency + a
security-relevant guard interaction affecting a shared middleware file is
squarely `complex`: a subtly wrong implementation (e.g. forgetting the
callback-route clear, or checking the marker in only one of the two guards)
would look like it works in a quick manual check while silently reintroducing
either the original bounce-back bug or a new stuck-logged-out regression.
