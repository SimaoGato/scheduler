import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import type { PersonRow } from '@/types/people'

/**
 * GET /api/admin/people — Return all active people, ordered by name.
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
      .from('people')
      .select('id, name, linked_user_id, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('[GET /api/admin/people] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const people: PersonRow[] = (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      linked_user_id: (row.linked_user_id as string | null) ?? null,
      is_active: row.is_active as boolean,
    }))

    return NextResponse.json(people)
  } catch (err) {
    console.error('[GET /api/admin/people] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/people — Create a new person record.
 *
 * Authentication: requireAdmin (401 if not authenticated, 403 if not admin).
 * Body: { name: string }
 * Validation: name must be non-empty.
 * Returns: the created PersonRow.
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

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
    const { data, error } = await serviceClient
      .from('people')
      .insert({ name })
      .select('id, name, linked_user_id, is_active')
      .single()

    if (error) {
      console.error('[POST /api/admin/people] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const person: PersonRow = {
      id: data.id as string,
      name: data.name as string,
      linked_user_id: (data.linked_user_id as string | null) ?? null,
      is_active: data.is_active as boolean,
    }

    return NextResponse.json(person, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/people] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
