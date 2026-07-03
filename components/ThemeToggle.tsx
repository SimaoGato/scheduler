'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type ThemeChoice = 'system' | 'light' | 'dark';

// The external "store" here never actually changes — there is nothing to
// subscribe to — so `subscribe` is a no-op unsubscribe. What we're using
// useSyncExternalStore for is its *hydration contract*: React uses
// `getServerSnapshot` for both the server render and the client's initial
// hydration render (so they match, no mismatch), then performs one
// client-only re-render using `getSnapshot` right after hydration commits.
// That gives us a `mounted` boolean that is guaranteed false during/through
// hydration and true only in a post-hydration render — without a manual
// `setState` call inside a `useEffect` body (flagged by
// react-hooks/set-state-in-effect, and more importantly the reason the
// previous `theme === undefined` check didn't work: it wasn't gated to a
// post-hydration render at all).
function subscribe() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}
function useMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

/**
 * ThemeToggle — 3-way System/Light/Dark control on the settings page
 * (CHORE-11). Built on next-themes' useTheme() + the existing Button
 * component (no new shadcn install).
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('Settings');
  const mounted = useMounted();

  const options: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: t('themeSystem') },
    { value: 'light', label: t('themeLight') },
    { value: 'dark', label: t('themeDark') },
  ];

  if (!mounted) {
    return <div className="h-[44px] w-full max-w-sm" aria-hidden="true" />;
  }

  return (
    <div className="flex items-center gap-2" role="group">
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
