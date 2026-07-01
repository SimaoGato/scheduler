# ADR-009: Route Groups for Conditional Chrome (AppHeader Visibility)

**Date**: 2026-07-01  
**Status**: Accepted  
**Context**: STORY-10 (login page minimal shell)

## Context

When implementing a login page without the `AppHeader` (navigation, user menu), the initial design noted that "a nested layout under `login/` takes precedence for that route only" — implying that `app/[locale]/login/layout.tsx` could suppress the `AppHeader` rendered by the parent `app/[locale]/layout.tsx`.

This misunderstands how Next.js App Router layouts work. In Next.js, **nested layouts always compose inside their parent** rather than replacing or suppressing parent content. Adding `app/[locale]/login/layout.tsx` would still render the parent's `AppHeader` in the parent's rendered slot, above the login layout's children.

## Decision

To hide application chrome (like `AppHeader`) on specific routes (login, OAuth callback, future marketing pages), use **route groups** to conditionally include chrome:

1. Create a route group `(app)/` that holds authenticated-user pages.
2. Move `AppHeader` rendering from `app/[locale]/layout.tsx` into `app/[locale]/(app)/layout.tsx`.
3. Move authenticated pages (`home`, `admin/*`) into the `(app)/` route group.
4. Leave non-authenticated routes (e.g., `login/`) outside `(app)/`, so they skip the chrome layout entirely.

Route groups are invisible to URLs — `/[locale]/`, `/[locale]/admin/users`, and `/[locale]/admin/people` URLs remain unchanged; the `(app)` segment does not appear.

## Consequences

### Advantages
- Cleanly separates authenticated and non-authenticated layouts without attempting to suppress parent content.
- Scales naturally as more non-authenticated routes are added (marketing pages, password reset, etc.).
- Aligns with Next.js mental model: each route has its own layout stack, not nested layout manipulation.

### Drawbacks
- Requires moving three existing pages into the new route group (one-time friction).
- Developers must remember that new app pages belong inside `(app)/`; pages added directly under `[locale]/` without `(app)/` will lack the header (documented in code comments in the route group layout).

### Future Implications
- Admin guards and per-page role checks remain at the page level (see ADR-007); the route group does not enforce auth separation.
- A future middleware-level admin guard could move to a separate route group (e.g., `(admin)/`) if needed, but current per-page guards suffice.

## References

- **STORY-10**: Login page — minimal shell and centered layout (first story to use route groups).
- **CLAUDE.md** "Locale layout pattern" section: Documents the route-group pattern for future developers.
- **Next.js App Router layouts**: https://nextjs.org/docs/app/building-your-application/routing#groups (route groups do not affect URL structure).
