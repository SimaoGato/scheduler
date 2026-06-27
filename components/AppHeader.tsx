import { useTranslations } from 'next-intl';
import AppNav from './AppNav';

export default function AppHeader() {
  const t = useTranslations('App');
  return (
    <header className="border-b bg-background px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <span className="text-lg font-semibold">{t('name')}</span>
        <AppNav />
      </div>
    </header>
  );
}
