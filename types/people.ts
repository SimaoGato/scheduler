/**
 * PersonRow — shared interface for the public.people table.
 *
 * No server-only imports: this type is used in both Server Components (admin
 * page) and Client Components (PeopleTable), so it must remain importable from
 * either runtime context. See CLAUDE.md §Shared types between Server and Client.
 *
 * linked_user_id is string | null (AC4: a person without a login is valid).
 */
export interface PersonRow {
  id: string
  name: string
  linked_user_id: string | null
  is_active: boolean
}
