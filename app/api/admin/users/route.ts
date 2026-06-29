import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import type { UserRow } from '@/types/user-management'

/**
 * GET /api/admin/users — Return all users from public.users, ordered by display_name.
 *
 * Authentication: requireAdmin (401 if not authenticated, 403 if not admin).
 * Uses service-role client to bypass RLS and read all rows.
 */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('users')
      .select('id, email, display_name, role')
      .order('display_name', { ascending: true })

    if (error) {
      console.error('[GET /api/admin/users] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const users: UserRow[] = (data ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      display_name: (row.display_name as string | null) ?? null,
      role: row.role === 'admin' ? ('admin' as const) : ('member' as const),
    }))

    return NextResponse.json(users)
  } catch (err) {
    console.error('[GET /api/admin/users] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
