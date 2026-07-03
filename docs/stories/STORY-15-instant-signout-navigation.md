# STORY-15: Make sign-out feel instant (navigate before backend cleanup completes)
Epic: EPIC-01
Status: draft

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
