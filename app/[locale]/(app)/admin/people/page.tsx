import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { getSessionUser, getUserRole } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import PeopleTable from '@/components/PeopleTable'
import type { PersonRow } from '@/types/people'

/**
 * /[locale]/admin/people — Admin-only people management page (Server Component).
 *
 * Belt-and-suspenders auth guard (CLAUDE.md §Per-page admin guard convention):
 *   1. proxy.ts already redirects unauthenticated visitors before this renders.
 *   2. This page additionally checks the user's role so a Member who somehow
 *      reaches this URL is redirected to the home page with ?denied=1.
 *
 * Auth checks come BEFORE getTranslations (W1 fix: do not pay for translation
 * namespaces on short-circuit paths). Pattern: session → role → getTranslations → data.
 */
export default async function AdminPeoplePage() {
  // 1. Get the current authenticated user (React cache deduplicates this call)
  const user = await getSessionUser()

  // 2. Null guard before any user.id access
  if (!user) {
    redirect(`/${routing.defaultLocale}/login`)
  }

  // 3. Check the user's role from public.users (React cache deduplicates this call)
  const role = await getUserRole(user.id)

  // 4. Non-admin users are redirected to the home page with ?denied=1.
  //    W2: use /${routing.defaultLocale}/?denied=1 (not /?denied=1) so next-intl
  //    preserves the query param on redirect.
  if (role !== 'admin') {
    redirect(`/${routing.defaultLocale}/?denied=1`)
  }

  // 5. Only reach getTranslations after all early-return auth branches (W1).
  const t = await getTranslations('PeopleManagement')

  // 6. Fetch all active people via service-role client (bypasses RLS)
  let people: PersonRow[] = []
  try {
    const serviceClient = createServiceClient()
    // FW1: destructure error so Supabase client errors (non-throwing) are logged
    const { data, error } = await serviceClient
      .from('people')
      .select('id, name, linked_user_id, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[AdminPeoplePage] supabase error:', error)
    }

    people = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      linked_user_id: (row.linked_user_id as string | null) ?? null,
      is_active: row.is_active as boolean,
    }))
  } catch (err) {
    // W3: named catch binding with explicit log (not bare catch {})
    console.error('[AdminPeoplePage] fetch error:', err)
    people = []
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <PeopleTable initialPeople={people} />
    </main>
  )
}
