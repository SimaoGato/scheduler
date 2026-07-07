'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
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
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

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
        // FW3: maintain server's alphabetical (pt) sort order after adding
        setRows((prev) =>
          [...prev, newPerson].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
        )
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

  // STORY-19 AC4/AC5: symmetric with RoleTable's handleRemove (Locked
  // decision 6 — people get the same warn+confirm UX as roles, not a
  // lesser/silent version). confirm defaults to false (first click); a 409
  // person_in_use response sets the inline confirm prompt instead of the
  // generic error banner.
  async function handleRemove(personId: string, confirm = false) {
    setLoadingId(personId)
    setErrorMessage(null)

    try {
      const response = await fetch(
        `/api/admin/people/${personId}${confirm ? '?confirm=1' : ''}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setRows((prev) => prev.filter((row) => row.id !== personId))
        setConfirmingRemoveId(null)
        setConfirmMessage(null)
      } else if (response.status === 409) {
        const errorBody = await response.json().catch(() => ({}))
        if (errorBody.error === 'person_in_use') {
          setConfirmingRemoveId(personId)
          setConfirmMessage(t('confirmRemoveInUse', { count: errorBody.count ?? 0 }))
        } else {
          setErrorMessage(t('errorGeneric'))
        }
      } else {
        setErrorMessage(t('errorGeneric'))
      }
    } catch {
      setErrorMessage(t('errorGeneric'))
    } finally {
      setLoadingId(null)
    }
  }

  function cancelRemoveConfirm() {
    setConfirmingRemoveId(null)
    setConfirmMessage(null)
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

      {confirmMessage && (
        <div
          data-testid="pm-confirm-banner"
          aria-live="polite"
          className="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          {confirmMessage}
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
          aria-label={t('addPersonLabel')}
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
                {/* Shrink-to-fit trailing column: w-[1%] + whitespace-nowrap makes
                    auto-layout give this column only the width its content needs,
                    so the other (unconstrained) columns absorb the remaining
                    width and this column stays pinned to the table's right edge. */}
                <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((person) => {
                const isLoading = loadingId === person.id
                const isEditing = editingId === person.id
                const isConfirmingRemove = confirmingRemoveId === person.id
                // STORY-19: block Editar/Remover/Competências on other rows
                // while a confirm prompt is open on any row — same
                // convention as RoleTable.tsx.
                const blockedByOtherConfirm =
                  confirmingRemoveId !== null && confirmingRemoveId !== person.id
                // Save/Cancel must render in the actions <td>, not this name
                // <td>, so the actions column position doesn't jump between
                // view/edit mode (AC4). A <form> can't validly wrap both
                // <td>s of a row, so the <input> here is form-associated by
                // id via the `form` attribute to the <form> that lives in
                // the actions cell below — Enter-to-submit still works.
                const editFormId = `pm-edit-form-${person.id}`
                return (
                  <tr key={person.id} className="border-b last:border-0 hover:bg-muted/25">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          form={editFormId}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder={t('namePlaceholder')}
                          aria-label={t('namePlaceholder')}
                          className="w-full rounded-md border px-3 py-1 text-sm"
                          disabled={isLoading}
                          autoFocus
                        />
                      ) : (
                        person.name
                      )}
                    </td>
                    {/* Shrink-to-fit trailing column: w-[1%] + whitespace-nowrap
                        makes auto-layout give this column only the width its
                        content needs, so the name column absorbs the
                        remaining width and this column stays pinned to the
                        table's right edge. */}
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-right">
                      {isEditing ? (
                        <form
                          id={editFormId}
                          onSubmit={(e) => handleEdit(e, person.id)}
                          className="flex justify-end gap-2"
                        >
                          <button
                            type="submit"
                            data-testid={`pm-save-${person.id}`}
                            disabled={isLoading || blockedByOtherConfirm}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('saveButton')}
                          </button>
                          <button
                            type="button"
                            data-testid={`pm-cancel-${person.id}`}
                            onClick={cancelEdit}
                            disabled={isLoading || blockedByOtherConfirm}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('cancelButton')}
                          </button>
                        </form>
                      ) : isConfirmingRemove ? (
                        <div className="flex flex-wrap justify-end gap-2 sm:flex-nowrap">
                          <button
                            data-testid={`pm-remove-confirm-${person.id}`}
                            onClick={() => handleRemove(person.id, true)}
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('confirmRemoveButton')}
                          </button>
                          <button
                            type="button"
                            data-testid={`pm-remove-cancel-${person.id}`}
                            onClick={cancelRemoveConfirm}
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('cancelButton')}
                          </button>
                        </div>
                      ) : (
                        // flex-wrap with sm:flex-nowrap: wrap only below sm (640px,
                        // Tailwind's default breakpoint), staying above the 375px
                        // mobile target. At sm and above (tablet/desktop), the three
                        // actions (Competências/Editar/Remover) render on one line.
                        // This prevents the buggy "always wraps" behavior where a
                        // flex-wrap container in a w-[1%] shrink-to-fit auto-layout
                        // column was reported as narrower than max-content, causing
                        // unconditional wrapping even at desktop widths.
                        <div className="flex flex-wrap justify-end gap-2 sm:flex-nowrap">
                          <Link
                            href={`/admin/people/${person.id}/skills`}
                            data-testid={`pm-skills-${person.id}`}
                            aria-disabled={blockedByOtherConfirm}
                            tabIndex={blockedByOtherConfirm ? -1 : undefined}
                            onClick={(e) => {
                              if (blockedByOtherConfirm) e.preventDefault()
                            }}
                            className={`flex min-h-[44px] items-center rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${blockedByOtherConfirm ? 'pointer-events-none opacity-50' : ''}`}
                          >
                            {t('skillsButton')}
                          </Link>
                          <button
                            data-testid={`pm-edit-${person.id}`}
                            onClick={() => startEdit(person)}
                            disabled={isLoading || loadingId !== null || blockedByOtherConfirm}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('editButton')}
                          </button>
                          <button
                            data-testid={`pm-remove-${person.id}`}
                            onClick={() => handleRemove(person.id)}
                            disabled={isLoading || loadingId !== null || blockedByOtherConfirm}
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
