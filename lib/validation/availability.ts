/**
 * parseBlockedDate — Validates a raw `date` payload value as a plain
 * `YYYY-MM-DD` calendar date string, returning the normalized string or
 * `null` if invalid (STORY-25 AC5, `invalid_date`).
 *
 * Validation is regex + UTC round-trip, never `new Date(dateStr)` directly
 * (which parses in the local/host timezone and could shift the effective
 * weekday) and never local-timezone arithmetic — per the Technical Notes'
 * "avoid timezone conversions that could shift the weekday" guidance.
 *
 * The round-trip catches rollover dates that the regex alone would accept
 * (e.g. `2026-02-30`): constructing via `Date.UTC(y, m-1, d)` normalizes an
 * out-of-range day/month by rolling into the following month, so comparing
 * the constructed date's UTC components back against the parsed input
 * detects the mismatch.
 */
export function parseBlockedDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const utcMs = Date.UTC(year, month - 1, day)
  const roundTrip = new Date(utcMs)

  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    return null
  }

  return raw
}

/**
 * isSunday — Checks whether an already-validated `YYYY-MM-DD` date string
 * falls on a Sunday (STORY-25 AC5, `not_sunday`).
 *
 * Kept separate from parseBlockedDate so the route handler can emit distinct
 * `invalid_date` vs `not_sunday` error codes. Parses the string's UTC
 * components directly (not `new Date(dateStr)` in local time) to avoid any
 * timezone-driven weekday shift.
 */
export function isSunday(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCDay() === 0
}
