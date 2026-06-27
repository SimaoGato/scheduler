# STORY-02: Google sign-in / sign-out with persistent session
Epic: EPIC-01
Status: draft

## User story
As a user, I want to sign in and out with my Google account, so that I can
securely access the app without managing a password.

## Context
Second slice of EPIC-01. Wires the auth/database provider (Supabase or
equivalent free tier) and Google OAuth. See PRD §6 (FR18: Google login for all
users) and §7 (security: Google OAuth). User provisioning/roles come next
(STORY-03).

## Acceptance criteria
1. Given a logged-out visitor, when they open a protected page, then they are
   directed to a sign-in screen offering **"Continue with Google"**.
2. Given the sign-in screen, when the user completes Google OAuth successfully,
   then they are returned to the app in an authenticated state showing their
   Google display name/email.
3. Given an authenticated user, when they reload or revisit the app, then their
   session persists (they are not asked to log in again until it expires/logs
   out).
4. Given an authenticated user, when they click sign-out, then the session is
   cleared and a subsequent visit to a protected page requires logging in again.
5. Given a failed or cancelled Google login, when control returns to the app,
   then a clear pt-PT error/notice is shown and the user remains logged out.

## Out of scope
- Creating the application user record / assigning roles (STORY-03).
- Admin vs Member authorization rules (STORY-04).
- Non-Google login methods.

## Technical notes
- Supabase Auth (Google provider) or equivalent; configure OAuth client + redirect URLs.
- Session handling via the provider's SDK; protect routes via middleware.
- Store provider secrets in env vars wired in STORY-01.

## Definition of Done
See CLAUDE.md.
