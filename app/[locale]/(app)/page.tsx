import { getTranslations, getFormatter } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSessionUser, getUserRole } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveSelfPersonId } from '@/lib/people/resolve-self';
import { getBlockedDates } from '@/lib/availability/blocked-dates';
import { getUpcomingSundays } from '@/lib/availability/upcoming-sundays';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface PageProps {
  // Next.js 16: searchParams is a Promise
  searchParams: Promise<{ denied?: string }>;
}

// STORY-30: matches the horizon value app/[locale]/(app)/availability/page.tsx
// already uses internally. Deliberately a local, unexported constant — that
// file is out of scope for this story and must not be touched or imported
// from here.
const SUNDAY_HORIZON = 12;

export default async function HomePage({ searchParams }: PageProps) {
  const m = await getTranslations('Member');

  // searchParams is a Promise in Next.js 16
  const { denied } = await searchParams;

  const user = await getSessionUser();

  let role: 'admin' | 'member' | null = null;
  if (user) {
    role = await getUserRole(user.id);
  }

  // AC4: Show a specific access-denied banner when redirected from an admin route.
  // Suppress for admins — they are never actually denied, so the banner would be misleading.
  const showDeniedBanner = denied === '1' && role !== 'admin';

  // AC1: Authenticated member (or user with no role due to DB provisioning failure)
  // AC4 warning 4: if user is set but role is null, show an error — do NOT silently
  //   show the same "no access yet" view as a legitimate member.
  if (user && role === null) {
    return (
      <main className="flex-1 container mx-auto px-4 py-8">
        {showDeniedBanner && (
          <div
            data-testid="access-denied-banner"
            aria-live="polite"
            className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {m('accessDenied')}
          </div>
        )}
        <p
          data-testid="no-role-error"
          aria-live="polite"
          className="text-sm text-destructive"
        >
          {m('noRoleError')}
        </p>
      </main>
    );
  }

  // STORY-30: Member home becomes a personal availability quick-overview,
  // replacing the previous static "no access yet" message (superseding
  // STORY-28). Mirrors app/[locale]/(app)/availability/page.tsx's
  // resolveSelfPersonId + getBlockedDates usage, but does not modify that
  // file (explicitly out of scope).
  if (user && role === 'member') {
    const serviceClient = createServiceClient();
    const { personId, error: resolveError } = await resolveSelfPersonId(serviceClient, user.id);

    if (resolveError) {
      console.error('[HomePage] resolveSelfPersonId error:', resolveError);
      const av = await getTranslations('Availability');
      return (
        <main className="flex-1 container mx-auto px-4 py-8">
          {showDeniedBanner && (
            <div
              data-testid="access-denied-banner"
              aria-live="polite"
              className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {m('accessDenied')}
            </div>
          )}
          <p data-testid="home-availability-load-error">{av('loadError')}</p>
        </main>
      );
    }

    if (personId === null) {
      // AC2: no linked person — reuse the same STORY-26 AC7 / STORY-29
      // /claim messaging, not new duplicate copy.
      const av = await getTranslations('Availability');
      return (
        <main className="flex-1 container mx-auto px-4 py-8">
          {showDeniedBanner && (
            <div
              data-testid="access-denied-banner"
              aria-live="polite"
              className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {m('accessDenied')}
            </div>
          )}
          <div data-testid="home-no-linked-person">
            <h1 className="mb-2 text-2xl font-semibold">{av('noLinkedPersonTitle')}</h1>
            <p className="mb-6 text-sm text-muted-foreground">{av('noLinkedPersonDescription')}</p>
            <Link
              href="/claim"
              className="inline-flex min-h-[44px] items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {av('noLinkedPersonCta')}
            </Link>
          </div>
        </main>
      );
    }

    // AC1: linked person — summary of available vs. blocked Sundays within
    // the same 12-Sunday horizon as the Availability page.
    const sundays = getUpcomingSundays(SUNDAY_HORIZON);

    const { data, error } = await getBlockedDates(serviceClient, {
      personIds: [personId],
      dateFrom: sundays[0],
      dateTo: sundays.at(-1),
    });

    if (error) {
      console.error('[HomePage] getBlockedDates error:', error);
    }

    const blockedSet = new Set((data ?? []).map((row) => row.blocked_date));
    const blockedCount = blockedSet.size;
    const availableCount = SUNDAY_HORIZON - blockedCount;
    // sundays is ascending, so .find gives the earliest blocked date.
    const nextBlocked = sundays.find((s) => blockedSet.has(s)) ?? null;

    const format = await getFormatter();
    const formattedNextBlocked =
      nextBlocked !== null
        ? (() => {
            const [year, month, day] = nextBlocked.split('-').map(Number);
            return format.dateTime(new Date(Date.UTC(year, month - 1, day)), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            });
          })()
        : null;

    const h = await getTranslations('Home');

    return (
      <main className="flex-1 container mx-auto px-4 py-8">
        {showDeniedBanner && (
          <div
            data-testid="access-denied-banner"
            aria-live="polite"
            className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {m('accessDenied')}
          </div>
        )}
        <Card data-testid="member-availability-summary">
          <CardHeader>
            <CardTitle>
              <h1 className="text-2xl font-semibold">{h('memberSummaryTitle')}</h1>
            </CardTitle>
            <CardDescription>
              {h('memberSummaryIntro', { total: SUNDAY_HORIZON })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="mb-4 flex flex-wrap gap-6">
              <li>
                <p className="text-sm font-semibold">
                  {h.rich('memberSummaryAvailableCount', {
                    count: availableCount,
                    num: (chunks) => (
                      <span data-testid="member-available-numeral" className="font-mono text-3xl font-bold">
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
              </li>
              <li>
                <p className="text-sm font-semibold">
                  {h.rich('memberSummaryBlockedCount', {
                    count: blockedCount,
                    num: (chunks) => (
                      <span data-testid="member-blocked-numeral" className="font-mono text-3xl font-bold">
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
              </li>
            </ul>
            {formattedNextBlocked !== null ? (
              <p className="text-sm">
                {h.rich('memberSummaryNextBlocked', {
                  date: formattedNextBlocked,
                  num: (chunks) => (
                    <span data-testid="member-next-blocked-date" className="font-mono font-medium">
                      {chunks}
                    </span>
                  ),
                })}
              </p>
            ) : (
              // AC4 neutral-framing principle applies here too: zero blocks is
              // good news for a Member, not an incomplete state.
              <p className="text-sm">
                {h('memberSummaryNoUpcomingBlocks', { total: SUNDAY_HORIZON })}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Link
              href="/availability"
              className="inline-flex min-h-[44px] items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {h('memberSummaryLink')}
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  // Admin view (role === 'admin') or unauthenticated fallback (user === null,
  // proxy.ts ensures only admins or CI placeholder-cred runs reach here).
  // Load Home translations only here — the member/no-role branches above never use them.
  const t = await getTranslations('Home');
  const nav = await getTranslations('Nav');

  // STORY-30: lightweight team-composition summary + quick links, replacing
  // the previous static welcome/description/disabled-CTA (superseding
  // CHORE-16). Each query is independent (own try/catch) so a single
  // failure only omits that one stat rather than crashing the whole page.
  let activePeopleIds: string[] | null = null;
  let activeRolesCount: number | null = null;

  try {
    const serviceClient = createServiceClient();
    const { data: activePeople, error: peopleError } = await serviceClient
      .from('people')
      .select('id')
      .eq('is_active', true);

    if (peopleError) {
      console.error('[HomePage] active people query error:', peopleError);
    } else {
      activePeopleIds = (activePeople ?? []).map((row) => row.id as string);
    }
  } catch (err) {
    console.error('[HomePage] active people query unexpected error:', err);
  }

  try {
    const serviceClient = createServiceClient();
    const { count, error: rolesError } = await serviceClient
      .from('roles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (rolesError) {
      console.error('[HomePage] active roles query error:', rolesError);
    } else {
      activeRolesCount = count ?? null;
    }
  } catch (err) {
    console.error('[HomePage] active roles query unexpected error:', err);
  }

  // AC4: "N pessoas com bloqueios registados nos próximos 30 dias" — must be
  // scoped to *active* people ids (Revision cycle 1 fix). Soft-deleting a
  // person never cascades away their blocked_dates rows (CLAUDE.md's
  // documented "soft-delete does NOT cascade" gap, STORY-19), so querying
  // blocked_dates unfiltered would let a soft-deleted person's stale blocks
  // inflate this count. If activePeopleIds is null/empty (query failed or
  // genuinely zero active people), skip the query and render nothing for
  // this stat — an empty personIds array would otherwise misleadingly
  // return zero rather than "unknown".
  let blocksNext30Days: number | null = null;

  if (activePeopleIds !== null && activePeopleIds.length > 0) {
    try {
      const serviceClient = createServiceClient();
      const now = new Date();
      const dateFrom = now.toISOString().slice(0, 10);
      const dateTo = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30)
      )
        .toISOString()
        .slice(0, 10);

      const { data, error } = await getBlockedDates(serviceClient, {
        personIds: activePeopleIds,
        dateFrom,
        dateTo,
      });

      if (error) {
        console.error('[HomePage] blocks-next-30-days query error:', error);
      } else {
        blocksNext30Days = new Set((data ?? []).map((row) => row.person_id)).size;
      }
    } catch (err) {
      console.error('[HomePage] blocks-next-30-days query unexpected error:', err);
    }
  }

  const activePeopleCount = activePeopleIds !== null ? activePeopleIds.length : null;

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      {showDeniedBanner && (
        <div
          data-testid="access-denied-banner"
          aria-live="polite"
          className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {m('accessDenied')}
        </div>
      )}

      <Card data-testid="admin-team-summary" className="mb-6">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold">{t('adminSummaryTitle')}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {activePeopleCount !== null && (
              <li
                data-testid="admin-active-people-hero"
                className="rounded-lg bg-brand p-5 text-brand-foreground shadow-[0_4px_0_0_hsl(var(--brand)/55%)]"
              >
                <p className="text-sm font-semibold">
                  {t.rich('adminActivePeopleCount', {
                    count: activePeopleCount,
                    num: (chunks) => (
                      <span
                        data-testid="admin-active-people-numeral"
                        className="font-mono text-4xl font-bold sm:text-5xl"
                      >
                        {chunks}
                      </span>
                    ),
                  })}
                </p>
              </li>
            )}
            {activeRolesCount !== null && (
              <li className="rounded-lg border p-5">
                <p className="text-sm font-semibold">
                  {t.rich('adminActiveRolesCount', {
                    count: activeRolesCount,
                    num: (chunks) => <span className="font-mono text-3xl font-bold">{chunks}</span>,
                  })}
                </p>
              </li>
            )}
            <li data-testid="admin-blocks-next-30-days" className="rounded-lg border p-5 text-sm">
              {blocksNext30Days !== null &&
                t.rich('adminBlocksNext30Days', {
                  count: blocksNext30Days,
                  num: (chunks) => <span className="font-mono text-3xl font-bold">{chunks}</span>,
                })}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card data-testid="admin-quick-links">
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">{t('quickLinksTitle')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 min-w-0">
            <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
              <Link href="/admin/people">{nav('people')}</Link>
            </Button>
            <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
              <Link href="/admin/roles">{nav('roles')}</Link>
            </Button>
            <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
              <Link href="/admin/users">{nav('userManagement')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
