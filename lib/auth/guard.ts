import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export interface AuthUser {
  user: User
  role: 'admin' | 'member'
}

/**
 * requireAuth — Resolves the authenticated user and their role from public.users.
 *
 * The entire Supabase block (client construction, getUser, role SELECT) is
 * wrapped in a single try/catch. Any error (missing env vars, network failure,
 * invalid credentials) falls through as a 401 response rather than a 500.
 * This matches the error-handling pattern in proxy.ts.
 *
 * Returns AuthUser on success.
 * Returns a 401 NextResponse if no session, role row is missing, or any error.
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: row, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !row) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return { user, role: row.role as 'admin' | 'member' }
  } catch {
    // Any unexpected error (missing env, network, etc.) → treat as unauthenticated
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

/**
 * requireAdmin — Like requireAuth but additionally enforces role === 'admin'.
 *
 * Returns a 401 NextResponse if no valid session.
 * Returns a 403 NextResponse if authenticated but role !== 'admin'.
 * Returns AuthUser & { role: 'admin' } on success.
 */
export async function requireAdmin(): Promise<(AuthUser & { role: 'admin' }) | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result // propagate 401

  if (result.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return result as AuthUser & { role: 'admin' }
}
