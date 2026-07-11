// supabase/test-users.mjs
//
// Shared fixed IDs/credentials for the CHORE-05 local-Supabase integration
// test users. Exported from a sibling module so both the seed script
// (supabase/seed-test-users.mjs) and the Playwright auth fixture
// (e2e-integration/fixtures.ts) reference the exact same values instead of
// duplicating them.
//
// These are only ever reachable against an ephemeral, job-scoped local
// Docker Supabase instance — see the fail-closed host guard at the top of
// supabase/seed-test-users.mjs, which refuses to run against any non-local
// Supabase URL.

export const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
export const MEMBER_ID = '00000000-0000-4000-8000-000000000002'
export const ADMIN_EMAIL = 'ci-admin@example.test'
export const MEMBER_EMAIL = 'ci-member@example.test'
export const TEST_PASSWORD = 'ci-integration-test-password-local-only'
