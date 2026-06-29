import { getTranslations } from 'next-intl/server';
import AppNav from './AppNav';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/[locale]/login/actions';

export default async function AppHeader() {
  const t = await getTranslations('App');
  const tAuth = await getTranslations('Auth');

  // NOTE: Both AppHeader and page.tsx perform independent role fetches.
  // These should be consolidated with React cache() in a future story.

  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // If Supabase is unreachable or env vars are placeholder values, treat as unauthenticated
    user = null;
  }

  let role: 'admin' | 'member' | null = null;
  let roleLabel: string | null = null;
  if (user) {
    try {
      const supabase = await createClient();
      const { data: row } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      role =
        row?.role === 'admin'
          ? ('admin' as const)
          : row?.role === 'member'
            ? ('member' as const)
            : null;
    } catch {
      // Role fetch failure — role stays null; header still renders greeting + sign-out
      role = null;
    }
    // tUM is only needed when user is present (for roleLabel).
    // Reusing UserManagement.roleAdmin / UserManagement.roleMember to avoid
    // duplicating strings that are semantically identical. NOTE 1, STORY-06.
    const tUM = await getTranslations('UserManagement');
    roleLabel =
      role === 'admin'
        ? tUM('roleAdmin')
        : role === 'member'
          ? tUM('roleMember')
          : null;
  }

  const displayName =
    user?.user_metadata?.full_name ?? user?.email ?? tAuth('userFallback');

  return (
    <header className="border-b bg-background px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <span className="text-lg font-semibold">{t('name')}</span>
        <div className="flex items-center gap-4">
          <AppNav role={role} />
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground" data-testid="user-identity">
                {tAuth('userGreeting', { name: displayName })}
                {roleLabel && (
                  <span data-testid="user-role-label"> &middot; {roleLabel}</span>
                )}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="min-h-[44px] px-3 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {tAuth('signOut')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
