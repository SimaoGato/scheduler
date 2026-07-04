import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { parseDefaultSlots } from '../route'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PATCH /api/admin/roles/[id] — Update a role's name and/or default slots.
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md convention).
 * Body: { name: string, default_slots?: number | string }
 * Validation: same as POST (name non-empty, default_slots positive integer
 * or omitted → defaults to 1).
 * Returns 404 if the role is not found or is inactive.
 * Returns 409 `duplicate_name` on a case-insensitive name collision.
 */
export async function PATCH(
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
    const name = typeof rec?.name === 'string' ? (rec.name as string).trim() : ''

    if (!name) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 })
    }

    const defaultSlots = parseDefaultSlots(rec?.default_slots)
    if (defaultSlots === null) {
      return NextResponse.json({ error: 'invalid_slots' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    // Mass-assignment guard: explicit object literal from validated locals
    // only — never update(body) or a spread of the raw parsed JSON.
    const { data, error } = await serviceClient
      .from('roles')
      .update({ name, default_slots: defaultSlots })
      .eq('id', id)
      .eq('is_active', true)
      .select('id')

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'duplicate_name' }, { status: 409 })
      }
      console.error('[PATCH /api/admin/roles/[id]] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/admin/roles/[id]] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/roles/[id] — Soft-delete a role (set is_active = false).
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md convention).
 * Soft-delete preserves the record, consistent with public.people (STORY-07).
 * Returns 404 if the role is not found or already inactive.
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
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('roles')
      .update({ is_active: false })
      .eq('id', id)
      .eq('is_active', true)
      .select('id')

    if (error) {
      console.error('[DELETE /api/admin/roles/[id]] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/roles/[id]] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
