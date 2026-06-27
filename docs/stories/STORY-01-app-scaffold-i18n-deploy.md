# STORY-01: Web app scaffold, pt-PT shell & deploy to free hosting
Epic: EPIC-01
Status: draft

## User story
As the coordinator, I want a deployed, responsive web app shell in Portuguese
(pt-PT), so that there is a reachable foundation to build every other feature on.

## Context
First slice of EPIC-01 (Foundation). Establishes the project scaffold, the
i18n-ready app shell, and the free-tier deploy pipeline. See PRD §7
(Non-functional: responsive web, pt-PT, i18n-ready) and §8 (free hosting:
Vercel + Supabase target). No auth yet — that is STORY-02.

## Acceptance criteria
1. Given the repository, when the app is built, then it compiles with no errors
   and lints clean.
2. Given a browser on mobile or desktop, when the user opens the app's public
   URL, then a responsive shell (header/nav + main content area) renders without
   layout breakage at common phone and desktop widths.
3. Given the running app, when any UI text is shown, then it comes from an
   externalized i18n string catalog (no hardcoded user-facing strings) with
   **pt-PT** as the default/active locale.
4. Given a push to the main branch, when the deploy pipeline runs, then the app
   is deployed to a free-tier host and reachable at a public URL.
5. Given a smoke test, when it requests the home route, then it returns HTTP 200.

## Out of scope
- Authentication / Google login (STORY-02).
- User roles, permissions, user management (STORY-03+).
- Any domain features (teams, schedules).

## Technical notes
- Likely Next.js (React) deployed to Vercel; i18n via a standard library
  (e.g. next-intl / i18next) with a pt-PT message catalog.
- Set up base layout, navigation placeholder, and a smoke-test route.
- Environment/secrets wiring prepared for Supabase (used in STORY-02).

## Definition of Done
See CLAUDE.md.

---

## Implementation plan

### Affected areas
- **frontend** — Next.js App Router scaffold, Tailwind responsive shell, next-intl
  wiring, component files
- **infra** — GitHub Actions CI workflow, Vercel Git integration (human step),
  `.env.example`
- **ux** — responsive header/nav/main shell structure, Tailwind breakpoints

---

### Step 1 — Bootstrap the Next.js project

Run from the repo root (which is currently empty of application code):

```
npx create-next-app@latest . \
  --typescript --tailwind --app --eslint \
  --no-src-dir --import-alias "@/*" --use-npm
```

Flags deliver: TypeScript, Tailwind CSS, App Router, ESLint, import alias `@/*`,
no `src/` directory nesting.  After creation, delete the boilerplate content
inside `app/page.tsx` and `app/globals.css` (keep only Tailwind directives in
the CSS file).  The `package.json` `scripts` section will have `lint` and
`build`; keep them unchanged.

---

### Step 2 — Install next-intl

```
npm install next-intl@^3
```

Pin to the v3 major unconditionally.  The plan is written for the v3 API
(`createMiddleware`, `createNavigation`, `defineRouting`); v4 ships a different
API surface and must not be installed without updating this plan first.  Do not
install i18next — next-intl is the chosen library (simpler App Router
integration, no extra adapter).

---

### Step 3 — i18n wiring (six files)

**`i18n/routing.ts`** — single source of truth for locales:
```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['pt-PT'],
  defaultLocale: 'pt-PT',
  localePrefix: 'always',   // URLs will be /pt-PT/…; explicit and predictable
});
```

