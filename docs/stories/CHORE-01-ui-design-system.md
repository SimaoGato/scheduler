# CHORE-01: Choose and integrate a UI component library & design tokens
Epic: EPIC-01
Status: draft

## Task
Set up a consistent, polished UI foundation — a component library plus base
design tokens (colors, typography, spacing) — as part of the app scaffold
(STORY-01), so that every feature built on top looks good on both phone and
desktop without per-story design work.

## Context
The PRD requires a responsive web app that is pleasant to use on mobile and
desktop. The existing PRD and stories only specify "no layout breakage" and
"WCAG-friendly", which sets a floor for function but not for visual quality.
Without a component library chosen at scaffold time, each story would produce
inconsistent, raw HTML and retrofitting later costs significant rework. This
chore must be done together with or before STORY-01 so the library is available
to all subsequent stories.

## Acceptance criteria
1. Given the project scaffold, when the app is built, then a component library
   is installed, configured, and used in the app shell (at minimum: layout,
   button, and navigation components come from it).
2. Given the app shell on a phone (375 px wide) and on a desktop (1280 px wide),
   when inspected visually, then the shell looks intentionally designed — not raw
   browser defaults — with consistent spacing, typography, and color.
3. Given the design tokens (colors, font sizes, spacing scale), when a new
   component is added in any future story, then the developer can reference these
   tokens rather than hardcoding raw values.
4. Given an accessibility audit, when the shell is scanned, then it has no
   obvious contrast failures (WCAG AA level for text).
5. Given a mobile browser, when the app is opened, then tap targets are
   adequately sized (minimum 44 × 44 px) and the layout does not require
   horizontal scrolling.

## Out of scope
- Per-feature design/UX (handled per story).
- Custom brand identity / logo design.
- Dark mode (nice-to-have, not MVP).
- Animation or micro-interactions.

## Technical notes
- **Recommended stack:** Tailwind CSS + shadcn/ui. Tailwind gives utility-first
  responsive styling; shadcn/ui gives accessible, composable components with no
  runtime overhead. Both are free and work with Next.js on Vercel.
- Alternatively: Tailwind + Radix UI primitives (lower-level, more custom).
- Set up a `globals.css` with CSS variables for the color palette and font;
  document tokens in a README or comment so future stories can reference them.
- Mobile-first breakpoints in Tailwind config.
- This chore should be completed in the same PR as STORY-01 or as a PR that
  immediately precedes it.

## Definition of Done
See CLAUDE.md.

---

## Implementation Plan

### Complexity tag
**standard** — Touches seven or more files across frontend components, CSS token layer, i18n catalog, and test suite. Requires understanding of how Tailwind v4's CSS variable model integrates with shadcn/ui's generated code, how React Server Components interact with client-boundary components, and how the locale layout ties everything together.

---

### Affected areas
- **frontend** — `app/globals.css`, `app/[locale]/layout.tsx` (minor), `components/AppHeader.tsx` (token swap), `components/AppNav.tsx` (add `'use client'`, shadcn Button), `app/[locale]/page.tsx` (CTA button), new `components/ui/button.tsx`, new `lib/utils.ts`
- **ux** — `components.json` (shadcn configuration)
- **data / i18n** — `messages/pt-PT.json` (one new key)
- **tests** — new `e2e/design-system.spec.ts`

---

### Pre-conditions
- Tailwind v4 is already installed and `app/globals.css` already contains `@import "tailwindcss"`. This line **must not** be removed or replaced by the old `@tailwind base/components/utilities` directives.
- `postcss.config.mjs` already uses `@tailwindcss/postcss` — no PostCSS changes needed.
- No `tailwind.config.ts` exists and none should be created; Tailwind v4 is config-file-free.

---

### Step 1 — Initialise shadcn/ui

Run the init command and answer the prompts as follows:

```
npx shadcn@latest init
```

Prompts / choices:
| Prompt | Answer |
|--------|--------|
| Which style would you like to use? | New York |
| Which color would you like to use as the base color? | Zinc |
| Would you like to use CSS variables for theming? | Yes |

What the command produces:
- **`components.json`** at project root. For a Tailwind v4 project the `tailwind.config` field must be an empty string (`""`); the `tailwind.css` field must point to `app/globals.css`. Verify the generated file matches:
  ```json
  {
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": true,
    "tsx": true,
    "tailwind": {
      "config": "",
      "css": "app/globals.css",
      "baseColor": "zinc",
      "cssVariables": true
    },
    "iconLibrary": "lucide",
    "aliases": {
      "components": "@/components",
      "utils": "@/lib/utils",
      "ui": "@/components/ui",
      "lib": "@/lib",
      "hooks": "@/hooks"
    }
  }
  ```
  If the CLI generates a different shape, adjust manually to match the above.
