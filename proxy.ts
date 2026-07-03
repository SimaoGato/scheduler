import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { SIGNOUT_MARKER_COOKIE } from './lib/auth/signout-marker';

const intlMiddleware = createMiddleware(routing);

// STORY-15: marker cookie set synchronously by UserWidgetMenu's sign-out
// click handler, before the real (server-side, unawaited) signOut() call
// resolves. See UserWidgetMenu.tsx and app/auth/callback/route.ts.

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths exempt from the auth guard.
  // NOTE: /auth/* is already excluded by the matcher below — no runtime check needed.
  const isLoginPath = /^\/[^/]+\/login(\/|$)/.test(pathname);

  // Create a mutable response to carry Supabase cookies through
  let supabaseResponse = NextResponse.next({ request });

  // STORY-15: if the client-set marker is present, skip the Supabase lookup
  // entirely and treat this request as unauthenticated. This only ever
  // forces the *stricter* branch of each guard below (forward guard
  // redirects protected routes to /login; reverse guard does not fire on
  // /login), so it cannot grant access — it can only cause an
  // already-logged-out request to be treated as such slightly early, while
  // the real supabase.auth.signOut() network call is still in flight. See
  // components/UserWidgetMenu.tsx (sets it) and
  // app/auth/callback/route.ts (clears it on next successful login).
  const signingOut = request.cookies.get(SIGNOUT_MARKER_COOKIE)?.value === '1';

  let user = null;
  if (!signingOut) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value)
              );
              supabaseResponse = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Any error (missing env vars, network, etc.) → treat as unauthenticated
      user = null;
    }
  }

  // Auth guard: redirect unauthenticated users to login
  if (!user && !isLoginPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${routing.defaultLocale}/login`;
    redirectUrl.search = '';
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy any Supabase cookies onto the redirect response
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // Reverse guard: redirect authenticated users away from login (STORY-09)
  if (user && isLoginPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${routing.defaultLocale}/`;
    redirectUrl.search = '';
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy any Supabase cookies onto the redirect response (same pattern as above)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // Let next-intl handle locale routing
  const intlResponse = intlMiddleware(request);

  // Copy Supabase cookies onto the intl response
  supabaseResponse.cookies.getAll().forEach(cookie => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

// The matcher excludes /api, /auth (OAuth callback lives at /auth/callback),
// Next.js internals, and static assets. Auth-callback exemption is handled here,
// not inside the middleware function.
export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)',],
};
