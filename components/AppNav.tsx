'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  role: 'admin' | 'member' | null;
}

export default function AppNav({ role }: Props) {
  const t = useTranslations('Nav');
  // STORY-26: Availability is the first Member-facing nav item; the empty-
  // landmark rule (STORY-16) still applies for a null/unrecognized role
  // (e.g. a provisioning-failure edge case).
  if (role !== 'admin' && role !== 'member') return null;
  return (
    <nav aria-label={t('ariaLabel')} className="min-w-0">
      <ul className="flex flex-wrap justify-end gap-1">
        <li>
          <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
            <Link href="/availability">{t('availability')}</Link>
          </Button>
        </li>
        {role === 'admin' && (
          <>
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
            <li>
              <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
                <Link href="/admin/roles">{t('roles')}</Link>
              </Button>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
