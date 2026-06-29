'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default function AppNav() {
  const t = useTranslations('Nav');
  return (
    <nav aria-label={t('ariaLabel')}>
      <ul className="flex gap-1">
        <li>
          <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
            <Link href="/">{t('home')}</Link>
          </Button>
        </li>
        {/* TODO(STORY-06): conditionally render this link for admin users only.
            AppNav currently has no access to the authenticated user's role —
            role-prop threading is deferred to the next story. The /admin/users
            page itself enforces the guard via requireAdmin, so this is a UX
            gap only, not an auth bypass. */}
        <li>
          <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
            <Link href="/admin/users">{t('userManagement')}</Link>
          </Button>
        </li>
      </ul>
    </nav>
  );
}
