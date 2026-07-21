import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getSessionUser, getUserProfile } from '@/lib/auth/session';
import { signOut } from '@/app/[locale]/login/actions';
import { Card, CardContent } from '@/components/ui/card';
import SettingsRow from '@/components/SettingsRow';
import SettingsSignOutButton from '@/components/SettingsSignOutButton';
import DisplayNameForm from '@/components/DisplayNameForm';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';

// CHORE-31: local, unexported duplicate of CHORE-30's UserTable.tsx
// getInitials helper. Per CLAUDE.md's scope-firewall precedent (STORY-30),
// UserTable.tsx is not a primary file for this story, so this small
// computation is duplicated locally rather than exported/imported across a
// file this story doesn't otherwise touch.
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

/**
 * /[locale]/settings — Account settings page (STORY-21, redesigned CHORE-31).
 *
 * Belt-and-suspenders auth guard (same convention as the admin pages):
 *   1. proxy.ts already redirects unauthenticated visitors before this
 *      renders (AC7).
 *   2. This page additionally redirects to /login if somehow reached
 *      without a session.
 *
 * CHORE-31: rewritten as a profile card + a preferences Card of SettingsRows
 * + a full-width sign-out button, replacing the previous bare stacked
 * <section>s. The <h1>{t('title')}</h1> below is retained byte-identical
 * (same classes, same position: first child of <main>) — resolves Challenge
 * cycle 1's CRITICAL finding that a full-rewrite plan risked silently
 * dropping it; e2e/language-switcher.spec.ts AC4 depends on this heading.
 */
export default async function SettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${routing.defaultLocale}/login`);
  }

  const profile = await getUserProfile(user.id);
  const t = await getTranslations('Settings');
  const tAuth = await getTranslations('Auth');

  // AC2: the Google name is a placeholder-only default — never silently
  // auto-saved. The input's actual value is the DB display_name, which may
  // be empty.
  const googleName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    '';

  // Effective display-name fallback chain, mirroring AppHeader.tsx's inline
  // computation (profile.displayName || googleName || user.email ||
  // userFallback) — duplicated locally here (same scope-firewall reasoning
  // as getInitials above) since the profile card needs a never-blank name.
  const effectiveDisplayName =
    profile?.displayName && profile.displayName !== ''
      ? profile.displayName
      : googleName || user.email || tAuth('userFallback');
  const initials = getInitials(effectiveDisplayName);

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">{t('title')}</h1>
      <div className="flex flex-col gap-6 max-w-2xl">
        <Card data-testid="settings-profile-card">
          <CardContent className="flex items-center gap-4">
            <span
              aria-hidden="true"
              data-testid="settings-profile-avatar"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-base font-bold text-primary-foreground"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold" data-testid="settings-profile-name">
                {effectiveDisplayName}
              </p>
              <p
                className="truncate font-mono text-sm text-muted-foreground"
                data-testid="settings-profile-email"
              >
                {user.email ?? ''}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="settings-preferences-card" className="gap-0 divide-y divide-border py-0">
          <SettingsRow title={t('nameLabel')} description={t('nameRowDescription')}>
            <DisplayNameForm
              initialDisplayName={profile?.displayName ?? ''}
              googleNamePlaceholder={googleName}
            />
          </SettingsRow>
          <SettingsRow title={t('languageLabel')} description={t('languageRowDescription')}>
            <LanguageSwitcher />
          </SettingsRow>
          <SettingsRow title={t('themeSectionTitle')} description={t('themeRowDescription')}>
            <ThemeToggle />
          </SettingsRow>
        </Card>

        <SettingsSignOutButton label={tAuth('signOut')} signOutAction={signOut} />
      </div>
    </main>
  );
}
