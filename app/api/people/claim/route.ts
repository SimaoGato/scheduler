import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/people/claim — Self-service claim of an existing unlinked
 * public.people record on first login (STORY-11).
 *
 * Authentication: requireAuth (any logged-in user — this is member
 * self-service, not admin-only, unlike the admin-management routes).
 * Body: { person_id: UUID }
 *
 * Uses the service-role client (bypasses RLS) for the write, following the
 * established codebase precedent for member self-service writes
 * (app/api/settings/display-name/route.ts, STORY-21): requireAuth for
 * authentication, createServiceClient() for the write, with explicit
 * .eq(...) filters in application code for authorization.
 *
 * Concurrency (AC6) — two layers:
 *   1. The claim itself is an atomic UPDATE with
 *      WHERE id = :personId AND linked_user_id IS NULL AND is_active = true.
 *      Zero rows affected (already claimed by someone else, deactivated, or
 *      a bad id — all collapse to the same UX) -> 409 already_claimed.
 *   2. A partial unique index on people.linked_user_id (migration
 *      20260705000001) catches a 23505 if the caller is already linked to a
 *      *different* person (e.g. a race between two tabs) -> 409
 *      already_linked.
 */
export async function POST(request: NextRequest) {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result

  // Wrap request.json() separately so malformed JSON returns 400, not 500
  // (project convention: invalid JSON body -> 400).
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  try {
    const rec = body as Record<string, unknown>
    const personId = typeof rec?.person_id === 'string' ? rec.person_id : ''

    if (!UUID_RE.test(personId)) {
      return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('people')
      .update({ linked_user_id: result.user.id })
      .eq('id', personId)
      .is('linked_user_id', null)
      .eq('is_active', true)
      .select('id')

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'already_linked' }, { status: 409 })
      }
      console.error('[POST /api/people/claim] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'already_claimed' }, { status: 409 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/people/claim] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
