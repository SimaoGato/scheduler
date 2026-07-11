import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveSelfPersonId } from '@/lib/people/resolve-self'
import { parseBlockedDate } from '@/lib/validation/availability'

/**
 * DELETE /api/availability/blocks/[date] — Unblock a date for the caller's
 * own linked person (STORY-25 AC3, AC5, AC6, AC7).
 *
 * `not_sunday` is not re-validated here — an already-non-Sunday date can
 * never have a row, so `.delete()` matching zero rows is already a correct
 * no-op.
 *
 * Idempotency (AC3): deleting zero rows is not an error; both the first
 * unblock and a repeat unblock of an already-unblocked date return the same
 * 200 `{ ok: true }` (no 404 — the starting state legitimately has no row
 * most of the time, and that's not an error condition here, unlike the
 * skills DELETE route's 404-on-no-op).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  const { date: rawDate } = await params

  const date = parseBlockedDate(rawDate)
  if (!date) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
  }

  try {
    const serviceClient = createServiceClient()

    const { personId, error: resolveError } = await resolveSelfPersonId(
      serviceClient,
      result.user.id
    )
    if (resolveError) {
      console.error('[DELETE /api/availability/blocks/[date]] resolveSelfPersonId error:', resolveError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!personId) {
      return NextResponse.json({ error: 'no_linked_person' }, { status: 409 })
    }

    const { error } = await serviceClient
      .from('blocked_dates')
      .delete()
      .eq('person_id', personId)
      .eq('blocked_date', date)

    if (error) {
      console.error('[DELETE /api/availability/blocks/[date]] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/availability/blocks/[date]] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
