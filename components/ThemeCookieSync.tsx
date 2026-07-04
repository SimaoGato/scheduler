'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { THEME_COOKIE_MAX_AGE_SECONDS, THEME_COOKIE_NAME } from '@/lib/theme/theme-cookie';

/**
 * ThemeCookieSync — CHORE-13: keeps a first-party cookie in step with
 * next-themes' resolvedTheme ('light' | 'dark', never the literal
 * 'system'), so app/[locale]/layout.tsx can render the correct `.dark`
 * class server-side on every request — including the RSC fetch behind a
 * soft cross-locale navigation, where the layout's <html> element is
 * re-rendered and next-themes' post-mount effect would otherwise leave at
 * least one frame with no theme class applied.
 *
 * Renders nothing. Runs on mount and on every subsequent resolvedTheme
 * change (explicit toggle, OS preference change, cross-tab storage sync).
 */
export default function ThemeCookieSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    document.cookie = `${THEME_COOKIE_NAME}=${resolvedTheme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }, [resolvedTheme]);

  return null;
}
