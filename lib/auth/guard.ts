import 'server-only'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

export interface AuthUser {
  user: User
  role: 'admin' | 'member'
}

/**
 * requireAuth — Resolves the authenticated user and their role from public.users.
 *
 * Accepts the incoming NextRequest so it reads cookies from request.cookies
 * directly (matching the middleware pattern in proxy.ts). Using next/headers
 * cookies() in Route Handlers does not reliably forward the browser's cookies
 * in Next.js 16 — request.cookies is the correct source for Route Handlers.
 *
 * The entire Supabase block is wrapped in a single try/catch; any error falls
 * through as a 401 response rather than a 500.
 *
 * Returns AuthUser on success.
 * Returns a 401 NextResponse if no session, role row is missing, or any error.
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser | NextResponse> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // Guards only read; token refresh is handled by proxy.ts for page routes.
          },
        },
      }
    )

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

    const role = row.role === 'admin' ? ('admin' as const) : ('member' as const)
    return { user, role }
  } catch (err) {
    // Any unexpected error (missing env, network, etc.) → treat as unauthenticated
    console.error('[requireAuth] unexpected error:', err)
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
export async function requireAdmin(
  request: NextRequest
): Promise<(AuthUser & { role: 'admin' }) | NextResponse> {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result // propagate 401

  if (result.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return result as AuthUser & { role: 'admin' }
}