**`i18n/request.ts`** — loads message catalog per request:
```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**`middleware.ts`** (repo root):
```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)',],
};
```

**`next.config.ts`** — wrap with next-intl plugin:
```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();
const nextConfig: NextConfig = {};
export default withNextIntl(nextConfig);
```

**`i18n/navigation.ts`** — re-exports locale-aware navigation primitives so
components import from `@/i18n/navigation` rather than directly from next-intl.
This keeps the locale configuration in one place and avoids hardcoded `/pt-PT/`
prefixes in `<a>` tags:
```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
```

**`messages/pt-PT.json`** — the only message catalog; all user-facing strings go
here (never hardcoded in components), including ARIA labels which are
user-facing for screen-reader users:
```json
{
  "App": {
    "name": "Escala"
  },
  "Nav": {
    "ariaLabel": "Navegação principal",
    "home": "Início"
  },
  "Home": {
    "welcome": "Bem-vindo ao Escala.",
    "description": "Gestão de escalas para equipas de serviço."
  }
}
```

---

### Step 4 — App directory structure

Rename / replace the scaffolded `app/layout.tsx` with a minimal passthrough
(Next.js requires a root layout, but html/body belong in the locale layout):

**`app/layout.tsx`** (root — minimal):
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**`app/[locale]/layout.tsx`** (new file — owns `<html>` and `<body>`):
```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Delete or empty out `app/page.tsx` (the root page); navigation to `/` is handled
by middleware redirecting to `/pt-PT/`.

**`app/[locale]/page.tsx`** (home page):
```tsx
import { useTranslations } from 'next-intl';
import AppHeader from '@/components/AppHeader';

export default function HomePage() {
  const t = useTranslations('Home');
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <p className="text-base">{t('welcome')}</p>
        <p className="mt-2 text-sm text-gray-500">{t('description')}</p>
      </main>
    </div>
  );
}
```

---

### Step 5 — Responsive shell components

**`components/AppHeader.tsx`**:
```tsx
import { useTranslations } from 'next-intl';
import AppNav from './AppNav';

export default function AppHeader() {
  const t = useTranslations('App');
  return (
    <header className="border-b bg-white px-4 py-3">
      <div className="container mx-auto flex items-center justify-between">
        <span className="text-lg font-semibold">{t('name')}</span>
        <AppNav />
      </div>
    </header>
  );
}
```

**`components/AppNav.tsx`** — navigation placeholder; links are i18n strings so
future stories can fill them in.  Use `Link` from `next-intl/navigation` (not a
plain `<a>`) so the locale prefix is resolved automatically and no locale segment
is hardcoded:
```tsx
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function AppNav() {
  const t = useTranslations('Nav');
  return (
    <nav aria-label={t('ariaLabel')}>
      <ul className="flex gap-4 text-sm">
        <li>
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            {t('home')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
```

Tailwind classes used: `flex`, `gap-4`, `container`, `mx-auto`, `px-4`, `py-3`,
`justify-between`, `text-sm/base/lg` — all responsive without breakpoint
qualifiers at this stage.  No layout breakage at 375 px (phone) or 1280 px
(desktop) because the flex container wraps gracefully.

---

### Step 6 — CLAUDE.md (repo root)

Create `/home/justasandbox/scheduler/CLAUDE.md`:

```markdown
# CLAUDE.md

## Definition of Done

A story is done when ALL of the following are true:

1. **Lint clean** — `npm run lint` exits 0 (Next.js ESLint config).
2. **Type-safe** — `npx tsc --noEmit` exits 0.
3. **Build succeeds** — `npm run build` exits 0.
4. **Tests pass** — `npm run test:e2e` exits 0 (smoke + story-specific tests).
5. **AC coverage** — every acceptance criterion has at least one automated test
   or a documented manual verification step in the story file.
6. **No hardcoded UI strings** — all user-facing text comes from
   `messages/pt-PT.json`; no raw Portuguese (or any language) string literals
   in component JSX.
7. **No regressions** — previously passing tests still pass.

## Quality gates (CI enforces these)

- `npm run lint`
- `npm run build`
- `npm run test:e2e` (Playwright smoke suite)

## Retry budget

Implementation agents have **2 fix cycles** after first review before the issue
is escalated to a human.

## Model routing

| Task                          | Model           |
|-------------------------------|-----------------|
| Story refiner                 | claude-sonnet-4-6 |
| Implementer (standard/complex)| claude-sonnet-4-6 |
| Implementer (trivial only)    | claude-haiku    |

## Complexity classification

- **trivial** — mechanical change, single file, no reasoning risk (text/config
  tweak, one-line bug fix with obvious cause).
- **standard** — multi-file, requires understanding of at least two modules or
  a cross-cutting concern; default for most stories.
- **complex** — auth, data integrity, concurrency, money, security, or three or
  more interacting systems.

When in doubt, classify as `standard`.
```

