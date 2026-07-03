import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import AppNav from './AppNav';
import UserWidget from './UserWidget';
import { getSessionUser, getUserRole } from '@/lib/auth/session';

export default async function AppHeader() {
  const t = await getTranslations('App');
  const tAuth = await getTranslations('Auth');

  const user = await getSessionUser();

  let role: 'admin' | 'member' | null = null;
  let roleLabel: string | null = null;
  if (user) {
    role = await getUserRole(user.id);
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
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] text-lg font-semibold"
        >
          {t('name')}
        </Link>
        <div className="flex items-center gap-4">
          <AppNav role={role} />
          {user && (
            <UserWidget displayName={displayName} roleLabel={roleLabel} />
          )}
        </div>
      </div>
    </header>
  );
}
