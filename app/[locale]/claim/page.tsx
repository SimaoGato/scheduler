import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
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
 *   4. STORY-29 AC2/AC3/AC5: if there are no unlinked+active person records,
 *      render an explanatory "nothing to claim yet" state (with a link back
 *      home) instead of silently redirecting. This only applies to
 *      direct/later navigation to this page — STORY-11 AC4's first-login
 *      auth-callback redirect decision (skip /claim entirely when nothing
 *      exists to claim) is unchanged; see app/auth/callback/route.ts.
 */
export default async function ClaimPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${routing.defaultLocale}/login`);
  }

  const serviceClient = createServiceClient();

  // AC5: a user who already has a linked person record never sees /claim.
  // This must NOT filter on is_active — the DB unique index (one
  // linked_user_id per user, migration 20260705000001) is keyed on any
  // non-null linked_user_id regardless of is_active, so this check must
  // match that invariant exactly. Filtering by is_active here would let a
  // user whose linked person was later deactivated see /claim again, only
  // to hit a confusing 409 already_linked when trying to claim someone else.
  const { data: existingLink, error: existingLinkError } = await serviceClient
    .from('people')
    .select('id')
    .eq('linked_user_id', user.id)
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

  const t = await getTranslations('Claim');

  // STORY-29 AC2/AC5: no unlinked+active person records exist — render an
  // explanatory state (not a silent redirect) instructing the Member to ask
  // an Admin to add them to the team or link an existing record. Includes an
  // explicit back-to-home link because this page's layout
  // (app/[locale]/claim/layout.tsx) is deliberately outside the (app)/
  // route group and renders no header/nav to fall back on.
  if (people.length === 0) {
    return (
      <main className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div
          data-testid="claim-no-records"
          aria-live="polite"
          className="text-center"
        >
          <h1 className="mb-2 text-2xl font-bold tracking-tight">{t('noRecordsTitle')}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{t('noRecordsDescription')}</p>
          <Link
            href="/"
            data-testid="claim-no-records-home-link"
            className="inline-flex min-h-[44px] items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t('noRecordsCta')}
          </Link>
        </div>
      </main>
    );
  }

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
