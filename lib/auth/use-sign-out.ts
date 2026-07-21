'use client';

import { useRouter } from '@/i18n/navigation';
import {
  SIGNOUT_MARKER_COOKIE,
  SIGNOUT_MARKER_MAX_AGE_SECONDS,
} from '@/lib/auth/signout-marker';

// STORY-15 marker-cookie sign-out sequence, extracted from
// UserWidgetMenu.tsx (CHORE-31) so the Settings-page sign-out button
// (components/SettingsSignOutButton.tsx) can reuse it verbatim instead of
// forking the marker-cookie logic. See lib/auth/signout-marker.ts (constants)
// and proxy.ts (read side) for the rest of the mechanism.
//
// Makes sign-out feel instant by navigating to /login before the
// server-side signOut() round trip completes, instead of waiting on it.
//
// WHY the marker cookie exists (do not "simplify" this away): setting
// `app-signout-pending=1` synchronously, before router.push, forces
// proxy.ts's auth guard to treat this browser as signed-out immediately.
// Without it, proxy.ts's reverse-guard (`user && isLoginPath`) would
// bounce the /login navigation straight back to / for as long as the
// real (still in-flight, unawaited) supabase.auth.signOut() call hasn't
// yet cleared the actual session cookie — the real cookie is never
// cleared synchronously, only after its own network round trip resolves.
// The 15s max-age bounds how long a hung/failed real signOut() (see
// actions.ts's try/catch + console.error) can keep the guard in this
// stricter treatment. See proxy.ts for the read side and
// app/auth/callback/route.ts for where the marker is cleared again on the
// next successful login.
//
// DO NOT alter the cookie write/readback sequence below.
export function useSignOut(signOutAction: () => Promise<void>) {
  const router = useRouter();

  return function handleSignOut() {
    document.cookie = `${SIGNOUT_MARKER_COOKIE}=1; path=/; max-age=${SIGNOUT_MARKER_MAX_AGE_SECONDS}; SameSite=Lax; Secure`;

    // Defensive readback: `Secure` means the browser silently no-ops the
    // write outside a secure context (fine on production HTTPS and on
    // Chromium/Firefox against http://localhost, but not guaranteed in
    // every environment, e.g. a non-localhost http dev hostname). If the
    // marker didn't actually get set, proxy.ts's reverse-guard race this
    // hook fixes would silently reopen. Log loudly so that failure is
    // visible instead of silent — but never block navigation on this check.
    if (!document.cookie.includes(`${SIGNOUT_MARKER_COOKIE}=1`)) {
      console.error(
        '[useSignOut] Sign-out marker cookie was not set (non-secure context?). ' +
          'proxy.ts may briefly treat this browser as still signed in.'
      );
    }

    router.push('/login');
    void signOutAction().catch((err) => {
      console.error('[useSignOut] signOutAction invocation error:', err);
    });
  };
}
