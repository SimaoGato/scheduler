'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  role: 'admin' | 'member' | null;
}

export default function AppNav({ role }: Props) {
  const t = useTranslations('Nav');
  if (role !== 'admin') return null;
  return (
    <nav aria-label={t('ariaLabel')}>
      <ul className="flex gap-1">
        <li>
          <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
            <Link href="/admin/users">{t('userManagement')}</Link>
          </Button>
        </li>
        <li>
          <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
            <Link href="/admin/people">{t('people')}</Link>
          </Button>
        </li>
      </ul>
    </nav>
  );
}
