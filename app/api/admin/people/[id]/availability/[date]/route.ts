import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { parseBlockedDate } from '@/lib/validation/availability'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE /api/admin/people/[id]/availability/[date] — Unblock a date for
 * the given person, on the Admin's behalf (STORY-27 AC2, AC5, AC6).
 *
 * `not_sunday` is not re-validated here — an already-non-Sunday date can
 * never have a row, so `.delete()` matching zero rows is already a correct
 * no-op (mirrors STORY-25's Member-facing unblock route).
 *
 * Idempotency (AC2): deleting zero rows is not an error; both the first
 * unblock and a repeat unblock of an already-unblocked date return the same
 * 200 `{ ok: true }`.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id, date: rawDate } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const date = parseBlockedDate(rawDate)
  if (!date) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
  }

  try {
    const serviceClient = createServiceClient()

    const { data: person, error: personError } = await serviceClient
      .from('people')
      .select('id')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (personError) {
      console.error(
        '[DELETE /api/admin/people/[id]/availability/[date]] person lookup error:',
        personError
      )
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!person) {
      // Deliberate deviation from the Implementation Plan's Design decision 4
      // (`person_not_found`): matches the sibling GET
      // `app/api/admin/people/[id]/skills/route.ts`'s 404 spelling instead,
      // for cross-route consistency. AC6 only pins the 400 `invalid_id`
      // code literally, so this is compatible. See STORY-27's Design
      // decision 4 post-review update for the full rationale.
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // TOCTOU note: the is_active check above and this write are not
    // transactional — a person could be soft-deleted between them. Accepted
    // low-severity risk (admin-only surface, narrow window); see
    // app/api/admin/people/[id]/skills/[roleId]/route.ts lines 91-96 for the
    // precedent and CLAUDE.md's TOCTOU-acceptance convention.
    const { error } = await serviceClient
      .from('blocked_dates')
      .delete()
      .eq('person_id', id)
      .eq('blocked_date', date)

    if (error) {
      console.error('[DELETE /api/admin/people/[id]/availability/[date]] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/people/[id]/availability/[date]] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
