import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * PATCH /api/admin/users/[id] — Promote or demote a user's role.
 *
 * Authentication: requireAdmin (401 if not authenticated, 403 if not admin).
 * Body: { role: 'admin' | 'member' }
 *
 * Last-admin safeguard: if demoting to 'member' and there is only one admin
 * remaining, the action is blocked with 409 { error: 'last_admin' }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params

  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  try {
    const body = await request.json()
    const rawRole = body?.role

    if (rawRole !== 'admin' && rawRole !== 'member') {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
    }

    const role: 'admin' | 'member' =
      rawRole === 'admin' ? ('admin' as const) : ('member' as const)

    const serviceClient = createServiceClient()

    // Last-admin safeguard: prevent demoting the only remaining admin
    if (role === 'member') {
      const { count, error: countError } = await serviceClient
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')

      if (countError) {
        console.error('[PATCH /api/admin/users/[id]] count error:', countError)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }

      if (count === null) {
        // Null count means the query itself failed; treat as fatal error
        throw new Error('Admin count query returned null')
      }

      if (count <= 1) {
        return NextResponse.json({ error: 'last_admin' }, { status: 409 })
      }
    }

    const { data, error } = await serviceClient
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('[PATCH /api/admin/users/[id]] update error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/admin/users/[id]] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
