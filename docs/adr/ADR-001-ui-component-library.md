# ADR-001: UI Component Library — shadcn/ui + Tailwind v4

**Status:** Accepted (CHORE-01, PR #2)  
**Date:** 2026-06-28  
**Author:** Simão  
**Related issue:** CHORE-01

## Context

The ADSintra church scheduling app requires a consistent, polished UI foundation available from the scaffold onwards so every feature built on top looks visually cohesive without per-story design rework. The PRD specifies WCAG accessibility and responsive design for mobile and desktop, but does not mandate a specific visual direction.

Choosing a UI framework at scaffold time avoids:
- Per-story inconsistency (raw HTML that looks unintentional on mobile/desktop).
- Retrofit costs when unifying components later.
- Developer friction — each new story can reference pre-built tokens and components instead of designing from scratch.

## Decision

Adopt **shadcn/ui** (New York style, Zinc palette) as the component library and **Tailwind CSS v4** for utility-first styling and design tokens.

### Rationale

1. **Zero runtime cost**: shadcn/ui provides copy-pasted components (not an npm package), giving full control and no black-box dependencies. Tailwind v4 is a build-time tool (no JS payload).

2. **Accessible by default**: shadcn components wrap Radix UI primitives (ARIA-compliant, keyboard navigable, screen-reader tested). Zinc palette meets WCAG AA contrast ratios out of the box.

3. **Design tokens as code**: Tailwind v4's CSS variable model (`@layer base`, `@theme inline`) allows design tokens to be defined once and referenced everywhere. This satisfies the MVP requirement "developers reference tokens rather than hardcoding values" without custom tooling.

4. **Next.js + Vercel friendly**: Both shadcn and Tailwind have production-proven Next.js integrations and are deployed at scale on Vercel.

5. **No lock-in**: Components are plain React; the app is not tethered to a vendor if the library's maintenance changes.

### Alternative considered

**Tailwind + Radix UI directly** — lower-level, more custom flexibility. Rejected because it requires building or sourcing pre-built component wrappers (higher initial effort) and the app is MVP-stage, not custom-brand-focused.

## Consequences

### Positive

- All future stories inherit a polished, consistent shell.
- New components default to library patterns (button, link, form controls) → faster development and fewer design reviews.
- Design tokens (colors, spacing, radius) are centralized in `app/globals.css` and Tailwind config, making palette changes a single edit.
- WCAG compliance is baked in (Radix primitives + Zinc contrast).
- Mobile tap targets are hard-coded to 44px minimum (`min-h-[44px]` not `h-11`), eliminating flaky responsive tests.

### Negative / Trade-offs

- **No dark mode in MVP**: shadcn includes dark mode CSS (`.dark` block in `app/globals.css`), but it's not wired up (no toggle UI or persistence). This is accepted MVP debt — implement in a future polish story.
- **No custom web font**: Typography uses the system stack (system-ui, sans-serif). Zinc theme colors and intentional spacing compensate for "not raw browser defaults", satisfying AC2. A web font can be added later without breaking components.
- **CLI dependency on environment**: `npx shadcn@latest init` and `npx shadcn@latest add` may be blocked in sandboxed CI/build environments. Mitigation: `components.json`, `lib/utils.ts`, and component scaffolds can be created manually — the CLI output is deterministic.

### Implementation Notes

1. **Tailwind v4 config**: `components.json` must have `"tailwind": { "config": "" }` (empty string). Tailwind v4 is config-file-free and auto-detects from `postcss.config.mjs`.

2. **CSS token layer**: Shadcn injects `@layer base` blocks for custom properties and an `@theme inline` block mapping variables to utilities. Multiple `@layer` declarations merge correctly; the `@import "tailwindcss"` line must remain first in `app/globals.css`.

3. **Client boundary**: `components/ui/button.tsx` must have `'use client'` as the first line (uses `React.forwardRef` + Radix `Slot`). Importing into server components is valid — Next.js establishes a client boundary automatically.

4. **Tap targets**: Use `min-h-[44px]` (absolute 44px floor) instead of `h-11` (rem multiple). This ensures compliance at any font-scale and makes Playwright boundingBox tests reliable.

5. **Design token documentation**: A comment block in `app/globals.css` lists available tokens (color utilities, text utilities, radius values) so future stories can self-serve without hunting the file.

## Rollback

All changes are additive. To revert:
1. Uninstall shadcn-added packages: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`.
2. Delete `components.json`, `lib/utils.ts`, `components/ui/button.tsx`.
3. Restore `app/globals.css`, `components/AppNav.tsx`, and i18n messages to pre-change state.

## Acceptance

This decision aligns with the PRD (responsive, WCAG-compliant, pleasant UX) and the MVP timeline (no custom design work required). The scaffold is complete and ready for feature stories to build on top.
