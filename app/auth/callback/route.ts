import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { routing } from '@/i18n/routing';
import { SIGNOUT_MARKER_COOKIE } from '@/lib/auth/signout-marker';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * provisionUser — Upserts the application user record in public.users.
 *
 * - Existing user: UPDATE email + display_name, leaving role unchanged (AC2).
 * - New user: count all rows; if count === 0 assign 'admin' (AC3 bootstrap),
 *   otherwise assign 'member' (AC1). Then INSERT.
 *
 * Uses .maybeSingle() for the existence check: returns
 * { data: null, error: null } for zero rows and { data: null, error: <real error> }
 * for DB errors, so the branch condition `data !== null` is unambiguous.
 *
 * Null count throws rather than falling back, preventing an incorrect admin
 * promotion when the count query itself fails.
 */
async function provisionUser(serviceClient: SupabaseClient, user: User): Promise<void> {
  if (!user.email) {
    throw new Error(`[provisionUser] User ${user.id} has no email; cannot provision record.`);
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    '';

  // 1. Check if a row already exists for this user.
  const { data: existing, error: selectError } = await serviceClient
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle(); // maybeSingle returns null data (not an error) for 0 rows

  if (selectError) {
    throw selectError;
  }

  if (existing !== null) {
    // 2. Existing user — update email and display_name only; preserve role (AC2).
    const { error: updateError } = await serviceClient
      .from('users')
      .update({ email: user.email, display_name: displayName })
      .eq('id', user.id);

    if (updateError) {
      throw updateError;
    }
    return;
  }

  // 3. New user — determine role via bootstrap guard.
  const { count, error: countError } = await serviceClient
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw countError;
  }

  // Treat null count as unknown (not zero) to avoid incorrect admin promotion.
  if (count === null) {
    throw new Error('[provisionUser] Count query returned null; cannot determine bootstrap role.');
  }

  const role = count === 0 ? 'admin' : 'member'; // AC3: first user is admin, AC1: rest are members

  const { error: insertError } = await serviceClient.from('users').insert({
    id: user.id,
    email: user.email,
    display_name: displayName,
    role,
  });

  if (insertError) {
    throw insertError;
  }
}

// STORY-15: every response this route returns represents a successful (or
// at least resolved) pass through the login flow, so the short-lived
// sign-out marker cookie (see proxy.ts, components/UserWidgetMenu.tsx) must
// never be allowed to shadow a fresh session. Wrapping all redirect() exit
// points through this helper guarantees none of the five return paths below
// is missed.
function clearSignoutMarker(response: NextResponse): NextResponse {
  response.cookies.set(SIGNOUT_MARKER_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const defaultLocale = routing.defaultLocale;

  // STORY-15: wrap the whole handler so that even an unexpected synchronous
  // throw (e.g. createClient() or exchangeCodeForSession() throwing instead
  // of returning { error }) still clears the sign-out marker on whatever
  // error response is ultimately returned, preserving the "every response
  // this route returns clears the marker" invariant end to end.
  try {
    const error = searchParams.get('error');
    const code = searchParams.get('code');

    if (error) {
      const encodedError = encodeURIComponent(error);
      return clearSignoutMarker(
        NextResponse.redirect(new URL(`/${defaultLocale}/login?error=${encodedError}`, request.url))
      );
    }

    if (code) {
      const supabase = await createClient();
      // Destructure data (not just error) to extract the session user.
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeError) {
        // Guard against null session even when there is no exchange error.
        const user = data.session?.user;
        if (!user) {
          console.error('[auth/callback] Exchange succeeded but session or user is null.');
          // Still redirect to home — the session cookie may have been set.
          return clearSignoutMarker(NextResponse.redirect(new URL(`/${defaultLocale}/`, request.url)));
        }

        // Provision the user record; errors are non-fatal (user still reaches home).
        try {
          const serviceClient = createServiceClient();
          await provisionUser(serviceClient, user);
        } catch (provisionErr) {
          // NOTE 1: log the error so it surfaces in server logs / Vercel logs.
          console.error('[auth/callback] provisionUser failed:', provisionErr);
          // Do NOT block the redirect — degraded mode is better than a broken login.
        }

        return clearSignoutMarker(NextResponse.redirect(new URL(`/${defaultLocale}/`, request.url)));
      }

      return clearSignoutMarker(
        NextResponse.redirect(new URL(`/${defaultLocale}/login?error=exchange_failed`, request.url))
      );
    }

    // Fallback: no code, no error
    return clearSignoutMarker(NextResponse.redirect(new URL(`/${defaultLocale}/login`, request.url)));
  } catch (err) {
    console.error('[auth/callback] Unexpected error:', err);
    return clearSignoutMarker(
      NextResponse.redirect(new URL(`/${defaultLocale}/login?error=unexpected`, request.url))
    );
  }
}
