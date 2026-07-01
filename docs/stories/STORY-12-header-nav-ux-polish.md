# STORY-12: App header — user identity widget
Epic: EPIC-01
Status: draft

## User story
As a logged-in user, I want a clear, interactive user identity element in the
header, so that I know who I am logged in as and can sign out without
confusion.

## Context
The current header renders "Olá, <name> · <role>" as a plain non-interactive
`<span>` alongside separate nav buttons and a "Sair" `<button>`. This creates
two problems:

1. **Non-interactive text between buttons is confusing.** Users instinctively
   try to click the identity text because it sits between other interactive
   elements. There is no recognised UI pattern where plain identity text sits
   inline between buttons in a toolbar.
2. **"Sair" has no pointer cursor.** It uses a bare `<button>` without
   `cursor-pointer`, unlike the shadcn nav buttons, so the hover state gives
   no visual affordance.

The correct pattern (as seen in Gmail, GitHub, etc.) is a single **interactive
identity widget** — a clickable element (avatar initial or name) that groups
identity info and sign-out together, removing the ambiguity entirely.

See PRD §7 (usability, accessibility) and EPIC-01 (app shell/navigation).

## Acceptance criteria
1. Given a logged-in user on any page with the app header visible, when they
   look at the header, then the identity/sign-out area is a single clearly
   interactive element (cursor changes to pointer on hover).
2. Given a logged-in user, when they activate (click/tap) the identity widget,
   then a sign-out action is accessible from that interaction (either the
   widget itself triggers sign-out, or a small dropdown appears with a
   "Sair" option).
3. Given a logged-in user, when they view the identity widget, then their
   display name and role are visible (either always or when the widget is
   open).
4. Given an admin on any page, when the header renders, then the nav links
   and identity widget are visible without horizontal overflow on a viewport
   ≥ 375 px wide (iPhone SE baseline).
5. Given a member on any page, when the header renders, then the nav links
   and identity widget are visible without horizontal overflow on a viewport
   ≥ 375 px.

## Out of scope
- A full user settings or profile page (future story).
- Changing navigation destinations or adding new nav links.
- Changing the sign-out server action itself (`actions.ts`).
- Responsive hamburger menu — resolve header crowding with layout and the
  widget consolidation first; add hamburger only if overflow persists.
- Avatar image fetched from Google (initials-based avatar is sufficient).

## Technical notes
- **Simplest approach**: replace the `<span>` + separate `<form>` with a
  shadcn `<DropdownMenu>` (or a minimal `<details>`/`<summary>` if shadcn
  Dropdown hasn't been added yet). Trigger: a button showing the user's
  initial letter in a small avatar circle + name. Dropdown content: name,
  role badge, and the "Sair" form/button.
- **Avatar initial**: `displayName.charAt(0).toUpperCase()` in a
  `rounded-full` div with a background colour (e.g. `bg-primary
  text-primary-foreground`).
- The sign-out form action from `actions.ts` stays unchanged; it just moves
  inside the dropdown.
- `AppHeader.tsx` is a Server Component — the dropdown trigger can be a
  `'use client'` sub-component that receives `displayName` and `roleLabel`
  as props.
- **Overflow on mobile**: the widget consolidation (one element instead of
  text + button) should reduce crowding significantly for both admin and
  member; measure during QA.

## Definition of Done
See CLAUDE.md.
