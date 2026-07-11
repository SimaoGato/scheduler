import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * resolveSelfPersonId — Resolves the caller's own `people` row id from an
 * authenticated user id (STORY-25).
 *
 * `linked_user_id = userId AND is_active = true` — a soft-deleted person
 * with a stale link is treated the same as "no linked person" (consistent
 * with the active-row-only checks in
 * app/api/admin/people/[id]/skills/[roleId]/route.ts). Returns `null` when
 * no matching active person exists; callers map `null` to a 409
 * `no_linked_person` response.
 *
 * Shared by all three availability Route Handlers so the lookup + is_active
 * filter can't drift between them.
 */
export async function resolveSelfPersonId(
  client: SupabaseClient,
  userId: string
): Promise<{ personId: string | null; error: unknown }> {
  const { data, error } = await client
    .from('people')
    .select('id')
    .eq('linked_user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return { personId: null, error }

  return { personId: data ? (data.id as string) : null, error: null }
}
