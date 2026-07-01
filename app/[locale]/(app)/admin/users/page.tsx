import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { getSessionUser, getUserRole } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import UserTable from '@/components/UserTable'
import type { UserRow } from '@/types/user-management'

/**
 * /[locale]/admin/users — Admin-only user management page (Server Component).
 *
 * Belt-and-suspenders auth guard:
 *   1. proxy.ts already redirects unauthenticated visitors before this renders.
 *   2. This page additionally checks the user's role so a Member who somehow
 *      reaches this URL is redirected to the home page.
 *
 * Uses getSessionUser() / getUserRole() (React cache, anon-key) for the current
 * user's session and role, and createServiceClient() (service-role) to list all users.
 */
export default async function AdminUsersPage() {
  const t = await getTranslations('UserManagement')

  // 1. Get the current authenticated user (React cache deduplicates this call)
  const user = await getSessionUser()

  // 2. Null guard before any user.id access
  if (!user) {
    redirect(`/${routing.defaultLocale}/login`)
  }

  // 3. Check the user's role from public.users (React cache deduplicates this call)
  const role = await getUserRole(user.id)

  // 4. Non-admin users are redirected to the home page with ?denied=1 so the
  //    home page can display a specific "access denied" message (AC4, STORY-06).
  //    CONVENTION: Every future app/[locale]/admin/*/page.tsx must include an
  //    equivalent role-guard redirect (with ?denied=1) until a middleware-level
  //    guard is introduced.
  if (role !== 'admin') {
    redirect(`/${routing.defaultLocale}/?denied=1`)
  }

  // 5. Fetch all users via service-role client (bypasses RLS)
  let users: UserRow[] = []
  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('users')
      .select('id, email, display_name, role')
      .order('display_name', { ascending: true })

    if (error) {
      console.error('[AdminUsersPage] DB error:', error)
    }

    users = (data ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      display_name: (row.display_name as string | null) ?? null,
      role: row.role === 'admin' ? ('admin' as const) : ('member' as const),
    }))
  } catch {
    users = []
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
      <UserTable initialUsers={users} />
    </main>
  )
}
