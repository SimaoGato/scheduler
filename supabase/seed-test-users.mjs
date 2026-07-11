#!/usr/bin/env node
// supabase/seed-test-users.mjs
//
// CHORE-05: CI integration-test infra ONLY. This script creates a seeded
// admin and member test account (via the Supabase Admin API + a direct
// public.users upsert) so the e2e-integration/ Playwright suite can sign in
// with email/password (no Google OAuth needed) and exercise the real
// authenticated API paths against a real local Supabase instance.
//
// CHORE-03 already decided local dev does NOT use Docker Supabase — it uses
// a separate shared cloud dev project. Do not run this script against that
// project or any non-local URL; the guard below enforces this at runtime.
// See supabase/config.toml (near project_id) for the matching pointer back
// to this file.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
  console.error(
    '[seed-test-users] refusing to run against non-local Supabase URL:',
    url,
    '\nThis script creates a privileged admin account with a committed,',
    'publicly-known password and must only ever run against a local',
    '`supabase start` instance (127.0.0.1/localhost), never the shared',
    'dev Supabase project (see CHORE-03) or production.'
  )
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { ADMIN_ID, MEMBER_ID, ADMIN_EMAIL, MEMBER_EMAIL, TEST_PASSWORD } = await import(
  './test-users.mjs'
)

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error('[seed-test-users] SUPABASE_SERVICE_ROLE_KEY is not set')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey)

async function createAuthUser(id, email) {
  const { error } = await admin.auth.admin.createUser({
    id,
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  })

  if (error) {
    // Idempotent: re-running against a persisted local stack during
    // development is fine as long as the user already exists.
    if (/already been registered/i.test(error.message)) {
      console.log(`[seed-test-users] ${email} already exists, skipping create`)
      return
    }
    console.error(`[seed-test-users] failed to create auth user ${email}:`, error)
    process.exit(1)
  }

  console.log(`[seed-test-users] created auth user ${email}`)
}

async function upsertPublicUser(id, email, displayName, role) {
  const { error } = await admin
    .from('users')
    .upsert({ id, email, display_name: displayName, role })

  if (error) {
    console.error(`[seed-test-users] failed to upsert public.users row for ${email}:`, error)
    process.exit(1)
  }

  console.log(`[seed-test-users] upserted public.users row for ${email} (role=${role})`)
}

await createAuthUser(ADMIN_ID, ADMIN_EMAIL)
await createAuthUser(MEMBER_ID, MEMBER_EMAIL)

await upsertPublicUser(ADMIN_ID, ADMIN_EMAIL, 'CI Admin', 'admin')
await upsertPublicUser(MEMBER_ID, MEMBER_EMAIL, 'CI Member', 'member')

console.log('[seed-test-users] done')
