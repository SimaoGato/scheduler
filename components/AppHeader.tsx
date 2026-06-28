import { getTranslations } from 'next-intl/server';
import AppNav from './AppNav';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/[locale]/login/actions';

export default async function AppHeader() {
  const t = await getTranslations('App');
  const tAuth = await getTranslations('Auth');

  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // If Supabase is unreachable or env vars are placeholder values, treat as unauthenticated
    user = null;
  }

  const displayName =
    user?.user_metadata?.full_name ?? user?.email ?? tAuth('userFallback');

  return (
    <header className="border-b bg-background px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <span className="text-lg font-semibold">{t('name')}</span>
        <div className="flex items-center gap-4">
          <AppNav />
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {tAuth('userGreeting', { name: displayName })}
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
