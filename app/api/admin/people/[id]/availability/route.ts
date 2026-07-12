import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { getBlockedDates } from '@/lib/availability/blocked-dates'
import { parseBlockedDate, isSunday } from '@/lib/validation/availability'
import type { BlockedDatesResponse } from '@/types/availability'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/people/[id]/availability — List a person's blocked dates,
 * for any admin-editable person (STORY-27 AC1, AC5, AC6).
 *
 * Not called by the admin page itself (the Server Component reads via
 * getBlockedDates() directly), but kept for architectural parity with the
 * Member-facing GET route (STORY-25) and to give this route family
 * symmetric 401/403/AC6 coverage across all three verbs (see the
 * Implementation Plan's Design decision 3).
 *
 * Authentication: requireAdmin, guard-first then await params (CLAUDE.md
 * convention). Person-centric: writes/reads `person_id` directly from the
 * URL param — no resolveSelfPersonId, unlike the Member routes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
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
      console.error('[GET /api/admin/people/[id]/availability] person lookup error:', personError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!person) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const { data, error } = await getBlockedDates(serviceClient, { personIds: [id] })

    if (error) {
      console.error('[GET /api/admin/people/[id]/availability] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    const body: BlockedDatesResponse = { dates: (data ?? []).map((row) => row.blocked_date) }
    return NextResponse.json(body)
  } catch (err) {
    console.error('[GET /api/admin/people/[id]/availability] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * POST /api/admin/people/[id]/availability — Block a date for the given
 * person, on the Admin's behalf (STORY-27 AC2, AC3, AC5, AC6).
 *
 * Body: { date: 'YYYY-MM-DD' } — must be a valid calendar date (400
 * `invalid_date`) and a Sunday (400 `not_sunday`).
 *
 * Idempotency (AC2): `upsert(..., { ignoreDuplicates: true })` against the
 * unique (person_id, blocked_date) index — identical to STORY-25's
 * Member-facing POST route.
 *
 * No parallel storage (AC4): writes to the same public.blocked_dates table
 * scoped by person_id, so a Member's own block and an Admin's edit on their
 * behalf are always the same row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

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

    const { data: person, error: personError } = await serviceClient
      .from('people')
      .select('id')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (personError) {
      console.error('[POST /api/admin/people/[id]/availability] person lookup error:', personError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!person) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // Mass-assignment guard: explicit object literal from validated locals
    // only — never upsert(body).
    const { error } = await serviceClient
      .from('blocked_dates')
      .upsert(
        { person_id: id, blocked_date: date },
        { onConflict: 'person_id,blocked_date', ignoreDuplicates: true }
      )

    if (error) {
      console.error('[POST /api/admin/people/[id]/availability] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/admin/people/[id]/availability] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
