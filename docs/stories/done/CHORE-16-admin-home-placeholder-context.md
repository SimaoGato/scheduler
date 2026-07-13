# CHORE-16: Give the Admin home page placeholder some context
Epic: maintenance
Priority: low
Status: superseded by STORY-30 — do not implement separately; STORY-30's
personal quick-overview fully replaces this page's Admin branch.

## Task
As an Admin visiting the app's home page today, I currently see a generic
welcome message and a permanently-disabled "Ver escala" button with no
explanation — I want enough context to understand this is deliberate
(schedule generation is still being built) and, ideally, quick links to the
admin screens that already work, so the home page doesn't read as broken or
unfinished.

## Context
On production (`https://scheduler-sable-xi.vercel.app/pt-PT`), the Admin
branch of `app/[locale]/(app)/page.tsx` renders:
```
Bem-vindo ao Escala.
Gestão de escalas para equipas de serviço.
[Ver escala]  (disabled)
```
This is intentional, not a bug: schedule generation (EPIC-04), review/editing
(EPIC-05), and output/sharing (EPIC-06) haven't been built yet — the team has
been delivering EPIC-01 (auth/roles) → EPIC-02 (team/roles/skills) → EPIC-03
(availability, currently wrapping up: STORY-25 done, STORY-26 in review,
STORY-27 not started) in sequence, since schedule generation depends on all
of that foundation data existing first. The disabled button is a correct,
deliberate placeholder for the eventual "view the generated schedule" action.

However, a real (non-developer) Admin visiting the live site today has **no
way to tell the difference between "not built yet" and "broken."** This was
raised during triage as "the main page doesn't seem to do anything, what's
its purpose?" — a fair question given the current copy gives zero indication
that this is expected, temporary, or when to expect more.

This chore is explicitly about the **interim** experience only. Once EPIC-04
ships, this page's Admin branch will be substantially rewritten anyway (the
"Ver escala" button will become real and probably link to an actual
schedule view) — so this is deliberately lightweight, low-risk polish, not a
redesign. Marked `Priority: low` because it may be more efficient to simply
wait for EPIC-04 to replace this page outright, depending on how soon that
epic starts; flagging for a human call on whether it's worth doing now.

## Acceptance criteria
1. Given a logged-in Admin, when they land on the home page today (before
   EPIC-04 ships), then the copy makes clear that schedule generation is
   still in progress / coming soon, rather than implying the button should
   already work.
2. Given a logged-in Admin, when they land on the home page, then they see
   at least a way to reach the admin screens that already work today
   (Equipa, Funções, Utilizadores) without depending solely on discovering
   them via the header nav — e.g. quick links matching the existing
   `AppNav` destinations.
3. Given the disabled "Ver escala" button, when an Admin encounters it, then
   either (a) it is removed until there's something real to show, or (b) it
   is retained with copy that makes clear why it's disabled (Refine to
   decide which is simpler/better).
4. Given all new/changed copy, when it renders, then strings come from
   `messages/pt-PT.json` / `messages/en.json` (key parity, AO90 spelling).

## Out of scope
- Any real schedule-generation functionality (EPIC-04/05/06 — separate,
  much larger epics).
- Redesigning the Member-facing home branch (STORY-28, already filed,
  separate).
- The "no role" / provisioning-failure branch.
- Building an actual dashboard/summary (e.g. "N Sundays scheduled this
  month") — that depends on data this app doesn't generate yet.

## Technical notes
- File: `app/[locale]/(app)/page.tsx`, the admin/unauthenticated-fallback
  branch (currently lines ~81-101, `Home` namespace).
- Existing admin destinations to consider linking: `/admin/users`,
  `/admin/people`, `/admin/roles` (see `components/AppNav.tsx` for current
  labels/routes) — reuse the same `Nav.*` i18n keys rather than duplicating
  strings, if a good fit.
- Low-risk, additive-only change: no new data fetching, no new auth logic,
  copy + optional link markup only.
- Given how small and low-stakes this is, likely `trivial` or low-end
  `standard` complexity — Refine should confirm the actual classification
  once designs are decided.

## Definition of Done
See CLAUDE.md.
