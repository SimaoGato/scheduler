# CHORE-12: Web App Manifest for "Add to Home Screen" installability
Epic: maintenance
Status: draft
Priority: low

## Task statement
Add a Web App Manifest so users can install/add the app to their phone's home
screen and launch it like a native app (own icon, no browser address bar),
without building full offline support.

## Context
The user asked whether it's possible to make the app installable on a phone
instead of always going through the browser. Confirmed via grep: there is
currently no `manifest.ts`/`manifest.json`, no service worker, and no
PWA-related dependency anywhere in the repo — this is greenfield.

Next.js has a built-in metadata-file convention for this:
`app/manifest.ts` exporting a `MetadataRoute.Manifest` object, which Next
serves at `/manifest.webmanifest` and automatically links from `<head>` — no
extra wiring needed in `app/layout.tsx`.

**Scope check (important):** a manifest alone gives installability (icon on
home screen, standalone launch, splash screen) but does **not** give offline
support — that requires a service worker with caching strategies, which is a
meaningfully bigger undertaking (cache invalidation, stale-data handling for
an app backed by live Supabase data). Since this is an always-online
scheduling tool (no value in viewing a schedule offline with stale data), a
full offline-capable PWA is deliberately not being proposed — installability
alone addresses what the user asked for (avoiding the browser chrome/URL bar,
having an icon to tap) without the complexity and staleness risk of
offline caching.

## Acceptance criteria
1. Given the app is deployed, when a user visits it on Chrome/Android or
   Safari/iOS and uses "Add to Home Screen", then an icon with the app's name
   ("Escala") is added, and launching it opens in `display: "standalone"`
   mode (no browser address bar/tabs UI).
2. Given `app/manifest.ts`, when inspected, then it defines at minimum:
   `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`,
   `background_color`, and an `icons` array with at least a 192x192 and
   512x512 PNG.
3. Given the manifest's `start_url`, when the installed app is launched, then
   it opens to the locale-aware home route (e.g. `/pt-PT/`), consistent with
   the existing `localePrefix: 'always'` routing — not an unprefixed `/`
   that would trigger a redirect on every cold launch.
4. Given `npm run lint && npx tsc --noEmit && npm run build`, then all exit 0.
5. Given the manifest is served, when checked, then `/manifest.webmanifest`
   returns a valid JSON manifest (Next.js's automatic route from
   `app/manifest.ts`).

## Out of scope
- Offline support / service worker / cache-first strategies — deliberately
  excluded per the Context section reasoning (stale-schedule-data risk,
  added complexity, not what was asked for).
- Push notifications (a separate, much larger feature if ever wanted).
- Custom install-prompt UI (e.g. a banner nudging users to install) — rely on
  each browser's native install affordance for v1.
- Per-platform native app wrappers (Capacitor, etc.) — out of scope entirely;
  this is a manifest-only web-standard approach.

## Technical notes
- Create `app/manifest.ts`:
  ```ts
  import type { MetadataRoute } from 'next';

  export default function manifest(): MetadataRoute.Manifest {
    return {
      name: 'Escala',
      short_name: 'Escala',
      start_url: '/pt-PT/',
      display: 'standalone',
      background_color: '#...',
      theme_color: '#...',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    };
  }
  ```
- `theme_color`/`background_color` should match the existing design tokens in
  `app/globals.css` (`:root` light block) for visual consistency with the
  splash screen Android/iOS generate on launch.
- Icons: need to be generated/exported (192x192 and 512x512 PNG at minimum;
  a maskable variant is a nice-to-have, not required for v1) and placed in
  `public/`. No existing app icon/logo asset was found in this investigation
  — flag to the user that source artwork (the "Escala" mark) is needed before
  this can ship; this is a **human input needed**, not something to invent.
- No changes needed to `app/layout.tsx` — Next.js auto-links the manifest.
- Complexity: **trivial** once icon artwork exists; mechanical single-file
  change otherwise.

## Definition of Done
See CLAUDE.md.
