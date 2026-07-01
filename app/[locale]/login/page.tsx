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
  const errorMessage = getErrorMessage(error, t);

  return (
    <main className="w-full max-w-sm px-4">
      <h1 className="text-2xl font-semibold mb-6">{t('signInTitle')}</h1>

      {errorMessage && (
        <div
          role="alert"
          data-testid="auth-error"
          className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      <GoogleSignInButton label={t('continueWithGoogle')} errorDefaultLabel={t('errorDefault')} />
    </main>
  );
}
