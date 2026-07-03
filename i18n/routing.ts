import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['pt-PT', 'en'],
  defaultLocale: 'pt-PT',
  localePrefix: 'always',
  localeDetection: false,
});
