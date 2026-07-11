import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveSelfPersonId } from '@/lib/people/resolve-self'
import { getBlockedDates } from '@/lib/availability/blocked-dates'
import { parseBlockedDate, isSunday } from '@/lib/validation/availability'
import type { BlockedDatesResponse } from '@/types/availability'

/**
 * GET /api/availability/blocks — List the caller's own blocked dates
 * (STORY-25 AC4, AC6, AC7).
 *
 * Authentication: requireAuth (any logged-in user — member self-service).
 * Resolves the caller's linked person via resolveSelfPersonId; 409
 * `no_linked_person` if none. Delegates the actual query to the shared
 * getBlockedDates() helper (the same seam EPIC-04 will use) rather than
 * duplicating a query here.
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  try {
    const serviceClient = createServiceClient()

    const { personId, error: resolveError } = await resolveSelfPersonId(
      serviceClient,
      result.user.id
    )
    if (resolveError) {
      console.error('[GET /api/availability/blocks] resolveSelfPersonId error:', resolveError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!personId) {
      return NextResponse.json({ error: 'no_linked_person' }, { status: 409 })
    }

    const { data, error } = await getBlockedDates(serviceClient, { personIds: [personId] })

    if (error) {
      console.error('[GET /api/availability/blocks] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    const body: BlockedDatesResponse = { dates: (data ?? []).map((row) => row.blocked_date) }
    return NextResponse.json(body)
  } catch (err) {
    console.error('[GET /api/availability/blocks] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * POST /api/availability/blocks — Block a date for the caller's own linked
 * person (STORY-25 AC2, AC5, AC6, AC7).
 *
 * Body: { date: 'YYYY-MM-DD' } — must be a valid calendar date (400
 * `invalid_date`) and a Sunday (400 `not_sunday`).
 *
 * Idempotency (AC2): `upsert(..., { ignoreDuplicates: true })` against the
 * unique (person_id, blocked_date) index — a repeat POST for the same date
 * is a silent no-op, not an error and not a duplicate row.
 */
export async function POST(request: NextRequest) {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  // Wrap request.json() separately so malformed JSON returns 400, not 500.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  try {
    const rec = body as Record<string, unknown>
    const date = parseBlockedDate(rec?.date)
    if (!date) {
      return NextResponse.json({ error: 'invalid_date' }, { status: 400 })
    }
    if (!isSunday(date)) {
      return NextResponse.json({ error: 'not_sunday' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { personId, error: resolveError } = await resolveSelfPersonId(
      serviceClient,
      result.user.id
    )
    if (resolveError) {
      console.error('[POST /api/availability/blocks] resolveSelfPersonId error:', resolveError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!personId) {
      return NextResponse.json({ error: 'no_linked_person' }, { status: 409 })
    }

    // Mass-assignment guard: explicit object literal from validated locals
    // only — never upsert(body).
    const { error } = await serviceClient
      .from('blocked_dates')
      .upsert(
        { person_id: personId, blocked_date: date },
        { onConflict: 'person_id,blocked_date', ignoreDuplicates: true }
      )

    if (error) {
      console.error('[POST /api/availability/blocks] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/availability/blocks] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
