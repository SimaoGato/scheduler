import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { qualifiedRolesForPerson } from '@/lib/skills/qualified-roles'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/people/[id]/skills — List a person's skill levels,
 * restricted to currently-active roles (STORY-18 AC1/AC6).
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md convention).
 * Returns 404 if the person is not found or is inactive.
 */
export async function GET(
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

    const { data: person, error: personError } = await serviceClient
      .from('people')
      .select('id')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (personError) {
      console.error('[GET /api/admin/people/[id]/skills] person lookup error:', personError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!person) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const { data: skills, error } = await qualifiedRolesForPerson(serviceClient, id)

    if (error) {
      console.error('[GET /api/admin/people/[id]/skills] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    return NextResponse.json(skills ?? [])
  } catch (err) {
    console.error('[GET /api/admin/people/[id]/skills] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
