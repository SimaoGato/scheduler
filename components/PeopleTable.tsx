'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { PersonRow } from '@/types/people'

interface Props {
  initialPeople: PersonRow[]
}

export default function PeopleTable({ initialPeople }: Props) {
  const t = useTranslations('PeopleManagement')
  const [rows, setRows] = useState<PersonRow[]>(initialPeople)
  const [addName, setAddName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = addName.trim()
    if (!trimmed) {
      setErrorMessage(t('errorNameRequired'))
      return
    }
    setLoadingId('add')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/admin/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })

      if (response.ok) {
        const newPerson = (await response.json()) as PersonRow
        setRows((prev) => [newPerson, ...prev])
        setAddName('')
      } else {
        setErrorMessage(t('errorGeneric'))
      }
    } catch {
      setErrorMessage(t('errorGeneric'))
    } finally {
      setLoadingId(null)
    }
  }

  function startEdit(person: PersonRow) {
    setEditingId(person.id)
    setEditName(person.name)
    setErrorMessage(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
  }

  async function handleEdit(e: React.FormEvent, personId: string) {
    e.preventDefault()
    const trimmed = editName.trim()
    if (!trimmed) {
      setErrorMessage(t('errorNameRequired'))
      return
    }
    setLoadingId(personId)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/people/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })

      if (response.ok) {
        setRows((prev) =>
          prev.map((row) => (row.id === personId ? { ...row, name: trimmed } : row))
        )
        setEditingId(null)
        setEditName('')
      } else {
        setErrorMessage(t('errorGeneric'))
      }
    } catch {
      setErrorMessage(t('errorGeneric'))
    } finally {
      setLoadingId(null)
    }
  }

  async function handleRemove(personId: string) {
    setLoadingId(personId)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/people/${personId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setRows((prev) => prev.filter((row) => row.id !== personId))
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
        <div
          data-testid="pm-error"
          aria-live="polite"
          className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* Add-person section (N1: addPersonLabel as h2 heading) */}
      <h2 className="mb-3 text-lg font-medium">{t('addPersonLabel')}</h2>
      <form onSubmit={handleAdd} className="mb-8 flex gap-2">
        <input
          data-testid="pm-add-input"
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          disabled={loadingId === 'add'}
        />
        <button
          data-testid="pm-add-submit"
          type="submit"
          disabled={loadingId === 'add'}
          className="min-h-[44px] rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingId === 'add' ? t('actionLoading') : t('saveButton')}
        </button>
      </form>

      {/* People list */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyList')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t('columnName')}</th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((person) => {
                const isLoading = loadingId === person.id
                const isEditing = editingId === person.id
                return (
                  <tr key={person.id} className="border-b last:border-0 hover:bg-muted/25">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleEdit(e, person.id)}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t('namePlaceholder')}
                            className="flex-1 rounded-md border px-3 py-1 text-sm"
                            disabled={isLoading}
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('saveButton')}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('cancelButton')}
                          </button>
                        </form>
                      ) : (
                        person.name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!isEditing && (
                        <div className="flex gap-2">
                          <button
                            data-testid={`pm-edit-${person.id}`}
                            onClick={() => startEdit(person)}
                            disabled={isLoading || loadingId !== null}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('editButton')}
                          </button>
                          <button
                            data-testid={`pm-remove-${person.id}`}
                            onClick={() => handleRemove(person.id)}
                            disabled={isLoading || loadingId !== null}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('removeButton')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
