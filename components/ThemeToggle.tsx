'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type ThemeChoice = 'system' | 'light' | 'dark';

/**
 * ThemeToggle — 3-way System/Light/Dark control on the settings page
 * (CHORE-11). Built on next-themes' useTheme() + the existing Button
 * component (no new shadcn install).
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('Settings');

  const options: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: t('themeSystem') },
    { value: 'light', label: t('themeLight') },
    { value: 'dark', label: t('themeDark') },
  ];

  // next-themes cannot know the resolved theme on the server, so `theme` is
  // undefined until mounted (after the pre-hydration script has run). Render
  // a same-size placeholder until then to avoid a hydration mismatch and
  // layout shift — no separate mounted-state effect needed since `theme`
  // itself already carries this information.
  if (theme === undefined) {
    return <div className="h-[44px] w-full max-w-sm" aria-hidden="true" />;
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('themeSectionTitle')}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={theme === option.value ? 'default' : 'outline'}
          size="sm"
          aria-pressed={theme === option.value}
          data-testid={`theme-toggle-${option.value}`}
          onClick={() => setTheme(option.value)}
          className="min-h-[44px] min-w-[44px]"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
