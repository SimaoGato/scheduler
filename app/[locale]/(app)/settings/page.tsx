import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getSessionUser, getUserProfile } from '@/lib/auth/session';
import DisplayNameForm from '@/components/DisplayNameForm';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';

/**
 * /[locale]/settings — Account settings page (STORY-21).
 *
 * Belt-and-suspenders auth guard (same convention as the admin pages):
 *   1. proxy.ts already redirects unauthenticated visitors before this
 *      renders (AC7).
 *   2. This page additionally redirects to /login if somehow reached
 *      without a session.
 */
export default async function SettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${routing.defaultLocale}/login`);
  }

  const profile = await getUserProfile(user.id);
  const t = await getTranslations('Settings');

  // AC2: the Google name is a placeholder-only default — never silently
  // auto-saved. The input's actual value is the DB display_name, which may
  // be empty.
  const googleName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    '';

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">{t('title')}</h1>
      <div className="flex flex-col gap-8">
        <DisplayNameForm
          initialDisplayName={profile?.displayName ?? ''}
          googleNamePlaceholder={googleName}
        />
        <LanguageSwitcher />
        <section aria-labelledby="theme-section-title" className="flex flex-col gap-3 max-w-sm">
          <h2 id="theme-section-title" className="text-sm font-medium">
            {t('themeSectionTitle')}
          </h2>
          <ThemeToggle />
        </section>
      </div>
    </main>
  );
}
