import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * PATCH /api/settings/display-name — Self-service update of the caller's own
 * display name (STORY-21).
 *
 * Authentication: requireAuth (any logged-in user, not admin-only — this is
 * self-service, unlike the admin-management routes).
 * Body: { displayName: string }
 * Validation: displayName must be non-empty after trimming (AC4).
 * Scope: updates WHERE id = the caller's own id only, never another user's.
 *
 * Response body explicitly returns the persisted (trimmed) value —
 * { displayName: trimmedName } — so the client form can sync its input to
 * the actual persisted value rather than the pre-save untrimmed one.
 */
export async function PATCH(request: NextRequest) {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  // Wrap request.json() separately so malformed JSON returns 400, not 500
  // (project convention: invalid JSON body -> 400).
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const rec = body as Record<string, unknown>
    const trimmedName =
      typeof rec?.displayName === 'string' ? (rec.displayName as string).trim() : ''

    if (!trimmedName) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('users')
      .update({ display_name: trimmedName })
      .eq('id', result.user.id)
      .select('id')

    if (error) {
      console.error('[PATCH /api/settings/display-name] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      console.error('[PATCH /api/settings/display-name] no row updated for user', result.user.id)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ displayName: trimmedName })
  } catch (err) {
    console.error('[PATCH /api/settings/display-name] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
