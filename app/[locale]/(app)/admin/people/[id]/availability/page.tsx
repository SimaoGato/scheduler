import { notFound, redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getSessionUser, getUserRole } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { getBlockedDates } from '@/lib/availability/blocked-dates'
import { getUpcomingSundays } from '@/lib/availability/upcoming-sundays'
import AvailabilityToggleList from '@/components/AvailabilityToggleList'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SUNDAY_HORIZON = 12

/**
 * /[locale]/admin/people/[id]/availability — Admin-only per-person
 * availability editor (Server Component), STORY-27.
 *
 * Mirrors app/[locale]/(app)/admin/people/[id]/skills/page.tsx exactly:
 * belt-and-suspenders auth guard (CLAUDE.md §Per-page admin guard
 * convention), notFound() on a malformed UUID or a missing/inactive person,
 * and a lazy-load rule — all rendered text lives in AvailabilityToggleList
 * (a Client Component using useTranslations), so this Server Component
 * never calls getTranslations itself.
 *
 * AC1: same 12-Sunday horizon as STORY-26's Member-facing page — no new
 * configurable horizon here.
 */
export default async function PersonAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // 1. Get the current authenticated user (React cache deduplicates this call)
  const user = await getSessionUser()

  // 2. Null guard before any user.id access
  if (!user) {
    redirect(`/${routing.defaultLocale}/login`)
  }

  // 3. Check the user's role from public.users (React cache deduplicates this call)
  const role = await getUserRole(user.id)

  // 4. Non-admin users are redirected to the home page with ?denied=1.
  if (role !== 'admin') {
    redirect(`/${routing.defaultLocale}/?denied=1`)
  }

  const { id } = await params

  if (!UUID_RE.test(id)) {
    notFound()
  }

  const serviceClient = createServiceClient()

  const { data: person, error: personError } = await serviceClient
    .from('people')
    .select('id, name')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  if (personError) {
    console.error('[PersonAvailabilityPage] person lookup error:', personError)
  }

  if (!person) {
    notFound()
  }

  const sundays = getUpcomingSundays(SUNDAY_HORIZON)

  const { data, error } = await getBlockedDates(serviceClient, {
    personIds: [id],
    dateFrom: sundays[0],
    dateTo: sundays.at(-1),
  })

  if (error) {
    console.error('[PersonAvailabilityPage] getBlockedDates error:', error)
  }

  const initialBlockedDates = (data ?? []).map((row) => row.blocked_date)

  return (
    <main className="container mx-auto px-4 py-8">
      <AvailabilityToggleList
        sundays={sundays}
        initialBlockedDates={initialBlockedDates}
        personId={id}
        personName={person.name as string}
      />
    </main>
  )
}
