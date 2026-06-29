import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/server'
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
 * Uses createClient() (anon-key) for the current user's session and role check,
 * and createServiceClient() (service-role) to list all users.
 */
export default async function AdminUsersPage() {
  const t = await getTranslations('UserManagement')

  // 1. Get the current authenticated user via the server (anon-key) client
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  // 2. Null guard before any user.id access
  if (!user) {
    redirect(`/${routing.defaultLocale}/login`)
  }

  // 3. Check the user's role from public.users
  let role: string | null = null
  try {
    const supabase = await createClient()
    const { data: row } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    role = row?.role ?? null
  } catch {
    role = null
  }

  // 4. Non-admin users are redirected to the home page
  if (role !== 'admin') {
    redirect(`/${routing.defaultLocale}/`)
  }

  // 5. Fetch all users via service-role client (bypasses RLS)
  let users: UserRow[] = []
  try {
    const serviceClient = createServiceClient()
    const { data } = await serviceClient
      .from('users')
      .select('id, email, display_name, role')
      .order('display_name', { ascending: true })

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
