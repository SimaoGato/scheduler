import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PUT /api/admin/people/[id]/link — Admin links a person record to a user
 * account (STORY-20 AC1/AC3/AC4).
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md
 * convention) — this is Admin-only, unlike the member self-claim route in
 * app/api/people/claim/route.ts (STORY-11).
 *
 * Body: { user_id: UUID }
 *
 * Race-guard / no-silent-overwrite design mirrors app/api/people/claim/route.ts
 * almost exactly:
 *   - AC4 (person already linked -> reject, don't overwrite): a pre-check
 *     read gives a clear 409 person_already_linked in the common case, and
 *     the UPDATE itself is *also* guarded on `linked_user_id IS NULL` so a
 *     race between the pre-check and the write (two admins linking the same
 *     person concurrently) still can't produce a silent overwrite — zero
 *     rows affected on the UPDATE falls back to the same 409.
 *   - AC3 (user already linked to a *different* person -> reject): relies
 *     solely on the existing partial unique index
 *     idx_people_linked_user_id_unique (STORY-11 migration
 *     20260705000001) via a 23505 catch, matching the claim route's
 *     precedent — no separate pre-check query for "is this user already
 *     linked" (avoids a redundant query and a check-then-act gap).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_person_id' }, { status: 400 })
  }

  // Wrap request.json() separately so malformed JSON returns 400, not 500.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rec = body as Record<string, unknown>
  const userId = typeof rec?.user_id === 'string' ? rec.user_id : ''
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'invalid_user_id' }, { status: 400 })
  }

  try {
    const serviceClient = createServiceClient()

    const { data: person, error: personError } = await serviceClient
      .from('people')
      .select('id, is_active, linked_user_id')
      .eq('id', id)
      .maybeSingle()

    if (personError) {
      console.error('[PUT /api/admin/people/[id]/link] person lookup error:', personError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!person || !person.is_active) {
      return NextResponse.json({ error: 'person_not_found' }, { status: 404 })
    }
    if (person.linked_user_id !== null) {
      return NextResponse.json({ error: 'person_already_linked' }, { status: 409 })
    }

    const { data: user, error: userError } = await serviceClient
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (userError) {
      console.error('[PUT /api/admin/people/[id]/link] user lookup error:', userError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    const { data, error } = await serviceClient
      .from('people')
      .update({ linked_user_id: userId })
      .eq('id', id)
      .is('linked_user_id', null)
      .eq('is_active', true)
      .select('id, linked_user_id')

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'user_already_linked' }, { status: 409 })
      }
      console.error('[PUT /api/admin/people/[id]/link] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      // Race fallback (AC4): another request linked this person between the
      // pre-check and this UPDATE.
      return NextResponse.json({ error: 'person_already_linked' }, { status: 409 })
    }

    return NextResponse.json({ id: data[0].id, linked_user_id: data[0].linked_user_id })
  } catch (err) {
    console.error('[PUT /api/admin/people/[id]/link] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/people/[id]/link — Admin unlinks a person record from
 * its user account (STORY-20 AC2).
 *
 * Authentication: requireAdmin called BEFORE await params.
 * Treats "already unlinked" as an idempotent success (200), not an error —
 * no AC requires erroring on a repeat unlink, matching the existing
 * skills-route precedent of a raced double-tap collapsing to a benign
 * outcome.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_person_id' }, { status: 400 })
  }

  try {
    const serviceClient = createServiceClient()

    const { data: person, error: personError } = await serviceClient
      .from('people')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()

    if (personError) {
      console.error('[DELETE /api/admin/people/[id]/link] person lookup error:', personError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!person || !person.is_active) {
      return NextResponse.json({ error: 'person_not_found' }, { status: 404 })
    }

    const { error } = await serviceClient
      .from('people')
      .update({ linked_user_id: null })
      .eq('id', id)
      .eq('is_active', true)
      .select('id')

    if (error) {
      console.error('[DELETE /api/admin/people/[id]/link] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    return NextResponse.json({ id, linked_user_id: null })
  } catch (err) {
    console.error('[DELETE /api/admin/people/[id]/link] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
