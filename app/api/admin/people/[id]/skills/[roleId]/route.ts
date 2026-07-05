import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { createServiceClient } from '@/lib/supabase/service'
import { parseSkillLevel } from '@/lib/validation/skills'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PUT /api/admin/people/[id]/skills/[roleId] — Upsert a person's skill level
 * for a role (STORY-18 AC1/AC2/AC5).
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md convention).
 * Body: { level: 1 | 2 | 3 }
 * Validation (in order, all before touching Supabase):
 *   - id / roleId must be UUIDs (400 invalid_person_id / invalid_role_id)
 *   - JSON body must parse (400 invalid_json)
 *   - level must be 1, 2, or 3 (400 invalid_level) — covers AC4: 0, 4,
 *     blank, non-numeric, decimal, negative.
 * Returns 404 person_not_found / role_not_found if either is missing or
 * inactive. The composite-PK upsert (onConflict person_id,role_id) is what
 * gives AC1/AC2/AC5 (one row per pair, re-assign updates in place) at the DB
 * layer, not just app logic.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id, roleId } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_person_id' }, { status: 400 })
  }
  if (!UUID_RE.test(roleId)) {
    return NextResponse.json({ error: 'invalid_role_id' }, { status: 400 })
  }

  // Wrap request.json() separately so malformed JSON returns 400, not 500.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rec = body as Record<string, unknown>
  const level = parseSkillLevel(rec?.level)
  if (level === null) {
    return NextResponse.json({ error: 'invalid_level' }, { status: 400 })
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
      console.error('[PUT /api/admin/people/[id]/skills/[roleId]] person lookup error:', personError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!person) {
      return NextResponse.json({ error: 'person_not_found' }, { status: 404 })
    }

    const { data: role, error: roleError } = await serviceClient
      .from('roles')
      .select('id')
      .eq('id', roleId)
      .eq('is_active', true)
      .maybeSingle()

    if (roleError) {
      console.error('[PUT /api/admin/people/[id]/skills/[roleId]] role lookup error:', roleError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }
    if (!role) {
      return NextResponse.json({ error: 'role_not_found' }, { status: 404 })
    }

    // Mass-assignment guard: explicit object literal from validated locals
    // only — never upsert(body).
    //
    // Accepted risk (low-severity TOCTOU): there is a narrow window between
    // the role active-check above and this upsert where the role could be
    // soft-deleted concurrently, which would silently defeat the "no skills
    // on a soft-deleted role" guard. This is an admin-only surface with a
    // vanishingly small race window; not worth a transaction/lock for the
    // current scale of concurrent admin usage.
    const { data, error } = await serviceClient
      .from('person_role_skills')
      .upsert({ person_id: id, role_id: roleId, level }, { onConflict: 'person_id,role_id' })
      .select('role_id, level')
      .single()

    if (error) {
      console.error('[PUT /api/admin/people/[id]/skills/[roleId]] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    return NextResponse.json({ role_id: data.role_id, level: data.level })
  } catch (err) {
    console.error('[PUT /api/admin/people/[id]/skills/[roleId]] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/people/[id]/skills/[roleId] — Unassign a person's skill
 * level for a role (STORY-18 AC3). Hard delete: "no level" is represented by
 * row absence, not a soft-delete flag.
 *
 * Authentication: requireAdmin called BEFORE await params (CLAUDE.md convention).
 * Returns 404 not_found if no row exists for this (person_id, role_id) pair.
 * The route itself always returns 404 here regardless of caller; it's the
 * client (PersonSkillsEditor) that chooses to treat a raced-double-tap 404
 * as a benign no-op rather than an error.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  // Guard first, params second (CLAUDE.md: Route Handler dynamic params with auth guards)
  const result = await requireAdmin(request)
  if (result instanceof NextResponse) return result

  const { id, roleId } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_person_id' }, { status: 400 })
  }
  if (!UUID_RE.test(roleId)) {
    return NextResponse.json({ error: 'invalid_role_id' }, { status: 400 })
  }

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('person_role_skills')
      .delete()
      .eq('person_id', id)
      .eq('role_id', roleId)
      .select('person_id')

    if (error) {
      console.error('[DELETE /api/admin/people/[id]/skills/[roleId]] DB error:', error)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/admin/people/[id]/skills/[roleId]] unexpected error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
