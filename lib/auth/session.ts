// No `import 'server-only'` here: createClient() imports `next/headers` which
// already enforces server-only at the Next.js bundler level. Adding
// `server-only` would block this module from being imported in test files.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * getSessionUser — Returns the currently authenticated Supabase User, or null.
 *
 * Decorated with React cache() so that within a single server render tree the
 * auth.getUser() network call is made exactly once, regardless of how many
 * Server Components call this helper.
 */
export const getSessionUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
});

/**
 * getUserRole — Returns the user's role from public.users, or null.
 *
 * Decorated with React cache() so that within a single server render tree the
 * role SELECT query is made exactly once per unique userId.
 */
export const getUserRole = cache(async (userId: string) => {
  try {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    return row?.role === 'admin'
      ? ('admin' as const)
      : row?.role === 'member'
        ? ('member' as const)
        : null;
  } catch {
    return null;
  }
});
