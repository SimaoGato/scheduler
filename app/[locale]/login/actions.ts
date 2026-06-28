'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${routing.defaultLocale}/login`);
}
