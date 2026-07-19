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

/**
 * qualifiedPeopleCountsByRole — reverse direction of qualifiedRolesForPerson:
 * for a given set of role ids, returns how many currently-active people are
 * qualified (have any skill level) for each role.
 *
 * One aggregate query, not N+1 (STORY-30 pattern): supabase-js has no
 * server-side GROUP BY, so this fetches every qualifying
 * `person_role_skills` row once and reduces to counts in JS.
 *
 * The `people!inner(is_active)` embed forces an inner join against
 * `public.people`, and `.eq('people.is_active', true)` filters on that
 * joined column server-side — mirrors qualifiedRolesForPerson's own
 * `roles!inner(is_active)` pattern in the opposite direction, so "only
 * active people count" is baked into the query itself, not a comment every
 * caller must remember (CHORE-29, STORY-30 metric-scope-consistency rule).
 *
 * `person_role_skills` has a composite PRIMARY KEY (person_id, role_id), so
 * counting rows is equivalent to counting distinct qualified people per
 * role — no risk of double-counting a person for the same role.
 *
 * Callers pass an already-active-filtered `roleIds` list (e.g. the roles
 * page's `is_active = true` query) and look up counts by id in the returned
 * Map, defaulting to 0 for any id absent from it (a brand-new role with no
 * assigned skills yet, or — impossible here since roleIds is caller-scoped
 * to active roles — a soft-deleted role). No caller can forget the filter.
 */
export async function qualifiedPeopleCountsByRole(
  client: SupabaseClient,
  roleIds: string[]
): Promise<{ data: Map<string, number> | null; error: unknown }> {
  if (roleIds.length === 0) return { data: new Map(), error: null }

  const { data, error } = await client
    .from('person_role_skills')
    .select('role_id, people!inner(is_active)')
    .in('role_id', roleIds)
    .eq('people.is_active', true)

  if (error) return { data: null, error }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const roleId = row.role_id as string
    counts.set(roleId, (counts.get(roleId) ?? 0) + 1)
  }
  return { data: counts, error: null }
}
