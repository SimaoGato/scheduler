// e2e-integration/service-client.ts
//
// Test-only infra: a service-role Supabase client for direct fixture
// setup/teardown and read-back assertions in integration specs (bypasses
// RLS, same as lib/supabase/service.ts, but constructed here without
// `server-only` since Playwright test files run in a plain Node process,
// not the Next.js server bundle).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function serviceClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set to run e2e-integration tests'
    )
  }

  cached = createClient(url, key)
  return cached
}
