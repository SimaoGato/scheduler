import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import ClaimPersonForm from '@/components/ClaimPersonForm';

/**
 * /[locale]/claim — Claim an existing unlinked person record on first login
 * (STORY-11).
 *
 * Belt-and-suspenders guards (defense-in-depth against direct navigation,
 * mirrors the /settings page convention):
 *   1. proxy.ts already redirects unauthenticated visitors before this
 *      renders.
 *   2. This page additionally redirects to /login if somehow reached
 *      without a session.
 *   3. AC5: if the caller already has a linked person record, redirect home
 *      — the claim page is never shown to a user who is already linked.
 *   4. AC4/AC7: if there are no unlinked+active person records, redirect
 *      home — nothing to claim.
 */
export default async function ClaimPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${routing.defaultLocale}/login`);
  }

  const serviceClient = createServiceClient();

  // AC5: a user who already has a linked person record never sees /claim.
  const { data: existingLink, error: existingLinkError } = await serviceClient
    .from('people')
    .select('id')
    .eq('linked_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (existingLinkError) {
    console.error('[ClaimPage] existing-link check DB error:', existingLinkError);
  }

  if (existingLink) {
    redirect(`/${routing.defaultLocale}/`);
  }

  // AC4/AC7: only unlinked + active people are eligible to be claimed.
  const { data, error } = await serviceClient
    .from('people')
    .select('id, name')
    .is('linked_user_id', null)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[ClaimPage] unlinked-people fetch DB error:', error);
  }

  const people = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));

  if (people.length === 0) {
    redirect(`/${routing.defaultLocale}/`);
  }

  const t = await getTranslations('Claim');

  return (
    <main className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="claim-title">
          {t('title')}
        </h1>
      </div>
      <ClaimPersonForm people={people} />
    </main>
  );
}
