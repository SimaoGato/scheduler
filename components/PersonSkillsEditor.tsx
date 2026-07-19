'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { RoleRow } from '@/types/roles'
import type { PersonSkill } from '@/types/skills'

interface Props {
  personId: string
  personName: string
  roles: RoleRow[]
  initialSkills: PersonSkill[]
}

const LEVELS = [1, 2, 3] as const

const ERROR_CODE_KEYS: Record<string, string> = {
  invalid_level: 'errorInvalidLevel',
}

type SkillsState = Record<string, 1 | 2 | 3 | undefined>

function skillsToState(skills: PersonSkill[]): SkillsState {
  const state: SkillsState = {}
  for (const skill of skills) {
    state[skill.role_id] = skill.level
  }
  return state
}

/**
 * PersonSkillsEditor — per-role radio group (1/2/3/none), auto-save on tap
 * (STORY-18).
 *
 * Auto-save per tap (no separate Save button, decision 2): selecting a level
 * fires PUT immediately; selecting "Sem nível" fires DELETE immediately.
 * Double-tap/race guard: every radio input for a given role is disabled
 * while that role's own request is in-flight (`savingRoleIds.has(role.id)`).
 * `savingRoleIds` is a Set (not a single scalar) so that concurrent saves on
 * different roles are tracked independently — starting a save on role B
 * while role A is still in-flight must not un-gate role A's disabled state,
 * and whichever role's request resolves first must only clear its own entry.
 *
 * A 404 from the DELETE call is treated as a benign no-op (state already
 * reflects "no level"), not an error — a raced double-tap unassign lands on
 * an already-removed row, which is exactly the end state the user wanted.
 */
export default function PersonSkillsEditor({ personId, personName, roles, initialSkills }: Props) {
  const t = useTranslations('SkillManagement')
  const [skills, setSkills] = useState<SkillsState>(() => skillsToState(initialSkills))
  const [savingRoleIds, setSavingRoleIds] = useState<Set<string>>(() => new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function mapErrorCode(code: unknown): string {
    const key = typeof code === 'string' ? ERROR_CODE_KEYS[code] : undefined
    return t(key ?? 'errorGeneric')
  }

  async function handleSelect(roleId: string, level: 1 | 2 | 3 | null) {
    const previousLevel = skills[roleId]
    setSavingRoleIds((prev) => new Set(prev).add(roleId))
    setErrorMessage(null)
    // Optimistic UI update.
    setSkills((prev) => ({ ...prev, [roleId]: level ?? undefined }))

    try {
      const url = `/api/admin/people/${personId}/skills/${roleId}`
      const response =
        level === null
          ? await fetch(url, { method: 'DELETE' })
          : await fetch(url, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ level }),
            })

      if (!response.ok) {
        // A 404 on DELETE is a benign no-op: the end state ("no level") is
        // already what the optimistic update set, so don't revert or error.
        if (level === null && response.status === 404) {
          return
        }
        setSkills((prev) => ({ ...prev, [roleId]: previousLevel }))
        const errorBody = await response.json().catch(() => ({}))
        setErrorMessage(mapErrorCode(errorBody.error))
      }
    } catch {
      setSkills((prev) => ({ ...prev, [roleId]: previousLevel }))
      setErrorMessage(t('errorGeneric'))
    } finally {
      setSavingRoleIds((prev) => {
        const next = new Set(prev)
        next.delete(roleId)
        return next
      })
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{t('title', { name: personName })}</h1>

      {errorMessage && (
        <div
          data-testid="skills-error"
          aria-live="polite"
          className="mb-4 rounded-md bg-destructive px-4 py-3 text-sm text-destructive-foreground"
        >
          {errorMessage}
        </div>
      )}

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyRoles')}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {roles.map((role) => {
            const isSaving = savingRoleIds.has(role.id)
            const currentLevel = skills[role.id]
            return (
              <fieldset key={role.id} className="rounded-md border p-4">
                <legend className="mb-2 px-1 text-sm font-medium">{role.name}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    data-testid={`skills-role-${role.id}-none`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:hover:bg-primary"
                  >
                    <input
                      type="radio"
                      name={`skill-${role.id}`}
                      checked={currentLevel === undefined}
                      onChange={() => handleSelect(role.id, null)}
                      disabled={isSaving}
                      aria-label={t('noLevelOptionAria', { role: role.name })}
                      className="sr-only"
                    />
                    {t('noLevelOption')}
                  </label>
                  {LEVELS.map((level) => (
                    <label
                      key={level}
                      data-testid={`skills-role-${role.id}-${level}`}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:hover:bg-primary"
                    >
                      <input
                        type="radio"
                        name={`skill-${role.id}`}
                        checked={currentLevel === level}
                        onChange={() => handleSelect(role.id, level)}
                        disabled={isSaving}
                        aria-label={t('levelOptionAria', { role: role.name, level })}
                        className="sr-only"
                      />
                      {t(`level${level}`)}
                    </label>
                  ))}
                  <span aria-live="polite" className="text-sm text-muted-foreground">
                    {isSaving ? t('savingIndicator') : null}
                  </span>
                </div>
              </fieldset>
            )
          })}
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/admin/people"
          data-testid="skills-back-link"
          className="min-h-[44px] rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground inline-flex items-center"
        >
          {t('backToTeam')}
        </Link>
      </div>
    </div>
  )
}
