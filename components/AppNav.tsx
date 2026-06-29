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
        <li>
          <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
            <Link href="/admin/users">{t('userManagement')}</Link>
          </Button>
        </li>
      </ul>
    </nav>
  );
}
