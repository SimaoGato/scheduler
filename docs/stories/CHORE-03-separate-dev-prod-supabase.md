# CHORE-03: Separate dev and prod Supabase environments
Epic: maintenance
Status: done ✅
PR: 7
Priority: low — do this before the first real church member is onboarded, not before STORY-03

## Task
Create a dedicated Supabase cloud project for local development so that
dev/test data is isolated from production. This is a 5-minute manual task,
not a code change.

**Do NOT use local Supabase via Docker** — it requires Docker Desktop, extra
RAM/disk, and complicates Google OAuth configuration. A second free cloud
project is the right approach for a project at this scale.

**Current risk is low**: until real members are onboarded, test sign-ins can
be deleted from the Supabase dashboard. The first-user Admin bootstrap being
triggered by the developer is actually correct (the developer IS the admin).
This chore can wait until just before go-live.

## Why this matters (when it does)
- Once real church members are in the system, local dev sign-ins create
  junk rows mixed with real member data.
- Supabase free tier allows up to 2 active projects — a second project costs
  nothing.

## Acceptance criteria
1. Given a developer running `npm run dev` locally, when they sign in or
   write data, then no rows appear in the production Supabase project.
2. Given the production Vercel deployment, when it connects to Supabase, then
   it uses the prod project URL and key (not the dev one).
3. Given the `.env.example` file, when a new developer reads it, then it
   clearly documents that dev and prod use separate Supabase project URLs.
4. Given the GitHub Actions CI workflow, when the Smoke test step runs, then
   it uses placeholder Supabase credentials (no real project needed for CI —
   tests pass without real DB calls).

## Out of scope
- Database migrations / schema sync tooling between dev and prod (that is
  a future concern).
- Staging environment (not needed yet).

## Steps (manual — no code agent required)
1. Create a second Supabase project named `scheduler-dev` at supabase.com.
2. Enable the Google OAuth provider in the new project (same Google Cloud
   credentials, just add `http://localhost:3000/auth/callback` as the
   redirect URI in both Supabase *and* Google Cloud Console under the same
   OAuth client).
3. Update `.env.local` to point at the dev project's URL and anon key.
4. Keep `.env.example` pointing at placeholder values; add a comment
   explaining dev vs prod.
5. Vercel environment variables remain pointed at the prod project — no
   change needed there.

## Technical notes
- Supabase free tier: 2 active projects max, no time limit.
- Google OAuth client: a single OAuth client can have multiple redirect URIs,
  so the same Google Client ID / Secret works for both dev and prod Supabase
  projects.
- CI already uses placeholder credentials (`https://placeholder.supabase.co`)
  and does not need a real project.
- When STORY-03 creates the `users` table, that schema change must be
  applied to **both** projects (dev and prod) manually via the Supabase
  dashboard SQL editor or the CLI (`supabase db push`). The implementer
  should document this in STORY-03's technical notes.

## Definition of Done
See CLAUDE.md — but note: this chore has no automated tests. Done when the
developer confirms that sign-in during `npm run dev` does NOT create rows in
the prod Supabase Auth → Users list.

---

## Implementation Plan

### Affected areas
- **infra** — `.env.example` (comment update only)
- Manual operator steps (Supabase dashboard, Google Cloud Console, Vercel) — no agent-executable

### AC-by-AC breakdown

| AC | Requires code? | Status |
|----|---------------|--------|
| AC1 — dev sign-ins do not pollute prod | No — manual (create `scheduler-dev` Supabase project, update `.env.local`) | Open |
| AC2 — Vercel prod deployment uses prod credentials | No — manual (Vercel env vars already point at prod; no change needed) | Open |
| AC3 — `.env.example` documents dev vs prod | **Yes — single-line comment addition** | Open |
| AC4 — CI uses placeholder credentials in Smoke test step | No — already satisfied (both Build and Smoke test steps in `.github/workflows/ci.yml` already carry `NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder`, `SUPABASE_SERVICE_ROLE_KEY: placeholder`) | Done |

### Step-by-step approach (code-only portion)

**Step 1 — Update `.env.example` (AC3)**

Replace the existing top comment in `.env.example` with an expanded block that
explains:
- Dev (`.env.local`) should point at the `scheduler-dev` Supabase cloud project.
- Prod (Vercel environment variables) should point at the `scheduler-prod`
  Supabase cloud project.
- Never use the prod URL/key locally.

The placeholder values themselves do not change; only the explanatory comment
block changes.

Target file: `/home/justasandbox/scheduler/.env.example`

Current content (lines 1-8):
```
# Supabase — wired in STORY-02. Copy to .env.local and fill in real values.
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Service-role key — server-side only; NEVER expose to the browser.
# Find it in: Supabase dashboard → Project Settings → API → service_role key.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Desired content:
```
# Supabase credentials — copy this file to .env.local and fill in real values.
#
# DEV vs PROD: Dev and production use SEPARATE Supabase cloud projects.
#   - Local dev (.env.local): point at the "scheduler-dev" Supabase project.
#   - Production (Vercel env vars): point at the "scheduler-prod" project.
# Never paste the production URL or keys into .env.local.
# See CHORE-03 for the setup procedure.
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Service-role key — server-side only; NEVER expose to the browser.
# Find it in: Supabase dashboard → Project Settings → API → service_role key.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Step 2 — Manual operator checklist (not agent-executable)**

These steps must be performed by the developer in a browser/CLI before marking
the story done:
1. Create a second Supabase cloud project named `scheduler-dev` at
   supabase.com (free tier, same region as prod).
2. In the new project, enable the Google OAuth provider and add
   `http://localhost:3000/auth/callback` as an authorised redirect URI in
   both Supabase → Auth → URL Configuration **and** Google Cloud Console →
   OAuth 2.0 Client → Authorised Redirect URIs (the same OAuth client ID and
   secret can be reused).
3. Apply the current production schema (public.users table + RLS policies from
   STORY-03) to the dev project via the Supabase dashboard SQL editor.
4. Copy the dev project's URL and anon key into `.env.local` (overwriting the
   prod values that are there now).
5. Verify: run `npm run dev`, sign in with Google, confirm a row appears in
   `scheduler-dev` Auth → Users and **not** in the prod project.

### Test plan

| AC | Verification method |
|----|---------------------|
| AC1 | Manual: sign in locally after step 5 above; check Supabase dashboards |
| AC2 | Manual: confirm Vercel env vars are unchanged (prod URL/key still set) |
| AC3 | Automated (lint/build): `.env.example` is not executed, but a reviewer can eyeball it; alternatively `grep "scheduler-dev\|DEV vs PROD" .env.example` passes |
| AC4 | Automated: `npm run build` and `npm run test:e2e` in CI — already passing |

No new Playwright tests are needed: this chore has no runtime behaviour to
exercise.

### Risks and rollback

- **Risk**: Developer accidentally copies the dev Supabase URL into Vercel prod
  env vars. Mitigation: the `.env.example` comment explicitly warns against this;
  the manual checklist in Step 2 above confirms Vercel is unchanged.
- **Risk**: Google OAuth redirect URI list grows stale. Mitigation: document in
  the README or a runbook that new environments require a new redirect URI entry.
- **Rollback**: The only code change is a comment in `.env.example`. It can be
  reverted with a one-line git revert if needed; no runtime impact.

### Complexity tag

`trivial` — The sole code change is a comment block addition to a single
non-executed file (`.env.example`). All substantive work is manual operator
steps. No logic, no modules, no reasoning risk.
