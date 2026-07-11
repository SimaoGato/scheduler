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

// Parse the URL and check `.hostname` against an exact allow-list, rather
// than a string-prefix regex. A regex like
// /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/ has a URL-userinfo bypass:
// `http://127.0.0.1:1234@evil.com/` matches it (the `:` right after
// `127.0.0.1` satisfies the terminator group) even though `fetch`/URL
// machinery actually connects to `evil.com`, not `127.0.0.1`. Parsing with
// `new URL()` and comparing `.hostname` is immune to this because the
// userinfo subcomponent (`user:pass@`) is never part of `.hostname`.
let hostname
try {
  hostname = new URL(url).hostname
} catch {
  console.error('[seed-test-users] invalid Supabase URL:', url)
  process.exit(1)
}

if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
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
    // development is fine as long as the user already exists. Prefer the
    // stable machine-readable `code` (GoTrue's error-codes.ts: 'email_exists')
    // over matching a substring of the free-text message, which could
    // change without notice; keep the message match as a fallback for
    // older/self-hosted GoTrue versions that don't set `code`.
    const alreadyExists =
      error.code === 'email_exists' || /already been registered/i.test(error.message)
    if (alreadyExists) {
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
