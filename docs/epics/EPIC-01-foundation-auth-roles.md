# EPIC-01 — Foundation, Authentication & User Roles

## Goal
Stand up the responsive web app on free hosting (Vercel + Supabase), with
Google login and the two-tier permission model (Admin / Member) that every
other feature depends on. A user can log in with Google, lands as a Member by
default, and an Admin can promote others to Admin. The app shell is pt-PT and
i18n-ready.

## Why it matters
Nothing else can be built or secured without identity and permissions. This
epic delivers the skeleton (deploy pipeline, database, auth) and the
Admin/Member distinction that gates all data access, so later epics plug in
safely.

## Scope (in)
- Web app scaffold (responsive, mobile + desktop), deployed to a free tier.
- Database + auth provider set up (Supabase or equivalent free tier).
- **Google OAuth login** for all users.
- **Admin** and **Member** roles with enforced permissions.
- First-time login creates a **Member by default**.
- Admins can **promote/demote** users to/from Admin (at least one Admin always).
- pt-PT as primary language; i18n scaffolding (strings externalized).
- Basic app navigation/shell and a "no access yet" state for brand-new Members.

## Out of scope
- Team/role/people management (EPIC-02).
- Any scheduling logic (EPIC-04).
- Email/password or other login methods.
- Public sign-up flows beyond Google login.

## Dependencies
- None (this is the base epic).

## Acceptance signals
- A user can sign in with Google and a session persists.
- A brand-new user is stored as a Member and sees a member-appropriate view.
- An Admin can see a user list and promote/demote Admins; permission checks
  block Members from Admin-only actions (server-enforced, not just UI).
- App is deployed and reachable on a public URL on a free plan.
- UI strings render in pt-PT.

## Candidate stories
- Project scaffold & deploy to free hosting
- Set up database & auth (Supabase) integration
- Google OAuth sign-in / sign-out
- User record created as Member on first login
- Admin user-management screen (list users)
- Promote / demote Admin role with last-admin safeguard
- Server-side permission enforcement (Admin vs Member)
- pt-PT i18n scaffolding & app shell/navigation
