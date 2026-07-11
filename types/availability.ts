/**
 * BlockedDatesResponse — the JSON shape of GET /api/availability/blocks
 * (STORY-25 AC4). `dates` lists the caller's own blocked Sundays as
 * `YYYY-MM-DD` strings; a date's absence means "available" (default state).
 *
 * No server-only imports: this type will be imported by STORY-26's Client
 * Component the same way `types/skills.ts` is imported by
 * PersonSkillsEditor. See CLAUDE.md §Shared types between Server and Client.
 */
export interface BlockedDatesResponse {
  dates: string[]
}
