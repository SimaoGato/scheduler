'use client'

import { useState } from 'react'
import { useTranslations, useFormatter } from 'next-intl'

interface Props {
  sundays: string[]
  initialBlockedDates: string[]
}

/**
 * AvailabilityToggleList — Member-facing list of upcoming Sundays, each a
 * single tap-to-toggle button (STORY-26).
 *
 * State:
 * - `blockedDates` (Set<string>) — optimistic UI state, seeded from the
 *   server-rendered `initialBlockedDates` (AC3).
 * - `pendingDates` (Set<string>) — STORY-18 keyed in-flight pattern (AC4):
 *   a Set, not a scalar, so concurrent toggles on different dates don't
 *   clobber each other's disabled state.
 * - `errorMessage` — cleared at the very start of every `handleToggle` call
 *   (AC5), before the optimistic flip, so a stale error from a previous
 *   failed toggle never lingers once a new action starts.
 *
 * Design decision 3: each date is a single
 * `<button type="button" aria-pressed={isBlocked}>` (not a checkbox/radio
 * pair) — block/unblock is a pure boolean, not a multi-option choice.
 *
 * Design decision 4: every failure mode (invalid_date, not_sunday,
 * no_linked_person, internal, thrown network errors) maps to one generic
 * `errorGeneric` message — these codes are structurally near-unreachable in
 * normal operation (dates are server-generated valid Sundays), so there is
 * no per-code mapping table here.
 */
export default function AvailabilityToggleList({ sundays, initialBlockedDates }: Props) {
  const t = useTranslations('Availability')
  const format = useFormatter()
  const [blockedDates, setBlockedDates] = useState<Set<string>>(
    () => new Set(initialBlockedDates)
  )
  const [pendingDates, setPendingDates] = useState<Set<string>>(() => new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleToggle(date: string) {
    // Critical fix (STORY-26 revision cycle 1): clear any stale error banner
    // from a previous failed toggle before starting a new action — must be
    // the first line, before the optimistic flip.
    setErrorMessage(null)

    const wasBlocked = blockedDates.has(date)
    setPendingDates((prev) => new Set(prev).add(date))
    // Optimistic UI update.
    setBlockedDates((prev) => {
      const next = new Set(prev)
      if (wasBlocked) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })

    try {
      const response = wasBlocked
        ? await fetch(`/api/availability/blocks/${date}`, { method: 'DELETE' })
        : await fetch('/api/availability/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date }),
          })

      if (!response.ok) {
        setBlockedDates((prev) => {
          const next = new Set(prev)
          if (wasBlocked) {
            next.add(date)
          } else {
            next.delete(date)
          }
          return next
        })
        setErrorMessage(t('errorGeneric'))
      }
    } catch {
      setBlockedDates((prev) => {
        const next = new Set(prev)
        if (wasBlocked) {
          next.add(date)
        } else {
          next.delete(date)
        }
        return next
      })
      setErrorMessage(t('errorGeneric'))
    } finally {
      setPendingDates((prev) => {
        const next = new Set(prev)
        next.delete(date)
        return next
      })
    }
  }

  function formatSunday(date: string): string {
    const [year, month, day] = date.split('-').map(Number)
    return format.dateTime(new Date(Date.UTC(year, month - 1, day)), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">{t('title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('instructions')}</p>

      {errorMessage && (
        <div
          data-testid="availability-error"
          aria-live="polite"
          className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {sundays.map((date) => {
          const isBlocked = blockedDates.has(date)
          const isPending = pendingDates.has(date)
          const formattedDate = formatSunday(date)
          const stateLabel = isBlocked ? t('stateBlocked') : t('stateAvailable')
          return (
            <li key={date}>
              <button
                type="button"
                aria-pressed={isBlocked}
                disabled={isPending}
                onClick={() => handleToggle(date)}
                aria-label={`${formattedDate} — ${stateLabel}`}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${
                  isBlocked
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'hover:bg-accent'
                }`}
              >
                <span>{formattedDate}</span>
                <span className="font-medium">{stateLabel}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
