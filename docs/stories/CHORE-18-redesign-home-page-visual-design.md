# CHORE-18: Redesign home page visual design (Card-based layout)
Epic: maintenance
Priority: low (visual-quality debt, not a functional defect)
Status: draft
Depends on: CHORE-17 (Card UI primitive)
Related story: STORY-30 (home-page-personal-quick-overview — this chore
restyles that story's output; no data/logic changes)

## Task
As a user (Admin or Member) landing on the home page, I want it to look
intentionally designed — clear visual grouping, hierarchy, and breathing
room — instead of plain stacked text, so the app feels trustworthy and
finished rather than like an unstyled placeholder.

## Context
The user's screenshot of the production home page (both the Admin "Resumo da
equipa" view and, by the same pattern, the Member availability-summary view)
shows every section as bare headings + `<ul><li>` text with no visual
container, minimal spacing, and no differentiation between the summary stats
and the quick-links section. Feedback: "the current home screens are very
simple, even ugly ... I don't want slop, I want good design. Simple, but
good."

`app/[locale]/(app)/page.tsx` (STORY-30) currently renders:
- Admin: `admin-team-summary` (title + `<ul>` of 2 stats), a separate
  `admin-blocks-next-30-days` text block, and `admin-quick-links` (title +
  wrapped `Button` row) — three visually undifferentiated sections stacked
  with only `mb-6` spacing.
- Member: `member-availability-summary` — title, intro paragraph, `<ul>` of
  2 counts, a conditional next-blocked-date line, and a CTA link — again all
  one undifferentiated text block.

This chore is purely visual: wrap the existing sections in `Card` (CHORE-17)
with sensible internal hierarchy (CardHeader/CardTitle for section titles,
CardContent for the stats/links), improve spacing and typographic hierarchy,
and give the summary numbers more visual weight than the surrounding label
text. No data, routing, auth, or copy logic changes.

## Acceptance criteria
1. Given the Admin home view, when rendered, then "Resumo da equipa" (stats)
   and "Acesso rápido" (quick links) each render inside a distinct `Card`
   with clear visual separation (border/background per the design tokens),
   not as bare stacked `<div>`s.
2. Given the Member home view, when rendered, then the availability summary
   renders inside a `Card` with the same treatment, and the summary counts
   (available/blocked) are visually emphasized (e.g. larger numeral,
   consistent with a "stat" presentation) rather than plain inline text.
3. Given all existing `data-testid` attributes (`admin-team-summary`,
   `admin-blocks-next-30-days`, `admin-quick-links`,
   `member-availability-summary`, `access-denied-banner`,
   `home-no-linked-person`, `home-availability-load-error`,
   `no-role-error`), when the redesign ships, then they are preserved
   unchanged so existing e2e assertions (STORY-30's own tests) keep passing
   without modification — this is a pure visual refactor of children inside
   those test-id'd containers, not a DOM-identity change.
4. Given the page at 375px and 1280px viewports, when rendered, then there is
   no horizontal overflow (`document.documentElement.scrollWidth <= 375` at
   mobile) and all interactive elements (quick-link buttons, the
   member CTA link) retain their existing ≥44px tap targets.
5. Given light and dark theme, when the redesigned cards render, then text
   contrast against card backgrounds meets WCAG AA in both themes (reuse
   CHORE-17's verified tokens; no new ad hoc colors).
6. Given `npm run lint && npx tsc --noEmit && npm run build && npm run
   test:e2e`, then all exit 0 with STORY-30's existing home-page e2e tests
   passing unmodified (per AC3) plus any new visual-regression assertion
   this story adds (e.g. asserting the summary sections render inside
   `[class*="card"]`-equivalent containers, or a screenshot-diff if the
   project's Playwright config supports one already — see
   CHORE-02-playwright-screenshot-artifacts.md for existing screenshot
   tooling).

## Out of scope
- Any change to the underlying data/queries, i18n copy, or business logic in
  `app/[locale]/(app)/page.tsx` — STORY-30's metric-consistency and
  neutral-copy rules (CLAUDE.md) still apply unchanged; this chore must not
  touch the query/count logic at all.
- The header/nav chrome — that's BUGFIX-06 (separate, already-broken layout
  bug from this same triage round).
- Redesigning any other page besides home — the availability page is
  CHORE-19.
- Introducing icons, illustrations, or imagery — keep it "simple, but good":
  typography, spacing, and card grouping only, per the user's own framing.

## Technical notes
- Depends on CHORE-17 landing first (or in the same PR, sequenced first).
- Keep the STORY-30 scope-firewall lesson in mind (CLAUDE.md): do not import
  anything from `app/[locale]/(app)/availability/page.tsx` — it remains out
  of scope here too.
- Because this is a visual-quality story, structural/DOM assertions alone
  are insufficient to confirm success — `qa-verifier` (or manual review)
  must actually render both the Admin and Member views in a browser (dev
  server or Vercel preview) and visually confirm the result looks
  intentionally designed, not just that the test-ids and overflow checks
  pass.

## Definition of Done
See CLAUDE.md.
