'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';

export async function signOut() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Log the error but proceed to redirect — the session cookie is cleared
      // client-side by Supabase regardless, so the user must be sent to login.
      console.error('[signOut] Supabase signOut error:', error.message);
    }
  } catch (err) {
    // createClient() threw (e.g. missing env vars) — still redirect to login.
    console.error('[signOut] Unexpected error:', err);
  }
  redirect(`/${routing.defaultLocale}/login`);
}
