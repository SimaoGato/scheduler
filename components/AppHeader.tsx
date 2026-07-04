import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import AppNav from './AppNav';
import UserWidget from './UserWidget';
import { getSessionUser, getUserProfile } from '@/lib/auth/session';

export default async function AppHeader() {
  const t = await getTranslations('App');
  const tAuth = await getTranslations('Auth');

  const user = await getSessionUser();

  let role: 'admin' | 'member' | null = null;
  let roleLabel: string | null = null;
  let displayName: string = tAuth('userFallback');
  if (user) {
    // STORY-21/AC6: public.users.display_name is the source of truth for the
    // displayed name — do not read user.user_metadata directly here. Falls
    // back to the Google name, then email, then the generic fallback only
    // when the DB value is empty.
    const profile = await getUserProfile(user.id);
    role = profile?.role ?? null;
    // Reusing UserManagement.roleAdmin / UserManagement.roleMember to avoid
    // duplicating strings that are semantically identical. NOTE 1, STORY-06.
    const tUM = await getTranslations('UserManagement');
    roleLabel =
      role === 'admin'
        ? tUM('roleAdmin')
        : role === 'member'
          ? tUM('roleMember')
          : null;

    const googleName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      '';
    displayName =
      profile?.displayName && profile.displayName !== ''
        ? profile.displayName
        : googleName || user.email || tAuth('userFallback');
  }

  return (
    <header className="border-b bg-background px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] text-lg font-semibold"
        >
          {t('name')}
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
          <AppNav role={role} />
          {user && (
            <UserWidget displayName={displayName} roleLabel={roleLabel} />
          )}
        </div>
      </div>
    </header>
  );
}