- **`lib/utils.ts`** — contains the `cn()` helper (`clsx` + `tailwind-merge`).
- **`app/globals.css`** — the CLI appends `@layer base { :root { … } }` (HSL color variables) and an `@theme inline { … }` block that maps them to Tailwind utility tokens. Verify that `@import "tailwindcss"` remains as the first line.
- **`package.json`** updated with `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` in `dependencies`.

After init, run `npx tsc --noEmit` and `npm run lint` to confirm the new files are clean.

---

### Step 2 — Add the Button component

```
npx shadcn@latest add button
```

This creates `components/ui/button.tsx` and adds `@radix-ui/react-slot` to `dependencies`.

**Critical:** Open `components/ui/button.tsx`. If the first line is not `'use client';`, add it. The Button uses `React.forwardRef` and `Slot` from Radix — both require the client runtime when rendered interactively.

---

### Step 3 — Update `app/globals.css` with token documentation comment

After the `@theme inline` block that shadcn added, insert a comment block documenting the available design tokens so future stories can reference them without hunting through the file:

```css
/*
 * Design tokens — reference these instead of hardcoded values
 *
 * Color utilities:  bg-background, bg-foreground, bg-card, bg-muted,
 *                   bg-primary, bg-secondary, bg-accent, bg-destructive
 * Text utilities:   text-foreground, text-muted-foreground, text-card-foreground,
 *                   text-primary-foreground, text-secondary-foreground
 * Border utilities: border-border, ring-ring
 * Radius:           rounded-sm, rounded-md, rounded-lg, rounded-xl
 *                   (mapped from --radius CSS variable, default 0.5 rem)
 *
 * All tokens are HSL CSS variables defined in @layer base :root above.
 * To customise the palette, edit the :root values; do NOT hardcode raw colours.
 */
```

---

### Step 4 — Wire the locale layout and shell to the design tokens

**`app/[locale]/layout.tsx`** — replace the hardcoded Tailwind colour classes with token-based ones so the shell picks up the theme:

```tsx
<body className="min-h-screen bg-background text-foreground antialiased">
```

**`components/AppHeader.tsx`** — replace `bg-white` with `bg-background`:

```tsx
<header className="border-b bg-background px-4 py-3">
```

No other changes to `AppHeader.tsx` are needed; it remains a React Server Component.

---

### Step 5 — Convert `AppNav.tsx` to a client component using shadcn Button

The nav must use a library component (AC1) and hit the 44 px tap-target floor (AC5). The `Button` component from shadcn with `asChild` is the cleanest way to achieve both.

Replace the entire content of `components/AppNav.tsx` with:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default function AppNav() {
  const t = useTranslations('Nav');
  return (
    <nav aria-label={t('ariaLabel')}>
      <ul className="flex gap-1">
        <li>
          <Button variant="ghost" asChild className="min-h-[44px] px-3 text-sm">
            <Link href="/">{t('home')}</Link>
          </Button>
        </li>
      </ul>
    </nav>
  );
}
```

Key details:
- `'use client'` is required because `Button` is a client component. `useTranslations` works in client components via the `NextIntlClientProvider` already in the locale layout.
- `min-h-[44px]` is used instead of `h-11` (which computes to exactly 44 px only at the browser's default 16 px/rem). Using `min-h-[44px]` guarantees the tap target is at least 44 px regardless of font-scale settings and makes the Playwright assertion flake-proof.
- `asChild` passes all button props (including `className`) into the `<Link>`, so the rendered element is an `<a>` tag styled as a button.
- `AppHeader.tsx` remains a server component and simply imports `AppNav` as usual — a server component importing a client component is a standard Next.js RSC pattern.

---

### Step 6 — Add a CTA Button to the home page

The home page must contain at least one shadcn `Button` to satisfy AC1 ("button … from the library"). Add a placeholder CTA that will eventually navigate to the schedule view.

**`app/[locale]/page.tsx`** — import `Button` and add the CTA:

```tsx
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const t = useTranslations('Home');
  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <p className="text-base">{t('welcome')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      <Button className="mt-6" disabled>{t('cta')}</Button>
    </main>
  );
}
```

Note: `Button` has `'use client'` and is imported into a server component — this is valid. Next.js renders the Button as a client boundary automatically.

The `disabled` prop is intentional: the schedule view does not exist yet. Marking the button disabled makes it clear the feature is placeholder-only, avoids a WCAG 4.1.2 violation (a non-disabled button that does nothing is invalid), and will be removed when the route is built.

Also replace the raw `text-gray-500` with `text-muted-foreground` to use the design token (AC3).

---

### Step 7 — Add i18n key for the CTA

**`messages/pt-PT.json`** — add one key to `Home`:

```json
{
  "App": { "name": "Escala" },
  "Nav": {
    "ariaLabel": "Navegação principal",
    "home": "Início"
  },
  "Home": {
    "welcome": "Bem-vindo ao Escala.",
    "description": "Gestão de escalas para equipas de serviço.",
    "cta": "Ver escala"
  }
}
```

---

### Step 8 — Write Playwright tests for CHORE-01 ACs

Create **`e2e/design-system.spec.ts`**:

```typescript
import { test, expect } from '@playwright/test';

