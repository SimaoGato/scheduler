import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

interface PageProps {
  // Next.js 16: searchParams is a Promise
  searchParams: Promise<{ denied?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const m = await getTranslations('Member');

  // searchParams is a Promise in Next.js 16
  const { denied } = await searchParams;

  // NOTE: Both AppHeader and page.tsx perform independent role fetches.
  // These should be consolidated with React cache() in a future story.
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable / placeholder creds — treat as unauthenticated.
    // proxy.ts already redirected unauthenticated users before this renders;
    // this path is only reached in CI with placeholder credentials.
    user = null;
  }

  let role: 'admin' | 'member' | null = null;
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
      role = null;
    }
  }

  // AC4: Show a specific access-denied banner when redirected from an admin route.
  // Suppress for admins — they are never actually denied, so the banner would be misleading.
  const showDeniedBanner = denied === '1' && role !== 'admin';

  // AC1: Authenticated member (or user with no role due to DB provisioning failure)
  // AC4 warning 4: if user is set but role is null, show an error — do NOT silently
  //   show the same "no access yet" view as a legitimate member.
  if (user && role === null) {
    return (
      <main className="flex-1 container mx-auto px-4 py-8">
        {showDeniedBanner && (
          <div
            data-testid="access-denied-banner"
            aria-live="polite"
            className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {m('accessDenied')}
          </div>
        )}
        <p
          data-testid="no-role-error"
          aria-live="polite"
          className="text-sm text-destructive"
        >
          {m('noRoleError')}
        </p>
      </main>
    );
  }

  if (user && role === 'member') {
    return (
      <main className="flex-1 container mx-auto px-4 py-8">
        {showDeniedBanner && (
          <div
            data-testid="access-denied-banner"
            aria-live="polite"
            className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {m('accessDenied')}
          </div>
        )}
        <h1
          data-testid="member-no-access-title"
          className="text-xl font-semibold"
        >
          {m('noAccessTitle')}
        </h1>
        <p
          data-testid="member-no-access-description"
          className="mt-2 text-sm text-muted-foreground"
        >
          {m('noAccessDescription')}
        </p>
      </main>
    );
  }

  // Admin view (role === 'admin') or unauthenticated fallback (user === null,
  // proxy.ts ensures only admins or CI placeholder-cred runs reach here).
  // Load Home translations only here — the member/no-role branches above never use them.
  const t = await getTranslations('Home');
  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      {showDeniedBanner && (
        <div
          data-testid="access-denied-banner"
          aria-live="polite"
          className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {m('accessDenied')}
        </div>
      )}
      <p className="text-base">{t('welcome')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      <Button className="mt-6" disabled>{t('cta')}</Button>
    </main>
  );
}
