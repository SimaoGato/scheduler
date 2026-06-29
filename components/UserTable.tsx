'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { UserRow } from '@/types/user-management'

interface Props {
  initialUsers: UserRow[]
}

export default function UserTable({ initialUsers }: Props) {
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
      } else if (response.status === 409) {
        setErrorMessage(t('errorLastAdmin'))
      } else {
        setErrorMessage(t('errorGeneric'))
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
        <div data-testid="um-error" className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
              <th className="px-4 py-3 text-left font-medium"></th>
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
                  <td className="px-4 py-3">
                    {user.role === 'member' ? (
                      <button
                        onClick={() => handleRoleChange(user.id, 'admin')}
                        disabled={isLoading}
                        className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? t('actionLoading') : t('promoteButton')}
                      </button>
                    ) : (
                      <button
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
