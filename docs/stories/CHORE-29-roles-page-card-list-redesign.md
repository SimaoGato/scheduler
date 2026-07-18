# CHORE-29: Redesign Roles page as card-list rows (fixes 375px overflow)
Epic: maintenance
Priority: standard — includes a real, ticketless pre-existing mobile
overflow bug found during CHORE-24 QA; part of the pre-EPIC-04 UI push
Status: draft
Depends on: CHORE-23 (tokens/fonts, done), CHORE-24 (pill primitives, done)
Related: CHORE-21 (Team page redesign — same row pattern, land in either
order but reuse the same visual idiom), updated mockup in
`App design refinement/Escala Dashboard.dc.html` (`isRoles` block,
`roleRows`), STORY-17 (roles CRUD), STORY-19 (in-use deletion guard)

## Task
As an Admin on the Funções page (`/admin/roles`), I want each role shown
as a card-style list row (name + meta line, slots badge, pill actions)
instead of the current table, so the page matches the new design language
and stops overflowing horizontally on phones.

## Context
Two drivers:
1. **Known bug with no ticket**: CHORE-24's QA found pre-existing
   horizontal page overflow on `/pt-PT/admin/roles` at 375px
   (`scrollWidth` 410–419 vs 375, confirmed on `main` before CHORE-23/24)
   and said "requires a separate BUGFIX ticket … documented here to
   prevent it from being lost during story archival." No ticket was ever
   filed — this chore is that ticket, folded into the redesign the updated
   mockup now specifies for this exact page.
2. **Updated mockup direction**: the `isRoles` block renders each role as
   a bordered card row: role name (display font, bold) with a mono meta
   line underneath ("N people can serve"), a slots badge ("X per Sunday",
   mono pill), and a pill-shaped Edit action on the right.

The mockup's meta line also shows "min level {N}" per role — that concept
does **not** exist in the data model (roles have `default_slots`;
qualification is per-person via `person_role_skills`, STORY-18). Omit the
min-level fragment; render only what the model supports ("N people can
serve" is derivable via the qualified-set query pattern,
`lib/skills/qualified-roles.ts`). Whether a per-role minimum level should
exist is an EPIC-04 data-model question, flagged separately in triage.

## Acceptance criteria
1. Given the Funções page at 375px/390px viewport, when rendered with
   seeded roles (including long pt-PT names), then
   `document.documentElement.scrollWidth` ≤ viewport width — the
   CHORE-24-documented overflow is gone, verified by an automated test.
2. Given the page, when rendered, then each active role appears as a
   card-style row showing: the role name (display font), a meta line with
   the count of people qualified for that role (mono font, correct ICU
   pluralization in both locales), and the per-Sunday slots as a badge
   (mono, pill).
3. Given the existing role management flows (add role with slots, inline
   edit name/slots, remove with the STORY-19 in-use confirm prompt), when
   used in the new layout, then all behave exactly as today — same API
   calls, same optimistic-update and sort behavior, same error messages —
   and every existing `data-testid` in `RoleTable.tsx` is preserved so
   STORY-17/19 e2e tests pass unmodified.
4. Given all interactive controls in the new layout, when measured, then
   each keeps a ≥44px tap target, and the add/edit input fields keep their
   distinct accessible labels (WCAG SC 1.3.1, STORY-17 pattern).
5. Given light and dark theme, when rendered, then all new text/background
   pairs meet WCAG AA 4.5:1 using existing verified tokens (no new colors).
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0.

## Out of scope
- Any roles API/validation/data-model change — including per-role minimum
  level (EPIC-04 decision).
- The qualified-people count becoming a link/drill-down — display only.
- Team and Users pages — CHORE-21 and CHORE-30 respectively; reuse the
  same row idiom but keep the PRs independent.

## Technical notes
- Primary files: `components/RoleTable.tsx` (likely renamed conceptually
  to a list, but keep the exported name/testids stable),
  `app/[locale]/(app)/admin/roles/page.tsx` (may need to fetch qualified
  counts server-side alongside the roles list — one aggregate query, not
  N+1; follow the STORY-30 metric-scope-consistency rule: count only
  active people, `!inner` join on active roles).
- The count text needs new i18n keys in **both** locale files with ICU
  plural (`{count, plural, one {…} other {…}}`).
- The inline edit mode currently relies on the HTML `form`-attribute
  association pattern (STORY-14/17) — a non-table layout can simplify
  this, but keep Enter-to-submit working.
- Visually render (dev server) both themes at 375px and 1280px, including
  the edit mode and in-use-delete confirm states, before marking done.

## Definition of Done
See CLAUDE.md.
