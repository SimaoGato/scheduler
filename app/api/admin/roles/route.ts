import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { parseDefaultSlots } from '@/lib/validation/roles'
import type { RoleRow } from '@/types/roles'

/**
 * GET /api/admin/roles — Return all active roles, ordered by name.
 *
 * Authentication: requireAdmin (401 if not authenticated, 403 if not admin).
 * Uses service-role client to bypass RLS.
 */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('roles')
      .select('id, name, default_slots, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[GET /api/admin/roles] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    const roles: RoleRow[] = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      default_slots: row.default_slots as number,
      is_active: row.is_active as boolean,
    }))

    return NextResponse.json(roles)
  } catch (err) {
    console.error('[GET /api/admin/roles] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * POST /api/admin/roles — Create a new role record.
 *
 * Authentication: requireAdmin (401 if not authenticated, 403 if not admin).
 * Body: { name: string, default_slots?: number | string }
 * Validation:
 *   - name must be non-empty (400 `name_required`)
 *   - default_slots must be a positive integer, or omitted entirely to
 *     default to 1 (400 `invalid_slots`)
 *   - duplicate (case-insensitive) name among active roles → 409 `duplicate_name`
 * Returns: the created RoleRow (201).
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request)
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
    // only — never insert(body) or a spread of the raw parsed JSON.
    const { data, error } = await serviceClient
      .from('roles')
      .insert({ name, default_slots: defaultSlots })
      .select('id, name, default_slots, is_active')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'duplicate_name' }, { status: 409 })
      }
      console.error('[POST /api/admin/roles] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    const role: RoleRow = {
      id: data.id as string,
      name: data.name as string,
      default_slots: data.default_slots as number,
      is_active: data.is_active as boolean,
    }

    return NextResponse.json(role, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/roles] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
