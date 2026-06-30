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

  try {
    const serviceClient = createServiceClient()
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
