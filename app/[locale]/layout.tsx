import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import ThemeCookieSync from '@/components/ThemeCookieSync';
import { routing } from '@/i18n/routing';
import { spaceGrotesk, jetbrainsMono } from '@/lib/fonts';
import { THEME_COOKIE_NAME } from '@/lib/theme/theme-cookie';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
  const messages = await getMessages({ locale });
  // CHORE-13: read the resolved-theme cookie (kept in sync with next-themes'
  // resolvedTheme by <ThemeCookieSync>) so the SSR'd <html> element always
  // carries the correct class — including on the RSC fetch behind a soft
  // cross-locale navigation, where this layout re-renders <html> without
  // next-themes' pre-hydration blocking script running again.
  const cookieStore = await cookies();
  const isDarkFromCookie = cookieStore.get(THEME_COOKIE_NAME)?.value === 'dark';
  // CHORE-23: compose the <html> className from font variables (always
  // present) + the conditional dark class, via a plain array-join — not
  // cn()/twMerge, to avoid any risk of twMerge misinterpreting the hashed
  // font-variable class names. Matches Next.js's own documented multi-font
  // pattern.
  const htmlClassName = [spaceGrotesk.variable, jetbrainsMono.variable, isDarkFromCookie ? 'dark' : null]
    .filter(Boolean)
    .join(' ');
  return (
    <html lang={locale} className={htmlClassName} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeCookieSync />
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