// AC1: a <button> rendered by the shadcn Button component is present in the shell
test('design-system AC1: shadcn Button is rendered on the home page', async ({ page }) => {
  await page.goto('/');
  // Use getByRole for a specific, future-proof locator that won't collide with
  // other buttons added in later stories.
  const cta = page.getByRole('button', { name: 'Ver escala' });
  await expect(cta).toBeVisible();
});

// AC1: navigation uses library component (rendered as <a> inside the nav)
test('design-system AC1: nav link rendered via shadcn Button asChild', async ({ page }) => {
  await page.goto('/');
  const navLink = page.locator('nav a').first();
  await expect(navLink).toBeVisible();
});

// AC5: nav tap targets are at least 44 px tall on mobile
test('design-system AC5: nav tap targets meet 44 px minimum at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const navLink = page.locator('nav a').first();
  const box = await navLink.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

// Note: the no-horizontal-overflow assertion at 375 px is already covered by
// e2e/smoke.spec.ts ("responsive shell: no horizontal overflow at mobile width").
// Do not duplicate it here to avoid double-failure noise in CI.
```

---

### Manual verification steps (for ACs not covered by automation)

**AC2 — Visual quality on phone (375 px) and desktop (1280 px):**
Open the running app at both viewports and verify: consistent spacing around content, the Zinc colour palette is visible (not raw browser-default blue links and grey backgrounds), header clearly separated from page content, nav links visually distinct from plain body text.

Note: no web font is configured in this story — typography uses the system stack (system-ui, sans-serif). This is an accepted MVP trade-off. The AC bar is "not raw browser defaults"; the Zinc theme colours and spacing satisfy that. A web font can be added in a future polish story.

**AC3 — Tokens are referenceable:**
Code-review the diff: confirm that `bg-background`, `text-foreground`, `text-muted-foreground`, and `border-border` appear in the layout and components, and that no raw colour values (`#...`, `rgb(...)`, `text-gray-*`) remain in the shell files.

**AC4 — No obvious contrast failures (WCAG AA):**
The shadcn/ui New York Zinc theme is designed to meet WCAG AA contrast ratios for text on its backgrounds (documented on the shadcn/ui website). Verify by opening the home page in a browser and running the Chrome DevTools Accessibility tree check, or paste the rendered page into the WebAIM Contrast Checker. No additional tooling is required for MVP.

---

### Verification checklist (Definition of Done gates)

Run in order after implementation:

1. `npm run lint` — must exit 0.
2. `npx tsc --noEmit` — must exit 0.
3. `npm run build` — must exit 0 (requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` dummy env vars per CLAUDE.md CI note — set them in `.env.local` locally if the build fails on missing vars).
4. `npm run test:e2e` — existing smoke tests plus new `design-system.spec.ts` must all pass.

---

### Risks and rollback notes

| Risk | Mitigation |
|------|-----------|
| `shadcn@latest init` overwrites `globals.css` and drops `@import "tailwindcss"` | After init, verify the first line of `globals.css` is still `@import "tailwindcss"`. Restore it manually if removed. |
| `shadcn@latest` CLI defaults to Tailwind v3 mode and generates a `tailwind.config.ts` | If a `tailwind.config.ts` is created, delete it. Confirm `components.json` has `"config": ""`. The CLI as of mid-2025 detects Tailwind v4 from `postcss.config.mjs` — if detection fails, pass `--tailwind-config ""` flag or create the `components.json` manually. |
| `Button` imported into a server component causes "you're importing a component that needs `'use client'`" build error | Add `'use client'` to `components/ui/button.tsx` as the first line, which makes all import sites valid. |
| Next-intl `useTranslations` in a client component (`AppNav`) fails if `NextIntlClientProvider` is absent | `NextIntlClientProvider` is already in `app/[locale]/layout.tsx` — this is confirmed working by STORY-01. |
| Playwright tap-target test is flaky due to browser font-scale variation | The nav button uses `min-h-[44px]` (absolute pixel floor, not a rem multiple), so the rendered height is guaranteed to be ≥ 44 px regardless of font-scale. No additional mitigation needed. |

**Rollback**: All changes are additive. To revert, uninstall the shadcn-added npm packages (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`), delete `components.json`, `lib/utils.ts`, `components/ui/button.tsx`, and restore `globals.css`, `AppNav.tsx`, `page.tsx`, and `pt-PT.json` to their pre-change state from git.
