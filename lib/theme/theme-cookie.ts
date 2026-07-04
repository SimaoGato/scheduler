// CHORE-13: shared constants for the resolved-theme cookie mechanism.
//
// This module is imported from a Server Component (app/[locale]/layout.tsx),
// a client component (components/ThemeCookieSync.tsx), and e2e tests. Keep
// it a plain constants module with no server-only or client-only imports so
// all three can import it — mirrors lib/auth/signout-marker.ts.
//
// The cookie name is deliberately distinct from next-themes' own
// localStorage key ('theme') to avoid confusion between the two storage
// mechanisms. The cookie always stores the *resolved* value ('light' or
// 'dark'), never the literal string 'system' — see
// components/ThemeCookieSync.tsx for the write side and
// app/[locale]/layout.tsx for the read side.
export const THEME_COOKIE_NAME = 'resolved-theme';

// One year, matching common "remember this preference" cookie lifetimes.
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
