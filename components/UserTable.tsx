'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { UserRow } from '@/types/user-management'

interface Props {
  initialUsers: UserRow[]
  currentUserId: string
}

export default function UserTable({ initialUsers, currentUserId }: Props) {
  const t = useTranslations('UserManagement')
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
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t('columnName')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('columnEmail')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('columnRole')}</th>
              {/* Shrink-to-fit trailing column: w-[1%] + whitespace-nowrap makes
                  auto-layout give this column only the width its content needs,
                  so the other (unconstrained) columns absorb the remaining
                  width and this column stays pinned to the table's right edge. */}
              <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => {
              const isLoading = loadingId === user.id
              return (
                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/25">
                  <td className="px-4 py-3">{user.display_name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.role === 'admin' ? t('roleAdmin') : t('roleMember')}
                  </td>
                  <td className="w-[1%] whitespace-nowrap px-4 py-3 text-right">
                    {user.id === currentUserId ? null : user.role === 'member' ? (
                      <button
                        data-testid={`um-promote-${user.id}`}
                        onClick={() => handleRoleChange(user.id, 'admin')}
                        disabled={isLoading}
                        className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? t('actionLoading') : t('promoteButton')}
                      </button>
                    ) : (
                      <button
                        data-testid={`um-demote-${user.id}`}
                        onClick={() => handleRoleChange(user.id, 'member')}
                        disabled={isLoading}
                        className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? t('actionLoading') : t('demoteButton')}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
