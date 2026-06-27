import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('Home');
  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <p className="text-base">{t('welcome')}</p>
      <p className="mt-2 text-sm text-gray-500">{t('description')}</p>
    </main>
  );
}
