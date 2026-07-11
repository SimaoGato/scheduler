// No `import 'server-only'` here — this is a standalone exception, not a
// redundancy argument like lib/auth/session.ts (which omits the marker
// because `next/headers` already gives it a transitive bundler-level server
// boundary). This module has no such transitive boundary: it takes only a
// generic SupabaseClient parameter and embeds no secrets, and it must be
// directly importable by e2e-integration/blocked-dates.spec.ts (AC8's test
// plan) to exercise personIds/date-range filtering against seeded fixture
// rows under Playwright's plain Node-based test runner (no `react-server`
// export condition is set there). `server-only`'s package.json only swaps to
// the safe `empty.js` export under that condition, so adding the marker here
// would throw at import time and break that test. Route Handlers remain the
// only production callers, and the absence of secrets/transitive
// server-bound imports keeps the accidental-client-bundle risk low.
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * BlockedDateRow — a single public.blocked_dates row as surfaced to callers.
 */
export interface BlockedDateRow {
  person_id: string
  blocked_date: string // YYYY-MM-DD
}

/**
 * getBlockedDates — Generator-facing query helper (STORY-25 AC8), queryable
 * by person set and/or date range. This is the single seam EPIC-04 will
 * import; the Member-facing GET route
 * (app/api/availability/blocks/route.ts) also calls this helper with
 * `{ personIds: [personId] }` rather than duplicating the query.
 *
 * Mirrors the non-throwing `{ data, error }` convention (CLAUDE.md,
 * qualifiedRolesForPerson) so every caller destructures and logs
 * consistently — the Supabase client does not throw on query errors.
 */
export async function getBlockedDates(
  client: SupabaseClient,
  opts: { personIds?: string[]; dateFrom?: string; dateTo?: string } = {}
): Promise<{ data: BlockedDateRow[] | null; error: unknown }> {
  let query = client.from('blocked_dates').select('person_id, blocked_date')

  if (opts.personIds) {
    query = query.in('person_id', opts.personIds)
  }
  if (opts.dateFrom) {
    query = query.gte('blocked_date', opts.dateFrom)
  }
  if (opts.dateTo) {
    query = query.lte('blocked_date', opts.dateTo)
  }

  const { data, error } = await query

  if (error) return { data: null, error }

  const rows: BlockedDateRow[] = (data ?? []).map((row) => ({
    person_id: row.person_id as string,
    blocked_date: row.blocked_date as string,
  }))

  return { data: rows, error: null }
}
