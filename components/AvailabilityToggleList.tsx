'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useFormatter } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface Props {
  sundays: string[]
  initialBlockedDates: string[]
  personId?: string
  personName?: string
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
 *
 * STORY-27 admin-mode extension: `personId`/`personName` are optional props
 * that default to `undefined`, so the already-shipped Member path (which
 * never passes them) has zero behavioral change. `isAdminMode` gates only
 * (a) which endpoint URLs handleToggle calls, (b) the title text, and (c)
 * whether a "back to team" link renders — the state machine below
 * (blockedDates/pendingDates/errorMessage, optimistic flip/revert, the
 * finally cleanup) is untouched.
 *
 * CHORE-19 (Card-based redesign): adds a `useMemo`-derived summary
 * (available/blocked counts, next-unavailable date) computed from the
 * `sundays` prop + live `blockedDates` state, so it stays accurate as the
 * user toggles — zero new Supabase queries/API routes. The whole component
 * is wrapped in one `Card` with two `CardContent` blocks (summary metrics,
 * then instructions/error-banner/list), mirroring CHORE-18's
 * `admin-team-summary` two-`CardContent` precedent. Copy is fully neutral/
 * shared between Member and Admin-on-behalf modes (no second-person
 * framing) — the pre-existing personalized `adminTitle` heading predates
 * this story and is untouched.
 */
export default function AvailabilityToggleList({
  sundays,
  initialBlockedDates,
  personId,
  personName,
}: Props) {
  const t = useTranslations('Availability')
  const format = useFormatter()
  const [blockedDates, setBlockedDates] = useState<Set<string>>(
    () => new Set(initialBlockedDates)
  )
  const [pendingDates, setPendingDates] = useState<Set<string>>(() => new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // CHORE-19: live-accurate summary metrics, derived from the sundays prop
  // (ascending, per getUpcomingSundays) + the live blockedDates Set. Every
  // existing setBlockedDates call already creates a new Set (STORY-26's
  // optimistic-update pattern), so this recomputes correctly on every toggle.
  const { availableCount, blockedCount, nextUnavailableDate } = useMemo(() => {
    const blocked = sundays.filter((date) => blockedDates.has(date))
    return {
      availableCount: sundays.length - blocked.length,
      blockedCount: blocked.length,
      nextUnavailableDate: sundays.find((date) => blockedDates.has(date)) ?? null,
    }
  }, [sundays, blockedDates])

  const isAdminMode = personId !== undefined
  const blockUrl = isAdminMode
    ? `/api/admin/people/${personId}/availability`
    : '/api/availability/blocks'
  const unblockUrl = (date: string) =>
    isAdminMode
      ? `/api/admin/people/${personId}/availability/${date}`
      : `/api/availability/blocks/${date}`

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
        ? await fetch(unblockUrl(date), { method: 'DELETE' })
        : await fetch(blockUrl, {
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

  const formattedNextUnavailable =
    nextUnavailableDate !== null ? formatSunday(nextUnavailableDate) : null

  return (
    <Card data-testid="availability-card">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl font-semibold">
            {isAdminMode ? t('adminTitle', { name: personName ?? '' }) : t('title')}
          </h1>
        </CardTitle>
        <CardDescription>{t('summaryIntro', { total: sundays.length })}</CardDescription>
      </CardHeader>

      <CardContent data-testid="availability-summary">
        <ul className="mb-4 flex flex-col gap-1 text-sm">
          <li className="text-xl font-bold">
            {t('summaryAvailableCount', { count: availableCount })}
          </li>
          <li className="text-xl font-bold">
            {t('summaryBlockedCount', { count: blockedCount })}
          </li>
        </ul>
        {formattedNextUnavailable !== null ? (
          <p className="text-sm">
            {t('summaryNextUnavailable', { date: formattedNextUnavailable })}
          </p>
        ) : (
          <p className="text-sm">
            {t('summaryNoUpcomingBlocks', { total: sundays.length })}
          </p>
        )}
      </CardContent>

      <CardContent>
        <p className="mb-6 text-sm text-muted-foreground">{t('instructions')}</p>

        {errorMessage && (
          <div
            data-testid="availability-error"
            aria-live="polite"
            className="mb-4 rounded-md bg-destructive px-4 py-3 text-sm text-destructive-foreground"
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
                  className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${
                    isBlocked ? 'border-destructive bg-destructive/10' : 'hover:bg-accent'
                  }`}
                >
                  <span>{formattedDate}</span>
                  <span
                    className={
                      isBlocked
                        ? 'rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground'
                        : 'font-medium'
                    }
                  >
                    {stateLabel}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {isAdminMode && (
          <div className="mt-8">
            <Link
              href="/admin/people"
              data-testid="availability-back-link"
              className="min-h-[44px] rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground inline-flex items-center"
            >
              {t('backToTeam')}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
