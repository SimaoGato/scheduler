import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function AppNav() {
  const t = useTranslations('Nav');
  return (
    <nav aria-label={t('ariaLabel')}>
      <ul className="flex gap-4 text-sm">
        <li>
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            {t('home')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
