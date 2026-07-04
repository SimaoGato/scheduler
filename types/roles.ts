/**
 * RoleRow — shared interface for the public.roles table.
 *
 * No server-only imports: this type is used in both Server Components (admin
 * page) and Client Components (RoleTable), so it must remain importable from
 * either runtime context. See CLAUDE.md §Shared types between Server and Client.
 *
 * default_slots is the per-role default number of slots on a normal Sunday
 * (STORY-17 AC1/AC2); it is a positive integer (>= 1).
 */
export interface RoleRow {
  id: string
  name: string
  default_slots: number
  is_active: boolean
}
