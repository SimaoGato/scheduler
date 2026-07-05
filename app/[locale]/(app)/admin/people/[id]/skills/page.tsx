import { notFound, redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getSessionUser, getUserRole } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { qualifiedRolesForPerson } from '@/lib/skills/qualified-roles'
import PersonSkillsEditor from '@/components/PersonSkillsEditor'
import type { RoleRow } from '@/types/roles'
import type { PersonSkill } from '@/types/skills'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * /[locale]/admin/people/[id]/skills — Admin-only per-person skills editor
 * (Server Component), STORY-18.
 *
 * Belt-and-suspenders auth guard (CLAUDE.md §Per-page admin guard convention):
 *   1. proxy.ts already redirects unauthenticated visitors before this renders.
 *   2. This page additionally checks the user's role so a Member who somehow
 *      reaches this URL is redirected to the home page with ?denied=1.
 *
 * All rendered text (title, back link, level labels, etc.) lives in
 * PersonSkillsEditor (a Client Component using useTranslations), so this
 * Server Component never calls getTranslations itself (lazy-load rule: do
 * not pay for a namespace this component doesn't render).
 */
export default async function PersonSkillsPage({
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
    console.error('[PersonSkillsPage] person lookup error:', personError)
  }

  if (!person) {
    notFound()
  }

  // Fetch all active roles (same query shape as admin/roles/page.tsx)
  let roles: RoleRow[] = []
  try {
    const { data, error } = await serviceClient
      .from('roles')
      .select('id, name, default_slots, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[PersonSkillsPage] roles fetch error:', error)
    }

    roles = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      default_slots: row.default_slots as number,
      is_active: row.is_active as boolean,
    }))
  } catch (err) {
    console.error('[PersonSkillsPage] roles fetch error:', err)
    roles = []
  }

  let initialSkills: PersonSkill[] = []
  const { data: skills, error: skillsError } = await qualifiedRolesForPerson(serviceClient, id)
  if (skillsError) {
    console.error('[PersonSkillsPage] skills fetch error:', skillsError)
  }
  initialSkills = skills ?? []

  return (
    <main className="container mx-auto px-4 py-8">
      <PersonSkillsEditor
        personId={id}
        personName={person.name as string}
        roles={roles}
        initialSkills={initialSkills}
      />
    </main>
  )
}
