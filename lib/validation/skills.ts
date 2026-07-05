/**
 * parseSkillLevel — Returns the validated skill level (1, 2, or 3), or null
 * if invalid.
 *
 * Unlike parseDefaultSlots (lib/validation/roles.ts), there is NO default
 * value here: level is always required on PUT, so `undefined`/`null` (key
 * omitted from the request body) is ALSO invalid, not "not specified →
 * default". This covers STORY-18 AC4: 0, 4, blank, non-numeric, decimal,
 * and negative values must all be rejected with 400 `invalid_level`.
 */
export function parseSkillLevel(raw: unknown): 1 | 2 | 3 | null {
  let n: number
  if (typeof raw === 'number') {
    n = raw
  } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    n = Number(raw.trim())
  } else {
    return null
  }
  return Number.isInteger(n) && (n === 1 || n === 2 || n === 3) ? (n as 1 | 2 | 3) : null
}
