import { getTranslations } from 'next-intl/server';
import GoogleSignInButton from './GoogleSignInButton';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

function getErrorMessage(
  errorCode: string | undefined,
  t: (key: string) => string
): string | null {
  if (!errorCode) return null;
  if (errorCode === 'access_denied') return t('errorAccessDenied');
  if (errorCode === 'exchange_failed') return t('errorExchangeFailed');
  return t('errorDefault');
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const t = await getTranslations('Auth');
  const tApp = await getTranslations('App');
  const errorMessage = getErrorMessage(error, t);

  return (
    <main
      className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-[0_6px_0_0_hsl(var(--brand)/55%)] dark:ring-1 dark:ring-header-border"
    >
      <div className="mb-8 text-center">
        <h1
          className="text-3xl font-bold uppercase tracking-wide"
          data-testid="login-app-name"
        >
          {tApp('name')}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground font-mono">
          {tApp('tagline')}
        </p>
      </div>

      {errorMessage && (
        <div
          aria-live="polite"
          data-testid="auth-error"
          className="mb-6 rounded-md bg-destructive px-4 py-3 text-sm text-destructive-foreground"
        >
          {errorMessage}
        </div>
      )}

      <GoogleSignInButton label={t('continueWithGoogle')} errorDefaultLabel={t('errorDefault')} />
    </main>
  );
}
