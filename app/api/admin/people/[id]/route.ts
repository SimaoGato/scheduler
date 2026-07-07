import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * PATCH /api/admin/people/[id] — Update a person's name.
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md convention).
 * Body: { name: string }
 * Validation: name must be non-empty.
 * Returns 404 if the person is not found or is inactive.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id } = await params

  // BW2: reject non-UUID path params before they reach PostgreSQL (avoids 22P02 → 500)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  // BW1: wrap request.json() separately so malformed JSON returns 400, not 500
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const rec = body as Record<string, unknown>
    const name = typeof rec?.name === 'string' ? (rec.name as string).trim() : ''

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    // BW3: select only 'id' — data is discarded; no need for extra columns
    const { data, error } = await serviceClient
      .from('people')
      .update({ name })
      .eq('id', id)
      .eq('is_active', true)
      .select('id')

    if (error) {
      console.error('[PATCH /api/admin/people/[id]] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/admin/people/[id]] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/people/[id] — Soft-delete a person (set is_active = false).
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md convention).
 * Soft-delete preserves the record for future schedule history (AC3).
 * Returns 404 if the person is not found or already inactive.
 *
 * STORY-19 in-use guard (AC4/AC5): mirrors the role DELETE handler
 * (app/api/admin/roles/[id]/route.ts) exactly, against person_role_skills
 * filtered by person_id instead of role_id. See that handler's doc comment
 * for the full cascade-ordering and accepted-risk rationale. Existing
 * free-text error strings in this file are pre-existing debt (STORY-07) and
 * are intentionally left as-is per the Implementation Plan's Locked
 * decision 3 — only the new person_in_use code follows the machine-readable
 * convention.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id } = await params

  // BW2: reject non-UUID path params before they reach PostgreSQL (avoids 22P02 → 500)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const confirmed = request.nextUrl.searchParams.get('confirm') === '1'

  try {
    const serviceClient = createServiceClient()

    const { count, error: countError } = await serviceClient
      .from('person_role_skills')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', id)

    if (countError) {
      console.error('[DELETE /api/admin/people/[id]] count error:', countError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const inUseCount = count ?? 0

    if (inUseCount > 0 && !confirmed) {
      return NextResponse.json({ error: 'person_in_use', count: inUseCount }, { status: 409 })
    }

    if (inUseCount > 0 && confirmed) {
      // Explicit hard-delete of dependent rows FIRST, then soft-delete the
      // parent — see app/api/admin/roles/[id]/route.ts for the full
      // ordering rationale (same reasoning applies symmetrically here).
      const { error: cascadeError } = await serviceClient
        .from('person_role_skills')
        .delete()
        .eq('person_id', id)

      if (cascadeError) {
        console.error('[DELETE /api/admin/people/[id]] cascade delete error:', cascadeError)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    }

    // Accepted risk: if the cascade delete above succeeded but this
    // soft-delete fails (transient DB/network fault), the person is left
    // active while their skill-assignment history is already gone. Not
    // engineered away in this story — see STORY-19's Implementation Plan
    // Risks section (same trade-off as the role handler above).
    const { data, error } = await serviceClient
      .from('people')
      .update({ is_active: false })
      .eq('id', id)
      .eq('is_active', true)
      .select('id')

    if (error) {
      console.error('[DELETE /api/admin/people/[id]] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/people/[id]] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
