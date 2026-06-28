import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'

/**
 * GET /api/admin/ping — Stub Admin-only endpoint for STORY-04.
 *
 * Used to verify server-side role enforcement:
 *   - 401 if no valid session
 *   - 403 if authenticated as Member
 *   - 200 { ok: true, role: 'admin' } if authenticated as Admin
 */
export async function GET() {
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  return NextResponse.json({ ok: true, role: result.role })
}