---

### Step 7 — Environment wiring

Create `.env.example` (committed to the repo; never contains real secrets):
```
# Supabase — wired in STORY-02. Copy to .env.local and fill in real values.
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Verify that `.gitignore` (generated by create-next-app) already includes
`.env.local` and `.env*.local`.  Do not commit `.env.local`.

---

### Step 8 — GitHub Actions CI workflow

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Smoke test
        run: npm run test:e2e
```

**Vercel deploy** — no secrets go in the workflow.  Instead, the human (Simão)
connects the GitHub repository to a Vercel project via the Vercel dashboard
(`vercel.com → New Project → Import Git Repository`).  Vercel then auto-deploys
every push to `main` and publishes a public URL.  This is a one-time manual step
documented in the story's manual verification section.

---

### Step 9 — Smoke test (Playwright)

Install:
```
npm install --save-dev @playwright/test
```

Add to `package.json` scripts:
```json
"test:e2e": "playwright test"
```

**`playwright.config.ts`**:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    // In CI the `npm run build` step has already run and .next/ exists;
    // use `npm start` here to avoid building twice and to prevent port
    // conflicts.  Locally (non-CI) `reuseExistingServer: true` means you
    // can run `npm run dev` separately and Playwright reuses that process.
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

**`e2e/smoke.spec.ts`**:
```ts
import { test, expect } from '@playwright/test';

test('home route returns HTTP 200', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
});

test('responsive shell: header, nav and main content area present at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
});

test('responsive shell: no horizontal overflow at mobile width (375 px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  // Assert no horizontal scrollbar — page content must fit within 375 px
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
});

test('app name rendered from i18n catalog', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header')).toContainText('Escala');
});
```

---

### Test plan — AC coverage

| AC | What verifies it | Automated? |
|----|-----------------|------------|
| AC1 — compiles, lints clean | `npm run lint` + `npm run build` (CI) | Yes |
| AC2 — responsive shell renders at mobile & desktop | Playwright: `header`, `nav`, `main` visible at 1280 px and at 375 px; `scrollWidth <= 375` assertion guards against horizontal overflow | Yes (automated at both viewports) |
| AC3 — all UI text from i18n, pt-PT active | Playwright: assert `header` contains `"Escala"` (from `messages/pt-PT.json`); all ARIA labels use `t()` — no raw strings in JSX; CLAUDE.md DoD rule 6 enforced at review | Partial (value check); DoD gate |
| AC4 — deployed to free host, public URL reachable | Manual: coordinator connects repo to Vercel dashboard; CI badge shows green; public URL accessible | Manual (one-time Vercel setup) |
| AC5 — home route returns HTTP 200 | Playwright: `response.status() === 200` | Yes |

---

### Risks and rollback

**Risk 1: next-intl v4 API break.**
The plan uses v3 APIs (`createMiddleware`, `createNavigation`, `defineRouting`).
Step 2 installs `next-intl@^3` explicitly so v4 is never resolved
automatically.  If v4 is required in a future story, the plan must be updated
before implementation begins.

**Risk 2: Root layout html/body conflict.**
If Next.js complains that `app/layout.tsx` lacks `<html>` and `<body>`, change
the root layout to a full passthrough that renders children directly (no wrapping
tags) and ensure the locale layout has all required tags.  Follow the official
next-intl "App Router" example exactly.

**Risk 3: `create-next-app` flag changes.**
`--no-src-dir` may differ across versions.  Run interactively if any flag
errors occur; the answers are: TypeScript yes, ESLint yes, Tailwind yes, src dir
no, App Router yes, alias `@/*`.

**Risk 4: Vercel project setup.**
Vercel connection is a human step.  The CI pipeline passes independently.  If
the Vercel deploy URL is not yet available when AC4 is verified, AC4 passes once
the Vercel project is created and a first deploy completes.

**Rollback:**
This is a greenfield story with no database writes or auth.  If the scaffold
needs to be reset, `git reset --hard <initial-commit>` restores the repo to the
docs-only state.  No data or secrets are at risk.

---

Complexity: standard
