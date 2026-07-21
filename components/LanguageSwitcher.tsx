'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const LOCALE_LABELS: Record<string, string> = { 'pt-PT': 'PT', en: 'EN' };

/**
 * LanguageSwitcher — settings-page control to switch between pt-PT and en
 * (CHORE-06). Renders on /[locale]/settings only (see story's "Placement
 * update"); not surfaced in AppHeader/AppNav/UserWidgetMenu.
 *
 * CHORE-31: no longer renders its own <section>/<h2> title wrapper —
 * SettingsRow (the caller) now supplies the row's title/description. This
 * component's only rendered output is the control itself; testids/aria-labels
 * on the two chips are unchanged.
 */
export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname(); // locale-agnostic, e.g. "/settings"
  const t = useTranslations('Settings');
  const otherLocale = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;
  const switchLabel = otherLocale === 'en' ? t('switchToEnglish') : t('switchToPortuguese');
  const otherLocaleLabel = LOCALE_LABELS[otherLocale] ?? otherLocale;

  return (
    <div className="flex items-center gap-2" role="group">
      <span
        data-testid="language-switcher-current"
        aria-current="true"
        className="min-h-[44px] inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium bg-accent"
      >
        {LOCALE_LABELS[locale] ?? locale}
      </span>
      <Link
        href={pathname}
        locale={otherLocale}
        data-testid="language-switcher-link"
        aria-label={`${otherLocaleLabel} — ${switchLabel}`}
        className="min-h-[44px] inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        {otherLocaleLabel}
      </Link>
    </div>
  );
}
