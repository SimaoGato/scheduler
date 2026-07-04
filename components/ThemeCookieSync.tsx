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
    document.cookie = `${THEME_COOKIE_NAME}=${resolvedTheme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax; Secure`;

    // Defensive readback, mirrors components/UserWidgetMenu.tsx's
    // SIGNOUT_MARKER_COOKIE write: `Secure` means the browser silently
    // no-ops the write outside a secure context (fine on production HTTPS
    // and on Chromium/Firefox against http://localhost, but not guaranteed
    // in every environment). If the cookie didn't actually get set, the
    // layout's SSR read falls back to its cold-load default and the
    // original flash can reappear on the next soft navigation. Log loudly
    // so that failure is visible instead of silent.
    if (!document.cookie.includes(`${THEME_COOKIE_NAME}=${resolvedTheme}`)) {
      console.error(
        '[ThemeCookieSync] Theme cookie was not set (non-secure context or ' +
          'cookies blocked?). The dark-theme flash fix may not apply on the ' +
          'next soft navigation.'
      );
    }
  }, [resolvedTheme]);

  return null;
}
