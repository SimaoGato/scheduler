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

import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'
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

  // Fail fast if @supabase/ssr stops calling `setAll` in some future
  // version — without this guard, an empty cookie header would silently
  // produce a confusing 401 downstream instead of a clear error here.
  if (cookies.length === 0) {
    throw new Error(
      `signInWithPassword for ${email} succeeded but no cookies were captured via setAll()`
    )
  }

  return cookies
}

function toCookieHeader(cookies: CapturedCookie[]): string {
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ')
}

interface IntegrationFixtures {
  adminRequest: APIRequestContext
  memberRequest: APIRequestContext
  memberPage: Page
  adminPage: Page
}

async function createAuthenticatedRequestContext(
  playwright: typeof import('playwright-core'),
  baseURL: string | undefined,
  email: string
): Promise<APIRequestContext> {
  const cookies = await signInAndGetCookies(email, TEST_PASSWORD)
  return playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: toCookieHeader(cookies) },
  })
}

// STORY-26 Design decision 6: real-browser auth fixture, built on top of the
// same signInAndGetCookies() helper used by the APIRequestContext fixtures
// above (no duplication of the cookie-capture logic). Uses
// `browser.newContext()` + `context.addCookies()` (not
// `playwright.request.newContext()`) because a real rendered page — not
// just raw HTTP requests — is needed to exercise the Client Component
// toggle flow and nav interactions.
//
// Cookie attributes: `secure`/`sameSite` are deliberately omitted from the
// addCookies() call below. This is dev/CI-only test infra running against
// `http://localhost:3000`, and the same `localhost` potentially-trustworthy-
// origin exception already documented in CLAUDE.md for CHORE-13 applies
// here. If signInAndGetCookies() ever returns a session split across
// multiple chunked cookies (e.g. `sb-<ref>-auth-token.0`, `.1`, ...), every
// chunk gets the *same* `domain`/`path` pair applied uniformly below — a
// partial or inconsistent domain/path across chunks would silently corrupt
// the reassembled session rather than fail loudly.
async function createAuthenticatedPage(
  browser: import('@playwright/test').Browser,
  baseURL: string | undefined,
  email: string
): Promise<Page> {
  const cookies = await signInAndGetCookies(email, TEST_PASSWORD)
  const url = new URL(baseURL ?? 'http://localhost:3000')

  const context = await browser.newContext()
  await context.addCookies(
    cookies.map(({ name, value }) => ({
      name,
      value,
      domain: url.hostname,
      path: '/',
    }))
  )
  return context.newPage()
}

export const test = base.extend<IntegrationFixtures>({
  adminRequest: async ({ playwright, baseURL }, provideContext) => {
    const context = await createAuthenticatedRequestContext(playwright, baseURL, ADMIN_EMAIL)
    await provideContext(context)
    await context.dispose()
  },

  memberRequest: async ({ playwright, baseURL }, provideContext) => {
    const context = await createAuthenticatedRequestContext(playwright, baseURL, MEMBER_EMAIL)
    await provideContext(context)
    await context.dispose()
  },

  memberPage: async ({ browser, baseURL }, provideContext) => {
    const page = await createAuthenticatedPage(browser, baseURL, MEMBER_EMAIL)
    await provideContext(page)
    await page.context().close()
  },

  adminPage: async ({ browser, baseURL }, provideContext) => {
    const page = await createAuthenticatedPage(browser, baseURL, ADMIN_EMAIL)
    await provideContext(page)
    await page.context().close()
  },
})

export { expect }
