import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/i18n/routing';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const defaultLocale = routing.defaultLocale;

  if (error) {
    const encodedError = encodeURIComponent(error);
    return NextResponse.redirect(
      new URL(`/${defaultLocale}/login?error=${encodedError}`, request.url)
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return NextResponse.redirect(new URL(`/${defaultLocale}/`, request.url));
    }

    return NextResponse.redirect(
      new URL(`/${defaultLocale}/login?error=exchange_failed`, request.url)
    );
  }

  // Fallback: no code, no error
  return NextResponse.redirect(new URL(`/${defaultLocale}/login`, request.url));
}
