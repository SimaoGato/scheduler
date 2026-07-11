import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Link } from '@/i18n/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveSelfPersonId } from '@/lib/people/resolve-self'
import { getBlockedDates } from '@/lib/availability/blocked-dates'
import { getUpcomingSundays } from '@/lib/availability/upcoming-sundays'
import AvailabilityToggleList from '@/components/AvailabilityToggleList'

const SUNDAY_HORIZON = 12

/**
 * /[locale]/availability — Member-facing "block/unblock upcoming Sundays"
 * page (STORY-26 Server Component).
 *
 * Belt-and-suspenders auth guard (defensive; proxy.ts already guards this):
 * redirects to /login if somehow reached without a session.
 *
 * Design decision 7: the no-linked-person (AC7) and load-error branches are
 * both rendered entirely server-side — no client interactivity needed for
 * either — mirroring app/[locale]/claim/page.tsx's all-server-side branch
 * handling.
 *
 * Lazy-load rule: getTranslations('Availability') is only called for these
 * two server-rendered branches. The happy-path strings live in the Client
 * Component (AvailabilityToggleList), which calls useTranslations itself.
 */
export default async function AvailabilityPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect(`/${routing.defaultLocale}/login`)
  }

  const serviceClient = createServiceClient()

  const { personId, error: resolveError } = await resolveSelfPersonId(serviceClient, user.id)

  if (resolveError) {
    console.error('[AvailabilityPage] resolveSelfPersonId error:', resolveError)
    const t = await getTranslations('Availability')
    return (
      <main className="container mx-auto px-4 py-8">
        <p data-testid="availability-load-error">{t('loadError')}</p>
      </main>
    )
  }

  if (personId === null) {
    const t = await getTranslations('Availability')
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold">{t('noLinkedPersonTitle')}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t('noLinkedPersonDescription')}</p>
        <Link
          href="/claim"
          className="inline-flex min-h-[44px] items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {t('noLinkedPersonCta')}
        </Link>
      </main>
    )
  }

  const sundays = getUpcomingSundays(SUNDAY_HORIZON)

  const { data, error } = await getBlockedDates(serviceClient, {
    personIds: [personId],
    dateFrom: sundays[0],
    dateTo: sundays.at(-1),
  })

  if (error) {
    console.error('[AvailabilityPage] getBlockedDates error:', error)
  }

  const initialBlockedDates = (data ?? []).map((row) => row.blocked_date)

  return (
    <main className="container mx-auto px-4 py-8">
      <AvailabilityToggleList sundays={sundays} initialBlockedDates={initialBlockedDates} />
    </main>
  )
}
