/**
 * PersonSkill — shared interface for a public.person_role_skills row, as
 * surfaced to callers (the role name is not always joined in; callers that
 * need it join separately against the roles list they already have).
 *
 * No server-only imports: this type is used in both Server Components (the
 * skills page) and Client Components (PersonSkillsEditor), so it must remain
 * importable from either runtime context. See CLAUDE.md §Shared types
 * between Server and Client.
 *
 * level is 1 (Iniciante) | 2 (Intermédio) | 3 (Especialista) — STORY-18 AC1.
 * Absence of a PersonSkill for a given role_id means "not qualified" (AC6);
 * there is no `level: null` representation.
 */
export interface PersonSkill {
  role_id: string
  level: 1 | 2 | 3
}
