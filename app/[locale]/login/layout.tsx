import { getTranslations } from 'next-intl/server';

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('App');
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6"
      data-testid="login-centering-root"
    >
      <span
        className="text-2xl font-semibold"
        data-testid="login-app-name"
      >
        {t('name')}
      </span>
      {children}
    </div>
  );
}
