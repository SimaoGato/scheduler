'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { RoleRow } from '@/types/roles'

interface Props {
  initialRoles: RoleRow[]
}

// Client-side shape check mirrors the server's parseDefaultSlots (blank,
// non-numeric, zero, negative, or decimal are invalid). This is UX-only
// pre-validation; the server remains the source of truth (STORY-17 AC3).
function isValidSlotsInput(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return false
  const n = Number(trimmed)
  return Number.isInteger(n) && n >= 1
}

const ERROR_CODE_KEYS: Record<string, string> = {
  name_required: 'errorNameRequired',
  invalid_slots: 'errorInvalidSlots',
  duplicate_name: 'errorDuplicateName',
  not_found: 'errorGeneric',
}

export default function RoleTable({ initialRoles }: Props) {
  const t = useTranslations('RoleManagement')
  const [rows, setRows] = useState<RoleRow[]>(initialRoles)
  const [addName, setAddName] = useState('')
  const [addSlots, setAddSlots] = useState('1')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlots, setEditSlots] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  function mapErrorCode(code: unknown): string {
    const key = typeof code === 'string' ? ERROR_CODE_KEYS[code] : undefined
    return t(key ?? 'errorGeneric')
  }

  function sortRoles(list: RoleRow[]): RoleRow[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = addName.trim()
    if (!trimmedName) {
      setErrorMessage(t('errorNameRequired'))
      return
    }
    if (!isValidSlotsInput(addSlots)) {
      setErrorMessage(t('errorInvalidSlots'))
      return
    }

    setLoadingId('add')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, default_slots: addSlots }),
      })

      if (response.ok) {
        const newRole = (await response.json()) as RoleRow
        setRows((prev) => sortRoles([...prev, newRole]))
        setAddName('')
        setAddSlots('1')
      } else {
        const errorBody = await response.json().catch(() => ({}))
        setErrorMessage(mapErrorCode(errorBody.error))
      }
    } catch {
      setErrorMessage(t('errorGeneric'))
    } finally {
      setLoadingId(null)
    }
  }

  function startEdit(role: RoleRow) {
    setEditingId(role.id)
    setEditName(role.name)
    setEditSlots(String(role.default_slots))
    setErrorMessage(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditSlots('')
  }

  async function handleEdit(e: React.FormEvent, roleId: string) {
    e.preventDefault()
    const trimmedName = editName.trim()
    if (!trimmedName) {
      setErrorMessage(t('errorNameRequired'))
      return
    }
    if (!isValidSlotsInput(editSlots)) {
      setErrorMessage(t('errorInvalidSlots'))
      return
    }

    setLoadingId(roleId)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, default_slots: editSlots }),
      })

      if (response.ok) {
        setRows((prev) =>
          sortRoles(
            prev.map((row) =>
              row.id === roleId
                ? { ...row, name: trimmedName, default_slots: Number(editSlots) }
                : row
            )
          )
        )
        setEditingId(null)
        setEditName('')
        setEditSlots('')
      } else {
        const errorBody = await response.json().catch(() => ({}))
        setErrorMessage(mapErrorCode(errorBody.error))
      }
    } catch {
      setErrorMessage(t('errorGeneric'))
    } finally {
      setLoadingId(null)
    }
  }

  // STORY-19 AC2/AC3/AC5: confirm defaults to false (first click). A 409
  // role_in_use response sets the inline confirm prompt instead of the
  // generic error banner; the Confirm button re-calls this with confirm=true.
  async function handleRemove(roleId: string, confirm = false) {
    setLoadingId(roleId)
    setErrorMessage(null)

    try {
      const response = await fetch(
        `/api/admin/roles/${roleId}${confirm ? '?confirm=1' : ''}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setRows((prev) => prev.filter((row) => row.id !== roleId))
        setConfirmingRemoveId(null)
        setConfirmMessage(null)
      } else if (response.status === 409) {
        const errorBody = await response.json().catch(() => ({}))
        if (errorBody.error === 'role_in_use') {
          setConfirmingRemoveId(roleId)
          setConfirmMessage(t('confirmRemoveInUse', { count: errorBody.count ?? 0 }))
        } else {
          setErrorMessage(mapErrorCode(errorBody.error))
        }
      } else {
        const errorBody = await response.json().catch(() => ({}))
        setErrorMessage(mapErrorCode(errorBody.error))
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
          data-testid="rm-error"
          aria-live="polite"
          className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {confirmMessage && (
        <div
          data-testid="rm-confirm-banner"
          aria-live="polite"
          className="mb-4 rounded-md bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          {confirmMessage}
        </div>
      )}

      {/* Add-role section */}
      <h2 className="mb-3 text-lg font-medium">{t('addRoleLabel')}</h2>
      <form onSubmit={handleAdd} className="mb-8 flex gap-2">
        <input
          data-testid="rm-add-input"
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder={t('namePlaceholder')}
          aria-label={t('addNameLabel')}
          className="min-h-[44px] flex-1 rounded-md border px-3 py-2 text-sm"
          disabled={loadingId === 'add'}
        />
        <input
          data-testid="rm-add-slots-input"
          type="text"
          inputMode="numeric"
          value={addSlots}
          onChange={(e) => setAddSlots(e.target.value)}
          placeholder={t('slotsPlaceholder')}
          aria-label={t('addSlotsLabel')}
          className="min-h-[44px] w-24 rounded-md border px-3 py-2 text-sm"
          disabled={loadingId === 'add'}
        />
        <button
          data-testid="rm-add-submit"
          type="submit"
          disabled={loadingId === 'add'}
          className="min-h-[44px] rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingId === 'add' ? t('actionLoading') : t('saveButton')}
        </button>
      </form>

      {/* Roles list */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyList')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t('columnName')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('columnSlots')}</th>
                {/* Shrink-to-fit trailing column: w-[1%] + whitespace-nowrap makes
                    auto-layout give this column only the width its content needs,
                    so the other (unconstrained) columns absorb the remaining
                    width and this column stays pinned to the table's right edge. */}
                <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((role) => {
                const isLoading = loadingId === role.id
                const isEditing = editingId === role.id
                const isConfirmingRemove = confirmingRemoveId === role.id
                // STORY-19: block Edit/Remove on other rows while a confirm
                // prompt is open on any row (consistent with the existing
                // "block concurrent row actions" convention in this file).
                const blockedByOtherConfirm =
                  confirmingRemoveId !== null && confirmingRemoveId !== role.id
                // Save/Cancel must render in the actions <td>, not the name
                // or slots <td>, so the actions column position doesn't
                // jump between view/edit mode (AC4). A <form> can't validly
                // wrap multiple <td>s of a row, so the <input>s here are
                // form-associated by id via the `form` attribute to the
                // <form> that lives in the actions cell below.
                const editFormId = `rm-edit-form-${role.id}`
                return (
                  <tr key={role.id} className="border-b last:border-0 hover:bg-muted/25">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          form={editFormId}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder={t('namePlaceholder')}
                          aria-label={t('namePlaceholder')}
                          className="min-h-[44px] w-full rounded-md border px-3 py-1 text-sm"
                          disabled={isLoading}
                          autoFocus
                        />
                      ) : (
                        role.name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          form={editFormId}
                          value={editSlots}
                          onChange={(e) => setEditSlots(e.target.value)}
                          placeholder={t('slotsPlaceholder')}
                          aria-label={t('slotsPlaceholder')}
                          className="min-h-[44px] w-24 rounded-md border px-3 py-1 text-sm"
                          disabled={isLoading}
                        />
                      ) : (
                        role.default_slots
                      )}
                    </td>
                    {/* Shrink-to-fit trailing column: w-[1%] + whitespace-nowrap
                        makes auto-layout give this column only the width its
                        content needs, so the name/slots columns absorb the
                        remaining width and this column stays pinned to the
                        table's right edge. */}
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-right">
                      {isEditing ? (
                        <form
                          id={editFormId}
                          onSubmit={(e) => handleEdit(e, role.id)}
                          className="flex justify-end gap-2"
                        >
                          <button
                            type="submit"
                            data-testid={`rm-save-${role.id}`}
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('saveButton')}
                          </button>
                          <button
                            type="button"
                            data-testid={`rm-cancel-${role.id}`}
                            onClick={cancelEdit}
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('cancelButton')}
                          </button>
                        </form>
                      ) : isConfirmingRemove ? (
                        <div className="flex justify-end gap-2">
                          <button
                            data-testid={`rm-remove-confirm-${role.id}`}
                            onClick={() => handleRemove(role.id, true)}
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('confirmRemoveButton')}
                          </button>
                          <button
                            type="button"
                            data-testid={`rm-remove-cancel-${role.id}`}
                            onClick={cancelRemoveConfirm}
                            disabled={isLoading}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('cancelButton')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            data-testid={`rm-edit-${role.id}`}
                            onClick={() => startEdit(role)}
                            disabled={isLoading || loadingId !== null || blockedByOtherConfirm}
                            className="min-h-[44px] rounded-md border px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('editButton')}
                          </button>
                          <button
                            data-testid={`rm-remove-${role.id}`}
                            onClick={() => handleRemove(role.id)}
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
