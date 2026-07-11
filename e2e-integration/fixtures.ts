// e2e-integration/fixtures.ts
//
// Test-only pattern — do not reuse for production auth flows. This
// constructs a `createServerClient` the same way `lib/auth/guard.ts` does,
// purely to capture session cookies for API test requests.
//
// Rather than hand-reconstruct @supabase/ssr's cookie name/encoding format
// (which is undocumented and can be chunked above ~3180 bytes), this fixture
// reuses the library itself: it builds a throwaway createServerClient with a
// cookies.setAll that just records whatever cookies the library produces,
// signs in with signInWithPassword(), and uses the recorded cookies verbatim
// as the Cookie header for the API request. This is the exact code path
// lib/auth/guard.ts reads from, so it survives any future encoding/chunking
// changes in @supabase/ssr without this fixture needing to track them.
//
// If a future story in this directory needs full-page/browser-based auth
// testing, switch to `browser.newContext({ storageState: { cookies: [...] } })`
// with `domain`/`path` set instead of the raw Cookie header, since
// APIRequestContext doesn't do domain-scoped cookie matching the way a
// BrowserContext does.

import { test as base, expect, type APIRequestContext } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { ADMIN_EMAIL, MEMBER_EMAIL, TEST_PASSWORD } from '../supabase/test-users.mjs'

interface CapturedCookie {
  name: string
  value: string
}

async function signInAndGetCookies(email: string, password: string): Promise<CapturedCookie[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to run e2e-integration tests'
    )
  }

  const cookies: CapturedCookie[] = []

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookies
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          cookies.push({ name, value })
        }
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`signInWithPassword failed for ${email}: ${error.message}`)
  }

  return cookies
}

function toCookieHeader(cookies: CapturedCookie[]): string {
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ')
}

interface IntegrationFixtures {
  adminRequest: APIRequestContext
  memberRequest: APIRequestContext
}

export const test = base.extend<IntegrationFixtures>({
  adminRequest: async ({ playwright, baseURL }, provideContext) => {
    const cookies = await signInAndGetCookies(ADMIN_EMAIL, TEST_PASSWORD)
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: toCookieHeader(cookies) },
    })
    await provideContext(context)
    await context.dispose()
  },

  memberRequest: async ({ playwright, baseURL }, provideContext) => {
    const cookies = await signInAndGetCookies(MEMBER_EMAIL, TEST_PASSWORD)
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: toCookieHeader(cookies) },
    })
    await provideContext(context)
    await context.dispose()
  },
})

export { expect }
