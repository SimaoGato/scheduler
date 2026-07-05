import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PersonSkill } from '@/types/skills'

/**
 * qualifiedRolesForPerson — Returns the roles a person is qualified for
 * (i.e. has a skill level for), restricted to currently-active roles.
 *
 * Mirrors Supabase's non-throwing {data, error} convention (CLAUDE.md) so
 * every caller destructures and logs consistently. This is the seam
 * EPIC-04 will import directly.
 *
 * The `roles!inner(is_active)` embed forces an inner join against
 * `public.roles`, and `.eq('roles.is_active', true)` filters on that joined
 * column server-side. This makes "only active-role skills are qualifying"
 * (AC6) an explicit part of the query itself — not a comment telling every
 * future caller to separately fetch an active-roles list and remember to
 * merge/filter against it. A caller cannot forget the filter because it's
 * baked into the one query this helper exposes.
 *
 * A skill row for a soft-deleted role is expected to exist and be excluded
 * here (STORY-18 decision 5: orphaned rows on role soft-delete are expected,
 * not a bug); this query is what makes that invisible to every caller.
 */
export async function qualifiedRolesForPerson(
  client: SupabaseClient,
  personId: string
): Promise<{ data: PersonSkill[] | null; error: unknown }> {
  const { data, error } = await client
    .from('person_role_skills')
    .select('role_id, level, roles!inner(is_active)')
    .eq('person_id', personId)
    .eq('roles.is_active', true)

  if (error) return { data: null, error }

  const skills: PersonSkill[] = (data ?? []).map((row) => ({
    role_id: row.role_id as string,
    level: row.level as 1 | 2 | 3,
  }))
  return { data: skills, error: null }
}
