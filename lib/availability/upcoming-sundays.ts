// No `import 'server-only'` here — same narrow exception class CLAUDE.md
// documents for lib/validation/availability.ts and
// lib/availability/blocked-dates.ts: this is a pure function with no
// secrets and no DB access, and it must be directly importable by the
// Playwright integration suite (e2e-integration/availability.spec.ts AC1) to
// independently compute the expected date list from a known reference date.

/**
 * getUpcomingSundays — Generates the next `count` Sunday dates as
 * `YYYY-MM-DD` strings, starting from `referenceDate`'s UTC calendar date
 * (STORY-26 Design decision 1).
 *
 * Inclusive of today if `referenceDate` is itself a Sunday, otherwise starts
 * from the next Sunday. Pure UTC date math (`Date.UTC` component
 * construction), same idiom as lib/validation/availability.ts — never a bare
 * `new Date(dateStr)`, which parses in the local/host timezone and could
 * shift the effective weekday.
 *
 * `count` must be a positive integer — a non-positive `count` (0 or
 * negative) returns an empty array rather than looping zero or a negative
 * number of times in unexpected ways. This is a defensive guard for a
 * standalone exported helper directly importable by the integration test
 * suite; the only current caller passes the constant `12`.
 */
export function getUpcomingSundays(count: number, referenceDate: Date = new Date()): string[] {
  if (count <= 0) {
    return []
  }

  const year = referenceDate.getUTCFullYear()
  const month = referenceDate.getUTCMonth()
  const day = referenceDate.getUTCDate()

  const daysUntilSunday = (7 - new Date(Date.UTC(year, month, day)).getUTCDay()) % 7

  const sundays: string[] = []
  for (let i = 0; i < count; i++) {
    const offset = daysUntilSunday + i * 7
    const sunday = new Date(Date.UTC(year, month, day + offset))
    sundays.push(sunday.toISOString().slice(0, 10))
  }

  return sundays
}
