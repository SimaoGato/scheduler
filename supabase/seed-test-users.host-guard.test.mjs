// supabase/seed-test-users.host-guard.test.mjs
//
// Regression test for the fail-closed host guard at the top of
// seed-test-users.mjs (CHORE-05 rework cycle 1, PR #41 review WARNING).
//
// The guard is the load-bearing control that stops this script from ever
// creating a privileged admin account with a fixed UUID and committed,
// publicly-known password against a real/shared/prod Supabase project. An
// earlier version used a string-prefix regex
// (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/) that had a URL-userinfo
// bypass: `http://127.0.0.1:1234@evil.com/` matched the regex even though
// fetch/URL machinery actually connects to `evil.com`. This test spawns the
// real script as a child process (no mocking) so it exercises the exact
// guard code path, and asserts on process exit code + stderr — never
// reaching the Supabase client construction, so no network access or real
// credentials are required for the rejection cases.
//
// Run with: node --test supabase/seed-test-users.host-guard.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed-test-users.mjs'
)

function runWithUrl(url, extraEnv = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: url,
      // Intentionally omitted unless passed via extraEnv: a rejected URL
      // must never reach the point where SUPABASE_SERVICE_ROLE_KEY matters.
      SUPABASE_SERVICE_ROLE_KEY: '',
      ...extraEnv,
    },
  })
}

test('rejects the URL-userinfo bypass that defeated the old regex guard', () => {
  const result = runWithUrl('http://127.0.0.1:1234@evil.com/')
  assert.notEqual(result.status, 0, 'script must exit non-zero for a userinfo-bypass URL')
  assert.match(result.stderr, /refusing to run against non-local Supabase URL/)
})

test('rejects a userinfo bypass using localhost as the userinfo segment', () => {
  const result = runWithUrl('http://localhost@evil.com/')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /refusing to run against non-local Supabase URL/)
})

test('rejects an unrelated non-local host', () => {
  const result = runWithUrl('https://evil.com')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /refusing to run against non-local Supabase URL/)
})

test('rejects an invalid URL string', () => {
  const result = runWithUrl('not a url')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /invalid Supabase URL/)
})

test('accepts a legitimate 127.0.0.1 URL and proceeds past the guard', () => {
  // No SUPABASE_SERVICE_ROLE_KEY is set, so the script should fail *after*
  // the host guard, on the service-role-key check — proving the URL guard
  // itself let it through.
  const result = runWithUrl('http://127.0.0.1:54321')
  assert.notEqual(result.status, 0)
  assert.doesNotMatch(result.stderr, /refusing to run against non-local Supabase URL/)
  assert.match(result.stderr, /SUPABASE_SERVICE_ROLE_KEY is not set/)
})

test('accepts a legitimate localhost URL and proceeds past the guard', () => {
  const result = runWithUrl('http://localhost:54321')
  assert.notEqual(result.status, 0)
  assert.doesNotMatch(result.stderr, /refusing to run against non-local Supabase URL/)
  assert.match(result.stderr, /SUPABASE_SERVICE_ROLE_KEY is not set/)
})
