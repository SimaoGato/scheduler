import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths exempt from the auth guard
  const isLoginPath = /\/[^/]+\/login/.test(pathname);
  const isAuthCallback = pathname.startsWith('/auth/callback');

  // Create a mutable response to carry Supabase cookies through
  let supabaseResponse = NextResponse.next({ request });

  let user = null;
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

  // Auth guard: redirect unauthenticated users to login
  if (!user && !isLoginPath && !isAuthCallback) {
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

  // Let next-intl handle locale routing
  const intlResponse = intlMiddleware(request);

  // Copy Supabase cookies onto the intl response
  supabaseResponse.cookies.getAll().forEach(cookie => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)',],
};
