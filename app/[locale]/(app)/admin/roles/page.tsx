import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { getSessionUser, getUserRole } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import RoleTable from '@/components/RoleTable'
import type { RoleRow } from '@/types/roles'

/**
 * /[locale]/admin/roles — Admin-only role management page (Server Component).
 *
 * Belt-and-suspenders auth guard (CLAUDE.md §Per-page admin guard convention):
 *   1. proxy.ts already redirects unauthenticated visitors before this renders.
 *   2. This page additionally checks the user's role so a Member who somehow
 *      reaches this URL is redirected to the home page with ?denied=1.
 *
 * Auth checks come BEFORE getTranslations (lazy-load rule: do not pay for
 * translation namespaces on short-circuit paths). Pattern:
 * session → role → getTranslations → data.
 */
export default async function AdminRolesPage() {
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

  // 5. Only reach getTranslations after all early-return auth branches.
  const t = await getTranslations('RoleManagement')

  // 6. Fetch all active roles via service-role client (bypasses RLS)
  let roles: RoleRow[] = []
  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('roles')
      .select('id, name, default_slots, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[AdminRolesPage] supabase error:', error)
    }

    roles = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      default_slots: row.default_slots as number,
      is_active: row.is_active as boolean,
    }))
  } catch (err) {
    console.error('[AdminRolesPage] fetch error:', err)
    roles = []
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <RoleTable initialRoles={roles} />
    </main>
  )
}
