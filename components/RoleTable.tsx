'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { RoleRow } from '@/types/roles'

interface Props {
  initialRoles: RoleRow[]
  qualifiedCounts?: Record<string, number>
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

export default function RoleTable({ initialRoles, qualifiedCounts = {} }: Props) {
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
          className="mb-4 rounded-md bg-destructive px-4 py-3 text-sm text-destructive-foreground"
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

      {/* Add-role section — CHORE-29 AC1: this form (not the row list) was
          the actual source of the pre-existing 375px overflow bug. flex-1
          text inputs don't shrink below their intrinsic content width unless
          min-w-0 overrides the flex item's default min-width: auto; without
          it, the row's total intrinsic width exceeds the viewport at narrow
          widths. flex-wrap sm:flex-nowrap (CLAUDE.md flexbox pattern) lets
          the controls wrap onto their own lines below 640px, never at
          desktop/tablet widths where there is ample space. */}
      <h2 className="mb-3 text-lg font-medium">{t('addRoleLabel')}</h2>
      <form onSubmit={handleAdd} className="mb-8 flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          data-testid="rm-add-input"
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder={t('namePlaceholder')}
          aria-label={t('addNameLabel')}
          className="min-h-[44px] min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
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

      {/* Roles list — CHORE-29: card-style <ul>/<li> rows (replaces the
          previous <table>, which overflowed horizontally at 375px). The
          page's existing <h1>{t('title')}</h1> labels the list for screen
          readers; no separate caption is needed for a non-table layout. */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyList')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((role) => {
            const isLoading = loadingId === role.id
            const isEditing = editingId === role.id
            const isConfirmingRemove = confirmingRemoveId === role.id
            // STORY-19: block Edit/Remove on other rows while a confirm
            // prompt is open on any row (consistent with the existing
            // "block concurrent row actions" convention in this file).
            const blockedByOtherConfirm =
              confirmingRemoveId !== null && confirmingRemoveId !== role.id
            const qualifiedCount = qualifiedCounts[role.id] ?? 0

            return (
              <li
                key={role.id}
                className="rounded-lg border bg-card px-4 py-3.5 text-card-foreground transition-colors hover:bg-muted/25"
              >
                {isEditing ? (
                  // The whole row's interactive content is the <form> itself
                  // now that it's a single container (no more STORY-14
                  // form={editFormId} attribute-association trick, which
                  // existed only to bridge separate <td>s of one <tr>).
                  <form
                    onSubmit={(e) => handleEdit(e, role.id)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t('namePlaceholder')}
                      aria-label={t('namePlaceholder')}
                      className="min-h-[44px] min-w-0 flex-1 rounded-md border px-3 py-1 text-sm"
                      disabled={isLoading}
                      autoFocus
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editSlots}
                      onChange={(e) => setEditSlots(e.target.value)}
                      placeholder={t('slotsPlaceholder')}
                      aria-label={t('slotsPlaceholder')}
                      className="min-h-[44px] w-24 flex-shrink-0 rounded-md border px-3 py-1 text-sm"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      data-testid={`rm-save-${role.id}`}
                      disabled={isLoading || blockedByOtherConfirm}
                      className="min-h-[44px] flex-shrink-0 rounded-full border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? t('actionLoading') : t('saveButton')}
                    </button>
                    <button
                      type="button"
                      data-testid={`rm-cancel-${role.id}`}
                      onClick={cancelEdit}
                      disabled={isLoading || blockedByOtherConfirm}
                      className="min-h-[44px] flex-shrink-0 rounded-full border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('cancelButton')}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{role.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {t('peopleCanServeCount', { count: qualifiedCount })}
                      </p>
                    </div>
                    {/* CLAUDE.md BUGFIX-06 lesson: nesting a second,
                        independent flex-wrap container inside this row can
                        pass scrollWidth overflow checks per-context while
                        the combined visual layout wraps incoherently.
                        This wrapper is intentionally kept nested (not
                        flattened) because flattening was tried and real-
                        browser-rendered at 375px with a long pt-PT role
                        name — it regressed badly (the name/meta block's
                        `flex-1` item has a zero flex-basis, so once the
                        badge + pill buttons became sibling flex items of
                        the same outer line instead of one grouped item,
                        they consumed the row's width first and left almost
                        none for the name, wrapping it across 6+ narrow
                        lines). Grouping the badge + buttons under this
                        wrapper makes them behave as one outer flex item, so
                        the outer row has only one wrap decision to make —
                        name-block vs. actions-block.
                        Correction from PR #64 re-review cycle 2: the
                        wrapper must NOT be `flex-shrink-0`. A prior version
                        set `flex-shrink-0` here to fix the outer wrap
                        decision, but that also fixes this item's hypothetical
                        width to its max-content size (all children
                        unwrapped) before the outer flex algorithm considers
                        wrapping — so this wrapper's own internal
                        `flex-wrap` never got a chance to engage. That's
                        invisible in the default badge+Editar+Remover state
                        (~200px, well under any tested viewport) but
                        overflows in the confirm-remove state
                        (badge+"Remover mesmo assim"+"Cancelar" ~468px, wider
                        than the 375px row itself). Leaving `flex-shrink`
                        at its default (1) lets this wrapper shrink when the
                        outer row is tight, which lets its own `flex-wrap`
                        break the badge/buttons onto multiple lines instead
                        of overflowing. Screenshotted at 375px/390px in both
                        the default and confirm-remove states; see
                        e2e-integration/roles-card-list.spec.ts AC1. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono font-semibold text-secondary-foreground">
                        {t('slotsPerSundayBadge', { count: role.default_slots })}
                      </span>
                      {isConfirmingRemove ? (
                        <>
                          <button
                            data-testid={`rm-remove-confirm-${role.id}`}
                            onClick={() => handleRemove(role.id, true)}
                            disabled={isLoading}
                            className="min-h-[44px] flex-shrink-0 rounded-full border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('confirmRemoveButton')}
                          </button>
                          <button
                            type="button"
                            data-testid={`rm-remove-cancel-${role.id}`}
                            onClick={cancelRemoveConfirm}
                            disabled={isLoading}
                            className="min-h-[44px] flex-shrink-0 rounded-full border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('cancelButton')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            data-testid={`rm-edit-${role.id}`}
                            onClick={() => startEdit(role)}
                            disabled={isLoading || loadingId !== null || blockedByOtherConfirm}
                            className="min-h-[44px] flex-shrink-0 rounded-full border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {t('editButton')}
                          </button>
                          <button
                            data-testid={`rm-remove-${role.id}`}
                            onClick={() => handleRemove(role.id)}
                            disabled={isLoading || loadingId !== null || blockedByOtherConfirm}
                            className="min-h-[44px] flex-shrink-0 rounded-full border px-4 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isLoading ? t('actionLoading') : t('removeButton')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
