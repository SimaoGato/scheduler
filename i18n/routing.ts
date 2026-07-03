import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['pt-PT', 'en'],
  defaultLocale: 'pt-PT',
  localePrefix: 'always',
  // Required to keep the "no auto-detection of browser locale" requirement
  // intact now that there are two locales. Without this, next-intl's
  // Accept-Language negotiation would auto-redirect `/` to `/en/` for
  // browsers sending an en-preferring header, instead of always defaulting
  // to pt-PT.
  localeDetection: false,
});
