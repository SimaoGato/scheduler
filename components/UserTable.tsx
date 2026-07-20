'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { UserRow } from '@/types/user-management'

interface Props {
  initialUsers: UserRow[]
  currentUserId: string
}

// CHORE-30: co-located pure helper for the avatar's initials, same "small
// pure helper lives next to its one consumer" convention as RoleTable.tsx's
// isValidSlotsInput. Takes the first letters of the first two words.
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('')
}

export default function UserTable({ initialUsers, currentUserId }: Props) {
  const t = useTranslations('UserManagement')
  const tAuth = useTranslations('Auth')
  const [rows, setRows] = useState<UserRow[]>(initialUsers)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member') {
    setLoadingId(userId)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        setRows((prev) =>
          prev.map((row) => (row.id === userId ? { ...row, role: newRole } : row))
        )
      } else {
        let code: string | undefined
        try {
          const errBody = await response.json()
          code = typeof errBody?.error === 'string' ? errBody.error : undefined
        } catch {
          code = undefined
        }
        const errorMap: Record<string, string> = {
          last_admin: t('errorLastAdmin'),
          self_demotion: t('errorSelfDemotion'),
        }
        setErrorMessage(code && errorMap[code] ? errorMap[code] : t('errorGeneric'))
      }
    } catch {
      setErrorMessage(t('errorGeneric'))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      {errorMessage && (
        <div data-testid="um-error" aria-live="polite" className="mb-4 rounded-md bg-destructive px-4 py-3 text-sm text-destructive-foreground">
          {errorMessage}
        </div>
      )}
      {/* Card-row list — CHORE-30, same idiom as CHORE-29's RoleTable.tsx.
          The right-hand group (badge + button) is intentionally nested but
          NOT flex-shrink-0 (CHORE-29's landmine/fix, see CLAUDE.md). */}
      <ul data-testid="um-list" className="flex flex-col gap-2.5">
        {rows.map((user) => {
          const isLoading = loadingId === user.id
          // Name text keeps today's exact behavior unchanged (Design decision
          // 2, reverted after Challenge cycle 1): only the avatar's initials
          // computation falls back to Auth.userFallback when display_name is
          // null/blank.
          const nameText = user.display_name ?? '—'
          const initialsSource =
            (user.display_name ?? '').trim() !== '' ? user.display_name! : tAuth('userFallback')
          const initials = getInitials(initialsSource)
          const roleBadgeClass =
            user.role === 'admin'
              ? 'rounded-full bg-header px-2 py-0.5 text-xs font-mono font-semibold text-header-foreground'
              : 'rounded-full border px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground'

          return (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3.5 text-card-foreground transition-colors hover:bg-muted/25"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground"
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{nameText}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={roleBadgeClass}>
                  {user.role === 'admin' ? t('roleAdmin') : t('roleMember')}
                </span>
                {user.id === currentUserId ? null : user.role === 'member' ? (
                  <button
                    data-testid={`um-promote-${user.id}`}
                    onClick={() => handleRoleChange(user.id, 'admin')}
                    disabled={isLoading}
                    className="min-h-[44px] rounded-full border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? t('actionLoading') : t('promoteButton')}
                  </button>
                ) : (
                  <button
                    data-testid={`um-demote-${user.id}`}
                    onClick={() => handleRoleChange(user.id, 'member')}
                    disabled={isLoading}
                    className="min-h-[44px] rounded-full border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? t('actionLoading') : t('demoteButton')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
