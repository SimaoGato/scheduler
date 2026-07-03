// STORY-15: shared constants for the sign-out marker cookie mechanism.
//
// This module is imported from a middleware file (proxy.ts), a client
// component (components/UserWidgetMenu.tsx), and a Route Handler
// (app/auth/callback/route.ts). Keep it a plain constants module with no
// server-only or client-only restrictions so all three can import it.
//
// See proxy.ts for the read side, components/UserWidgetMenu.tsx for the
// write side, and app/auth/callback/route.ts for where the marker is
// cleared again on the next successful login.
export const SIGNOUT_MARKER_COOKIE = 'app-signout-pending';

// Bounds how long a hung/failed real signOut() call (see actions.ts's
// try/catch + console.error) can keep proxy.ts's auth guard in the
// stricter (forced-signed-out) treatment.
export const SIGNOUT_MARKER_MAX_AGE_SECONDS = 15;
