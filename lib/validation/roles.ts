/**
 * parseDefaultSlots — Returns the validated slot count, or null if invalid.
 *
 * `undefined`/`null` (key omitted from the request body) is NOT invalid — it
 * means "not specified" and defaults to 1 (AC2). An explicit blank string,
 * zero, negative, decimal, or non-numeric value IS invalid (AC3) and must
 * return null so the caller can 400.
 *
 * Shared between app/api/admin/roles/route.ts and
 * app/api/admin/roles/[id]/route.ts so the two Route Handlers stay in sync
 * without one importing from the other's file (STORY-17 review fix).
 */
export function parseDefaultSlots(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 1 // AC2: not specified → default 1
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 1 ? raw : null
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '' || !/^\d+$/.test(trimmed)) return null // blank/non-numeric/negative/decimal
    const n = Number(trimmed)
    return Number.isInteger(n) && n >= 1 ? n : null
  }
  return null
}
