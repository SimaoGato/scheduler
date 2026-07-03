'use server';

import { createClient } from '@/lib/supabase/server';

// NOTE (STORY-15): this action no longer redirects. Navigation to /login is
// now driven client-side by UserWidgetMenu's onClick handler, which fires
// this action in the background (not awaited) alongside a synchronous
// marker cookie + router.push. See UserWidgetMenu.tsx, proxy.ts, and
// app/auth/callback/route.ts for the rest of the mechanism.
export async function signOut() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Log the error — the client has already navigated away by the time
      // this resolves, so there is nothing to redirect; just log (AC3).
      console.error('[signOut] Supabase signOut error:', error.message);
    }
  } catch (err) {
    // createClient() threw (e.g. missing env vars) — log only (AC3).
    console.error('[signOut] Unexpected error:', err);
  }
}
